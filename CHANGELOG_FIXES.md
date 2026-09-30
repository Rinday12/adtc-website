### Fix #17 — Tampilan Kedua Tanggal untuk Training Postpone (Asli + Baru)
Tanggal: 2026-09-30
File: views/trainings/catalog.ejs, views/trainings/detail.ejs
Masalah: Training dengan status postpone hanya menampilkan tanggal baru (`start_date` diupdate ke jadwal baru), sehingga user tidak tahu jadwal asli yang dijadwalkan ulang.
Akar: Model dan view hanya menyimpan dan menampilkan satu tanggal (`start_date`). Kolom `reschedule_date` sudah ada di DB tapi tidak dipakai di view.
Fix:
- Tambah kolom `reschedule_date DATE NULL` di tabel trainings (sudah ada di schema.sql, tidak perlu ALTER)
- Tambah field `reschedule_date` di form admin trainings (create & edit)
- Tambah validasi: `reschedule_date` wajib diisi saat status = postpone
- Di catalog.ejs: untuk training postpone dengan `reschedule_date`, tampilkan dua baris tanggal — tanggal asli (dicoret, abu-abu) + tanggal baru (kuning, tebal)
- Di detail.ejs: untuk training postpone dengan `reschedule_date`, tampilkan tanggal asli dicoret + jadwal baru dengan emoji 🔄 dan subtitle "Tanggal dijadwalkan ulang"
- Tambah `reschedule_date` ke model Training (CREATE, UPDATE)
Verifikasi: 110 test passing. Katalog menampilkan "Asli: 29 September 2026" (dicoret) + "Jadwal Baru: 15 April 2025" (kuning). Detail page menampilkan format yang sama. Button Daftar tetap disabled untuk status postpone.
Pelajaran: Fitur postpone sudah ada di backend, tapi detail tampilan kedua tanggal belum diimplementasikan sampai sekarang.
Log Keyword: postpone, reschedule-date, kedua-tanggal, original-date
Deploy: ✅ LIVE 2026-09-30

### Fix #11 — Grup WhatsApp di Payment Success & Thumbnail Bukti di Dashboard Admin
Tanggal: 2026-09-17
File: controllers/paymentController.js, views/registration/payment-success.ejs, views/admin/dashboard.ejs
Masalah: (1) Halaman payment-success tidak menampilkan grup WhatsApp meskipun peserta sudah diverifikasi. (2) Admin tidak bisa melihat thumbnail bukti pembayaran langsung dari dashboard sebelum klik detail.
Akar: Controller tidak mengirimkan groupLink ke view; dashboard tidak menampilkan gambar bukti.
Fix:
- Tambah `groupLink = registration.whatsapp_group_link || null` di paymentController.getPaymentSuccess()
- Di payment-success.ejs: tampilkan card hijau dengan tombol "Bergabung ke Grup WA" jika groupLink ada, tampilkan card biru "Selanjutnya?" jika belum ada
- Di dashboard.ejs: untuk status payment_uploaded, tambahkan thumbnail gambar bukti pembayaran (w-16 h-12) sebelum tombol verifikasi/tolak
Verifikasi: 87 test passing. Payment-success menampilkan card WhatsApp jika training memiliki group link. Dashboard admin menampilkan thumbnail bukti di baris payment_uploaded.
Pelajaran: Selalu kirim data yang dibutuhkan view dari controller. Thumbnail di dashboard menghemat waktu admin.
Log Keyword: groupLink, payment-success, WhatsApp, thumbnail, dashboard
Deploy: ✅ LIVE 2026-09-17

