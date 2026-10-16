# Handoff Prompt — Integrasi CIS FortiGate Rule Set ke Firewall Audit Analyzer

> **Cara pakai:** Salin seluruh isi file ini ke AI coding assistant yang mengerjakan project **Firewall Audit Analyzer**. Prompt ini dirancang untuk mengintegrasikan katalog 64 rule CIS FortiGate ke sistem yang sudah ada, dengan arsitektur yang **siap multi-vendor**.

---

## KONTEKS PROYEK

Kamu melanjutkan pengembangan aplikasi **Firewall Audit Analyzer** — platform web berbasis **upload config backup** (BUKAN koneksi langsung ke firewall). Sistem sudah memiliki: autentikasi (Supabase), dashboard dengan scoring, manajemen per-company, device inventory, upload config, audit result, findings, dan report history.

Stack: **Next.js + Tailwind + Supabase (Auth + PostgreSQL + Storage)**. Parser/audit engine berjalan sebagai proses analisa terhadap file config yang di-upload.

**Tugasmu sekarang:** Mengganti rule catalog yang masih generik dengan **rule set definitif berbasis CIS FortiGate 7.4.x Benchmark v1.0.1 (64 recommendation)**, dan memastikan arsitekturnya tetap mudah diperluas ke vendor lain (SonicWall, Palo Alto, dll).

---

## PRINSIP WAJIB (JANGAN DILANGGAR)

1. **Vendor-agnostic core.** Audit engine, scoring, report, dan UI TIDAK BOLEH hardcode logika khusus FortiGate. Semua yang vendor-specific harus berada di layer parser adapter + data rule.
2. **Rule sebagai DATA, bukan kode.** Ke-64 rule disimpan di database/seed sebagai data, sehingga menambah/mengubah rule tidak perlu ubah core.
3. **Upload-based.** Tidak ada koneksi API/SSH ke perangkat. Semua analisa dari file config backup.
4. **Backward compatible.** Jangan rusak fitur existing (login, company, dashboard, report history). Tambahkan lewat migrasi, bukan rewrite.
5. **Full file saat update.** Saat memodifikasi file yang sudah ada, berikan file lengkap yang bisa langsung copy-paste (jangan diff/snippet).
6. **Idempotent seeding.** Script seed rule harus bisa dijalankan ulang tanpa menduplikasi data (upsert by rule code).

---

## BAGIAN 1 — MODEL DATA RULE (WAJIB)

Perbarui/'buat tabel `rules` dengan skema berikut (PostgreSQL/Supabase). Buat migrasi baru, jangan hapus data existing.

```sql
create table if not exists rules (
  id             uuid primary key default gen_random_uuid(),
  vendor         text not null default 'fortigate',   -- siap multi-vendor
  code           text not null,                        -- "2.1.9"
  title          text not null,
  section        text,                                 -- "System Settings > General Settings"
  cis_level      text,                                 -- "L1" | "L2"
  cis_status     text,                                 -- "Automated" | "Manual"
  system_check   text not null,                        -- "auto" | "semi" | "manual"
  severity       text not null,                        -- "Critical" | "High" | "Medium" | "Low"
  config_key     text,                                 -- path/directive utk parser
  expected_value text,                                 -- kondisi lulus (human-readable)
  audit_hint     text,                                 -- perintah CLI / lokasi GUI
  remediation    text,
  default_value  text,
  cis_controls   jsonb default '[]'::jsonb,            -- ["v8 8.9","v7 6.3"]
  benchmark_ref  text default 'CIS FortiGate 7.4.x v1.0.1',
  active         boolean default true,
  created_at     timestamptz default now(),
  unique (vendor, code)
);
```

Tambahkan kolom pada tabel `findings` (jika belum ada):
- `system_check` (auto/semi/manual) — agar UI tahu apakah finding butuh konfirmasi auditor.
- `status` dengan nilai: `open | accepted_risk | false_positive | resolved | not_applicable | pending_confirmation`.
- `cis_code` (referensi ke `rules.code`).

