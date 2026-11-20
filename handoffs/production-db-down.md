# Migration DB Produksi — Kolom/Tabel Belum Di-deploy
Status: SELESAI · Service: production (adtcuad.id) · Diperbarui: 2026-11-20

## Riwayat
- 2026-10-03: ECONNREFUSED/ETIMEDOUT — kredensial lama di `.env` vs. `adtcuadi_adtc_app`
- 2026-11-20: dump produksi (`adtcuadi_adtc_app (5).sql`) konfirmasi SEMUA migrasi sudah ada:
  - `registrations`: `institution`, `social_proof`, `payment_option`, `ig_story_proof`, `wa_share_proof`, `ig_comment_proof` ✅
  - `categories`: `cert_available`, `lock_paid_option` ✅
  - `trainings`: `training_document`, `cert_override` ✅
  - Tabel `promo_settings` ✅, `promo_trainings` ✅

## Jangan lakukan
- Jangan anggap ETIMEDOUT koneksi DB dari laptop = "DB mati" — port 3306
  cPanel shared hosting memang tidak terbuka ke luar.
- Jangan jalankan migrate:fresh / DROP / perintah perusak.
