# PRD — Firewall Audit Analyzer

**Dokumen:** Product Requirements Document (PRD)
**Nama Produk (kerja):** Firewall Audit Analyzer
**Versi Dokumen:** 1.0
**Tanggal:** 28 Juli 2026
**Penyusun:** Adhitya (Network & Systems Specialist)
**Status:** Draft untuk eksekusi

---

## 1. Ringkasan Eksekutif

Firewall Audit Analyzer adalah platform berbasis web untuk melakukan **audit dan review konfigurasi firewall secara mendalam** berdasarkan **file backup konfigurasi** yang di-upload oleh user (BUKAN koneksi langsung ke perangkat firewall).

Sistem menganalisa config, mendeteksi temuan (findings), memberikan **skor keamanan (scoring)**, memetakan temuan ke standar (CIS, NIST, ISO 27001, Cyber Trust Mark), dan menghasilkan **laporan audit** yang tersimpan dan dapat dibuka kembali (report history) per perusahaan/client.

Dirancang **multi-vendor** sejak awal. Rilis pertama fokus **FortiGate**, namun arsitektur parser bersifat **plugin/adapter** sehingga vendor lain (SonicWall, Palo Alto, Cisco ASA, dll) dapat ditambahkan **tanpa mengubah core system**.

### 1.1 Prinsip Desain Utama
1. **Offline-first / upload-based** — tidak ada koneksi langsung ke firewall.
2. **Multi-tenant per company** — data dikelompokkan berdasarkan nama perusahaan/client.
3. **Vendor-agnostic core** — logika audit tidak terikat pada satu brand.
4. **Extensible by design** — tambah vendor = tambah plugin parser + rule set, bukan rombak sistem.
5. **Auditable & repeatable** — setiap audit tersimpan sebagai report historis dengan skor.

---

## 2. Tujuan & Non-Tujuan

### 2.1 Tujuan (Goals)
- Menerima upload file backup konfigurasi firewall.
- Melakukan parsing dan **analisa mendalam** terhadap konfigurasi.
- Mendeteksi temuan keamanan (config hardening + firewall rule review).
- Menghitung **skor keamanan** untuk tiap audit dan menampilkannya di dashboard.
- Menyimpan histori laporan per company dan menampilkannya kembali kapan saja.
- Menghasilkan laporan (Executive Summary + Technical) yang dapat diexport (PDF/DOCX).
- Mendukung penambahan vendor firewall baru dengan mudah.

### 2.2 Non-Tujuan (Out of Scope untuk v1)
- Koneksi langsung ke firewall via API/SSH.
- Real-time syslog ingestion / log collector.
- Auto-remediation / push config ke firewall.
- Real-time bandwidth monitoring.
- Multi-vendor lengkap (v1 hanya FortiGate; struktur sudah siap untuk brand lain).

---

## 3. Persona & Peran Pengguna

| Peran | Deskripsi | Akses Utama |
|---|---|---|
| **Admin** | Mengelola user, company, dan konfigurasi sistem | Full akses |
| **Auditor / Engineer** | Upload config, jalankan audit, edit findings, buat report | Buat & edit audit/report |
| **Viewer / Client** | Melihat report & skor untuk company tertentu (read-only) | Read-only per company |

> Catatan: v1 minimal wajib mendukung **Admin** dan **Auditor**. Viewer/Client bisa masuk sebagai fase berikutnya, namun skema role harus sudah disiapkan sejak awal.

---

## 4. Alur Kerja Utama (User Flow)

```text
Login
  ↓
Dashboard (ringkasan skor & findings semua company)
  ↓
Pilih / Buat Company (client)
  ↓
Upload Firewall Config Backup  →  Pilih Vendor (FortiGate / SonicWall / ...)
  ↓
System deteksi vendor & parsing config
  ↓
Audit Engine menjalankan rule set sesuai vendor
  ↓
Findings dihasilkan + Skor dihitung
  ↓
Halaman Audit Result (findings, rule review, skor, mapping compliance)
  ↓
Auditor review / edit / tambah catatan / upload evidence
  ↓
Generate Report  →  tersimpan ke Report History
  ↓
Export PDF / DOCX  (opsional)
```

