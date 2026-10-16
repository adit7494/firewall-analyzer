# Handoff Addendum — Rule Details (Audit & Remediation) untuk Firewall Audit Analyzer

> **Cara pakai:** Salin seluruh isi file ini ke AI coding assistant yang sedang menjalankan `Handoff-Prompt-CIS-Integration.md`. Ini adalah **tambahan (addendum)**, bukan pengganti — lanjutkan pekerjaan sebelumnya, jangan ulang dari awal atau rusak yang sudah jadi.

---

## TUJUAN ADDENDUM INI

Melengkapi setiap rule dengan **detail cara cek (audit) dan cara perbaiki (remediation)** yang diambil langsung dari CIS FortiGate 7.4.x Benchmark. Sehingga ketika audit menemukan finding **FAIL**, sistem dapat langsung menampilkan ke user:
- **Cara Cek (Audit Procedure)** — perintah CLI/GUI untuk memverifikasi.
- **Cara Perbaiki (Remediation Procedure)** — perintah CLI/GUI untuk memperbaiki.
- **Default Value**, **Rationale/Impact**, dan **References**.

Data lengkap sudah disediakan dalam file: **`cis_fortigate_7.4.x_seed.json`** (64 rule, sudah berisi field detail).

---

## PRINSIP WAJIB (SAMA SEPERTI SEBELUMNYA)

1. **Backward compatible** — jangan rusak fitur/kolom existing. Tambahkan lewat migrasi baru.
2. **Rule tetap sebagai DATA** — detail audit/remediation disimpan di tabel `rules`, bukan hardcode.
3. **Vendor-agnostic** — field detail ini berlaku umum untuk semua vendor (bukan khusus FortiGate).
4. **Idempotent** — importer seed harus upsert by (`vendor`, `code`), aman dijalankan ulang.
5. **Full file saat update** — berikan file lengkap yang bisa langsung copy-paste, bukan diff/snippet.

---

## LANGKAH 1 — MIGRASI: TAMBAH KOLOM DETAIL PADA TABEL `rules`

Buat migrasi baru (jangan hapus kolom lama). Tambahkan kolom berikut:

```sql
alter table rules add column if not exists rationale             text;
alter table rules add column if not exists impact                text;
alter table rules add column if not exists audit_procedure       text;   -- CARA CEK
alter table rules add column if not exists remediation_procedure text;   -- CARA PERBAIKI
alter table rules add column if not exists default_value         text;
alter table rules add column if not exists references_json       jsonb default '[]'::jsonb;
```

> Catatan: jika kolom `cis_controls`, `config_key`, `expected_value`, `audit_hint`, `remediation` sudah dibuat pada migrasi sebelumnya, biarkan. `remediation_procedure` (langkah teknis dari CIS) BERBEDA dari `remediation` (ringkasan singkat) — keduanya boleh koeksistensi; kalau `remediation` singkat belum dipakai UI, cukup pakai `remediation_procedure`.

---

## LANGKAH 2 — UPDATE IMPORTER SEED

1. Baca file `cis_fortigate_7.4.x_seed.json` (root punya `rules[]`; metadata benchmark ada di root: `benchmark`, `benchmark_version`, `tested_on`).
2. Untuk tiap item, **upsert** ke tabel `rules` by (`vendor`, `code`). Map field JSON → kolom DB:

| Field JSON | Kolom DB |
|---|---|
| `code` | `code` |
| `title` | `title` |
| `section` | `section` |
| `cis_level` | `cis_level` |
| `cis_status` | `cis_status` |
| `system_check` | `system_check` |
| `severity` | `severity` |
| `config_key` | `config_key` |
| `expected_value` | `expected_value` |
| `rationale` | `rationale` |
| `impact` (jika ada) | `impact` |
| `audit_procedure` | `audit_procedure` |
| `remediation_procedure` | `remediation_procedure` |
| `default_value` | `default_value` |
| `references` | `references_json` |
| `cis_controls` | `cis_controls` |
| (root) `benchmark_version` | `benchmark_ref` |

