-- ============================================================================
-- NONAKTIFKAN KATEGORI NON-RESMI — PRODUCTION
-- Database: adtcuadi_adtc_app
-- Tanggal:  2026-10-28
--
-- Latar:  Dropdown navbar production menampilkan 8 kategori (BNSP, Awareness,
--   Awareness Lingkungan, Awareness Umum, dll) sedangkan local server hanya
--   menampilkan 4 kategori resmi:
--     • 📚 Pelatihan
--     • 💼 Konsultan
--     • 🏭 In-house training
--     • 🎁 Pelatihan gratis
--
-- Solusi:  SET status='nonaktif' untuk SEMUA kategori production yang bukan
--   anchor resmi. `findCategories()` memfilter `status='aktif'`, jadi navbar
--   hanya menampilkan 4 kategori resmi setelah migrasi ini dijalankan.
--
-- Prasyarat: tabel `categories` sudah ada (migrasi 2026-10-15 / production_sql).
-- Idempoten: UPDATE hanya mengubah baris yang masih `status='aktif'`;
--   bila sudah `nonaktif` sebelumnya, affected rows = 0 — aman dijalankan ulang.
--
-- ⚠️  JANGAN gunakan DELETE — `trainings.category` adalah foreign reference
--   ke `categories.name`, bukan `categories.id`; DELETE akan memutus riwayat.
-- ============================================================================

-- HANYA 4 anchor resmi yang boleh tetap 'aktif'; semua yang lain → 'nonaktif'
UPDATE categories
SET status = 'nonaktif'
WHERE anchor NOT IN (
    'pelatihan',
    'konsultan',
    'in-house-training',
    'pelatihan-gratis'
);

-- Verifikasi: setelah migrasi, hanya 4 baris status='aktif'
-- SELECT name, anchor, status FROM categories ORDER BY sort_order, name;
--
-- Diharapkan:
--   •  status='aktif'   → 4 baris:
--       Pelatihan, Konsultan, In-house training, Pelatihan gratis
--   •  status='nonaktif' → semua kategori lain (BNSP, Awareness, dll)
--
-- ============================================================================
