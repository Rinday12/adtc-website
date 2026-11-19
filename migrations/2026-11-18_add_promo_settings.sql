-- migrations/2026-11-18_add_promo_settings.sql
-- Tabel setting promo global (1 baris per promo aktif).
-- Dipakai registrationController.calculateFinalPrice untuk mengganti
-- harga normal (per kategori) dengan harga promo tunggal selama periode
-- promo berlangsung — skema "diskon awal tahun" yang berlaku untuk
-- SEMUA kategori berbayar sekaligus, tanpa perlu menambah kolom di
-- tabel trainings.
CREATE TABLE promo_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(120) NOT NULL DEFAULT '',
  promo_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  promo_starts_at DATETIME NULL,
  promo_ends_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