### Fix #10 — Upload Gambar Tidak Terangkat & Tambah Tombol Refresh Admin
Tanggal: 2026-09-17
File: app.js, views/admin/dashboard.ejs, views/admin/registration-detail.ejs
Masalah: (1) Gambar bukti pembayaran tidak bisa dibuka di admin detail (HTTP 404), karena folder uploads/ tidak di-serve sebagai static file. (2) Dashboard admin tidak ada tombol refresh untuk memuat ulang data terbaru setelah aksi approve/reject/verify.
Akar: Express hanya melayani static file dari folder public/, folder uploads/ terletak di root project.
Fix:
- Tambah `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))` di app.js setelah static public
- Tambah tombol "Refresh" dengan ikon rotate di header dashboard admin (sebelum tombol Logout)
- Di halaman detail pendaftaran admin, bukti pembayaran ditampilkan sebagai thumbnail gambar (bukan hanya link teks), memudahkan admin memverifikasi visual
Verifikasi: 87 test passing. GET /uploads/payment_proofs/filename.jpg menghasilkan 200 dengan content-type image/png. Dashboard admin menampilkan tombol Refresh.
Pelajaran: Semua direktori yang isinya file statis (uploads, assets, dll) harus didaftarkan ke express.static().
Log Keyword: static, uploads, express.static, refresh button, thumbnail
Deploy: ✅ LIVE 2026-09-17

### Fix #9 — Upload Bukti Pembayaran 400 (req.files → req.file)
Tanggal: 2026-09-17
File: controllers/paymentController.js
Masalah: User mendapat error 400 "Bukti pembayaran wajib diunggah" saat upload bukti di halaman /registrations/:id/payment, padahal file sudah dipilih.
Akar: Route publicRoutes.js menggunakan `upload.single('payment_proof')` (multer single) yang menyimpan file di `req.file`, tapi controller mengakses `req.files?.payment_proof?.[0]?.path` (format fields/multiple) yang selalu null.
Fix: Ganti `req.files?.payment_proof?.[0]?.path` menjadi `req.file?.path` di submitPayment().
Verifikasi: 87 test passing. POST /registrations/:id/payment berhasil 302 redirect ke payment-success, status berubah ke payment_uploaded, file tersimpan di uploads/payment_proofs/.
Pelajaran: Harus konsisten antara middleware upload (single vs fields) dan cara akses file di controller.
Log Keyword: multer, upload, req.file, req.files, 400 payment
Deploy: ✅ LIVE 2026-09-17

### Fix #7 — Hapus Info Rekening dari Halaman Success User
Tanggal: 2026-09-17
File: views/registration/success.ejs, controllers/registrationController.js
Masalah: Nomor rekening ditampilkan langsung di halaman success, padahal email sudah mengirim info rekening. User bisa bingung karena ada dua sumber informasi yang sama.
Akar: Halaman success menampilkan bank account info secara eksplisit.
Fix:
- Hapus section "Informasi Rekening Pembayaran" dari success.ejs
- Ganti dengan pesan informatif: rekening dikirim via email ke address user
- Hapus variabel `bankAccount` dari registrationController.getSuccess()
Verifikasi: 87 test passing. Halaman success sekarang hanya menampilkan ringkasan pendaftaran + kode referensi + instruksi email.
Pelajaran: Hindari duplikasi informasi — kalau email sudah mengirim detail, jangan tampilkan ulang di halaman web.
Log Keyword: bank account, success page, email instruction
Deploy: ✅ LIVE 2026-09-17

### Fix #8 — Fix Link Email Gmail Terblokir (localhost → BASE_URL)
Tanggal: 2026-09-17
File: views/emails/status-rejected.ejs, views/emails/status-verified.ejs
Masalah: Link di email status-rejected dan status-verified mengarah ke http://localhost:3000 — Gmail memblokir link localhost sehingga user tidak bisa klik "Lihat Detail Pendaftaran".
Akar: Template email lama menggunakan hardcoded localhost, belum pakai BASE_URL.
Fix: Ganti semua `http://localhost:<PORT>` dengan `<%= process.env.BASE_URL %>` di email templates.
Verifikasi: 87 test passing. Link email sekarang mengarah ke BASE_URL yang benar.
Pelajaran: Jangan gunakan localhost di email template — selalu gunakan BASE_URL atau environment-aware URL.
Log Keyword: localhost, gmail, link email, BASE_URL
Deploy: ✅ LIVE 2026-09-17

