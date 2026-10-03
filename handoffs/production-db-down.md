# Koneksi DB Production ECONNREFUSED — Semua Halaman Publik 500
Status: BERJALAN · Service: production (adtcuad.id) · Diperbarui: 2026-10-03

## Sedang dikerjakan
Database MySQL produksi tidak bisa dihubungi. Kredensial yang benar (sudah
konfirmasi user, sama di .env.production server):
  - DB_HOST=localhost, DB_PORT=3306
  - DB_USER=adtcuadi_adtc_app (bukan `adtc_app` seperti di repo lokal — repo lokal
    masih pakai nama lama, perlu di-update)
  - DB_NAME=adtcuadi_adtc_app (sesuai yang terlihat di phpMyAdmin: 5 tabel,
    `admins` berisi 1 row, `benefits`/`news`/`registrations`/`trainings` masih kosong)
  - DB_PASSWORD=Kj9#mP2$xL5nQ8@wRt3y

Gejala (2026-10-03): semua halaman publik yang query DB (`/`, `/trainings`,
`/berita`) menampilkan error 500. `/admin/login` (GET) tetap 200 karena tidak
menyentuh DB.

Hasil diagnostik:
- From laptop (localhost, .env.production lama: `adtc_app`/`adtc_production`)
  → `ECONNREFUSED` (diharapkan, DB tidak ada di laptop).
- Coba koneksi langsung ke host produksi (`adtcuad.id:3306`) dengan kredensial
  baru yang benar (`adtcuadi_adtc_app`/`adtcuadi_adtc_app`) → `ETIMEDOUT`.
  Ini wajar & diharapkan: MySQL di cPanel shared hosting (DomaiNesia, user
  `adtcuadi`) tidak dibuka ke IP luar, hanya ke `localhost` dari dalam server
  itu sendiri. **ETIMEDOUT dari luar ≠ DB-nya mati — ini normal, bukan bug.**
- Jadi belum bisa memastikan apakah DB-nya benar-benar down dari server,
  atau masalahnya di konfigurasi app Node.js-nya di server (mis. .env di
  server belum di-update ke kredensial baru, atau PM2 belum restart setelah
  .env diubah, atau app Node.js sebenarnya masih connect ke kredensial lama
  `adtc_app`/`adtc_production` yang tidak ada di MySQL-nya).

## Status terakhir
- Fix #19 (fallback data kosong untuk getCatalog/getTrainingDetail/getNewsList/
  getNewsDetail) sudah di-merge ke working tree lokal, 76 unit test passing.
  Status: PENDING verifikasi — perlu di-commit & deploy ke production, tapi
  selagi koneksi DB dari server masih gagal, halaman tetap 500 (meskipun
  sekarang dengan fallback tampilan kosong yang lebih ramah, bukan pesan
  error mentah).
- Kredensial DB yang benar sudah dikonfirmasi user (sama dengan di
  .env.production): `adtcuadi_adtc_app` / `adtcuadi_adtc_app`.
- **Repo lokal (file .env.production yang di-commit) masih memakai kredensial
  LAMA yang salah** (`adtc_app` / `adtc_production`) — ini sumber kekacauan,
  perlu di-update supaya sesuai server aslinya.

## Keputusan penting
- Fallback data kosong (bukan fallback error 500) dipilih agar situs tidak
  blank total saat DB down — konsisten dengan pola Fix #18 di `getHome`.
- ETIMEDOUT saat test koneksi DB dari luar server itu NORMAL untuk MySQL di
  cPanel shared hosting — jangan anggap sebagai gejala "DB mati". Yang perlu
  dicek adalah koneksi dari dalam server (localhost) itu sendiri.

## Langkah berikutnya
1. Update kredensial di `config/db.js` / `.env.production` (repo lokal) ke
   `adtcuadi_adtc_app` agar sesuai server asli (opsional, hanya supaya repo
   lokal konsisten; bukan akar masalah, karena server sudah pakai file
   .env-nya sendiri yang benar).
2. Di server (cPanel File Manager / SSH): cek apakah isi `.env` yang
   sebenarnya dibaca app Node.js sudah menggunakan kredensial baru
   (`adtcuadi_adtc_app`). Bisa dicek lewat File Manager di
   `/home/adtcuadi/node-app` (atau di mana pun project Node.js-nya
   di-deploy).
3. Cek log PM2 (`pm2 logs`) atau file log yang dipakai server — cari
   `ECONNREFUSED`/`ER_ACCESS_DENIED`/`ER_BAD_DB_ERROR` untuk tahu error
   DB yang sebenarnya terjadi.
4. Setelah app Node.js sudah connect ke DB dengan benar, jalankan
   `pm2 restart` / `bash scripts/server.sh restart` untuk memuat ulang
   pool koneksi.
5. Verifikasi: `curl https://adtcuad.id/` → harus 200 dengan data nyata,
   `curl https://adtcuad.id/trainings` → 200.
6. Commit & deploy Fix #19 (perubahan di `controllers/publicController.js`,
   `controllers/contentController.js`, `app.js`, `CHANGELOG_FIXES.md`).

## Jangan lakukan
- Jangan anggap ETIMEDOUT dari test koneksi di luar server sebagai "DB mati"
  — cPanel shared hosting memang tidak membuka port 3306 ke luar.
- Jangan jalankan `migrate:fresh`/`DROP`/perintah perusak data.
- Jangan menghapus atau mereset DB production; tunggu konfirmasi user dulu.