Tambahkan pada tabel `audits`:
- `profile_level` (`L1` | `L1_L2`) — level audit yang dipilih user.

---

## BAGIAN 2 — SEED DATA: 64 RULE CIS FORTIGATE

Buat file seed (mis. `supabase/seed/cis_fortigate_7.4.x.json` + script importer idempotent). Masukkan SELURUH 64 rule berikut. Field: `code | title | section | cis_level | cis_status | system_check | severity | config_key | expected_value`.

### Section 1 — Network Settings
- 1.1 | Ensure DNS server is configured | Network Settings | L1 | Automated | auto | Medium | `config system dns` primary/secondary | DNS terpercaya diisi (bukan default 96.45.45.45)
- 1.2 | Ensure intra-zone traffic is not always allowed | Network Settings | L1 | Manual | semi | Medium | `config system zone` intrazone | intrazone=deny pada zone relevan
- 1.3 | Disable all management services on WAN port | Network Settings | L1 | Manual | semi | Critical | `system interface` allowaccess (WAN) | Tidak ada http/https/ping/ssh/snmp/radius-acct di WAN

### Section 2.1 — System > General Settings
- 2.1.1 | Ensure 'Pre-Login Banner' is set | System > General | L1 | Automated | auto | Low | `system global` pre-login-banner | enable
- 2.1.2 | Ensure 'Post-Login-Banner' is set | System > General | L1 | Automated | auto | Low | `system global` post-login-banner | enable
- 2.1.3 | Ensure timezone is properly configured | System > General | L1 | Automated | auto | Low | `system global` timezone | Sesuai lokasi (bukan default GMT-8)
- 2.1.4 | Ensure correct system time via NTP | System > General | L1 | Manual | semi | Medium | `config system ntp` | NTP terpercaya dikonfigurasi
- 2.1.5 | Ensure hostname is set | System > General | L1 | Automated | auto | Low | `system global` hostname | Bukan default (bukan nomor model)
- 2.1.6 | Ensure the latest firmware is installed | System > General | L2 | Manual | manual | High | `get system status` Version | Bandingkan ke PSIRT/upgrade-tool (eksternal)
- 2.1.7 | Disable USB firmware & config installation | System > General | L2 | Automated | auto | Medium | `system auto-install` | auto-install-config & image = disable
- 2.1.8 | Disable static keys for TLS | System > General | L2 | Automated | auto | Medium | `system global` ssl-static-key-ciphers | disable
- 2.1.9 | Enable Global Strong Encryption | System > General | L2 | Automated | auto | High | `system global` strong-crypto | enable
- 2.1.10 | Mgmt GUI on secure TLS version | System > General | L1 | Automated | auto | High | `system global` admin-https-ssl-versions | tlsv1-3 (min tls1-2)
- 2.1.11 | Ensure CDN enabled for GUI performance | System > General | L2 | Automated | auto | Low | `system global` gui-cdn-usage | enable (bukan kontrol keamanan/informational)
- 2.1.12 | Single CPU core overload logged | System > General | L1 | Automated | auto | Low | `system global` log-single-cpu-high | enable
- 2.1.13 | Hostname not displayed on login GUI | System > General | L2 | Automated | auto | Low | `system global` gui-display-hostname | disable

### Section 2.2 — Password Policy
- 2.2.1 | Ensure 'Password Policy' is enabled | System > Password Policy | L1 | Automated | auto | High | `system password-policy` | status enable, min-length>=14, scope both
- 2.2.2 | Admin password retries & lockout configured | System > Password Policy | L1 | Automated | auto | Medium | `system global` lockout-threshold/duration | threshold<=3, duration<=900

