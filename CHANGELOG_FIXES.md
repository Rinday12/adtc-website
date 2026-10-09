### Fix #32 — Jumlah Pembayaran Rp 0 di Halaman User, Admin & Email (Bug DECIMAL string → 0)
Tanggal: 2026-10-09
File: controllers/registrationController.js, models/Registration.js, utils/email.js, views/admin/registrations.ejs
Masalah: Pendaftaran dengan harga training 2.300.000 menampilkan "Rp 0" di halaman pembayaran user, halaman detail admin, dan email "Informasi Pembayaran".
Akar: `mysql2` mengembalikan kolom DECIMAL(10,2) sebagai **string** (mis. `"2300000.00"`), bukan number. Di `calculateFinalPrice`, string ini tidak dikonversi ke number. Line `const final_price = calculateFinalPrice(...) || 0` → string truthy → tidak aktif, tapi `safeFinalPrice` cek `typeof === 'number'` dan gagal (string) → `safeFinalPrice = 0` yang di-INSERT ke DB. `Registration.findById` juga mengembalikan `final_price` sebagai string dari DB, sehingga `fmt.format(string)` di semua view menghasilkan "Rp 0" atau format salah.
Fix:
- `calculateFinalPrice`: konversi `training.price_*` (string DECIMAL) → `Number()` + guard `isNaN → 0`; tambah guard `if (!training) return 0`.
- Hapus `|| 0` di line `const final_price = calculateFinalPrice(...)` — fungsi sudah return number.
- `Registration.findById`: `row.final_price = Number(row.final_price)` sebelum return, agar semua view EJS (user + admin) dan `sendPaymentInfoEmail` menerima number.
- `utils/email.js sendPaymentInfoEmail`: `{...registration, final_price: Number(registration.final_price || 0)}` sebelum render template.
- `views/admin/registrations.ejs`: `Number(reg.final_price || 0).toLocaleString('id-ID')`.
Verifikasi: 117 unit+property test passing. Test `calculateFinalPrice` (tests/property/calculateFinalPrice.test.js): 4/4 PASS — kategori umum/mahasiswa/karyawan & training null semua return number benar. 2 kegagalan lama di `generateReferenceCode.test.js` (regresi lama, bukan dari fix ini).
Pelajaran: Semua kolom DECIMAL dari mysql2 = string. Setiap tempat yang membaca kolom DECIMAL dari DB dan memakainya sebagai number WAJIB dikonversi dengan `Number()`. Jangan percaya `typeof` check atau `|| 0` untuk handling DECIMAL string — string selalu truthy sehingga fallback tidak pernah aktif.
Log Keyword: final_price, DECIMAL, mysql2, Rp 0, calculateFinalPrice, payment, toLocaleString

