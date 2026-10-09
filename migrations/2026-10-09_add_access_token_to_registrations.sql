-- Migration: tambah kolom access_token di tabel registrations
-- Jalankan sekali di production (cPanel phpMyAdmin) untuk database yang sudah ada.
-- access_token bersifat unik & rahasia (dibuat crypto-random saat pendaftaran),
-- dipakai untuk membuka halaman detail pendaftaran (success/payment) tanpa
-- perlu menebak/menunjukkan ID numerik.
ALTER TABLE registrations
  ADD COLUMN access_token VARCHAR(64) NOT NULL UNIQUE
  AFTER reference_code;

-- Isi kolom lama dengan token placeholder acak agar constraint UNIQUE & NOT NULL
-- tidak menghalangi baris historis; token ini tidak valid untuk membuka halaman
-- (user lama akan menggunakan link token yang sudah dikirim via email/WA).
UPDATE registrations
  SET access_token = CONCAT('legacy-', UUID())
  WHERE access_token IS NULL OR access_token = '';