### Section 2.3 — SNMP
- 2.3.1 | Ensure only SNMPv3 is enabled | System > SNMP | L1 | Automated | auto | Medium | `system snmp community`/`user` | Tidak ada community v1/v2c; hanya user v3
- 2.3.2 | Allow only trusted hosts in SNMPv3 | System > SNMP | L2 | Manual | auto | Medium | `snmp user` notify-hosts | IP spesifik, tanpa 0.0.0.0
- 2.3.3 | Disable SNMPv3 Query Per User | System > SNMP | L2 | Automated | auto | Low | `snmp user` queries | disable (user trap-only)
- 2.3.4 | Enable SNMP trap for memory usage | System > SNMP | L1 | Automated | auto | Low | `snmp sysinfo` trap thresholds | trap-free/freeable-memory dikonfigurasi

### Section 2.4 — Administrators & Admin Profiles
- 2.4.1 | Remove default admin, create new name | System > Admins | L1 | Automated | semi | Critical | `system admin` | Tidak ada user "admin" (password kosong = runtime test)
- 2.4.2 | Trusted hosts on all login accounts | System > Admins | L1 | Manual | auto | High | `system admin` trusthostX | Semua akun punya trusted host (bukan 0.0.0.0/0)
- 2.4.3 | Correct admin privilege profiles assigned | System > Admins | L1 | Manual | semi | Medium | `system accprofile` + `system admin` | Least privilege (judgment auditor)
- 2.4.4 | Admin idle timeout configured | System > Admins | L1 | Automated | auto | Medium | `system global` admintimeout | <=15 (ideal 5)
- 2.4.5 | Only encrypted access channels enabled | System > Admins | L1 | Automated | auto | High | `system interface` allowaccess | Tidak ada http/telnet
- 2.4.6 | Apply Local-in Policies | System > Admins | L1 | Automated | auto | Medium | `firewall local-in-policy` | Ada local-in-policy terkonfigurasi
- 2.4.7 | Change default Admin ports | System > Admins | L1 | Automated | auto | Medium | `system global` admin-port/admin-sport | Bukan 80/443; https-redirect disable
- 2.4.8 | Virtual patching on local-in mgmt | System > Admins | L1 | Automated | auto | Medium | `firewall local-in-policy` virtual-patch | enable (butuh lisensi FMWP)

### Section 2.5 — High Availability
- 2.5.1 | Ensure HA configuration is enabled | System > HA | L2 | Automated | auto | Medium | `system ha` mode | a-a/a-p, group-name & hbdev diisi
- 2.5.2 | Enable Monitor Interfaces for HA | System > HA | L1 | Automated | auto | Medium | `system ha` monitor | Interface kritis dimonitor
- 2.5.3 | HA Reserved Mgmt Interface configured | System > HA | L1 | Automated | auto | Low | `system ha` ha-mgmt-status | enable + interface/gateway diisi
- 2.5.4 | HA Group-ID configured | System > HA | L2 | Automated | auto | Low | `system ha` group-id | Bukan default 0

### Section 3 — Policy and Objects
- 3.1 | Unused policies reviewed regularly | Policy & Objects | L2 | Manual | manual | Medium | Hit count (runtime) | Butuh review bisnis + runtime
- 3.2 | Policies do not use "ALL" as Service | Policy & Objects | L1 | Automated | auto | High | `firewall policy` service | Tidak ada policy service "ALL"
- 3.3 | Deny traffic to/from Tor/malicious/scanner (ISDB) | Policy & Objects | L1 | Automated | semi | High | `firewall policy` ISDB objects | Ada deny inbound & outbound sesuai daftar ISDB
- 3.4 | Logging enabled on all firewall policies | Policy & Objects | L1 | Automated | auto | High | `firewall policy` logtraffic | Allow=all sessions, Deny=log violation
- (EKSTRA, non-CIS) FW-ANY | Any-Any-Any policy detected | Policy & Objects | - | - | auto | Critical | `firewall policy` srcaddr=all & dstaddr=all & service=ALL | Tidak boleh ada