---

## 5. Kebutuhan Fungsional (Functional Requirements)

### 5.1 Autentikasi & Otorisasi
- **FR-1** Login menggunakan email + password (Supabase Auth).
- **FR-2** Session management + logout.
- **FR-3** Role-based access control (Admin / Auditor / Viewer).
- **FR-4** (Opsional v1.1) MFA untuk akun Admin.
- **FR-5** Viewer hanya dapat melihat company yang di-assign kepadanya.

### 5.2 Dashboard
- **FR-6** Menampilkan ringkasan lintas company:
  - Total company
  - Total firewall/device yang diaudit
  - Total audit/report yang pernah dibuat
  - Distribusi findings (Critical / High / Medium / Low)
  - **Skor keamanan rata-rata** & tren skor
- **FR-7** Kartu skor per company (company card) dengan skor terbaru + status (warna).
- **FR-8** Daftar audit terbaru (recent audits) dengan skor & tanggal.
- **FR-9** Filter dashboard berdasarkan company, vendor, dan rentang tanggal.

### 5.3 Managed Firewall by Company
- **FR-10** CRUD company/client (nama perusahaan, kontak, catatan).
- **FR-11** Setiap company memiliki daftar firewall device (inventory).
- **FR-12** Data device: hostname, vendor, model, versi OS, serial (jika ada di config), lokasi, tanggal backup, tanggal audit terakhir.
- **FR-13** Data device otomatis terisi dari hasil parsing config bila tersedia.
- **FR-14** Semua audit & report dikelompokkan berdasarkan company.

### 5.4 Upload & Parsing Config
- **FR-15** Upload file config backup (mendukung `.conf`, `.txt`, `.cfg`, `.xml`, `.json`, `.zip`).
- **FR-16** User memilih vendor secara manual **atau** sistem melakukan **auto-detect vendor** dari isi file (best-effort).
- **FR-17** File mentah disimpan ke object storage (untuk evidence & re-analisa).
- **FR-18** Parser mengubah config menjadi **model data ternormalisasi (Normalized Config Model)** yang vendor-agnostic.
- **FR-19** Jika vendor belum didukung, tampilkan pesan jelas + tetap simpan file (queued for future support).
- **FR-20** Validasi ukuran & tipe file, serta penanganan error parsing yang informatif.

### 5.5 Audit Engine
- **FR-21** Menjalankan **rule set** terhadap Normalized Config Model.
- **FR-22** Rule set terdiri dari 2 kategori:
  - **Config/Hardening rules** (admin security, management access, logging, firmware, dsb).
  - **Firewall Rule Review** (any-any, unused, duplicate, no logging, exposed mgmt, dll).
- **FR-23** Setiap rule menghasilkan finding dengan: judul, deskripsi, severity, bukti (config snippet), rekomendasi, dan mapping compliance.
- **FR-24** Rule dapat bersifat **common (semua vendor)** atau **vendor-specific**.
- **FR-25** Auditor dapat: menandai finding sebagai *accepted risk / false positive*, menambah catatan, dan menambah finding manual.
- **FR-26** Auditor dapat upload screenshot/evidence pada finding.

### 5.6 Scoring System
- **FR-27** Setiap audit menghasilkan **skor 0–100** dan **grade** (mis. A/B/C/D/F).
- **FR-28** Skor dihitung berdasarkan bobot severity findings terhadap total kontrol yang diperiksa (lihat Bagian 8).
- **FR-29** Skor ditampilkan di: dashboard, halaman company, halaman audit result, dan di dalam report.
- **FR-30** Skor historis disimpan agar tren dapat ditampilkan (naik/turun antar audit).
- **FR-31** Breakdown skor per kategori (Access Control, Logging, Rulebase, dst).

