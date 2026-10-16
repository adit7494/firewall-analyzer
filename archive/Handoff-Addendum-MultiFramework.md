# Handoff Addendum — Multi-Framework Support (Crosswalk Architecture)

> **Cara pakai:** Salin seluruh isi file ini ke AI coding assistant yang sedang mengerjakan **Firewall Audit Analyzer** (lanjutan dari `Handoff-Prompt-CIS-Integration.md` + addendum sebelumnya). Ini **tambahan**, bukan pengganti — jangan rusak yang sudah jadi.

---

## MASALAH YANG DISELESAIKAN

Sistem sudah punya rule set **CIS FortiGate** yang sangat lengkap & teknis (cek config baris per baris). Namun kita juga ingin mendukung framework lain: **NIST CSF 2.0, NIST SP 800-41, ISO/IEC 27001, PCI DSS, Cyber Trust Mark (Singapore)**.

**Tantangan:** framework lain bersifat **high-level / outcome-based** (governance, kebijakan, proses) — TIDAK sedetail CIS. Jika dipaksa jadi rule teknis, mereka akan "kosong" dan skornya menyesatkan.

**Solusi (WAJIB diikuti): Crosswalk / Mapping Architecture.**
- **CIS = single source of truth untuk cek teknis.** Audit engine TETAP menjalankan rule CIS terhadap config. JANGAN menduplikasi logika cek untuk tiap framework.
- **Framework lain = kumpulan "control" yang DI-MAP ke satu/lebih rule CIS.** Kepatuhan framework diturunkan (derived) dari hasil finding CIS yang sudah ada.
- **Satu kali audit → banyak lensa compliance.** User upload config sekali; hasilnya bisa dilihat dari perspektif CIS / NIST / ISO / PCI / CTM.
- **Coverage transparan.** Karena framework lain tak selengkap CIS, sistem HARUS menampilkan status coverage per control dengan jujur (jangan memalsukan skor).

---

## PRINSIP WAJIB

