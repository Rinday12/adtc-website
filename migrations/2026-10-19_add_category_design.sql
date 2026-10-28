-- Migration: tambah kolom desain per kategori di tabel categories
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db)
--
-- Setiap kategori punya identitas visual sendiri di halaman publik:
--   accent : nama palet Tailwind yang dipakai di hero banner
--            ('blue' | 'navy' | 'teal' | 'green' | 'purple' | 'red')
--   icon   : emoji pendek yang tampil di hero & dropdown navbar
--
-- Update idempoten — aman dijalankan ulang.

ALTER TABLE categories
  ADD COLUMN accent VARCHAR(20) NOT NULL DEFAULT 'blue' AFTER is_free_tier,
  ADD COLUMN icon   VARCHAR(20) NOT NULL DEFAULT ''     AFTER accent;

UPDATE categories SET accent = 'blue',  icon = '📚' WHERE anchor = 'pelatihan';
UPDATE categories SET accent = 'navy',  icon = '💼' WHERE anchor = 'konsultan';
UPDATE categories SET accent = 'teal',  icon = '🏭' WHERE anchor = 'in-house-training';
UPDATE categories SET accent = 'green', icon = '🎁' WHERE anchor = 'pelatihan-gratis';
