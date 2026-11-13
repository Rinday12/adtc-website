-- Override e-sertifikat per training (di luar keputusan kategori).
-- NULL = ikut default kategori (perilaku lama tidak berubah).
-- 0     = kategori gratis tapi TIDAK ada paket e-sertifikat (full free).
-- 1     = kategori gratis TAPI admin memilih tetap tawarkan paket e-sertifikat
--         (peserta bisa pilih "Gratis" atau "Dengan Sertifikat").
ALTER TABLE trainings
  ADD COLUMN cert_override TINYINT(1) NULL;
