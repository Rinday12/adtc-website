-- ============================================================================
-- PINDAHKAN TRAINING KATEGORI LAMA KE "Pelatihan" — PRODUCTION
-- Database: adtcuadi_adtc_app
-- Tanggal:  2026-10-28
--
-- Latar:  Migrasi 2026-10-28_deactivate_non_official_categories_prod.sql
--   sudah menonaktifkan kategori non-resmi (BNSP, Awareness, dll) sehingga
--   navbar production hanya menampilkan 4 kategori resmi. Namun,
--   trainings yang menunjuk kategori lama tetap tercatat `category=<nama lama>`
--   di tabel `trainings`, sehingga:
--     • tidak muncul di halaman /trainings/kategori/pelatihan (count 0)
--     • halaman /trainings/kategori/bnsp dll tetap terbuka (kategori nonaktif
--       masih bisa diakses via URL langsung, hanya disembunyikan dari navbar)
--
-- Solusi:  1. Pindahkan SEMUA training yang `category` bukan 4 nama resmi
--          ke `category='Pelatihan'`.
--          2. (Opsional, sudah di-migrasi sebelumnya) kategori lama
--            tetap nonaktif — tidak ada lagi training yang menunjuk ke sana.
--
-- Idempoten: UPDATE hanya mengubah baris yang masih menunjuk kategori lama;
--   bila sudah semua `category='Pelatihan'`, affected rows = 0.
--
-- Prasyarat:  tabel `trainings` kolom `category` berisi nama kategori teks
--   (bukan id) — konsisten dengan pola `findCategories()` dan view EJS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- LANGKAH 1 — Pindahkan training kategori lama → "Pelatihan"
-- Nama lama yang dikenal di production (dari dump + kategori non-resmi):
--   BNSP, Awareness, Awareness Lingkungan, Awareness Umum
--   (bisa ditambah bila ada nama lain di production — cek dulu:
--    SELECT DISTINCT category FROM trainings
--    WHERE category NOT IN ('Pelatihan','Konsultan','In-house training','Pelatihan gratis');
--   )
-- ----------------------------------------------------------------------------

UPDATE trainings
SET category = 'Pelatihan'
WHERE category IN (
    'BNSP',
    'Awareness',
    'Awareness Lingkungan',
    'Awareness Umum'
);

-- ----------------------------------------------------------------------------
-- VERIFIKASI
-- ----------------------------------------------------------------------------
-- SELECT category, COUNT(*) AS jml FROM trainings GROUP BY category ORDER BY jml DESC;
--
-- Diharapkan setelah migrasi:
--   •  4 kategori resmi (Pelatihan, Konsultan, In-house training,
--      Pelatihan gratis) = satu-satunya nilai di kolom category
--   •  count 'Pelatihan' = jumlah lama + jumlah training yang tadinya
--      masuk ke 4 kategori lama
--
-- ============================================================================
