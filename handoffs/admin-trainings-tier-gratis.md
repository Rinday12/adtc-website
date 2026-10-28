# Tier Gratis Kategori di Form Training & Pendaftaran
Status: BERJALAN · Service: admin + registration + view publik · Diperbarui: 2026-10-28 (Fix #35–#43)

## Sedang dikerjakan
Tidak ada — kode & verifikasi selesai; tinggal deploy (paket Fix #35 → #43).

## Status terakhir
- Fix #35: `resolveFinalPrice()` + form publik gratis (radio Gratis/Dengan Sertifikat Rp `CERT_FEE`) + blok sukses per tier. E2E terverifikasi.
- Fix #36: form `/admin/trainings/create` — banner kategori gratis, checkbox `new_cat_is_free`, bug `category-custom` tanpa `name` diperbaiki.
- Fix #37: kolom `categories.cert_available` (migrasi aditif, default 1) membedakan GRATIS MURNI (tanpa opsi 75k) vs GRATIS+PAKET KOMPLIT (opsi 75k). Guard server-side: kategori murni selalu 0 meski form dipaksa kirim `sertifikat`.
- Fix #38: 3 field harga (umum/UAD/karyawan) dinonaktifkan otomatis saat kategori gratis; validasi server tidak memaksanya; dipaksa simpan 0.
- Fix #39: ikon emoji percent-encoded (`%F0%9F%8E%89`) dinormalisasi via `Category.normalizeIcon`.
- Fix #40: form kategori memakai radio 3 opsi "tipe biaya" (Berbayar / Full free / Gratis + paket komplit Rp CERT_FEE) menggantikan checkbox bertumpuk; sinkronisasi ke hidden `is_free_tier`/`free_pure`; controller & model tak diubah. Tabel daftar kini menampilkan varian tiap kategori.
- **Keputusan data dev**: kategori "Full Free" (id 17) dan "Gratis Paket Komplit" sudah disatukan/dihapus; varian gratis-paket memakai "Pelatihan gratis" (id 11, cert_available=1). Dua varian di prompt user tersedia sebagai TIPE DI FORM, bukan baris kategori ganda.
- Data dev terkini: baris kategori **"Full Gratis" (id 25)** ada di DB dev (`is_free_tier=1, cert_available=0`, ikon 🆓, sort 5) — bisa dipakai langsung untuk test; 2 training di "Pelatihan gratis" (vesdw id 30, btht id 37) tak tersentuh.
- Fix #41: halaman detail training — bagian tabel biaya pendaftaran & catatan dokumen **disembunyikan** bila kategori full gratis (`is_free_tier && cert_available=0`), diganti banner hijau "sepenuhnya gratis, Rp 0 total". Form publik (Fix #35) & alur berbayar/gratis+paket tak berubah. 127 test passing.
- Fix #42: teks tier di halaman kategori dibedakan per varian — badge hero "Rp 0 total", harga kartu, dan intro. 127 test passing.
- Fix #43: kartu program di `/trainings/kategori/<anchor>` disamakan markup-nya dengan kartu katalog `/trainings`; tombol "Lihat Detail" yang sebelumnya memakai handler JS tak ada (`handleDetailClick` → `ReferenceError`) diganti plain anchor. Halaman kategori: 0 handler rusak, 18 plain anchor; 127 test passing.
- 127 test passing. DB dev bersih dari data uji.

## Langkah berikutnya
1. **Migrasi DULU di produksi**: `migrations/2026-10-28_add_cert_available_to_categories.sql`, baru deploy kode (kode baru query-nya butuh kolomnya).
   - Note: kategori "Gratis Paket Komplit" (session sebelumnya) sudah dihapus; tier gratis-paket memakai "Pelatihan gratis" (id 11) yang sudah ada.
2. Set `CERT_FEE=75000` di `.env.production` bila belum ada.
3. Verifikasi prod: kategori full free → form publik tanpa radio; kategori paket → submit `sertifikat` → `final_price=75000`.
4. Update entri Fix #35/#36/#37 jadi `✅ LIVE <tanggal>` + hapus handoff ini.

## Jangan lakukan
- Jangan jalankan kode Fix #37 tanpa migrasi kolomnya dulu (query subselect error di DB lama).
- Jangan ubah `is_free_tier`/`cert_available` kategori pre-existing lewat form training (flag otomatis hanya untuk kategori yang DIKREASIKAN dari form training) — kelola lewat `/admin/categories`.
