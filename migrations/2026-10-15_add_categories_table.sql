-- Migration: tambah tabel categories (kelola kategori pelatihan dari admin)
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db)
--
-- categories: daftar kategori resmi yang bisa dikelola admin (CRUD penuh),
-- terpisah dari kolom `category` di tabel trainings.
--
-- Kolom:
--   name        : nama tampilan kategori (unik, misal "Pelatihan gratis")
--   anchor      : slug URL-friendly (auto-buat dari name), dipakai link & tab
--   sort_order  : urutan tampilan di navbar & katalog (asc)
--   is_free_tier: 1 = kategori gratis (harga boleh Rp 0, sertifikat berbayar)
--   status      : aktif / nonaktif (hanya aktif yang tampil publik)
--
-- Baris lama (kategori yang sudah dipakai di trainings) disinkronkan ke tabel
-- baru sehingga tidak hilang dari navbar. INSERT IGNORE menghindari duplikat
-- bila nama sudah ada.

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

-- Sinkronkan kategori yang sudah ada di trainings ke tabel baru (aman, idempoten)
INSERT IGNORE INTO categories (name, anchor, sort_order)
SELECT t.category,
       LOWER(REPLACE(t.category, ' ', '-')),
       MIN(t.category_order)
FROM trainings t
WHERE t.category IS NOT NULL AND t.category <> ''
GROUP BY t.category;

-- Keempat kategori resmi ADTC (idempoten via INSERT IGNORE + nama unik)
INSERT IGNORE INTO categories (name, anchor, sort_order, is_free_tier) VALUES
  ('Pelatihan',        'pelatihan',        1, 0),
  ('Konsultan',        'konsultan',        2, 0),
  ('In-house training','in-house-training',3, 0),
  ('Pelatihan gratis', 'pelatihan-gratis', 4, 1);

-- Pastikan kategori resmi selalu aktif & urutan benar (idempoten)
UPDATE categories SET sort_order = 1, status = 'aktif', is_free_tier = 0 WHERE anchor = 'pelatihan';
UPDATE categories SET sort_order = 2, status = 'aktif', is_free_tier = 0 WHERE anchor = 'konsultan';
UPDATE categories SET sort_order = 3, status = 'aktif', is_free_tier = 0 WHERE anchor = 'in-house-training';
UPDATE categories SET sort_order = 4, status = 'aktif', is_free_tier = 1 WHERE anchor = 'pelatihan-gratis';
