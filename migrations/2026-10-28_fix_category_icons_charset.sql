-- ============================================================================
-- PERBAIKAN IKON KATEGORI (_CHARSET_UTF8MB4)
-- Database: adtcuadi_adtc_app
--
-- Akar masalah: import sebelumnya menggunakan client dengan charset latin1,
-- sehingga emoji di kolom categories.icon tersimpan sebagai '?'.
-- Baris pertama SET NAMES utf8mb4 PERLU dijalankan SETIAP import agar
-- literal emoji sampai utuh ke server.
--
-- Cara pakai di server:
--   mysql --default-character-set=utf8mb4 -u adtcuadi_adtc_app -p adtcuadi_adtc_app \
--     < migrations/2026-10-28_fix_category_icons_charset.sql
-- ============================================================================

SET NAMES utf8mb4;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Rekatkan baris ganda kategori resmi tanpa ikon (idempoten)
DELETE FROM categories WHERE anchor = 'pelatihan'          AND icon = '';
DELETE FROM categories WHERE anchor = 'konsultan'          AND icon = '';
DELETE FROM categories WHERE anchor = 'in-house-training'  AND icon = '';
DELETE FROM categories WHERE anchor = 'pelatihan-gratis'   AND icon = '';

-- Ikon & acent kategori resmi (baris resmi — harus sudah ada dari migrasi dasar)
UPDATE categories SET icon = '📚', accent = 'blue',  sort_order = 1, is_free_tier = 0, status = 'aktif' WHERE anchor = 'pelatihan';
UPDATE categories SET icon = '💼', accent = 'navy',  sort_order = 2, is_free_tier = 0, status = 'aktif' WHERE anchor = 'konsultan';
UPDATE categories SET icon = '🏭', accent = 'teal',  sort_order = 3, is_free_tier = 0, status = 'aktif' WHERE anchor = 'in-house-training';
UPDATE categories SET icon = '🎁', accent = 'green', sort_order = 4, is_free_tier = 1, status = 'aktif' WHERE anchor = 'pelatihan-gratis';

-- Ikon & acent kategori lainnya — per anchor yang terdeteksi di dump production
UPDATE categories SET icon = '🏅', accent = 'blue'   WHERE anchor = 'bnsp'                 AND icon NOT IN ('📚','💼','🏭','🎁');
UPDATE categories SET icon = '🌱', accent = 'teal'   WHERE anchor = 'awareness-lingkungan' AND icon NOT IN ('📚','💼','🏭','🎁');
UPDATE categories SET icon = '📣', accent = 'blue'   WHERE anchor = 'awareness-umum'       AND icon NOT IN ('📚','💼','🏭','🎁');
UPDATE categories SET icon = '🌐', accent = 'navy'   WHERE anchor = 'data-analyst'         AND icon NOT IN ('📚','💼','🏭','🎁');
UPDATE categories SET icon = '🤖', accent = 'purple' WHERE anchor = 'data-scientist'       AND icon NOT IN ('📚','💼','🏭','🎁');
UPDATE categories SET icon = '💻', accent = 'purple' WHERE anchor = 'web-developer'        AND icon NOT IN ('📚','💼','🏭','🎁');
UPDATE categories SET icon = '📱', accent = 'green'  WHERE anchor = 'social-media-marketing' AND icon NOT IN ('📚','💼','🏭','🎁');
UPDATE categories SET icon = '📋', accent = 'navy'   WHERE anchor = 'praktikal-office-advance' AND icon NOT IN ('📚','💼','🏭','🎁');

-- Fallback: semua baris yang masih tanpa ikon (atau ikon masih '?' dari bug lama)
UPDATE categories
   SET icon = '📋', accent = 'blue'
 WHERE icon NOT IN ('📚','💼','🏭','🎁','🏅','🌱','📣','🌐','🤖','💻','📱','📋')
    OR icon = '';

-- ============================================================================
-- VERIFIKASI — jalankan setelah import:
-- SELECT anchor, icon, accent, sort_order FROM categories ORDER BY sort_order, id;
-- Tidak boleh ada '?'/kosong di kolom icon.
-- ============================================================================
