-- ============================================================================
-- PRODUCTION MIGRATION SCRIPT
-- Database: adtcuadi_adtc_app
-- Tanggal:  2026-10-28
--
-- Latar:  File dump production (adtcuadi_adtc_app.sql, 15:22) menunjukkan:
--   ✅ tabel: admins, benefits, news, registrations, trainings
--   ❌ tabel categories / services BUKAN ADA
--   ❌ kolom cert_available / accent / icon BUKAN ADA
--   → artinya migrasi 2026-10-15, 2026-10-19, 2026-10-22, 2026-10-28
--     belum pernah dijalankan di production.
--
-- Cara pakai:
--   1. Backup dulu:  mysqldump -u adtcuadi_adtc_app adtcuadi_adtc_app > backup_sebelum_mig.sql
--   2. Import script ini (semua aman & idempoten — bisa dijalankan ulang):
--        mysql -u adtcuadi_adtc_app adtcuadi_adtc_app < 2026-10-28_production_sql.sql
--   3. Set CERT_FEE=75000 di .env.production
--   4. Git pull + deploy kode baru, pm2 restart adtc-app
--
-- ⚠️  JANGAN deploy kode Fix #37/#41/#42 SEBELUM script ini selesai
--      — query kode baru butuh kolom cert_available di tabel categories.
-- ============================================================================

-- ============================================================================
-- BAGIAN 1 — Tabel categories (migrasi 2026-10-15)
-- Kategori resmi ADTC, disinkronkan dari trainings yang sudah ada.
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL UNIQUE,
  anchor        VARCHAR(120)  NOT NULL,
  sort_order    INT           NOT NULL DEFAULT 0,
  is_free_tier  TINYINT(1)    NOT NULL DEFAULT 0,
  status        ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories (sort_order);

-- Sinkronkan semua kategori unik yang sudah dipakai di trainings → tidak hilang dari navbar
INSERT IGNORE INTO categories (name, anchor, sort_order)
SELECT t.category,
       LOWER(REPLACE(t.category, ' ', '-')),
       MIN(t.category_order)
FROM trainings t
WHERE t.category IS NOT NULL AND t.category <> ''
GROUP BY t.category;

-- Keempat kategori resmi ADTC
INSERT IGNORE INTO categories (name, anchor, sort_order, is_free_tier) VALUES
  ('Pelatihan',         'pelatihan',         1, 0),
  ('Konsultan',         'konsultan',         2, 0),
  ('In-house training', 'in-house-training', 3, 0),
  ('Pelatihan gratis',  'pelatihan-gratis',  4, 1);

UPDATE categories SET sort_order = 1, status = 'aktif', is_free_tier = 0 WHERE anchor = 'pelatihan';
UPDATE categories SET sort_order = 2, status = 'aktif', is_free_tier = 0 WHERE anchor = 'konsultan';
UPDATE categories SET sort_order = 3, status = 'aktif', is_free_tier = 0 WHERE anchor = 'in-house-training';
UPDATE categories SET sort_order = 4, status = 'aktif', is_free_tier = 1 WHERE anchor = 'pelatihan-gratis';

-- ============================================================================
-- BAGIAN 2 — Kolom desain kategori (migrasi 2026-10-19)
-- accent (palet warna hero) + icon (emoji) per kategori.
-- ============================================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS accent VARCHAR(20) NOT NULL DEFAULT 'blue' AFTER is_free_tier,
  ADD COLUMN IF NOT EXISTS icon   VARCHAR(20) NOT NULL DEFAULT ''   AFTER accent;

UPDATE categories SET accent = 'blue',  icon = '📚' WHERE anchor = 'pelatihan';
UPDATE categories SET accent = 'navy',  icon = '💼' WHERE anchor = 'konsultan';
UPDATE categories SET accent = 'teal',  icon = '🏭' WHERE anchor = 'in-house-training';
UPDATE categories SET accent = 'green', icon = '🎁' WHERE anchor = 'pelatihan-gratis';

-- ============================================================================
-- BAGIAN 3 — Kolom cert_available (migrasi 2026-10-28)
-- Pembeda kategori gratis murni (Rp 0 total, tanpa paket) vs
-- gratis+paket (ikut Rp 0, bisa beli paket komplit Rp CERT_FEE).
-- Default 1 = semua kategori lama mempertahankan perilaku saat ini.
-- ============================================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS cert_available TINYINT(1) NOT NULL DEFAULT 1 AFTER is_free_tier;

-- ============================================================================
-- BAGIAN 4 — Tabel services (migrasi 2026-10-22)
-- Layanan konsultan yang ditampilkan di halaman kategori "Konsultan".
-- NOTE: CREATE INDEX IF NOT EXISTS pada MariaDB/MySQL versi lama mungkin
-- tidak didukung — bila error, hapus baris CREATE INDEX dan lanjut.
-- ============================================================================

CREATE TABLE IF NOT EXISTS services (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150)  NOT NULL,
  description     TEXT          NOT NULL,
  category_anchor VARCHAR(120)  NOT NULL DEFAULT 'konsultan',
  icon            VARCHAR(20)   NOT NULL DEFAULT '',
  sort_order      INT           NOT NULL DEFAULT 0,
  status          ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services (category_anchor, status, sort_order);

-- Seed: 4 layanan konsultan awal
-- ⚠️ Jalankan HANYA SEKALI — tabel ini tidak punya constraint unik,
--    jadi eksekusi ulang akan duplikat baris.
INSERT INTO services (name, description, category_anchor, icon, sort_order) VALUES
  ('Analisis Dampak Lingkungan',
   'Mengidentifikasi, mengevaluasi, dan memitigasi dampak aktivitas terhadap lingkungan — studi KDL/UKL-UPL, AMDAL, hingga audit lingkungan berkelanjutan.',
   'konsultan', '🌱', 1),
  ('Pemberdayaan Masyarakat',
   'Merancang dan mendampingi program pemberdayaan masyarakat sekitar — penguatan kapasitas, kemitraan lokal, dan dampak sosial positif yang terukur.',
   'konsultan', '🤝', 2),
  ('Konsultan Survei, Olah Data & Surveior',
   'Perancangan kuesioner, pengerahan surveior terlatih, hingga olah data dan laporan hasil riset — dari tahap desain instrumen sampai penyajian temuan.',
   'konsultan', '📊', 3),
  ('Manajemen Kualitas',
   'Sistem manajemen mutu, implementasi dan audit standar (ISO 9001, ISO 14001, dll.), continuous improvement, dan kesiapan sertifikasi untuk organisasi Anda.',
   'konsultan', '✅', 4);

-- ============================================================================
-- VERIFIKASI — jalankan setelah import, semua harus mengembalikan data:
-- ============================================================================
-- SHOW TABLES;                                  → categories & services ada
-- SELECT COUNT(*) FROM categories;               → ≥ 8 (sinkron + 4 resmi)
-- SELECT COUNT(*) FROM services;                 → 4
-- DESCRIBE categories;                           → kolom accent, icon, cert_available ada
-- ============================================================================
