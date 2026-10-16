# Firewall Audit Analyzer - Production Deployment Guide

Panduan ini berisi langkah-langkah detail untuk men-deploy aplikasi **Firewall Audit Analyzer** ke environment Production menggunakan **Docker Desktop** (di Windows) atau server Linux yang memiliki Docker.

## Prasyarat

Pastikan sistem Anda (atau server) sudah menginstall aplikasi berikut:
- **Docker Desktop** (jika menggunakan Windows / Mac) atau Docker Engine (Linux).
- **Git** (Opsional, untuk pull repository).

---

## Langkah 1: Persiapan Konfigurasi

1. Buka terminal atau Command Prompt (di Windows) lalu arahkan ke root direktori project aplikasi ini.
2. Buka file `docker-compose.yml` menggunakan text editor (contoh: Notepad atau VSCode).
3. Pastikan variabel `NEXTAUTH_SECRET` sudah diubah menggunakan *string* rahasia milik Anda. Ini digunakan untuk mengenkripsi sesi login user. 
   ```yaml
   environment:
     - NODE_ENV=production
     - NEXT_TELEMETRY_DISABLED=1
     - DATABASE_URL=file:/app/data/prod.db
     - NEXTAUTH_SECRET=ganti_dengan_teks_rahasia_yang_panjang
     - NEXTAUTH_URL=http://localhost:3000
   ```
   *(Catatan: Jika Anda mendeploy ini ke domain publik, ganti `NEXTAUTH_URL` dengan URL domain Anda misal `https://audit.perusahaan.com`)*

## Langkah 2: Build Image Docker

Karena kita telah melakukan perubahan pada file-file konfigurasi, kita harus mem-build image Docker-nya terlebih dahulu.

Jalankan perintah ini di dalam root folder project Anda:

```bash
docker-compose build
```

*Proses ini akan mengunduh dependencies (Node.js Alpine), membuat build Next.js Production (standalone), dan menyiapkan Prisma.*

## Langkah 3: Menjalankan Aplikasi

Setelah proses build selesai, Anda dapat menjalankan aplikasi di *background* menggunakan perintah:

```bash
docker-compose up -d
```

**Apa yang terjadi saat perintah ini dijalankan?**
1. Docker akan membuat dan menjalankan container `firewall-analyzer`.
2. Script `entrypoint.sh` akan berjalan untuk mengeksekusi `npx prisma db push`, yang mana akan secara otomatis membuat dan menyinkronkan database SQLite baru (file `prod.db`) di dalam folder `data` host Anda.
3. Next.js akan mulai berjalan pada port 3000.

## Langkah 4: Verifikasi & Akses Aplikasi

1. Buka browser Anda (Google Chrome / Edge).
2. Akses alamat: **`http://localhost:3000`**
3. Karena database (`prod.db`) masih baru dan kosong, aplikasi akan mengarahkan Anda ke halaman **Initial Setup**.
4. Buat akun **Admin Pertama** dengan memasukkan Email dan Password.
5. Anda sekarang sudah bisa login ke dashboard utama!

---

## Manajemen Data (Penting)

### Lokasi Database
Aplikasi menggunakan database SQLite. Berkat pengaturan volume pada Docker, file database ini disimpan secara aman di komputer Host Anda pada folder:
`./data/prod.db` (Folder `data` berada di dalam root project Anda).
**Jangan hapus folder `data/` ini jika Anda tidak ingin kehilangan seluruh data hasil audit, tenant, dan user Anda.**

### Menghentikan Aplikasi
Jika Anda ingin menghentikan aplikasi, jalankan:
```bash
docker-compose down
```
*(Tenang, data di dalam folder `data/` tidak akan hilang saat container dihentikan)*

### Update Aplikasi Baru
Jika di masa depan ada pembaruan kode aplikasi, Anda bisa meng-update-nya dengan cara:
```bash
docker-compose build --no-cache
docker-compose up -d
```
