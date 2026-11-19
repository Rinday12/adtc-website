# Setting Promo Harga Global + Promo per Training
Status: BERJALAN · Service: adtcwebsite · Diperbarui: 2026-11-19 09:00

## Sedang dikerjakan
Fitur promo global (Fix #59) + skema harga per training (Fix #60, tabel `promo_trainings`
dengan fallback ke harga global `promo_settings.promo_price`) sudah selesai di kode:
model/controller/view admin/test semua dibuat, 138 test lulus. Tinggal step sebelum
fitur per-training bisa dipakai di production:
- Jalankan migrasi `migrations/2026-11-18_add_promo_settings.sql` DAN
  `migrations/2026-11-19_add_promo_trainings.sql` di DB production SEBELUM deploy kode.
  Tabel `promo_settings` harus ada dulu agar `adminPromoController.postSave` (INSERT/UPDATE)
  tidak error 500; tabel `promo_trainings` harus ada agar `PromoSetting.set()` dengan
  `byTraining` tidak gagal (DELETE/INSERT ke tabel yang tak ada). `findActive()` &
  `getActivePromo()` sudah punya fallback catch (kembalikan baris parent saja / null)
  bila tabel anak belum ada — view publik aman, hanya form admin save yang error.

## Status terakhir
- Semua perubahan kode sudah di working tree, BELUM di-commit & BELUM di-deploy.
  File baru: `controllers/adminPromoController.js`, `models/PromoSetting.js`,
  `migrations/2026-11-18_add_promo_settings.sql`, `migrations/2026-11-19_add_promo_trainings.sql`,
  `views/admin/promo/form.ejs`.
- Migrasi `promo_settings` sudah dijalankan di DB lokal (`adtc_db`). Migrasi
  `promo_trainings` perlu dicek/dijalankan juga di DB lokal sebelum test manual.
- Property test promo (8 case di calculateFinalPrice.test.js, termasuk 2 baru untuk
  byTraining) + 138 test penuh lulus.
- Changelog Fix #59 (promo global) & Fix #60 (promo per training) sudah ditulis,
  keduanya status "BELUM DEPLOY".

## Langkah berikutnya
1. Jalankan `migrations/2026-11-19_add_promo_trainings.sql` di DB lokal
   (`adtc_db`) bila belum, pastikan tabel `promo_trainings` sudah ada.
2. Commit semua perubahan (file baru + yang sudah ada di git status).
3. Deploy ke production: jalankan KEDUA migrasi (`2026-11-18` dan `2026-11-19`)
   di DB production SEBELUM deploy kode.
4. Update entri Fix #59 & Fix #60 di CHANGELOG_FIXES.md dari "BELUM DEPLOY" →
   "✅ LIVE <tanggal>" + HAPUS file handoff ini.

## Jangan lakukan
- Jangan deploy kode tanpa menjalankan KEDUA migrasi dulu → form admin save akan error 500.
- Jangan ubah signature `calculateFinalPrice`/`resolveFinalPrice` lagi tanpa update
  test property — test mendefinisikan versi lokal sendiri, tidak otomatis gagal kalau
  signature controller berubah.
- Kolom `training_id` di `promo_trainings` WAJIB `INT` (bukan `INT UNSIGNED`) —
  PRIMARY KEY tabel `trainings` bertipe signed `int(11)`; `INT UNSIGNED` akan memicu
  FK type mismatch saat CREATE TABLE.
