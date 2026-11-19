-- Migration: kunci opsi berbayar per kategori
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db, atau dev: terapkan otomatis)
--
-- Latar: kategori is_free_tier=1, cert_available=0 ("full free") saat ini masih
-- bisa di-override per-training (cert_override=1) untuk membuka kembali opsi
-- Paket Lengkap. User ingin opsi kategori "full gratis tanpa opsi berbayar"
-- yang MENGUNCI perilaku itu: per-training cert_override tak bisa re-aktifkan.
--
-- Kolom baru:
--   lock_paid_option: 1 = opsi berbayar DIKUNCI — form publik & per-training
--                     cert_override diabaikan; peserta selalu Rp 0.
--                    0 = perilaku lama: cert_override per-training berlaku.
--
-- Default 0 membuat semua kategori lama mempertahankan perilaku saat ini.

ALTER TABLE categories
  ADD COLUMN lock_paid_option TINYINT(1) NOT NULL DEFAULT 0 AFTER cert_available;