### 5.7 Report & Report History
- **FR-32** Generate report dari hasil audit (Executive Summary + Technical Report).
- **FR-33** Semua report tersimpan (report history) dan dapat dibuka kembali kapan saja.
- **FR-34** Report history dapat difilter per company, vendor, tanggal, dan skor.
- **FR-35** Report bersifat *snapshot* — mencerminkan kondisi saat audit dibuat (immutable setelah finalisasi).
- **FR-36** Export report ke **PDF** dan/atau **DOCX**.
- **FR-37** Report mencakup: skor, ringkasan temuan, detail findings, rule review, dan compliance mapping.
- **FR-38** Perbandingan antar report (opsional v1.1): bandingkan skor & findings audit lama vs baru.

### 5.8 Compliance Mapping
- **FR-39** Setiap finding dapat dipetakan ke satu atau lebih framework: **CIS Benchmark, NIST CSF, NIST SP 800-41, ISO 27001, Cyber Trust Mark**.
- **FR-40** Mapping tersimpan sebagai metadata rule (bukan hardcode di UI).

---

## 6. Arsitektur Sistem

### 6.1 Gambaran Umum

```text
┌────────────────────────────────────────────────────────────┐
│                        FRONTEND (Web)                        │
│                  Next.js + Tailwind + shadcn                 │
│  Dashboard · Company · Upload · Audit Result · Reports       │
└───────────────┬────────────────────────────────────────────┘
                │  REST / RPC
┌───────────────▼────────────────────────────────────────────┐
│                      BACKEND / API LAYER                     │
│         Next.js Route Handlers  atau  Python FastAPI         │
│  Auth · Company Mgmt · Upload Handler · Audit Orchestrator   │
└───────────────┬────────────────────────────────────────────┘
                │
      ┌─────────┴──────────┬──────────────────┬───────────────┐
      ▼                    ▼                  ▼               ▼
┌───────────┐      ┌──────────────┐   ┌──────────────┐  ┌──────────┐
│  Parser   │      │  Audit Rule  │   │  Scoring     │  │  Report  │
│  Registry │─────▶│  Engine      │──▶│  Engine      │─▶│ Generator│
│ (Plugins) │      │ (Rule Sets)  │   │              │  │ PDF/DOCX │
└───────────┘      └──────────────┘   └──────────────┘  └──────────┘
      │                                                       │
      ▼                                                       ▼
┌──────────────────────────────────────────────────────────────┐
│   DATABASE (PostgreSQL / Supabase) + OBJECT STORAGE            │
│   companies · devices · audits · findings · reports · scores  │
│   raw config files · evidence images · generated reports      │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Rekomendasi Stack
| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend | Next.js + Tailwind (+ shadcn/ui) | Sesuai keahlian existing, cepat, UI konsisten |
| Auth | Supabase Auth | Sederhana, mendukung role/RLS |
| Database | PostgreSQL (Supabase) | Relasional, cocok untuk data ternormalisasi |
| Object Storage | Supabase Storage / S3-compatible | Simpan config mentah, evidence, report |
| Parser & Audit Engine | Python (FastAPI worker) **atau** Node.js service | Python unggul untuk parsing/analisa teks config |
| Report Generator | HTML template → PDF (mis. Puppeteer/WeasyPrint) & DOCX | Fleksibel, mudah styling |

> **Catatan arsitektur:** Parsing config berat sebaiknya dijalankan di worker/service terpisah (Python) agar tidak membebani serverless function. Untuk MVP kecil, parser bisa berjalan sebagai job async yang dipicu setelah upload.

---

## 7. Desain Multi-Vendor (Extensibility) — BAGIAN KUNCI

Tujuan: menambah brand baru (SonicWall, Palo Alto, Cisco ASA, dll) **tanpa mengubah core**. Dicapai melalui 3 pilar: **Parser Adapter**, **Normalized Config Model**, dan **Rule Set modular**.

### 7.1 Pilar 1 — Parser Adapter (Plugin Pattern)

Setiap vendor punya adapter sendiri yang mengimplementasikan **interface/kontrak yang sama**:

```text
interface FirewallParser {
  vendor: string                 // "fortigate", "sonicwall", "paloalto"
  detect(rawConfig): boolean     // auto-detect apakah file ini milik vendor tsb
  parse(rawConfig): NormalizedConfig  // ubah ke model ternormalisasi
}
```

Adapter didaftarkan ke **Parser Registry**:

```text
ParserRegistry
 ├─ FortiGateParser   (v1)
 ├─ SonicWallParser   (v2 - tinggal tambah file)
 ├─ PaloAltoParser    (v3 - tinggal tambah file)
 └─ CiscoASAParser    (future)