3. Set `vendor = 'fortigate'` untuk semua (kecuali rule `FW-ANY` boleh `vendor = 'common'` bila kamu terapkan sebagai common rule).
4. **PENTING (dedup):** JSON hanya berisi 7.3.2, TIDAK ada 7.3.3 (karena CIS 7.3.3 duplikat editorial dari 7.3.2). Jangan buat 7.3.3.
5. **Rule ekstra:** `FW-ANY` (Any-Any-Any policy) memiliki `cis_level` & `cis_status` = null — pastikan importer menangani null tanpa error.

---

## LANGKAH 3 — UPDATE API/QUERY FINDING

Saat mengambil finding untuk ditampilkan, JOIN ke tabel `rules` (by `vendor` + `cis_code`/`code`) agar ikut membawa: `audit_procedure`, `remediation_procedure`, `default_value`, `rationale`, `impact`, `references_json`, `config_key`, `expected_value`, `cis_controls`, `cis_level`, `cis_status`, `system_check`.

Data ini dipakai UI Finding Detail. Jangan duplikasi teks panjang ke tabel `findings` — cukup referensi ke `rules` (findings menyimpan hasil pass/fail + evidence + status + catatan auditor).

---

## LANGKAH 4 — UPDATE UI: FINDING DETAIL

Pada halaman Finding Detail, tambahkan/lengkapi section berikut (tampilkan HANYA yang datanya ada):

1. **Header** — badge severity, `CIS <code>`, `L1/L2`, tier (`auto`/`semi`/`manual`), status finding.
2. **Deskripsi & Rationale** — dari `rationale`; tampilkan `impact` bila ada.
3. **📋 Cara Cek (Audit Procedure)** — render `audit_procedure` dalam blok kode monospace (pertahankan line break `\n`). Beri judul jelas "Cara Cek".
4. **🔧 Remediasi (Cara Perbaiki)** — render `remediation_procedure` dalam blok kode monospace. Beri judul "Remediasi" + tombol **Copy** untuk menyalin perintah.
5. **Default Value** — dari `default_value`.
6. **Config Key & Expected Value** — dari `config_key` + `expected_value`.
7. **References** — render `references_json` sebagai daftar link yang bisa diklik (buka tab baru).
8. **Compliance Mapping** — render `cis_controls` sebagai tag (mis. "CIS v8 12.7", "CIS v7 1.8").

### Catatan rendering
- `audit_procedure` & `remediation_procedure` berisi perintah multi-baris (dipisah `\n`). Render dalam `<pre>`/blok kode monospace agar indentasi & baris CLI terbaca benar.
- Untuk finding berstatus `pass`, section Remediasi boleh disembunyikan/di-collapse (opsional) — tapi Audit Procedure tetap boleh ditampilkan sebagai referensi.
- Untuk finding `pending_confirmation` (tier semi) & `manual`, tetap tampilkan Cara Cek agar auditor bisa verifikasi manual.

---

## LANGKAH 5 — REPORT

Pada report yang di-generate (technical), untuk setiap finding **fail** sertakan ringkas: judul, severity, **Cara Perbaiki (remediation_procedure)**, dan reference. Ini membuat report actionable bagi engineer client.

---

## DELIVERABLES

1. [ ] Migrasi kolom detail pada `rules`.
2. [ ] Importer seed terbaca dari `cis_fortigate_7.4.x_seed.json` (upsert idempotent, mapping field sesuai tabel di atas).
3. [ ] API finding menyertakan detail rule (JOIN).
4. [ ] UI Finding Detail menampilkan "Cara Cek", "Remediasi" (+ tombol Copy), Default Value, References, Compliance Mapping.
5. [ ] Report technical menyertakan remediation per finding fail.
6. [ ] Verifikasi: jalankan ulang seed → tidak ada duplikasi; buka satu finding fail → detail audit & remediation tampil benar.

Setelah selesai, berikan ringkasan file yang dibuat/diubah + cara menjalankan migrasi & re-seed.