### Fix #6 — Reference Code + Quick Action Dashboard
Tanggal: 2026-09-17
File: models/Registration.js, controllers/registrationController.js, controllers/paymentController.js, controllers/adminController.js, routes/adminRoutes.js, views/admin/dashboard.ejs, views/admin/registration-detail.ejs, views/registration/payment.ejs, views/registration/success.ejs, views/emails/payment-info.ejs, views/emails/status-approved.ejs, tests/unit/generateReferenceCode.test.js
Masalah: Tidak ada kode unik untuk tracking transfer pembayaran; admin harus buka detail satu per satu untuk approve/reject; email tidak menyertakan kode referensi.
Akar: Kode belum diimplementasikan sama sekali di model, view, atau email.
Fix:
- Tambah kolom `reference_code VARCHAR(50) UNIQUE` di DB (sudah ada di schema.sql, ALTER TABLE dijalankan)
- Tambah `generateReferenceCode()` di Registration model (format: ADTC-YYYY-NNNN)
- Simpan kode otomatis saat create registrasi
- Tampilkan kode di halaman success, payment form, detail admin, dan email payment-info
- Tambah kolom "Kode Referensi" di dashboard admin table
- Tambah quick action inline (approve/reject) langsung dari tabel dashboard untuk status pending dan payment_uploaded
- Tambah script toggleRejectForm() di dashboard
- Tambah 4 unit test untuk generateReferenceCode
Verifikasi: 87 test passing. Kode referensi muncul di semua halaman dan email. Quick action berfungsi di dashboard.
Pelajaran: Reference code penting untuk tracking transfer bank. Quick action menghemat waktu admin.
Log Keyword: reference_code, generateReferenceCode, quick action, dashboard inline
Deploy: ✅ LIVE 2026-09-17

### Fix #5 — Admin Bisa Menolak Bukti Pembayaran (payment_uploaded → rejected)
Tanggal: 2026-09-17
File: controllers/adminController.js, routes/adminRoutes.js, views/admin/registration-detail.ejs
Masalah: Admin hanya bisa menolak pendaftaran di status `pending`, tidak bisa menolak bukti pembayaran yang sudah diunggah peserta.
Akar: Fungsi `rejectRegistration` hanya menerima status `pending`; tidak ada handler untuk status `payment_uploaded`.
Fix: 
- Tambah method `rejectPayment()` di adminController.js yang mengubah status dari `payment_uploaded` → `rejected` dengan `rejection_reason`
- Tambah route `POST /admin/registrations/:id/reject-payment` di adminRoutes.js
- Tambah tombol "Tolak Bukti" di halaman detail pendaftaran untuk status `payment_uploaded` (bersama tombol "Verifikasi Pembayaran")
- Form alasan penolakan inline muncul saat klik tombol Tolak (sama pola dengan reject pending)
- Kirim notifikasi email penolakan ke peserta setelah reject
Verifikasi: Semua 83 test passing. Admin bisa lihat detail pendaftaran, klik "Tolak Bukti", isi alasan, dan konfirmasi → status berubah ke rejected.
Pelajaran: Flow pembayaran sudah ada controller `verifyPayment`, tapi bagian reject-nya terlewat dari sesi sebelumnya.
Log Keyword: reject-payment, payment_uploaded, rejection_reason
Deploy: ✅ LIVE 2026-09-17

### Fix #2 — Sticky Header dengan Logo Baru PT. Adi Multi Teknologi
Tanggal: 2026-09-16
File: views/layout/header.ejs, views/admin/layout/main.ejs, controllers/adminTrainingController.js
Masalah: Header tidak sticky dan logo belum menggunakan brand baru PT. Adi Multi Teknologi.
Akar: Navbar lama menggunakan class `relative` bukan `sticky`, dan logo masih menggunakan SVG sederhana ADTC.
Fix: 
- Ubah navbar public menjadi `sticky top-0 z-50` di header.ejs
- Ganti logo dengan SVG baru: shape biru + arrow oranye + teks "PT. Adi Multi Teknologi"
- Tambah logo di admin top bar (views/admin/layout/main.ejs) dengan sticky positioning
- Perbaiki controller adminTrainingController.js yang rusak oleh sed sebelumnya
Verifikasi: Public page h-20 sticky, admin pages tidak ada public nav, logo PT. Adi Multi muncul di semua halaman.
Pelajaran: Hati-hati dengan sed mass replace pada controller, lebih baik edit manual.
Log Keyword: sticky, PT. Adi Multi Teknologi, logo baru
Deploy: ✅ LIVE 2026-09-16