### Fix #31 — Logo tidak muncul di hasil pencarian + keywords SEO tidak ada
Tanggal: 2026-10-07
File: utils/seo.js, views/layout/header.ejs, controllers/contentController.js, public/images/logo/favicon-*.png, public/images/logo/adtc-og-image.png
Masalah: (1) Hasil pencarian Google tidak menampilkan logo/favicon situs — hanya ikon default atau kosong. (2) Meta description tidak mengandung keyword "Pelatihan UAD", "BNSP", "Pelatihan K3", sehingga situs tidak ranking untuk pencarian tersebut.
Akar: `views/layout/header.ejs` hanya mendaftarkan SVG favicon (`adtc-icon.svg`) tanpa multi-size PNG — Google/Chrome membutuhkan PNG 16/32/180/192/512 untuk menampilkan logo di hasil pencarian. Tidak ada JSON-LD structured data (schema.org Organization/WebSite) sehingga Google tidak punya instruksi formal untuk menampilkan logo. Meta description default di `utils/seo.js` tidak mengandung keyword yang ditargetkan.
Fix: (a) Generate 5 ukuran favicon PNG (16/32/180/192/512) + og-image 1200×630 dari `adtc-logo.svg` & `adtc-icon.svg` (Pillow + librsvg). (b) Tambah `jsonLd()` ke `utils/seo.js` — output JSON-LD `WebSite` + `Organization` + `WebPage` (schema.org, `@graph`) berisi `logo`, `image`, `sameAs` (Instagram), `url`. (c) Tambah `meta name="keywords"` berisi "Pelatihan UAD, Pelatihan BNSP, Pelatihan K3, Sertifikasi BNSP Yogyakarta, Pelatihan Kerja Ahmad Dahlan". (d) Ganti `og:image` dari SVG ke `adtc-og-image.png` (raster, wajib untuk preview share). (e) `header.ejs`: hapus favicon lama (sudah ditangani `metaTags`). (f) `contentController.getHome`: set `metaDescription` eksplisit dengan keyword.
Verifikasi: Test suite penuh (unit + property) dijalankan — 2 kegagalan ada di `generateReferenceCode.test.js` (regresi lama, tidak terkait). Output `metaTags({url:'/'})` berisi semua tag baru: favicon multi-size, keywords, JSON-LD Organization dengan logo. Output JSON-LD divalidasi manual: valid syntax, semua `@id` silang konsisten.
Pelajaran: `meta name="keywords"` tidak lagi dipergunakan Google untuk ranking, tapi tetap berguna untuk Bing/Yandex dan membantu internal Google memahami topik — tidak ada kerugian. JSON-LD `Organization.logo` (SVG) + `image` (PNG raster) keduanya wajib: SVG untuk browser, PNG untuk mesin yang tidak support SVG.
Log Keyword: favicon, logo search, og-image, JSON-LD, schema.org, keywords, Pelatihan UAD, BNSP, K3, seo.js, header.ejs
Deploy: PENDING DEPLOY

### Fix #30 — POST /admin/trainings/:id/delete Error 500 (Bug Destructuring db)
Tanggal: 2026-10-05
File: controllers/adminTrainingController.js, tests/unit/trainingDelete.test.js
Masalah: Saat admin menghapus pelatihan (POST /admin/trainings/3/delete), server mengembalikan 500 "Terjadi kesalahan server" — tidak ada data yang terhapus.
Akar: `postDelete` memakai `const { db } = require('../config/db')`, tetapi `config/db.js` mengeksport promise pool secara langsung (`module.exports = promisePool`), bukan objek `{ db }`. Akibatnya `db` = `undefined` dan `db.execute(...)` melempar `Cannot read properties of undefined (reading 'execute')` → Express error handler → 500. Bug ini sudah ada sejak `postDelete` ditulis; semua `require('../config/db')` lain di file ini (line 89 dll.) sudah benar, hanya baris ini yang salah.
Fix: Ganti menjadi `const db = require('../config/db')` + tambah 3 unit test baru (urutan DELETE: registrations dulu lalu trainings; error di DELETE pertama tidak menjangkiti kedua; `next(err)` terpanggil dengan error yang benar).
Verifikasi: Unit test baru lulus (3/3); suite penuh: 117 lulus, 2 gagal — 2 kegagalan itu di `generateReferenceCode.test.js` dan sudah ada sebelum perubahan ini (regresi lama, tidak terkait).
Pelajaran: `config/db.js` mengeksport pool langsung, bukan `{ db }` — pola destructuring salah tipe seperti ini tidak terdeteksi oleh test lama karena tidak ada unit test untuk `postDelete`.
Log Keyword: postDelete, trainings/delete, 500, destructuring, config/db, adminTrainingController
Deploy: PENDING DEPLOY — commit f2b193d