### Section 4.1 — IPS
- 4.1.1 | Detect Botnet connections | Security Profiles > IPS | L2 | Automated | semi | High | IPS profile scan-botnet-connections | Block, diterapkan ke policy WAN
- 4.1.2 | Apply IPS Profile to Policies | Security Profiles > IPS | L1 | Manual | semi | High | `firewall policy` ips-sensor | IPS di policy antar-interface

### Section 4.2 — Antivirus
- 4.2.1 | AV Definition Push Updates configured | Security Profiles > AV | L2 | Automated | auto | Medium | `system autoupdate schedule` | Automatic
- 4.2.2 | Apply AV Profile to Policies | Security Profiles > AV | L2 | Manual | semi | High | `firewall policy` av-profile | AV di policy relevan
- 4.2.3 | Enable Outbreak Prevention Database | Security Profiles > AV | L2 | Automated | auto | Medium | `antivirus profile` outbreak-prevention | block
- 4.2.4 | Enable AI/heuristic malware detection | Security Profiles > AV | L2 | Automated | auto | Medium | `antivirus settings` machine-learning-detection | enable
- 4.2.5 | Enable grayware detection | Security Profiles > AV | L2 | Automated | auto | Low | `antivirus settings` grayware | enable
- 4.2.6 | Inline scanning FortiGuard AI Sandbox | Security Profiles > AV | L1 | Automated | semi | Medium | `system fortiguard` sandbox-inline-scan + AV profile | enable + fortisandbox block
- 4.2.7 | CDR proxy mode (XLSB/OpenOffice/RTF) | Security Profiles > AV | L2 | Automated | auto | Low | `antivirus profile` (proxy) CDR | Content Disarm aktif utk office files

### Section 4.3 — DNS Filter
- 4.3.1 | Botnet C&C Domain Blocking DNS Filter | Security Profiles > DNS | L2 | Automated | semi | Medium | `dnsfilter profile` redirect botnet C&C | enable + diterapkan
- 4.3.2 | DNS Filter logs all queries & responses | Security Profiles > DNS | L1 | Automated | auto | Low | `dnsfilter profile` log-all-domain | enable
- 4.3.3 | Apply DNS Filter to Policies | Security Profiles > DNS | L1 | Automated | semi | Medium | `firewall policy` dnsfilter-profile | Diterapkan pada traffic ke Internet

### Section 4.4 — Web Filtering
- 4.4.1 | Create a Web Filtering Profile | Security Profiles > Web | L1 | Automated | semi | Medium | `webfilter profile` Security Risk categories | Malicious/Phishing/Spam URL = Block

### Section 4.5 — Application Control
- 4.5.1 | Block high risk categories | Security Profiles > App | L1 | Manual | semi | Medium | `application list` P2P/Proxy | Block
- 4.5.2 | Block apps on non-default ports | Security Profiles > App | L2 | Automated | auto | Low | `application list` enforce-default-app-port | enable
- 4.5.3 | All App Control traffic logged | Security Profiles > App | L1 | Manual | auto | Low | `application list` (no "Allow" action) | Semua Monitor/Block
- 4.5.4 | Apply App Control to Policies | Security Profiles > App | L1 | Manual | semi | Medium | `firewall policy` application-list | Diterapkan pada policy antar-interface

### Section 5 — Security Fabric
- 5.1.1 | Enable Compromised Host Quarantine | Security Fabric > Automation | L1 | Automated | semi | Medium | `system automation-stitch` | Stitch quarantine enable (jika pakai Fabric)
- 5.2.1.1 | Ensure Security Fabric is Configured | Security Fabric > Fabric Connectors | L2 | Manual | semi | Low | Security Fabric setup | Root fabric enable (jika fitur dipakai)

### Section 6 — VPN
- 6.1.1 | Trusted Signed Cert for VPN Portal | VPN > SSL VPN | L2 | Automated | semi | High | `vpn ssl settings` server-certificate | Bukan self-signed/factory
- 6.1.2 | Limited TLS Versions for SSL VPN | VPN > SSL VPN | L2 | Automated | auto | High | `vpn ssl settings` | max tls1-3, min tls1-2, algorithm high

