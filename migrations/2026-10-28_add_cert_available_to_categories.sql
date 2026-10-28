-- Migration: pembeda kategori gratis "murni" vs gratis+dengan-paket-berbayar
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db, atau dev: terapkan otomatis)
--
-- Latar: kategori is_free_tier=1 kini punya dua varian perilaku:
--   1. FULL FREE   → peserta Rp 0 total, TANPA opsi sertifikat/paket komplit
--   2. GRATIS+PAKET → ikut Rp 0, peserta boleh beli paket komplit
--      (sertifikat, materi, dll.) seharga CERT_FEE (Rp 75.000)
--
-- Kolom baru:
--   cert_available: 1 = opsi paket/sertifikat berbayar DITAWARKAN ke peserta
--                   0 = kategori gratis murni — form pendaftaran tidak
--                       menampilkan opsi apa pun, tagihan selalu Rp 0.
--
-- Default 1 membuat semua kategori lama (termasuk 'Pelatihan gratis' id 11)
-- mempertahankan perilaku saat ini — perubahan bersifat ADITIF, tidak mengubah
-- data historis.

ALTER TABLE categories
  ADD COLUMN cert_available TINYINT(1) NOT NULL DEFAULT 1 AFTER is_free_tier;
