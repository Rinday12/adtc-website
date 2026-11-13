-- Migration: tambah kolom ig_comment_proof di registrations
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db)
--
-- ig_comment_proof : VARCHAR(500) — path file screenshot bukti komentar
--                    di postingan IG adtc_uad (NULL-able, hanya kategori gratis)
--
-- Menggantikan kolom post_comment_url (yang menyimpan URL teks) dengan
-- bukti visual berupa screenshot, agar admin dapat memverifikasi.

ALTER TABLE registrations
  ADD COLUMN ig_comment_proof VARCHAR(500) NULL AFTER wa_share_proof;