### Fix #3 — Sticky Bottom Bar untuk Halaman User (Dashboard)
Tanggal: 2026-09-16
File: views/home.ejs
Masalah: Halaman user tidak memiliki navigasi bawah yang sticky untuk mobile.
Akar: User membutuhkan akses cepat ke menu utama tanpa harus scroll ke atas.
Fix: Tambah fixed bottom bar dengan 4 item: Beranda, Pelatihan, Berita, Daftar. Responsive (md:hidden) agar tidak muncul di desktop.
Verifikasi: Sticky bar muncul di homepage mobile, tidak muncul di admin pages.
Pelajaran: Bottom navigation bar umum untuk mobile-first design.
Log Keyword: fixed bottom-0, md:hidden, sticky bar
Deploy: ✅ LIVE 2026-09-16

### Fix #4 — Sticky Bottom Bar & Email Pembayaran
Tanggal: 2026-09-16
File: views/home.ejs, views/registration/payment.ejs, controllers/paymentController.js, utils/email.js, views/emails/payment-info.ejs
Masalah: 
1. Sticky bottom bar terlalu kecil dan logo terpotong
2. User bingung karena rekening ditampilkan langsung di halaman pembayaran tanpa instruksi email
Akar: 
- Sticky bar padding terlalu kecil (py-3) dan icon terlalu kecil (w-6 h-6)
- Halaman payment menampilkan rekening secara eksplisit tanpa informasi email
Fix:
- Update sticky bar: py-4, icon w-7 h-7, text font-semibold, CTA button lebih menonjol
- Update payment page: ganti informasi rekening dengan notifikasi email
- Tambah fungsi sendPaymentInfoEmail() di utils/email.js
- Tambah template email payment-info.ejs
- Update paymentController untuk trigger email saat user akses halaman pembayaran
Verifikasi: Sticky bar lebih rapi, payment page menampilkan info email bukan rekening.
Pelajaran: Email notification lebih secure daripada menampilkan rekening di halaman web.
Log Keyword: sticky, payment, email, rekening
Deploy: ✅ LIVE 2026-09-16

### Fix #12 — Hapus Email Ganda Info Pembayaran
Tanggal: 2026-09-17
File: controllers/paymentController.js
Masalah: Email "Informasi Pembayaran" dikirim berulang setiap kali user membuka/refresh halaman `/registrations/:id/payment`, karena `sendPaymentInfoEmail` dipanggil di GET handler.
Akar: Fungsi dipanggil di `getPaymentForm` (GET), bukan hanya saat status berubah.
Fix: Hapus panggilan `sendPaymentInfoEmail` dari `getPaymentForm`. Email info pembayaran sudah dikirim sekali saat admin approve (via `sendStatusNotification(registration, 'approved')`) yang merender template `status-approved.ejs` dengan lengkap (rekening, kode referensi, jumlah).
Verifikasi: 87 test passing. Tidak ada perubahan test karena ini hanya hapus logika redundan.
Pelajaran: Email notifikasi harus dipicu oleh perubahan status (transisi), bukan oleh page view (GET).
Log Keyword: email, double-send, payment-info, getPaymentForm
Deploy: ✅ LIVE 2026-09-17

