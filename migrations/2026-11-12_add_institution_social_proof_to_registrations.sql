-- Migration: tambah kolom institution + social_proof di tabel registrations
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db)
--
-- institution  : VARCHAR(255) — asal instansi peserta (opsional).
-- social_proof  : VARCHAR(500) — path file bukti follow Instagram adtc_uad
--                  yang diunggah peserta (opsional), serupa pola kolom
--                  payment_proof / identity_card_proof.
--
-- Kedua kolom NULL-able → aman untuk baris lama.

ALTER TABLE registrations
  ADD COLUMN institution VARCHAR(255) NULL AFTER identity_card_proof;

ALTER TABLE registrations
  ADD COLUMN social_proof VARCHAR(500) NULL AFTER institution;

-- Kolom opsional baru: menyimpan pilihan "gratis" / "dengan sertifikat"
-- untuk kategori gratis berbayar-paket (categories.cert_available = 1).
-- Nilai sah: 'gratis', 'sertifikat'. NULL = kategori berbayar (pilihan tidak berlaku).
-- Ditambah di migration yang sama agar deployment tidak terpotong dua kali
-- (kolom belum ada saat form live → UPDATE optional gagal, di-swallow oleh
-- Registration.create — tetap sukses, tapi data pilihan hilang; dengan kolom
-- ini langsung, data tersimpan utuh).
ALTER TABLE registrations
  ADD COLUMN payment_option ENUM('gratis','sertifikat') NULL AFTER social_proof;