### Section 7 — Logs and Reports
- 7.1.1 | Enable Event Logging | Logs > Enable Logging | L2 | Automated | auto | Medium | `log eventfilter` event | enable (semua event)
- 7.2.1 | Centralized Logging & Reporting | Logs > Centralized | L2 | Automated | auto | High | `log syslogd`/`fortianalyzer setting` | Log dikirim ke SIEM/FAZ/syslog
- 7.3.1 | Encrypt logs to FortiAnalyzer/FortiManager | Logs > Encrypt | L1 | Automated | auto | Medium | `log fortianalyzer setting` | reliable enable, enc-algorithm high
- 7.3.2 | Encrypt logs to Syslog | Logs > Encrypt | L1 | Manual | auto | Medium | `log syslog setting` | reliable enable, enc-algorithm high

> **CATATAN DEDUP:** CIS 7.3.3 identik dengan 7.3.2 (editorial duplicate). Implementasikan HANYA SEKALI (7.3.2). Jangan buat rule 7.3.3 agar tidak double-penalty pada scoring.

---

## BAGIAN 3 — PARSER FORTIGATE (Adapter)

Implementasikan `FortiGateParser` yang mengubah config backup `.conf` menjadi **NormalizedConfig** (vendor-agnostic). Parser harus:

1. Membaca blok `config ... end` dan `edit ... next` secara rekursif menjadi struktur objek.
2. Meng-expose data yang dibutuhkan seluruh `config_key` di atas (system global, interface, admin, accprofile, snmp, ha, dns, ntp, firewall policy, address/service objects, security profiles, vpn ssl settings, log settings).
3. Tahan terhadap perbedaan kecil antar versi FortiOS (jangan crash bila directive tidak ada → anggap default/absent).

Interface WAJIB (agar multi-vendor):
```ts
interface FirewallParser {
  vendor: string;
  detect(raw: string): boolean;        // auto-detect vendor dari isi file
  parse(raw: string): NormalizedConfig;
}
```
Daftarkan ke `ParserRegistry`. JANGAN memanggil FortiGateParser langsung dari core — selalu lewat registry berdasarkan vendor terdeteksi/terpilih.

---

## BAGIAN 4 — AUDIT ENGINE

1. Engine menerima `NormalizedConfig` + `profile_level` (L1 atau L1_L2) + daftar `rules` (difilter by `vendor` & `active`).
2. Untuk setiap rule:
   - `system_check = auto` → jalankan checker deterministik → set finding `pass`/`fail`.
   - `system_check = semi` → jalankan checker, hasilkan finding berstatus **`pending_confirmation`** + lampirkan bukti config yang ditemukan.
   - `system_check = manual` → buat finding kosong berstatus **manual** untuk diisi auditor.
3. Filter berdasarkan `cis_level`: jika audit L1 saja, rule L2 di-skip (jangan dihitung di skor).
4. Dukung status **`not_applicable`** (mis. fitur/lisensi tidak dipakai) — dikeluarkan dari perhitungan skor, wajib ada justifikasi.
5. Checker ditulis modular per rule (map `code -> checkerFn(normalizedConfig)`), sehingga menambah rule = menambah entri map, bukan mengubah engine.

---

## BAGIAN 5 — SCORING

1. Skor dihitung HANYA atas rule yang: `active`, sesuai `profile_level`, dan TIDAK `not_applicable`.
2. Bobot penalti default (boleh dikonfigurasi di Settings):
   - Critical = 25, High = 12, Medium = 5, Low = 2.
3. `score = max(0, 100 − Σ(bobot × jumlah finding fail severity tsb))`.
4. Finding `pending_confirmation` diperlakukan sebagai **fail sementara** sampai auditor konfirmasi (agar skor konservatif) — beri indikator visual bahwa skor masih provisional.
5. Finding `accepted_risk` / `false_positive` DIKELUARKAN dari penalti (dengan jejak audit).
6. Simpan `score_breakdown` per section (Network, System, Policy, Security Profiles, Fabric, VPN, Logs).
7. `cis_level` & `severity` disimpan TERPISAH — jangan campur (L1/L2 = kepraktisan CIS, severity = risiko untuk scoring).

