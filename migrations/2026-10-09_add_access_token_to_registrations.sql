-- Migration: tambah kolom access_token di tabel registrations (Jalankan di cPanel → phpMyAdmin → database adtcuadi_adtc_app)
-- access_token bersifat unik & rahasia (UUID v4, dibuat crypto-random saat pendaftaran),
-- dipakai untuk membuka halaman detail pendaftaran (success/payment) tanpa perlu
-- menebak/menunjukkan ID numerik.
--
-- PENTING: Jalankan 3 statement ini BERURUTAN, bukan sekaligus.
-- Penambahan kolom UNIQUE + NOT NULL tanpa DEFAULT akan membuat MySQL mengisi
-- semua baris lama dengan '' (string kosong) → melanggar UNIQUE di baris ke-2.
-- Solusinya: (1) tambah kolom dulu tanpa UNIQUE, (2) isi nilai, (3) tambah index UNIQUE.

-- Langkah 1: tambah kolom (NOT NULL dengan default '' agar baris lama valid)
ALTER TABLE registrations
  ADD COLUMN access_token VARCHAR(64) NOT NULL DEFAULT '' AFTER reference_code;

-- Langkah 2: isi token acak untuk semua baris (termasuk baris lama & default '')
UPDATE registrations
  SET access_token = CONCAT('legacy-', UUID());

-- Langkah 3: buang default & pasang constraint UNIQUE
ALTER TABLE registrations
  MODIFY COLUMN access_token VARCHAR(64) NOT NULL;

ALTER TABLE registrations
  ADD UNIQUE INDEX idx_registrations_access_token (access_token);