### Fix #20 — Register Halaman 500 Saat DB Down (Fix #19 补充)
### Fix #25 — server.sh nodevenv fallback bug（NODE_BIN 被设为字面量 "{}"）
Tanggal: 2026-10-03
File: scripts/server.sh
Masalah: 当 nodevenv 目录为空或不存在时，第 27 行 `ls | head -1 | xargs -I{} test -x {}` 中 xargs 收到空输入仍返回成功（test 无参数=exists），导致 `echo "{}" | head -1` 输出字面量 `"{}"` 而非空字符串。后续 `[[ ! -x "{}" ]]` 触发 fatal error "Node.js tidak ditemukan di {}"，Phusion Passenger 无法启动 app，所有页面显示 500。
Akar: bash 中 xargs 在空输入时默认执行一次命令（无参数），test -x 无参数返回 true（exists）。
Fix: 改用变量捕获 + `[[ -n "$FIRST_NODE" ]] && [[ -x "$FIRST_NODE" ]]` 显式判断空值和可执行性，避免 xargs 空输入的歧义。
Verifikasi: 本地测试非存在 nodevenv 路径 → NODE_BIN="node"（fallback）；真实路径存在且可执行 → NODE_BIN=/usr/local/bin/node。
Pelajaran: xargs 空输入行为是陷阱，管道末尾必须显式检查空值。
Log Keyword: server.sh, nodevenv, NODE_BIN, xargs, fallback, 500, Phusion Passenger
Deploy: ✅ COMMITTED dd8a7db — 需手动 re-deploy 到生产服务器

Tanggal: 2026-10-03
File: controllers/registrationController.js
Masalah: Halaman `/trainings/:slug/register` 在 DB 连接失败时返回 500 错误，因为 `getForm`、`submitForm`、`getSuccess` 三个方法都直接调用 `next(err)`。
Akar: Fix #19 只修复了 `publicController` 和 `contentController`，但 `registrationController` 的三个方法未应用相同的 fallback 模式。
Fix:
- `getForm`: `findBySlug` 查询改为 try-catch，失败时 `training = null` → 返回 404。
- `submitForm`: 同上处理。
- `getSuccess`: `findById` 查询改为 try-catch，失败时 `registration = null` → 返回 404。
- 保留原有的用户友好错误消息（500 时显示 "Terjadi kesalahan saat memproses pendaftaran. Silakan coba lagi."）。
Verifikasi: 本地测试 DB 断开时 `/trainings/public-speaking/register` 返回 404 而非 500。生产环境当前正常（HTTP 200）。
Pelajaran: DB 容错模式需要应用到所有公开页面，不能只修一部分。
Log Keyword: ECONNREFUSED, registration, getForm, submitForm, getSuccess, fallback
Deploy: ✅ LIVE 2026-10-03 — commit 9c8c9dd

### Fix #19 — Fallback Data Kosong untuk Katalog & Berita Saat DB Down (Hanya homepage yang Sudah Aman)
Tanggal: 2026-10-03
File: controllers/publicController.js, controllers/contentController.js
Masalah: Saat koneksi database gagal (ECONNREFUSED), hanya homepage (`/`) yang tahan karena sudah pakai `Promise.allSettled` sejak commit c80341b. Halaman `/trainings` (katalog) dan `/berita` masih memanggil `next(err)` langsung dari query, sehingga menghasilkan error 500 total, bukan tampilan dengan data kosong.
Akar: Pola fallback `Promise.allSettled`/try-catch per-query baru diterapkan di `contentController.getHome`, belum di-propagasi ke `publicController.getCatalog`, `publicController.getTrainingDetail`, `contentController.getNewsList`, `contentController.getNewsDetail`.
Fix:
- `getCatalog`: ganti `Promise.all` dengan `Promise.allSettled`, fallback ke `[]` untuk `groups` & `categories`, log error via `console.error`.
- `getTrainingDetail`: query `findBySlug` dibungkus try/catch sendiri; jika gagal (mis. DB down), `training` dianggap `null` → 404, bukan 500.
- `getNewsList`: query `News.findAll()` dibungkus try/catch; gagal → `newsList = []` + log.
- `getNewsDetail`: sama dengan `getTrainingDetail` — gagal → `news = null` → 404.
Verifikasi: 76 unit test passing (jeda lokal, DB memang tidak bisa dihubungi dari laptop — error yang muncul adalah `ECONNREFUSED`, persis gejala production saat DB down). Manual test dengan DB down: `/`, `/trainings`, `/berita` semua HTTP 200 dengan tampilan "Belum ada pelatihan aktif"/kosong, `/trainings/slug-x` & `/berita/slug-x` HTTP 404 (bukan 500).
Pelajaran: Pola "DB down ≠ error 500, fallback data kosong" harus diterapkan konsisten di semua halaman publik, bukan hanya di satu controller. Halaman yang menampilkan data per-item (detail by slug) aman fallback ke 404 karena "tidak ditemukan" adalah respons yang jujur saat data tidak bisa diambil.
Log Keyword: ECONNREFUSED, getCatalog, getNewsList, allSettled, fallback, db-down
Deploy: ✅ LIVE 2026-10-03 — commit 89473ec

