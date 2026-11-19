### Fix #60 — Tambah fitur harga promo per training (fallback ke harga global)
Tanggal: 2026-11-19
Masalah: Skema promo global awal (Fix #59) memakai 1 harga tunggal (`promo_settings.promo_price`) untuk semua training & kategori berbayar — admin tak bisa membedakan harga promo antar training.
Akar: Implementasi awal fitur promo hanya mengantisipasi skenario 1 promo 1 harga; tabel promo belum pernah punya relasi ke training.
Fix: Tabel baru `promo_trainings` (promo_id, training_id, promo_price; FK CASCADE ke promo_settings & trainings; kolom `training_id` bertipe `INT` — bukan `INT UNSIGNED` — karena PRIMARY KEY tabel `trainings` bertipe signed `int(11)`, sehingga `INT UNSIGNED` akan memicu FK type mismatch saat CREATE). `PromoSetting.findActive()` kini JOIN `promo_trainings` dan mengembalikan `{...parent, byTraining: {trainingId: price}}` (object, bukan Map — object key selalu string, konsisten dengan cara view/controller mengindeksnya). `PromoSetting.set()` menerima `byTraining` (hapus baris anak lama via DELETE, INSERT yang baru dalam transaksi). Form admin (`views/admin/promo/form.ejs`) tambah section "Training yang Ikut Promo": checkbox per training + input harga (disabled saat tak tercentang); POST simpan array paralel `training_ids[]`/`promo_prices[]` (kosong = fallback ke harga global). `calculateFinalPrice` pakai `promo.byTraining[training.id]` bila ada, selain itu fallback `promo.promo_price` — sebelum cek "promo harus lebih murah dari harga normal" (guard tetap berlaku, mencegah byTraining yang justru menaikkan harga). Semua IIFE view publik (catalog/category/home hero+card/registration form/detail) di-update dengan pola sama: training yang tak masuk daftar `byTraining` tetap tampilkan harga normal, hanya training terpilih yang tampilkan banner promo. `views/trainings/detail.ejs` & `views/registration/form.ejs` tambah variabel `promoPrice`/`promoDisplayPrice` (harga efektif per training) untuk banner & tabel harga per kategori — bukan lagi `promoNow.promo_price` global.
Verifikasi: 138 test lulus (termasuk 2 property test baru di calculateFinalPrice.test.js: "byTraining ada untuk training → pakai harga per training"; "byTraining tak ada → fallback ke harga global"; plus fix 1 assertion test lama yang buggy — `promo sudah berakhir` assert `result > 1` padahal harga normal bisa 1, diganti cukup `result === expected`).
Pelajaran: Tipe kolom FK di MySQL harus SESUAI dengan tipe kolom PRIMARY KEY yang direferensikan (signed vs unsigned) — `INT UNSIGNED` di FK yang menunjuk `int(11)` signed akan gagal saat CREATE TABLE; cek tipe PK tabel target dulu sebelum menulis migration FK. `byTraining` direpresentasikan sebagai plain object (key string), bukan Map — konsisten dengan cara `training.id` (number dari DB) dipakai sebagai indeks di view EJS (JS object key otomatis jadi string).
Log Keyword: promo per training, byTraining, promo_trainings, INT UNSIGNED FK mismatch
Deploy: ✅ LIVE 2026-11-19 — commit f63a4da; migrasi `2026-11-18_add_promo_settings.sql` & `2026-11-19_add_promo_trainings.sql` sudah dijalankan di DB lokal (`adtc_db`, tabel terverifikasi ADA) & committed. Catatan: migrasi `2026-11-18` sudah dijalankan di DB lokal sebelumnya; migrasi `2026-11-19` juga sudah terkonfirmasi ada. Untuk production, jalankan KEDUA migrasi di DB prod SEBELUM deploy kode bila belum (form admin "Setting Promo" akan error 500 saat save tanpa tabelnya — `findActive()` sendiri sudah punya fallback catch yang mengembalikan baris parent saja tanpa `byTraining`, jadi view publik aman).

### Fix #59 — Tambah fitur diskon/promo harga global per periode
Tanggal: 2026-11-18
File: migrations/2026-11-18_add_promo_settings.sql, models/PromoSetting.js, controllers/adminPromoController.js, routes/adminRoutes.js, views/admin/promo/form.ejs, views/admin/layout/sidebar.ejs, controllers/publicController.js, controllers/contentController.js, views/trainings/detail.ejs, views/trainings/catalog.ejs, views/trainings/category.ejs, views/home.ejs, views/registration/form.ejs, controllers/registrationController.js, tests/property/calculateFinalPrice.test.js
Masalah: Tidak ada mekanisme diskon global untuk semua kategori berbayar; admin harus ubah harga tiap training manual saat mau promo.
Akar: Belum pernah diimplementasikan fitur promo sejak awal proyek.
Fix: Skema 1 setting global per periode — tabel `promo_settings` (label, promo_price, promo_starts_at, promo_ends_at, is_active). Model PromoSetting.findActive() ambil 1 baris aktif; set() auto nonaktifkan promo lama saat setting baru diaktifkan. `calculateFinalPrice(category, training, promo)` (argumen promo baru) hanya menggantikan harga normal per kategori bila promo aktif + dalam periode + promo_price < harga normal kategori (mencegah "promo" justru menaikkan harga). Kategori gratis tak tersentuh promo. View publik (detail/catalog/category/home/registration form) tampilkan banner + harga normal dicoret + harga promo bila promo valid; server-side submitForm pakai nilai yang sama.
Verifikasi: 136 tests lulus (termasuk 6 property test promo baru di calculateFinalPrice.test.js: promo aktif & lebih murah → promo_price; lebih mahal → normal; berakhir/belum mulai/is_active=false → normal; tanpa batas waktu → berlaku).
Pelajaran: Signature `calculateFinalPrice` berubah (tambah argumen ke-3 `promo`) — pemanggil lama yang tak di-update diam-diam dapat `undefined` (aman, teruji), tapi test property yang mendefinisikan versi lokal sendiri tak akan otomatis gagal; wajib di-update manual supaya tetap selaras dengan controller.
Deploy: ✅ LIVE 2026-11-19 — commit f63a4da; migrasi `2026-11-18_add_promo_settings.sql` sudah dijalankan di DB lokal & committed. Untuk production: jalankan migrasi di DB prod SEBELUM deploy kode (form admin "Setting Promo" akan error 500 saat save tanpa tabelnya — `getActivePromo()` pakai fallback catch return null, jadi view publik aman).

### Fix #58 — Bersihkan dead code: hapus fungsi/method/eksport yang tidak terpakai
Tanggal: 2026-11-13
File: models/Registration.js, models/Service.js, models/Training.js, app.js, routes/adminRoutes.js, utils/seo.js, utils/email.js, middleware/upload.js, controllers/adminController.js, controllers/adminCategoryController.js, controllers/adminTrainingController.js, controllers/registrationController.js
Masalah: Proyek menumpuk method/fungsi/eksport yang tidak lagi dipakai setelah refactor (Fix #35, #48, #47, dll.) — membingungkan maintainer & menambah surface area.
Akar: Perubahan fitur (hapus tier, ubah label, tambah opsi) tidak diikuti pembersihan kode lama; tiap sesi fokus fitur baru, dead code terakumulasi.
Fix:
- `models/Registration.js`: hapus `countByTraining()` (tidak dipanggil di controller/view)
- `models/Service.js`: hapus `findAllActive()` (hanya `findAllActiveByCategory()` yang dipakai)
- `models/Training.js`: hapus 3 field unused di select query (2 kolom lama yang sudah tak relevan)
- `app.js`: hapus `console.log` debug `[MW] Categories loaded:`
- `routes/adminRoutes.js`: hapus GET `/training/import` (sudah ada `/trainings/import`)
- `utils/seo.js`: hapus eksport `jsonLd`, `BASE`, `KEYWORDS`, `DEFAULTS` (hanya `metaTags` yang dipakai)
- `utils/email.js`: hapus `console.log` debug di function kirim email
- `middleware/upload.js`: hapus komentar dead code
- `controllers/*`: hapus variabel/fungsi lokal yang tak terpakai
Verifikasi: grep global memastikan tidak ada referensi ke function yang dihapus. npm test: 130/130 pass (23 property test + 107 unit test). Server startup bersih tanpa error.
Pelajaran: Tiap selesai refactor fitur besar, jalankan `grep -rn "functionName" --include="*.js" | grep -v "models/\|test"` untuk menemukan caller; bila 0 hasil → hapus. Jangan tunggu sesi khusus "cleanup" — lakukan saat mengubah file terkait.
Log Keyword: dead code, unused function, countByTraining, findAllActive, cleanup

### Fix #57 — Sederhanakan teks UI: semua kategori gratis kini menampilkan opsi Paket Lengkap
