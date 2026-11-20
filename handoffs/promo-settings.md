# Setting Promo Harga Global + Promo per Training
Status: SELESAI · Service: adtcwebsite (production) · Diperbarui: 2026-11-20

## Riwayat fix
- Fix #59 (promo global) — commit f63a4da
- Fix #60 (promo per training) — commit f63a4da
- Fix #61 (kategori gratis + sertifikat ikut promo) — commit 3ffa870
- Fix #62 (TDZ certFee + display promo di detail.ejs) — commit e53d01f
- Fix #63 (lock_paid_option) — commit 7b15e5a

## Status terakhir
Semua migrasi terkonfirmasi LIVE di production (dump `adtcuadi_adtc_app (5).sql`):
- Tabel `promo_settings` ✅ & `promo_trainings` ✅
- Kolom `institution`, `social_proof`, `payment_option` di `registrations` ✅
- Kolom `lock_paid_option` di `categories` ✅
- Kolom `training_document`, `cert_override` di `trainings` ✅

## Keputusan penting
- `final_price` adalah snapshot saat submit — reg lama tak ikut promo otomatis.
- Opsi A dipilih: kategori gratis boleh dipromokan.

## Jangan lakukan
- Jangan anggap harga `final_price` di DB lama ikut promo otomatis.
- Jangan jalankan migrate:fresh / DROP / perintah perusak.
