-- Migration: rename kategori agar label navbar jelas & tidak ambigu
-- (Jalankan di cPanel -> phpMyAdmin -> database adtc_db)
--
-- Perubahan label (urutan penting — hindari tabrakan nama):
--   1. "Pelatihan gratis" (anchor: pelatihan-gratis-berbayar, cert_available=1)
--        -> "Pelatihan berbayar"
--   2. "Gratis"          (anchor: pelatihan-gratis,          cert_available=0)
--        -> "Pelatihan gratis"
--   3. "Pelatihan"       (anchor: pelatihan)
--        -> "Sertifikasi"
--
-- Setiap statement juga sync trainings.category (string name, bukan ID).
-- Semua idempoten: aman dijalankan ulang.

-- ============================================================
-- STEP 1: rename kategori berbayar dulu (agar slot "Pelatihan gratis" kosong)
-- ============================================================
-- 1a. Sync trainings
UPDATE trainings t
  JOIN categories c ON t.category = c.name
SET t.category = 'Pelatihan berbayar'
WHERE c.anchor = 'pelatihan-gratis-berbayar'
  AND c.is_free_tier = 1;

-- 1b. Rename di categories
UPDATE categories SET name = 'Pelatihan berbayar'
WHERE anchor = 'pelatihan-gratis-berbayar'
  AND cert_available = 1;

-- ============================================================
-- STEP 2: rename "Gratis" -> "Pelatihan gratis" (slot sudah kosong)
-- ============================================================
-- 2a. Sync trainings
UPDATE trainings t
  JOIN categories c ON t.category = c.name
SET t.category = 'Pelatihan gratis'
WHERE c.anchor = 'pelatihan-gratis'
  AND c.is_free_tier = 1;

-- 2b. Rename di categories
UPDATE categories SET name = 'Pelatihan gratis'
WHERE anchor = 'pelatihan-gratis'
  AND cert_available = 0;

-- ============================================================
-- STEP 3: rename "Pelatihan" -> "Sertifikasi"
-- ============================================================
-- 3a. Sync trainings
UPDATE trainings t
  JOIN categories c ON t.category = c.name
SET t.category = 'Sertifikasi'
WHERE c.anchor = 'pelatihan';

-- 3b. Rename di categories
UPDATE categories SET name = 'Sertifikasi'
WHERE anchor = 'pelatihan';