1. **DRY (Don't Repeat Yourself)** — cek teknis hanya ada di rule CIS. Framework lain TIDAK punya checker sendiri; mereka membaca hasil finding rule yang sudah di-map.
2. **Derived compliance** — status control framework dihitung dari status finding rule yang di-map ke control tsb.
3. **Coverage jujur** — control tanpa mapping teknis ditandai `manual`/`not_covered`, TIDAK dihitung sebagai "pass" otomatis.
4. **Backward compatible** — jangan rusak rule/finding/scoring CIS yang sudah ada. CIS tetap default & utuh.
5. **Extensible** — menambah framework baru = tambah data (framework + controls + mapping), BUKAN ubah engine.
6. **Vendor-agnostic tetap berlaku** — mapping berbasis rule `code`, jadi ketika vendor lain (SonicWall) punya rule sendiri, mapping framework bisa mengikuti pola sama.
7. **Full file saat update** — berikan file lengkap, bukan diff/snippet.

---

## LANGKAH 1 — MODEL DATA (MIGRASI BARU)

```sql
-- Katalog framework yang didukung
create table if not exists frameworks (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- "CIS", "NIST_CSF", "NIST_800_41", "ISO_27001", "PCI_DSS", "CTM"
  name          text not null,                 -- "NIST Cybersecurity Framework 2.0"
  version       text,
  description   text,
  is_technical  boolean default false,         -- true=CIS (granular), false=governance/outcome-based
  active        boolean default true,
  created_at    timestamptz default now()
);

-- Control/klausul di dalam sebuah framework
create table if not exists framework_controls (
  id             uuid primary key default gen_random_uuid(),
  framework_id   uuid not null references frameworks(id) on delete cascade,
  control_code   text not null,                -- "PR.AA-01", "A.8.20", "Req 1.2.1"
  title          text not null,
  category       text,                         -- fungsi/domain: "Protect", "Access Control", dll
  description    text,
  -- coverage: seberapa jauh control ini bisa dinilai dari audit config
  coverage_type  text not null default 'manual', -- 'automated' | 'partial' | 'manual' | 'not_covered'
  guidance       text,                         -- panduan bagi auditor bila manual
  created_at     timestamptz default now(),
  unique (framework_id, control_code)
);

-- Mapping many-to-many: control framework <-> rule teknis (CIS)
create table if not exists control_rule_mappings (
  id                  uuid primary key default gen_random_uuid(),
  framework_control_id uuid not null references framework_controls(id) on delete cascade,
  rule_code           text not null,           -- referensi ke rules.code (mis. "2.4.4")
  rule_vendor         text not null default 'fortigate',
  mapping_strength    text default 'full',     -- 'full' | 'partial' (kontribusi rule ke control)
  note                text,
  created_at          timestamptz default now(),
  unique (framework_control_id, rule_code, rule_vendor)
);

-- (opsional) simpan snapshot hasil per-framework pada tiap audit
create table if not exists audit_framework_results (
  id                   uuid primary key default gen_random_uuid(),
  audit_id             uuid not null references audits(id) on delete cascade,
  framework_id         uuid not null references frameworks(id),
  score                numeric,                 -- skor compliance framework (0-100) atas control yang assessable
  covered_controls     int,                     -- jumlah control yang bisa dinilai otomatis/partial
  total_controls       int,
  coverage_percent     numeric,                 -- covered / total
  breakdown_json       jsonb default '{}'::jsonb,
  created_at           timestamptz default now(),
  unique (audit_id, framework_id)
);
```

> Catatan: `rules` (CIS) yang sudah ada TIDAK diubah strukturnya. Mapping menunjuk ke `rules.code` + `rules.vendor`.

---

## LANGKAH 2 — DEFINISI COVERAGE (ATURAN PENTING)

Setiap `framework_control.coverage_type` ditentukan sbagai berikut:

- **`automated`** — control punya ≥1 mapping ke rule CIS dan seluruh aspek control tercakup oleh rule tsb → dinilai penuh otomatis.
- **`partial`** — control punya mapping ke rule CIS tapi hanya sebagian aspeknya tercakup (sisanya butuh judgment/manual).
- **`manual`** — control bersifat governance/proses (mis. "ada kebijakan tertulis", "training kesadaran", "review berkala") → TIDAK bisa dari config; auditor mengisi manual.
- **`not_covered`** — control di luar cakupan audit konfigurasi firewall (mis. keamanan fisik, HR) → ditampilkan sebagai informasi, dikeluarkan dari perhitungan skor.

**Aturan derivasi status control (untuk automated/partial):**
Untuk tiap control, kumpulkan finding dari semua rule yang di-map ke control tsb (pada audit ybs):
- Semua rule mapped = **pass** → control **Compliant**.
- Ada ≥1 rule mapped = **fail** → control **Non-Compliant** (tampilkan rule mana yang gagal + audit/remediation-nya).
- Ada finding `pending_confirmation`/`manual` yang relevan → control **Needs Review**.
- `not_applicable` di semua rule mapped → control **N/A** (dikeluarkan dari skor).

---

## LANGKAH 3 — SEED FRAMEWORK & MAPPING

Buat file seed terpisah (JSON) + importer idempotent (upsert):
- `supabase/seed/frameworks.json` — daftar framework + controls.
- `supabase/seed/mappings_cis_fortigate.json` — mapping control → rule CIS.

### Sumber mapping yang WAJIB dipakai (jangan mengarang)
CIS Benchmark sudah menyediakan mapping resmi ke **CIS Controls v7 & v8** pada tiap rule (field `cis_controls` di tabel `rules`). Gunakan itu sebagai basis. Untuk framework lain:
- **NIST CSF 2.0, ISO 27001, PCI DSS, CTM** → gunakan **CIS Controls sebagai jembatan** bila mapping langsung tidak tersedia (CIS Controls → NIST/ISO/PCI crosswalk resmi dari CIS tersedia publik). Jika suatu control tidak punya padanan teknis, set `coverage_type='manual'` atau `not_covered` — JANGAN memaksakan mapping yang tidak valid.
- Untuk **NIST SP 800-41** (khusus firewall policy) → map ke rule Section 1 & 3 (policy, logging, segmentation) yang relevan.

### Contoh struktur seed (ISI LENGKAP MENYUSUL — buat kerangka & minimal contoh dulu)
```json
// frameworks.json
{
  "frameworks": [
    {
      "code": "NIST_CSF",
      "name": "NIST Cybersecurity Framework 2.0",
      "version": "2.0",
      "is_technical": false,
      "controls": [
        { "control_code": "PR.AA-01", "title": "Identities and credentials are managed", "category": "Protect", "coverage_type": "automated" },
        { "control_code": "PR.AA-05", "title": "Access permissions incorporate least privilege", "category": "Protect", "coverage_type": "partial" },
        { "control_code": "GV.PO-01", "title": "Policy for managing cybersecurity risk is established", "category": "Govern", "coverage_type": "manual", "guidance": "Butuh dokumen kebijakan; auditor konfirmasi manual." }
      ]
    }
  ]
}
```
```json
// mappings_cis_fortigate.json
{
  "mappings": [
    { "framework": "NIST_CSF", "control_code": "PR.AA-01", "rules": ["2.2.1","2.2.2","2.4.1"], "vendor": "fortigate", "strength": "full" },
    { "framework": "NIST_CSF", "control_code": "PR.AA-05", "rules": ["2.4.3","2.4.2"], "vendor": "fortigate", "strength": "partial" }
  ]
}
```

> **Instruksi ke AI:** buat kerangka lengkap untuk kelima framework (NIST CSF, NIST 800-41, ISO 27001, PCI DSS, CTM). Untuk tiap framework, isi control utama + mapping ke rule CIS yang relevan menggunakan `cis_controls` yang sudah ada sebagai basis. Tandai coverage secara jujur. Jika ragu pada suatu mapping, set `partial`/`manual` daripada `automated`.

---

## LANGKAH 4 — ENGINE: DERIVED COMPLIANCE (JANGAN CEK ULANG)

Buat modul `frameworkEvaluator` yang:
1. Menerima `audit_id` + hasil finding rule CIS yang SUDAH dihitung (jangan jalankan ulang parser/checker).
2. Untuk tiap framework aktif:
   - Ambil semua `framework_controls`.
   - Untuk control `automated`/`partial`: kumpulkan finding rule yang di-map → derive status control (aturan di Langkah 2).
   - Untuk control `manual`/`not_covered`: status default `Needs Review` (manual) atau dikecualikan (not_covered).
3. Hitung skor & coverage framework:
   - **coverage_percent** = (control automated+partial) / (total control assessable) × 100.
   - **score** = dihitung HANYA atas control yang assessable (automated+partial); control manual/not_covered dikecualikan dari skor tapi tetap ditampilkan.
4. Simpan ke `audit_framework_results`.

> **PENTING:** skor framework & skor CIS adalah dua hal berbeda. Skor CIS = kepatuhan teknis penuh. Skor framework = kepatuhan atas control yang bisa dinilai (dengan coverage% menyertainya agar tidak menyesatkan).

---

## LANGKAH 5 — UI

1. **Audit Result — pemilih Framework (lens switcher):** dropdown/tab untuk beralih tampilan: `CIS (default) | NIST CSF | NIST 800-41 | ISO 27001 | PCI DSS | Cyber Trust Mark`.
2. **Framework view menampilkan:**
   - **Coverage banner** yang jujur: mis. "NIST CSF: 62% control dapat dinilai otomatis dari config. Sisanya butuh review manual (governance)." Tampilkan coverage% menonjol.
   - Daftar control dikelompokkan per kategori/fungsi (Govern/Identify/Protect/Detect/Respond/Recover untuk CSF; domain ISO; Requirement PCI; dst).
   - Status tiap control: **Compliant / Non-Compliant / Needs Review / N/A / Not Covered** dengan warna.
   - Klik control → tampilkan **rule CIS yang mendukungnya**, beserta **Cara Cek (audit_procedure)** & **Remediasi (remediation_procedure)** dari rule tsb (reuse UI Finding Detail yang sudah dibuat).
3. **Badge kejujuran:** control `manual`/`not_covered` diberi label jelas "Perlu verifikasi manual" / "Di luar cakupan audit config" — JANGAN ditampilkan seolah pass.
4. **Dashboard:** opsi menampilkan skor per framework di samping skor CIS (opsional, dengan coverage%).

---

## LANGKAH 6 — REPORT

1. Report bisa di-generate **per framework** (pilih lens saat generate).
2. Report framework berisi:
   - Ringkasan skor + **coverage%** (wajib, agar pembaca tahu berapa persen dinilai otomatis).
   - Tabel control: status, rule CIS pendukung, temuan, remediation.
   - Bagian terpisah "Control yang butuh verifikasi manual" (daftar `manual`/`not_covered`) agar auditor menindaklanjuti.
3. Untuk audit compliance (mis. Cyber Trust Mark), report ini jadi evidence: temuan teknis (dari CIS) + gap governance (manual).

---

## LANGKAH 7 — MENAMBAH FRAMEWORK BARU (DOKUMENTASI)

Buat `docs/ADD_NEW_FRAMEWORK.md` berisi:
1. Tambah entri di `frameworks.json` (+ controls & coverage_type).
2. Tambah mapping di `mappings_*.json` (control → rule code).
3. Jalankan re-seed (idempotent). Selesai — engine & UI otomatis mendukung, TANPA ubah kode.

---

## DELIVERABLES

1. [ ] Migrasi tabel: `frameworks`, `framework_controls`, `control_rule_mappings`, `audit_framework_results`.
2. [ ] Seed `frameworks.json` (5 framework: NIST CSF, NIST 800-41, ISO 27001, PCI DSS, CTM) + controls dengan coverage_type jujur.
3. [ ] Seed `mappings_cis_fortigate.json` (mapping control → rule CIS, berbasis `cis_controls` existing).
4. [ ] Importer idempotent untuk kedua seed.
5. [ ] Modul `frameworkEvaluator` (derived compliance + coverage% + skor, TANPA cek ulang).
6. [ ] UI lens switcher + framework view + coverage banner + badge kejujuran.
7. [ ] Report per framework (dengan coverage% + section manual).
8. [ ] `docs/ADD_NEW_FRAMEWORK.md`.
9. [ ] Verifikasi: 1 audit config → beralih antar framework menampilkan status derived yang benar; control governance tampil sebagai manual (bukan pass).

Setelah selesai, berikan ringkasan file yang dibuat/diubah + cara menjalankan migrasi & seed, dan tampilkan contoh output coverage% untuk satu framework.

---

## CATATAN PENTING UNTUK AI (JANGAN DILEWATKAN)

- **JANGAN** membuat checker teknis baru untuk NIST/ISO/PCI/CTM. Semua cek teknis = rule CIS. Framework lain hanya **membaca hasil** via mapping.
- **JANGAN** memaksa control governance jadi "pass" otomatis. Kalau tak bisa dinilai dari config, itu `manual`/`not_covered`.
- **Coverage% wajib ditampilkan** di UI & report agar tidak ada kesan framework lain selengkap CIS.
- Mapping HARUS berbasis data yang valid (utamakan `cis_controls` yang sudah ada + crosswalk resmi CIS Controls). Bila tidak yakin, tandai `partial`/`manual`.
