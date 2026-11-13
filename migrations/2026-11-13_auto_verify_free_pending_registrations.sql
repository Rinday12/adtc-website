-- Migration: auto-verify peserta gratis yang masih stuck di status 'pending'
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db)
--
-- Latar belakang: Fix #49 membuat peserta gratis (final_price = 0) langsung
-- masuk status 'verified' saat create. Migration ini menyinkronkan data
-- LAMA yang terlanir stuck di 'pending' tanpa perlu menunggu approval
-- admin (yang mustahil — tidak ada pembayaran yang harus diverifikasi).
--
-- TIDAK menghapus data apa pun. Hanya UPDATE status pada baris yang
-- benar-benar gratis (final_price = 0) dan masih 'pending'.
-- Peserta berbayar (final_price > 0) tidak tersentuh.

UPDATE registrations
SET status = 'verified'
WHERE status = 'pending'
  AND final_price = 0;