---

## BAGIAN 6 — PERUBAHAN UI

1. **Halaman Upload:** tambah pilihan **Audit Profile Level** (L1 / L1+L2). Tampilkan vendor auto-detected.
2. **Audit Result:** 
   - Kelompokkan findings per **section CIS** (Network Settings, System Settings, dst).
   - Tampilkan badge `CIS <code>`, `L1/L2`, dan indikator tier (`auto`/`semi`/`manual`).
   - Findings `pending_confirmation` diberi tombol **Confirm / Override** untuk auditor.
   - Findings `manual` diberi form input untuk auditor mengisi hasil.
3. **Finding Detail:** tampilkan `config_key`, `expected_value`, `audit_hint` (perintah CLI), `remediation`, `default_value`, dan `cis_controls` (mapping v7/v8).
4. **Report:** sertakan section breakdown + kolom compliance mapping CIS Controls. Tandai jelas mana yang auto vs dikonfirmasi auditor.

---

## BAGIAN 7 — KESIAPAN MULTI-VENDOR (PENTING)

Karena vendor lain (SonicWall, Palo Alto, Cisco ASA) akan ditambahkan nanti, PASTIKAN:

1. Kolom `vendor` ada di `rules`, `devices`, `audits`.
2. Rule di-query selalu dengan filter `where vendor = <device.vendor>`. JANGAN pernah asumsikan semua rule = FortiGate.
3. Rule yang universal (mis. any-any policy, logging enabled, admin trusted host) BOLEH diberi `vendor = 'common'` dan diterapkan lintas vendor bila NormalizedConfig menyediakan datanya.
4. Menambah vendor baru HARUS cukup dengan: (a) buat parser adapter baru + daftarkan ke registry, (b) buat file seed rule vendor tsb, (c) TANPA mengubah audit engine, scoring, atau UI.
5. Buat dokumentasi singkat `docs/ADD_NEW_VENDOR.md` berisi langkah menambah vendor.

> **Catatan tentang benchmark SonicWall:** CIS Benchmark bersifat per-vendor & per-versi, sehingga katalog FortiGate ini TIDAK valid untuk SonicWall. Saat menambah SonicWall, gunakan benchmark/hardening guide milik SonicWall (atau standar internal) dan tuangkan ke skema `rules` yang SAMA. Struktur sistem tidak berubah — hanya data rule + parser yang bertambah.

---

## BAGIAN 8 — DELIVERABLES & URUTAN KERJA

Kerjakan bertahap, buat checklist, dan pastikan tiap tahap tidak merusak fitur existing:

1. [ ] Migrasi DB: tabel `rules` + kolom baru di `findings`/`audits`.
2. [ ] File seed 64 rule + importer idempotent (upsert by vendor+code).
3. [ ] `FortiGateParser` + `NormalizedConfig` + `ParserRegistry`.
4. [ ] Audit engine + checker map (auto/semi/manual) + filter level + N/A.
5. [ ] Scoring engine + score_breakdown per section.
6. [ ] Update UI: Upload (level), Audit Result (section grouping + confirm/override), Finding Detail, Report.
7. [ ] `docs/ADD_NEW_VENDOR.md`.
8. [ ] Uji dengan minimal 1 file config FortiGate contoh; pastikan skor & findings muncul benar.

Setelah selesai, berikan ringkasan file yang dibuat/diubah dan cara menjalankan migrasi + seed.

---

## OUTPUT YANG DIHARAPKAN DARI KAMU (AI CODING)

- Kode lengkap per file (bukan snippet) untuk file yang dibuat/diubah.
- Script migrasi & seed yang bisa langsung dijalankan.
- Tidak ada logika FortiGate yang bocor ke core.
- Konfirmasi bahwa fitur existing tetap berjalan.
