-- Migration: tambah kolom exec_mode + fasilitas di tabel trainings
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db)
--
-- exec_mode  : ENUM('online','offline') — mode pelaksanaan pelatihan.
-- fasilitas  : TEXT — daftar fasilitas yang didapat peserta HANYA bila offline.
--              Disimpan sebagai string ber-baris (satu fasilitas per baris),
--              konsisten dengan pola kolom teks lain di project.
--
-- Kedua kolom NULL-able / punya default → aman untuk baris lama.

ALTER TABLE trainings
  ADD COLUMN exec_mode ENUM('online','offline') NOT NULL DEFAULT 'offline' AFTER status;

ALTER TABLE trainings
  ADD COLUMN fasilitas TEXT NULL AFTER exec_mode;
