# Pembersihan Dead Code + Fix Label
Status: SELESAI · Service: seluruh proyek · Diperbarui: 2026-11-13 14:30

## Ringkasan
Sesi ini menyelesaikan 4 pekerjaan:
1. Tambah sub-radio cert_option di form kategori (Fix #56)
2. Update form + controller untuk semua kategori gratis menampilkan opsi payment (Fix #35 enhancement)
3. Ganti label "Mahasiswa UAD" → "Mahasiswa" di semua view
4. Bersihkan dead code di seluruh proyek (Fix #58)

## Yang Sudah Terverifikasi
- npm test: 130/130 pass (23 property test + 107 unit test)
- E2E manual: form admin kategori menampilkan sub-radio cert_opt saat free_pkg dipilih
- Form pendaftaran publik: semua kategori gratis menampilkan opsi Paket Lengkap (Rp 75.000)
- Label "Mahasiswa UAD" diganti "Mahasiswa" di: form pendaftaran, halaman detail training, admin views
- Dead code dihapus: countByTraining(), findAllActive(), console.log debug, route duplikat, eksport unused

## File Utama yang Diubah
- views/admin/categories/form.ejs — tambah sub-radio cert_opt
- views/registration/form.ejs — perbaiki logika menampilkan payment options
- controllers/registrationController.js — update resolveFinalPrice
- views/trainings/category.ejs, detail.ejs — hapus branch full-free khusus
- models/Registration.js, Service.js — hapus method unused
- app.js, routes/adminRoutes.js, utils/seo.js, utils/email.js — bersihkan dead code

## Langkah Berikutnya (jika perlu lanjut)
- Deploy ke production (butuh `CERT_FEE=75000` di env production)
- Jalankan migration jika ada skema DB yang belum update
- Test di staging sebelum production

## Jangan Lakukan
- Jangan hapus `findAllActiveByCategory()` — masih dipakai di publicController.js
- Jangan ubah nilai `free_pure` di hidden field — controller sudah membaca ini
- Jangan deploy tanpa set CERT_FEE di env production

## Referensi Changelog
Fix #35, #47, #48, #52, #53, #54, #55, #56, #57, #58
