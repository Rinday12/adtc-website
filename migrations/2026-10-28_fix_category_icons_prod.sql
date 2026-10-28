-- ============================================================================
-- PERBAIKAN ICON & AKENT KATEGORI — PRODUCTION
-- Database: adtcuadi_adtc_app
--
-- Masalah:  Dropdown navbar menampilkan "? Pelatihan", "? Konsultan", dll —
--   ada dua baris kategori resmi di tabel: baris ganda (tanpa ikon, dari
--   sinkronisasi otomatis) dan baris resmi (dengan ikon). Baris ganda tidak
--   punya ikon sehingga render jadi "? Nama".
--
-- Solusi:  1. Hapus baris ganda (yang tanpa ikon) dari 4 kategori resmi,
--          sehingga hanya baris resmi (dengan ikon) yang tersisa.
--          2. Beri ikon & akur ke semua kategori yang masih kosong.
--
-- Prasyarat: tabel categories sudah ada (lihat 2026-10-28_production_sql.sql).
-- Idempoten: UPDATE hanya menyentuh baris yang belum punya ikon; DELETE
--            hanya menjalankan bila baris ganda masih ada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- LANGKAH 1 — Hapus baris ganda (tanpa ikon) dari 4 kategori resmi
-- Baris resmi dikenali karena sudah punya ikon; baris ganda icon = ''.
-- trainings tidak menunjuk categories.id, hanya categories.name, sehingga
-- hapus baris ganda tidak memutus referensi.
-- ----------------------------------------------------------------------------

DELETE FROM categories WHERE anchor = 'pelatihan'          AND icon = '';
DELETE FROM categories WHERE anchor = 'konsultan'          AND icon = '';
DELETE FROM categories WHERE anchor = 'in-house-training'  AND icon = '';
DELETE FROM categories WHERE anchor = 'pelatihan-gratis'   AND icon = '';

-- Pastikan baris resmi selalu aktif, ikon & akur benar, urutan benar
UPDATE categories SET icon = '📚', accent = 'blue',  sort_order = 1, is_free_tier = 0, status = 'aktif' WHERE anchor = 'pelatihan';
UPDATE categories SET icon = '💼', accent = 'navy',  sort_order = 2, is_free_tier = 0, status = 'aktif' WHERE anchor = 'konsultan';
UPDATE categories SET icon = '🏭', accent = 'teal',  sort_order = 3, is_free_tier = 0, status = 'aktif' WHERE anchor = 'in-house-training';
UPDATE categories SET icon = '🎁', accent = 'green', sort_order = 4, is_free_tier = 1, status = 'aktif' WHERE anchor = 'pelatihan-gratis';

-- ----------------------------------------------------------------------------
-- LANGKAH 2 — Beri ikon & akur ke kategori lainnya
-- Peta disesuaikan dengan kategori yang ada di dump produksi.
-- ----------------------------------------------------------------------------

UPDATE categories SET icon = '📣', accent = 'blue'   WHERE anchor = 'awareness'            AND icon = '';
UPDATE categories SET icon = '🏅', accent = 'blue'   WHERE anchor = 'bnsp'                 AND icon = '';
UPDATE categories SET icon = '🔧', accent = 'navy'   WHERE anchor = 'kompetensi-teknis'    AND icon = '';
UPDATE categories SET icon = '🖥️', accent = 'purple' WHERE anchor = 'programming'          AND icon = '';
UPDATE categories SET icon = '🌐', accent = 'teal'   WHERE anchor = 'jaringan'             AND icon = '';
UPDATE categories SET icon = '🌱', accent = 'teal'   WHERE anchor = 'awareness-lingkungan' AND icon = '';
UPDATE categories SET icon = '📢', accent = 'blue'   WHERE anchor = 'awareness-umum'       AND icon = '';
UPDATE categories SET icon = '🌐', accent = 'navy'   WHERE anchor = 'data-analyst'         AND icon = '';
UPDATE categories SET icon = '🤖', accent = 'purple' WHERE anchor = 'data-scientist'       AND icon = '';
UPDATE categories SET icon = '🎨', accent = 'green'  WHERE anchor = 'desain-multimedia-muda' AND icon = '';
UPDATE categories SET icon = '🛠️', accent = 'red'    WHERE anchor = 'investigasi-kecelakaan-kerja' AND icon = '';
UPDATE categories SET icon = '⚡', accent = 'green'  WHERE anchor = 'pengendalian-pencemaran-air' AND icon = '';
UPDATE categories SET icon = '🔋', accent = 'green'  WHERE anchor = 'pengenalan-teknologi-baterai-listrik-dan-pembangkit-ebt' AND icon = '';
UPDATE categories SET icon = '☀️', accent = 'green'  WHERE anchor = 'perakitan-solar-cell-applied' AND icon = '';
UPDATE categories SET icon = '📋', accent = 'navy'   WHERE anchor = 'praktikal-office-advance' AND icon = '';
UPDATE categories SET icon = '📱', accent = 'green'  WHERE anchor = 'social-media-marketing' AND icon = '';
UPDATE categories SET icon = '💻', accent = 'purple' WHERE anchor = 'web-developer'        AND icon = '';

-- Fallback: kategori yang belum dipeta → ikon netral, akur biru
UPDATE categories SET icon = '📋', accent = 'blue' WHERE icon = '';

-- ----------------------------------------------------------------------------
-- VERIFIKASI — jalankan setelah import
-- ----------------------------------------------------------------------------
-- SELECT id, name, anchor, icon, accent, sort_order FROM categories ORDER BY sort_order, id;
-- Setiap anchor resmi hanya satu baris; tidak ada ikon kosong.
-- ----------------------------------------------------------------------------