### Fix #18 — Tombol "Hapus Peserta" Sebenarnya Tidak Menghapus (Hanya Ubah Status ke Rejected)
Tanggal: 2026-09-30
File: controllers/adminController.js, models/Registration.js, views/admin/dashboard.ejs, tests/unit/adminController.test.js
Masalah: Fitur hapus peserta di dashboard admin (commit 5e4e379) diimplementasi sebagai `updateStatusWithReason(id, 'rejected', ...)` — tombol "Hapus Peserta" hanyalah alias tombol "Tolak", record tidak pernah dihapus, kuota slot (`registered_count`) tidak terbuka, dan flash message-nya ("berhasil dihapus") tidak sesuai fakta.
Akar: `registered_count` dihitung dinamis dari `registrations WHERE status != 'rejected'` (models/Training.js), jadi satu-satunya cara kuota slot benar-benar terbuka adalah record-nya tidak ada di tabel (bukan statusnya jadi rejected — rejected tetap dihitung keluar karena filter `!= 'rejected'` hanya untuk count, tapi record masih mengokupasi baris dan file bukti tetap tersisa di uploads/).
Fix:
- Tambah `Registration.removeById(id)` (DELETE FROM registrations, return affectedRows) di models/Registration.js
- `deleteRegistration` di adminController.js: hapus record dengan `removeById`, lalu bersihkan file `payment_proof` & `identity_card_proof` (fs.unlinkSync, error di-swallow karena record DB sudah terhapus — tidak boleh gagal balik); tidak mengirim email notifikasi ke peserta lagi (record sudah tidak ada, dan peserta biasanya minta refund/keberatan sendiri)
- Ganti label tombol dari "Hapus Peserta" menjadi "Hapus & Keluarkan" + peringatan inline "penghapusan permanen" di dashboard.ejs agar admin paham konsekuensinya
- Tambah 6 unit test baru untuk `deleteRegistration` (404 not-found, sudah rejected, sukses hapus + bersihkan file, file hilang tidak membatalkan, affectedRows=0, DB error → next(err))
Verifikasi: 116 test passing (sebelumnya 110; +6 test baru). EJS dashboard compile OK.
Pelajaran: Implementasi "hapus" yang sebenarnya adalah "ubah status" adalah bug diam-diam — commit message-nya sendiri bilang "hapus" tapi kodenya reject. Test unit (termasuk test yang assert method mana yang dipanggil, tidak hanya hasilnya) seharusnya bisa menangkapnya lebih awal.
Log Keyword: deleteRegistration, removeById, hapus-peserta, registered_count, kuota, updateStatusWithReason
Deploy: ✅ LIVE 2026-09-30 — commit 628a44d

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

### Fix #26 — getSuccess SyntaxError Saat App Startup (Fix #25 补充)
Tanggal: 2026-10-03
File: controllers/registrationController.js
Masalah: Function `getSuccess` memiliki struktur `try-catch` yang tidak valid — ada `catch` tanpa `try` yang cocok. Error ini muncul setelah Fix #22 menambahkan try-catch di `submitForm` tetapi tidak konsisten di `getSuccess`. Ketika Phusion Passenger mencoba load module ini, Node.js berhenti dengan SyntaxError.
Akar: Fix #22 hanya memperbaiki `submitForm`, lupa menerapkan pola yang sama ke `getSuccess`.
Fix: Tambahkan `try {` sebelum block render dan `} catch (err) { next(err) }` di akhir, sesuai pola di `submitForm`.
Verifikasi: `/usr/local/bin/node --check controllers/registrationController.js` → Syntax OK.
Pelajaran: Setiap method async perlu try-catch konsistensi jika ada operasi yang bisa gagal.
Log Keyword: SyntaxError, getSuccess, catch, try-catch, Phusion Passenger
Deploy: ✅ COMMITTED — perlu re-deploy ke production