### Fix #13 — Bulk Import Excel + Upload Cover Image Pelatihan
Tanggal: 2026-09-17
File: config/schema.sql, middleware/upload.js, models/Training.js, controllers/adminTrainingController.js, routes/adminRoutes.js, views/admin/trainings/form.ejs, views/admin/trainings/list.ejs, views/trainings/catalog.ejs, tests/unit/trainingModel.test.js
Masalah: (1) Tidak ada cara efisien untuk membuat banyak pelatihan sekaligus — admin harus input manual satu per satu. (2) Pelatihan tidak memiliki gambar cover untuk ditampilkan di katalog.
Akar: Fitur ini belum diimplementasikan sama sekali.
Fix:
- Tambah kolom `cover_image VARCHAR(500)` di tabel trainings (ALTER TABLE)
- Update middleware/upload.js: tambah routing destination untuk `training_cover` (uploads/training_covers/) dan `training_excel` (uploads/training_imports/); update fileFilter untuk terima .xlsx/.xls
- Tambah `validateTrainingRow()` dan `parseTrainingRow()` di Training model; tambah `bulkCreate(rows)` yang validasi tiap baris, generate slug unik, dan insert satu per satu
- Tambah `postBulkImport` di adminTrainingController: baca Excel pakai xlsx, map kolom (mendukung nama Inggris dan Indonesia), panggil bulkCreate, tampilkan flash sukses/gagal
- Tambah field upload `training_cover` opsional di form.ejs (create & edit)
- Tambah section "Import dari Excel" di list.ejs dengan form upload
- Tampilkan cover image di catalog card (header gambar di atas card) dan admin table
- Tambah 12 unit tests untuk validateTrainingRow dan parseTrainingRow
Verifikasi: 99 test passing (87 lama + 12 baru). Import Excel berfungsi untuk banyak baris. Cover image opsional tampil di katalog dan tabel admin.
Pelajaran: Bulk import harus memvalidasi tiap baris secara independen agar satu baris error tidak menggagalkan seluruh import.
Log Keyword: bulk-import, excel, xlsx, cover-image, training-cover
### Fix #14 — Redirect URL Training Tunggal ke Plural
Tanggal: 2026-09-17
File: routes/adminRoutes.js
Masalah: User mengakses `/admin/training/create` (tunggal) → 404, padahal route yang benar adalah `/admin/trainings/create` (plural).
Akar: Route hanya didefinisikan dengan format plural, tidak ada fallback untuk singular.
Fix: Tambah redirect otomatis dari `/admin/training*` ke `/admin/trainings*` di adminRoutes.js.
Verifikasi: `/admin/training/create` return 302 → `/admin/trainings/create` → 200 OK. Backend test: login OK, halaman create tampil normal.
Pelajaran: Pastikan URL singular dan plural keduanya bisa diakses user-friendly.
Log Keyword: training, 404, redirect, singular, plural
### Fix #15 — Perbaiki Duplikasi Elemen di Katalog Pelatihan
Tanggal: 2026-09-17
File: views/trainings/catalog.ejs
Masalah: Card pelatihan menampilkan judul dan kategori dua kali (duplikasi HTML), membuat tampilan berantakan.
Akar: Ada duplikasi block HTML untuk header card di dalam div cover_image dan else block.
Fix: Hapus duplikasi elemen, gunakan struktur yang lebih rapi dengan overlay gradient untuk card bergambar.
Verifikasi: Katalog /trainings tampil rapi, setiap card hanya menampilkan judul satu kali dengan kategori di bawahnya.
Pelajaran: Selalu periksa output HTML untuk duplikasi ketika melakukan refactor template.
Log Keyword: catalog, duplicate, training-card, layout
Deploy: Belum deploy

### Fix #16 — Katalog Pelatihan Tampil Kosong (Animasi Reveal Tidak Berfungsi)
Tanggal: 2026-09-17
File: views/trainings/catalog.ejs
Masalah: Halaman /trainings menampilkan semua 13 kartu pelatihan di HTML (verified), tapi tidak terlihat di browser. Kartu menggunakan animasi scroll-reveal (opacity:0 → opacity:1 via IntersectionObserver) yang hanya bekerja di homepage.js, tidak dimuat di halaman katalog.
Akar: Script scroll-reveal ada di public/js/home.js, dimuat hanya di views/home.ejs. Halaman katalog (/trainings) memuat catalog.ejs tanpa script tersebut, sehingga kartu tetap opacity:0 selamanya.
Fix:
- Hapus class "reveal-card" dari semua kartu pelatihan di catalog.ejs (13 kartu)
- Hapus script IntersectionObserver untuk reveal-card (tidak diperlukan lagi)
- Kartu sekarang langsung tampil tanpa animasi reveal (CSS transition tetap ada untuk hover effect)
Verifikasi: 13 kartu pelatihan muncul di halaman /trainings. Semua 12 training titles terdeteksi di HTML. Test masih passing.
Pelajaran: Pastikan script interaktif dimuat di semua halaman yang membutuhkannya, atau gunakan inline script di template yang relevan.
Log Keyword: catalog, reveal-card, intersection-observer, opacity, hidden cards
Deploy: Belum deploy
