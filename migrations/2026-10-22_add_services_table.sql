-- Migration: tambah tabel services (layanan konsultan yang bisa dikelola admin)
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db)
--
-- services: daftar layanan konsultan/kegiatan sejenis yang ditampilkan di
--           halaman kategori publik (mis. halaman "Konsultan").
--           Dipisah dari tabel trainings karena layanan ini bersifat
--           deskriptif (tanpa pendaftaran/pelatihan terjadwal), tapi
--           tetap bisa ditambahkan/diedit admin kapan saja.
--
-- Kolom:
--   name            : nama layanan (mis. "Analisis Dampak Lingkungan")
--   description     : penjelasan singkat layanan
--   category_anchor : anchor kategori pemilihnya di tabel categories
--                     (mis. 'konsultan'), NULL = tampil di semua kategori
--   icon            : emoji pendek untuk tampilan card
--   sort_order      : urutan tampilan (asc)
--   status          : aktif / nonaktif (hanya aktif yang tampil publik)
--
-- Idempoten: CREATE TABLE IF NOT EXISTS + INSERT IGNORE (bukan unik, bisa
-- dijalankan ulang — untuk seed manual, gunakan kunci (name, category_anchor)
-- hanya sebagai panduan, bukan CONSTRAINT, supaya admin tetap bisa menambah
-- layanan dengan nama sama di kategori berbeda bila perlu).

CREATE TABLE IF NOT EXISTS services (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150)  NOT NULL,
  description     TEXT          NOT NULL,
  category_anchor VARCHAR(120)  NOT NULL DEFAULT 'konsultan',
  icon            VARCHAR(20)   NOT NULL DEFAULT '',
  sort_order      INT           NOT NULL DEFAULT 0,
  status          ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services (category_anchor, status, sort_order);

-- Seed: 4 layanan konsultan awal yang diumumkan (idempoten via CHECK manual —
-- tidak ada constraint unik di tabel ini, jadi jalankan sekali saja / pastikan
-- tidak duplikat nama sebelum execute).
INSERT INTO services (name, description, category_anchor, icon, sort_order) VALUES
  ('Analisis Dampak Lingkungan',
   'Mengidentifikasi, mengevaluasi, dan memitigasi dampak aktivitas terhadap lingkungan — studi KDL/UKL-UPL, AMDAL, hingga audit lingkungan berkelanjutan.',
   'konsultan', '🌱', 1),
  ('Pemberdayaan Masyarakat',
   'Merancang dan mendampingi program pemberdayaan masyarakat sekitar — penguatan kapasitas, kemitraan lokal, dan dampak sosial positif yang terukur.',
   'konsultan', '🤝', 2),
  ('Konsultan Survei, Olah Data & Surveior',
   'Perancangan kuesioner, pengerahan surveior terlatih, hingga olah data dan laporan hasil riset — dari tahap desain instrumen sampai penyajian temuan.',
   'konsultan', '📊', 3),
  ('Manajemen Kualitas',
   'Sistem manajemen mutu, implementasi dan audit standar (ISO 9001, ISO 14001, dll.), continuous improvement, dan kesiapan sertifikasi untuk organisasi Anda.',
   'konsultan', '✅', 4);