```

Menambah vendor baru = **buat 1 file adapter baru + daftarkan**. Core (audit engine, scoring, report, UI) tidak perlu diubah.

### 7.2 Pilar 2 — Normalized Config Model (Vendor-Agnostic)

Semua vendor diterjemahkan ke satu model umum. Audit engine hanya "berbicara" dengan model ini, bukan format asli vendor.

```text
NormalizedConfig {
  device: {
    vendor, model, os_version, hostname, serial, ha_status
  }
  admin_accounts: [
    { name, mfa_enabled, trusted_hosts[], profile, password_policy }
  ]
  management_access: {
    https, http, ssh, telnet, snmp, allowed_from_wan, trusted_hosts[]
  }
  logging: {
    traffic_log, security_log, remote_log_enabled, remote_targets[]
  }
  interfaces: [
    { name, zone, ip, allowaccess[] }
  ]
  firewall_rules: [
    {
      id, name, src_zone, dst_zone, src[], dst[], service[],
      action, logging_enabled, profiles[], enabled, comment,
      schedule, last_used(optional)
    }
  ]
  address_objects: [ { name, type, value, used } ]
  service_objects: [ { name, protocol, port, used } ]
  vpn: {
    ssl_vpn_enabled, ipsec_enabled, users[], encryption, mfa_enabled
  }
  system: { firmware, ntp, dns, backup_configured }
}
```

> Jika vendor tertentu tidak punya suatu field, field tersebut `null` — dan rule terkait cukup di-skip / ditandai *not applicable*.

### 7.3 Pilar 3 — Rule Set Modular

Rule disimpan sebagai definisi (kode/JSON) dengan atribut:

```text
Rule {
  id: "ADM-001"
  title: "Admin MFA tidak aktif"
  applies_to: ["common"]        // atau ["fortigate"], ["sonicwall"]
  category: "Access Control"
  severity: "High"
  check(NormalizedConfig): Finding | null
  recommendation: "..."
  compliance: ["CIS", "NIST CSF", "ISO27001", "CTM"]
}
```

- **Common rules** → berlaku untuk semua vendor (mis. "admin tanpa MFA", "any-any rule").
- **Vendor-specific rules** → hanya jalan untuk vendor tertentu.
- Menambah vendor cukup menambah rule vendor-specific bila diperlukan; common rules langsung berlaku begitu adapter menghasilkan Normalized Config.

### 7.4 Ringkasan: Cara Menambah Vendor Baru (mis. SonicWall)
1. Buat `SonicWallParser` yang implement interface `FirewallParser`.
2. Daftarkan ke Parser Registry.
3. (Opsional) Tambah rule vendor-specific SonicWall bila ada.
4. Selesai — dashboard, scoring, report, dan common rules otomatis berlaku.

---

## 8. Scoring System (Detail)

### 8.1 Prinsip
Skor mencerminkan seberapa aman konfigurasi terhadap total kontrol yang diperiksa, dengan **bobot berdasarkan severity**.

### 8.2 Bobot Severity (default, dapat dikonfigurasi)
| Severity | Bobot Penalti |
|---|---|
| Critical | 25 |
| High | 12 |
| Medium | 5 |
| Low | 2 |
| Info | 0 |

### 8.3 Rumus Skor (contoh sederhana & mudah dijelaskan)
```text
base_score = 100
penalty = Σ (bobot_severity × jumlah_finding_severity_tsb)
score = max(0, base_score − penalty)
```

Opsi alternatif (normalisasi terhadap jumlah kontrol) dapat digunakan bila diinginkan skor yang lebih stabil:
```text
score = 100 × (kontrol_lolos / total_kontrol_berlaku)   // disesuaikan bobot
```

### 8.4 Grade
| Skor | Grade | Status |
|---|---|---|
| 90–100 | A | Excellent 🟢 |
| 75–89 | B | Good 🟢 |
| 60–74 | C | Fair 🟡 |
| 40–59 | D | Poor 🟠 |
| 0–39 | F | Critical 🔴 |

### 8.5 Breakdown per Kategori
Skor juga dipecah per kategori agar actionable:
- Access Control
- Management / Hardening
- Logging & Monitoring
- Firewall Rulebase
- VPN
- Network Segmentation

> Finding yang ditandai *accepted risk / false positive* oleh auditor dikeluarkan dari perhitungan penalti (dengan jejak audit).

---

## 9. Katalog Rule Awal (FortiGate v1)

### 9.1 Access Control / Admin
| ID | Rule | Severity |
|---|---|---|
| ADM-001 | Admin tanpa MFA | High |
| ADM-002 | Shared admin account | High |
| ADM-003 | Trusted host tidak dikonfigurasi | Medium |
| ADM-004 | Password policy lemah | Medium |

### 9.2 Management Access / Hardening
| ID | Rule | Severity |
|---|---|---|
| MGT-001 | HTTP management aktif | High |
| MGT-002 | Telnet aktif | High |
| MGT-003 | Management interface exposed ke WAN | Critical |
| MGT-004 | SNMP tidak aman (community default) | Medium |
| SYS-001 | Firmware sudah tidak didukung / outdated | High |
| SYS-002 | NTP tidak dikonfigurasi | Low |
| SYS-003 | Backup config tidak aktif | Medium |

### 9.3 Logging & Monitoring
| ID | Rule | Severity |
|---|---|---|
| LOG-001 | Traffic logging nonaktif | Medium |
| LOG-002 | Security logging nonaktif | High |
| LOG-003 | Tidak ada remote log (Syslog/FortiAnalyzer) | High |

### 9.4 Firewall Rulebase (Rule Review)
| ID | Rule | Severity |
|---|---|---|
| FW-001 | Any source + Any destination + Any service | Critical |
| FW-002 | Management port (RDP/SSH) exposed dari Internet | Critical |
| FW-003 | Allow rule tanpa logging | High |
| FW-004 | Inbound rule tanpa security profile (IPS/AV) | High |
| FW-005 | Rule duplikat | Medium |
| FW-006 | Rule disabled/obsolete masih tersimpan | Low |
| FW-007 | Temporary rule tanpa schedule/expiry | Medium |
| FW-008 | Rule tanpa comment/owner | Low |
| FW-009 | Unused address/service object | Low |

### 9.5 VPN
| ID | Rule | Severity |
|---|---|---|
| VPN-001 | SSL VPN tanpa MFA | High |
| VPN-002 | Enkripsi lemah | High |
| VPN-003 | User VPN nonaktif belum dihapus | Low |

### 9.6 Network Segmentation
| ID | Rule | Severity |
|---|---|---|
| NET-001 | User dan Server VLAN tidak dipisah | Medium |
| NET-002 | DMZ tidak dikonfigurasi | Medium |
| NET-003 | Management network tidak terisolasi | High |

> Rule bertanda kategori **common** akan otomatis berlaku ke vendor lain begitu adapter tersedia.

---

## 10. Skema Database (Ringkas)

```text
users
  id, email, role (admin|auditor|viewer), created_at

