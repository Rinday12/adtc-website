-- migrations/2026-11-19_add_promo_trainings.sql
-- Tabel anak promo_settings: harga promo per training (opsional).
-- promo_settings.promo_price tetap dipakai sebagai harga default/fallback
-- bila admin tidak mengisi harga khusus untuk training tertentu —
-- kompatibilitas dengan skema lama (1 harga global untuk semua training).
-- Catatan: tipe training_id memakai INT (bukan INT UNSIGNED) agar cocok
-- dengan tipe PRIMARY KEY tabel `trainings` (int(11), signed) — FK hanya
-- dapat dibuat bila tipe kolom referensi identik (MySQL/MariaDB).
CREATE TABLE promo_trainings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  promo_id INT UNSIGNED NOT NULL,
  training_id INT NOT NULL,
  promo_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_promo_training (promo_id, training_id),
  CONSTRAINT fk_pt_promo FOREIGN KEY (promo_id) REFERENCES promo_settings(id) ON DELETE CASCADE,
  CONSTRAINT fk_pt_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
