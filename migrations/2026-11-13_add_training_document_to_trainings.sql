-- Tambah kolom training_document di tabel trainings
-- untuk menyimpan URL Google Drive (folder dokumen peserta)
ALTER TABLE trainings
  ADD COLUMN training_document VARCHAR(500) NULL
  COMMENT 'URL Google Drive folder untuk dokumen peserta (opsional)'
  AFTER fasilitas;
