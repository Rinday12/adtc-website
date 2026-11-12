-- Migration: tambah kategori "Pelatihan gratis + berbayar" & pastikan
-- "Pelatihan gratis" = gratis murni (cert_available = 0).
-- Jalankan di cPanel -> phpMyAdmin -> database adtc_db / adtcuadi_adtc_app.
--
-- Latar belakang: form pendaftaran membatasi kategori peserta per kategori
-- training berdasarkan 2 flag di tabel categories:
--   is_free_tier = 1 (gratis) + cert_available = 0  -> kategori peserta:
--       umum + mahasiswa_uad, harga selalu Rp 0.
--   is_free_tier = 1 + cert_available = 1  -> kategori peserta:
--       umum + mahasiswa_uad, harga Rp 0 ATAU Rp CERT_FEE (pilih sertifikat).
--
-- Kategori "Pelatihan gratis + berbayar" belum ada di tabel -> form & navbar
-- tidak bisa menunjuk kategori ini. Migration ini menambahkannya.
--
-- Semua statement idempoten (INSERT IGNORE + UPDATE): aman dijalankan ulang.

-- 1. Tambah kategori baru (anchor: buildAnchor otomatis di model bila tidak
--    di-specify; di sini dispecify eksplisit agar konsisten dengan pola
--    kategori lain: nama -> huruf kecil, spasi -> '-').
INSERT IGNORE INTO categories
  (name, anchor, sort_order, is_free_tier, cert_available, accent, icon, status)
VALUES
  ('Pelatihan gratis + berbayar',
   'pelatihan-gratis-berbayar',
   5,
   1,
   1,
   'green',
   '🎁',
   'aktif');

-- 2. Pastikan "Pelatihan gratis" (existing) = gratis MURNI, jadi berbeda
--    perilaku dari kategori baru (gratis + paket sertifikat berbayar).
--    Jika sudah 0, statement ini tidak mengubah apa pun (idempoten).
UPDATE categories SET cert_available = 0 WHERE anchor = 'pelatihan-gratis';

-- 3. Icon & accent kategori baru — pakai icon sama dengan kategori gratis
--    (gift) tapi beda warna agar mudah dibedakan di dropdown navbar.
UPDATE categories SET accent = 'teal', icon = '🎓' WHERE anchor = 'pelatihan-gratis-berbayar';