companies
  id, name, contact_person, contact_email, notes, created_at

company_access            -- untuk viewer/client per company
  id, user_id, company_id

devices
  id, company_id, vendor, model, os_version, hostname,
  serial, ha_status, location, last_backup_date, created_at

audits
  id, company_id, device_id, vendor, config_file_path,
  status (queued|parsing|done|failed),
  score, grade, created_by, created_at

findings
  id, audit_id, rule_id, title, description, category,
  severity, evidence_snippet, recommendation,
  compliance_tags[], status (open|accepted_risk|false_positive|resolved),
  auditor_note, is_manual, created_at

finding_evidence
  id, finding_id, image_path, caption

score_breakdown
  id, audit_id, category, category_score

reports
  id, audit_id, company_id, type (executive|technical|monthly),
  file_path_pdf, file_path_docx, snapshot_json, finalized (bool), created_at

rules                      -- opsional: rule sebagai data (bukan hardcode)
  id, code, title, applies_to[], category, severity,
  recommendation, compliance_tags[], active
```

---

## 11. Daftar Halaman (Page List)

| # | Halaman | Fungsi |
|---|---|---|
| 1 | Login | Autentikasi |
| 2 | Dashboard | Ringkasan skor, findings, tren, per company |
| 3 | Company List | Daftar & CRUD company |
| 4 | Company Detail | Device inventory + histori audit + skor company |
| 5 | Upload Config | Upload file + pilih/auto-detect vendor |
| 6 | Audit Progress | Status parsing & audit (queued/parsing/done) |
| 7 | Audit Result | Skor, breakdown, findings, rule review, mapping |
| 8 | Finding Detail | Detail finding, evidence, catatan, status |
| 9 | Reports (History) | Daftar report tersimpan + filter + buka kembali |
| 10 | Report Viewer | Tampilan report + tombol export PDF/DOCX |
| 11 | Settings | Manajemen user, role, company access, bobot skor |

---

## 12. Wireframe Konsep (Low-Fidelity)

### 12.1 Dashboard
```text
┌───────────────────────────────────────────────────────────┐
│  Firewall Audit Analyzer            [Search]   [User ▼]     │
├───────────────────────────────────────────────────────────┤
│  [Companies: 12] [Devices: 34] [Audits: 88] [Avg Score:72] │
├───────────────────────────────────────────────────────────┤
│  Findings:  🔴 Critical 6   🟠 High 21   🟡 Med 40  Low 55  │
├───────────────────────────────────────────────────────────┤
│  Company Scorecards                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ PT ABC   │ │ PT XYZ   │ │ Client C │ │ Client D │        │
│  │ Score 84 │ │ Score 61 │ │ Score 45 │ │ Score 92 │        │
│  │ Grade B  │ │ Grade C  │ │ Grade D  │ │ Grade A  │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├───────────────────────────────────────────────────────────┤
│  Recent Audits (company · vendor · score · date)           │
└───────────────────────────────────────────────────────────┘
```

### 12.2 Audit Result
```text
┌───────────────────────────────────────────────────────────┐
│  PT ABC · FortiGate FGT-60F · FortiOS 7.4.3                 │
│  ┌─────────────┐   Score Breakdown                          │
│  │  SCORE  84  │   Access Control ......... 90              │
│  │  Grade  B   │   Management ............. 75              │
│  └─────────────┘   Logging ................ 60              │
│                    Rulebase ............... 88              │
│  Findings (sortable by severity)                            │
│  🔴 FW-001  Any-Any rule ................. [View]           │
│  🟠 ADM-001 Admin tanpa MFA .............. [View]           │
│  🟡 LOG-001 Traffic logging off .......... [View]           │
│  [+ Add Manual Finding]        [Generate Report]            │
└───────────────────────────────────────────────────────────┘
```

---

## 13. Format Report

### 13.1 Executive Summary (untuk management/client non-teknis)
- Nama company & tanggal audit
- **Skor & grade** + status visual
- Ringkasan kondisi keamanan (bahasa sederhana)
- Jumlah temuan per severity
- 3–5 rekomendasi prioritas
- Kesimpulan singkat

### 13.2 Technical Report (untuk engineer)
- Device details
- Skor + breakdown per kategori
- Config/hardening findings (dengan evidence snippet)
- Firewall rule review
- VPN & logging review
- Compliance mapping (CIS / NIST / ISO / CTM)
- Rekomendasi & remediation plan per finding

### 13.3 Monthly/Recurring Report (opsional, MSP style)
- Perbandingan skor bulan ini vs sebelumnya
- Findings baru / findings yang sudah di-remediasi
- Action items

---

## 14. Roadmap & Fase Pengembangan

### Fase 1 — MVP (FortiGate)
- Login + role dasar (Admin, Auditor)
- CRUD company + device inventory
- Upload config + FortiGate parser + Normalized Config Model
- Audit engine + rule set FortiGate (katalog Bagian 9)
- Scoring engine + dashboard skor
- Audit result page + finding detail
- Report generator (Executive + Technical) + report history
- Export PDF

### Fase 2 — Extensibility & Polish
- Tambah vendor kedua (SonicWall) via adapter → validasi arsitektur plugin
- Compliance mapping lengkap + filter
- Export DOCX
- Evidence upload
- Viewer/Client role + company access
- Perbandingan antar report (tren skor)

### Fase 3 — Advanced (Future)
- Auto-detect vendor lebih pintar
- Vendor tambahan (Palo Alto, Cisco ASA)
- (Opsional) modul log analyzer / syslog collector
- (Opsional) integrasi API langsung ke firewall
- AI-assisted finding explanation & remediation

---

## 15. Development Checklist (untuk eksekusi & handoff AI/coder)

### Setup
- [ ] Init project Next.js + Tailwind (+ shadcn/ui)
- [ ] Setup Supabase (Auth + PostgreSQL + Storage)
- [ ] Definisikan schema DB (Bagian 10) + migrasi
- [ ] Setup RLS / role-based access

### Core Domain
- [ ] Modul Auth + role guard
- [ ] CRUD Company
- [ ] Device inventory (auto-fill dari parsing)

### Parser & Audit (Extensible)
- [ ] Definisikan interface `FirewallParser`
- [ ] Buat `NormalizedConfig` model
- [ ] Implementasi `FortiGateParser`
- [ ] Buat Parser Registry + auto-detect
- [ ] Implementasi Rule Engine (common + vendor-specific)
- [ ] Implementasi katalog rule FortiGate (Bagian 9)

### Scoring
- [ ] Scoring engine + bobot severity (Bagian 8)
- [ ] Score breakdown per kategori
- [ ] Simpan skor historis

### UI
- [ ] Dashboard (skor, findings, scorecards, recent audits)
- [ ] Halaman Upload + Audit Progress
- [ ] Audit Result + Finding Detail
- [ ] Reports (History) + Report Viewer

### Report
- [ ] Template Executive + Technical
- [ ] Report generator → simpan snapshot + file
- [ ] Export PDF
- [ ] (Fase 2) Export DOCX

### Validasi Extensibility
- [ ] Tambah `SonicWallParser` sebagai bukti arsitektur plugin bekerja tanpa mengubah core

---

## 16. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Format config antar versi FortiOS berbeda | Parsing gagal | Parser toleran + unit test per versi + simpan raw file |
| Rule audit menghasilkan false positive | Skor tidak akurat | Fitur mark false positive + auditor override |
| Coupling parser ke core | Sulit tambah vendor | Interface parser + Normalized Model (Bagian 7) |
| Data client sensitif | Kebocoran config | Enkripsi storage, akses per-company (RLS), audit log akses |
| Parsing berat memblokir UI | UX buruk | Jalankan sebagai job async + halaman progress |

---

## 17. Kesimpulan

Firewall Audit Analyzer dirancang sebagai platform audit firewall **berbasis upload config**, dengan **dashboard, login, manajemen per company, histori report, dan scoring system** di dashboard maupun tiap report. Kunci keberlanjutan produk ada pada **arsitektur multi-vendor** (Parser Adapter + Normalized Config Model + Rule Set modular), sehingga penambahan brand seperti **SonicWall, Palo Alto, atau Cisco ASA** cukup dilakukan dengan menambah adapter/plugin **tanpa merombak core system**.

Rilis pertama fokus **FortiGate**, dan struktur sudah disiapkan untuk ekspansi vendor pada fase berikutnya.
