# Deploy Instructions for adtcuad.id

## Masalah Utama (2026-10-07)
Semua halaman publik (`/`, `/trainings`, `/berita`) menampilkan error 500.
Kode Fix #19/#20 (DB fallback) sudah committed & pushed, tapi server masih
menggunakan kredensial DB lama (`adtc_app`/`adtc_production`) sehingga
koneksi ke MySQL selalu gagal (ECONNREFUSED/ER_ACCESS_DENIED).

## Fix Status
Semua commit sudah ada di origin/main:
```
Fix #19 — DB fallback data kosong di publicController/contentController
Fix #20 — Register halaman 500 saat DB down (registrationController)
Fix #14 — Redirect /admin/training/create → /admin/trainings/create
```
Status: pushed ✅, deploy ke server ❌ belum

---

## Langkah 1 — Cek Kredensial DB di Server

SSH ke server:
```bash
ssh adtcuadi@202.155.137.48
```

Lihat isi `.env` yang dibaca app Node.js:
```bash
# Carikan file .env di folder app
find ~/node-app -name ".env" 2>/dev/null
cat ~/node-app/.env
```

Yang perlu ada di `.env` (kredensial BENUA/Baru, sudah dikonfirmasi user):
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=adtcuadi_adtc_app
DB_NAME=adtcuadi_adtc_app
DB_PASSWORD=<password MySQL user adtcuadi_adtc_app — lihat di cPanel → MySQL Databases>
```

Kalau masih ada `DB_USER=adtc_app` atau `DB_NAME=adtc_production` → **itu penyebabnya**.
Perbaiki langsung di server:
```bash
nano ~/node-app/.env
# Ubah DB_USER & DB_NAME ke adtcuadi_adtc_app
# Set DB_PASSWORD yang benar (cek cPanel → MySQL Databases → password adtcuadi_adtc_app)
```

> Catatan: password DB tidak boleh ditulis di repo. Cara cek: cPanel → MySQL Databases → cari user `adtcuadi_adtc_app` → lihat password (atau reset kalau lupa).

## Langkah 2 — Cek PM2 & Log

```bash
# Lihat log PM2, cari error DB
pm2 logs adtc-app --lines 50

# Atau kalau pakai server.sh:
bash ~/node-app/scripts/server.sh status
```

Kata kunci yang dicari di log:
- `ECONNREFUSED` → port salah atau MySQL tidak listening
- `ER_ACCESS_DENIED` → username/password salah (kredensial lama masih dipakai)
- `ER_BAD_DB_ERROR` → DB name tidak ada
- Kalau log kosong / tidak ada error DB → app mungkin belum restart setelah .env diubah

## Langkah 3 — Restart App

Setelah `.env` sudah benar:
```bash
# Kalau pakai PM2:
pm2 restart adtc-app

# Kalau pakai server.sh:
bash ~/node-app/scripts/server.sh restart
```

Lalu pull kode terbaru (jangan lakukan ini kalau server masih di commit lama
dan .env sudah benar — restart saja dulu):
```bash
cd ~/node-app
git pull origin main
pm2 restart adtc-app
```

## Langkah 4 — Verifikasi

```bash
# Dari laptop (bukan dari server):
curl -s -o /dev/null -w "%{http_code}" https://adtcuad.id/
curl -s -o /dev/null -w "%{http_code}" https://adtcuad.id/trainings
curl -s -o /dev/null -w "%{http_code}" https://adtcuad.id/berita
```

Expected: semua 200 (dengan konten atau fallback data kosong, bukan 500).

Kalau masih 500 → cek log PM2 lagi, lihat error spesifiknya.

## Langkah 5 — Update `.env.production` di Repo Lokal (opsional tapi disarakan)

Repo lokal masih punya `.env.production` dengan kredensial lama.
Update supaya konsisten (tidak di-commit ke remote, hanya local env file):
```bash
# Di folder project lokal:
# Update DB_USER=adtcuadi_adtc_app & DB_NAME=adtcuadi_adtc_app di .env.production
```

> Jangan commit file `.env` atau `.env.production` yang berisi password ke GitHub.

---

## Method 2: cPanel CI/CD Auto-Deploy
1. Enable SSH Access di cPanel → SSH Access
2. Add your SSH public key ke GitHub & server
3. Push ke cPanel remote:
```bash
git remote add cpanel ssh://adtcuadi@202.155.137.48/home/adtcuadi/node-app
git push cpanel main
```
4. Enable CI/CD di cPanel dan configure `.cpanel.yml`

## Method 3: cPanel File Manager
1. Login cPanel → File Manager
2. Buka terminal di File Manager
3. `cd ~/node-app && git pull origin main && pm2 restart adtc-app`

## Known Issues
- DNS `marsala.denoedia.net` tidak resolve dari luar network — pakai IP `202.155.137.48`
- MySQL cPanel shared hosting tidak membuka port 3306 ke luar — ETIMEDOUT dari test koneksi di luar server itu NORMAL, bukan indikator DB mati
