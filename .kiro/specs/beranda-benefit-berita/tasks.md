# Implementation Plan — Beranda, Benefit, dan Berita

---

- [x] 1. Update schema database: tambah tabel `news` dan `benefits`
  - Append dua blok `CREATE TABLE IF NOT EXISTS` ke `config/schema.sql`
  - Tabel `news`: kolom `id`, `title`, `slug` (UNIQUE), `content`, `image_path` (NULL), `published_at`, `created_at`
  - Tambah index `idx_news_slug` dan `idx_news_published_at`
  - Tabel `benefits`: kolom `id`, `title`, `description`, `status` (ENUM `aktif`/`nonaktif` DEFAULT `aktif`), `created_at`
  - Jalankan script ke database (atau `SOURCE config/schema.sql`) untuk membuat tabel
  - _Requirements: 8.1, 8.2, 8.3_

---

- [x] 2. Buat `models/News.js`
  - Implementasikan `findAll()` — SELECT semua berita ORDER BY `published_at DESC, created_at DESC`
  - Implementasikan `findBySlug(slug)` — SELECT WHERE `slug = ?` LIMIT 1, return row atau `null`
  - Implementasikan `findById(id)` — SELECT WHERE `id = ?` LIMIT 1, return row atau `null`
  - Implementasikan `create(data)` — INSERT dengan field `title, slug, content, image_path, published_at`, return `insertId`
  - Implementasikan `update(id, data)` — UPDATE SET semua field WHERE `id = ?`, return `affectedRows`
  - Implementasikan `delete(id)` — DELETE WHERE `id = ?`, return `affectedRows`
  - Semua query menggunakan parameterized statement (`db.execute` dengan placeholder `?`)
  - _Requirements: 3.1, 3.3, 4.1, 5.1, 5.3, 5.5, 5.6, 8.1, 8.3, 8.5_

---

- [x] 3. Buat `models/Benefit.js`
  - Implementasikan `findAllActive()` — SELECT WHERE `status = 'aktif'` ORDER BY `created_at ASC`, return array
  - Implementasikan `findAll()` — SELECT semua benefit (aktif & nonaktif) ORDER BY `created_at ASC`
  - Implementasikan `findById(id)` — SELECT WHERE `id = ?` LIMIT 1, return row atau `null`
  - Implementasikan `create(data)` — INSERT `title, description` (status default `aktif`), return `insertId`
  - Implementasikan `update(id, data)` — UPDATE SET `title, description, status` WHERE `id = ?`, return `affectedRows`
  - Implementasikan `delete(id)` — DELETE WHERE `id = ?`, return `affectedRows`
  - Semua query menggunakan parameterized statement
  - _Requirements: 2.2, 2.4, 7.1, 7.3, 7.5, 7.6, 8.2, 8.3, 8.6_

---

- [x] 4. Update `models/Training.js` — tambah method `findLatest`
  - Tambahkan method `async findLatest(limit = 3)` ke objek `Training`
  - Query: `SELECT * FROM trainings WHERE status = 'active' ORDER BY created_at DESC LIMIT ?`
  - Parameter `limit` diteruskan sebagai prepared statement parameter (bukan interpolasi string)
  - Return array (bisa kosong), tidak pernah `null`
  - _Requirements: 1.4, 1.6_

---

- [x] 5. Update `middleware/upload.js` — tambah routing `news_images/` dan format `webp`

  - [x] 5.1 Tambah kondisi `news_image` di `destination` callback
    - Tambahkan `else if (file.fieldname === 'news_image')` → `dest = 'uploads/news_images'`
    - Pastikan `ensureDir(dest)` dipanggil sebelum `cb(null, dest)`
    - _Requirements: 6.1, 6.4, 6.5_

  - [x] 5.2 Tambah `webp` ke `allowedPattern` di `fileFilter`
    - Ubah `const allowedPattern = /jpeg|jpg|png|pdf/` menjadi `/jpeg|jpg|png|pdf|webp/`
    - Perubahan ini tidak merusak validasi field lain karena format sebelumnya (jpg, png, pdf) tetap diterima
    - _Requirements: 6.1, 6.3_

---

- [x] 6. Buat `controllers/contentController.js`
  - Implementasikan `getHome` (GET `/`):
    - Jalankan `Promise.allSettled([Training.findLatest(3), Benefit.findAllActive()])`
    - Render `home` dengan `{ title: 'Beranda', trainings, benefits }` — fallback ke `[]` jika salah satu gagal
    - Jika query training gagal, teruskan error ke `next(err)` (karena allSettled, perlu cek status `rejected`)
    - _Requirements: 1.1, 1.3, 1.4, 1.6, 2.2, 2.3, 2.5_
  - Implementasikan `getNewsList` (GET `/berita`):
    - Panggil `News.findAll()`, render `news/list` dengan `{ title: 'Berita ADTC', newsList }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - Implementasikan `getNewsDetail` (GET `/berita/:slug`):
    - Panggil `News.findBySlug(req.params.slug)`
    - Jika `null`, render `error` dengan status 404
    - Jika ditemukan, render `news/detail` dengan `{ title: news.title, news }`
    - _Requirements: 4.1, 4.2, 4.3_

---

- [x] 7. Buat `controllers/adminNewsController.js`

  - [x] 7.1 Implementasikan helper functions
    - `generateSlug(title)` — lowercase, hapus non-alfanumerik, trim, ganti spasi dengan `-`, collapse `-` ganda
    - `ensureUniqueSlug(baseSlug, excludeId = null)` — loop cek `News.findBySlug`, append `-2`, `-3`, dst. jika duplikat
    - `validateNewsInput(body)` — validasi trim: `title`, `content`, `published_at`; return `{ valid, errors }`
    - Export semua helper via `module.exports.validateNewsInput`, `.generateSlug`, `.ensureUniqueSlug`
    - _Requirements: 5.7, 5.8, 5.9, 5.10, 5.11_

  - [x] 7.2 Implementasikan `getList`, `getCreate`, `getEdit`
    - `getList` — render `admin/news/list` dengan semua berita
    - `getCreate` — render `admin/news/form` dengan `{ news: null, errors: [], isEdit: false }`
    - `getEdit` — cari berita by ID; HTTP 404 jika tidak ada; render `admin/news/form` dengan data terisi
    - _Requirements: 5.1, 5.2, 5.4, 5.12_

  - [x] 7.3 Implementasikan `postCreate`
    - Validasi input; jika gagal, hapus file upload (`fs.unlink` fire-and-forget), render form kembali dengan errors
    - Generate slug unik, simpan via `News.create`, redirect ke `/admin/news` dengan flash sukses
    - _Requirements: 5.3, 5.7, 5.8, 5.9, 5.10, 5.11, 6.4, 6.5, 6.6_

  - [x] 7.4 Implementasikan `postUpdate`
    - Cari berita by ID; HTTP 404 jika tidak ada
    - Validasi input; jika ada file baru, hapus file lama via `fs.unlink`
    - Generate slug unik dengan `excludeId`, simpan via `News.update`, redirect ke `/admin/news`
    - _Requirements: 5.5, 5.7, 5.8, 5.9, 5.10, 5.11, 6.7_

  - [x] 7.5 Implementasikan `postDelete`
    - Cari berita by ID; hapus file gambar dari filesystem jika ada
    - Panggil `News.delete`, redirect ke `/admin/news` dengan flash sukses
    - _Requirements: 5.6, 6.8, 8.5_

---

- [x] 8. Buat `controllers/adminBenefitController.js`

  - [x] 8.1 Implementasikan `validateBenefitInput(body)`
    - Validasi trim: `title` dan `description`; return `{ valid, errors }`
    - Export via `module.exports.validateBenefitInput`
    - _Requirements: 7.7, 7.8_

  - [x] 8.2 Implementasikan `getList`, `getCreate`, `getEdit`
    - `getList` — render `admin/benefits/list` dengan semua benefit (aktif + nonaktif)
    - `getCreate` — render `admin/benefits/form` dengan `{ benefit: null, errors: [], isEdit: false }`
    - `getEdit` — cari benefit by ID; HTTP 404 jika tidak ada; render form dengan data terisi
    - _Requirements: 7.1, 7.2, 7.4, 7.10_

  - [x] 8.3 Implementasikan `postCreate`
    - Validasi input; jika gagal render form kembali dengan errors
    - Simpan via `Benefit.create` (status default `aktif`), redirect ke `/admin/benefits` dengan flash sukses
    - _Requirements: 7.3, 7.7, 7.8_

  - [x] 8.4 Implementasikan `postUpdate`
    - Cari benefit by ID; HTTP 404 jika tidak ada
    - Validasi input; normalisasi `status` — hanya terima `'nonaktif'`, fallback ke `'aktif'`
    - Simpan via `Benefit.update`, redirect ke `/admin/benefits` dengan flash sukses
    - _Requirements: 7.5, 7.7, 7.8, 7.9_

  - [x] 8.5 Implementasikan `postDelete`
    - Panggil `Benefit.delete(req.params.id)`, redirect ke `/admin/benefits` dengan flash sukses
    - _Requirements: 7.6, 8.6_

---

- [x] 9. Update `routes/publicRoutes.js`
  - Require `contentController` dari `'../controllers/contentController'`
  - Ganti `router.get('/', (req, res) => res.redirect('/trainings'))` dengan `router.get('/', contentController.getHome)`
  - Tambahkan `router.get('/berita', contentController.getNewsList)`
  - Tambahkan `router.get('/berita/:slug', contentController.getNewsDetail)`
  - _Requirements: 1.1, 3.1, 4.1_

---

- [x] 10. Update `routes/adminRoutes.js`
  - Require `adminNewsController`, `adminBenefitController`, dan `upload`
  - Tambahkan route News (tanpa prefix `/admin` karena sudah ditangani `app.use('/admin', ...)`):
    - `GET  /news` → `getList`
    - `GET  /news/create` → `getCreate` (**harus sebelum** `/news/:id/edit`)
    - `POST /news` → `upload.single('news_image')`, `postCreate`
    - `GET  /news/:id/edit` → `getEdit`
    - `POST /news/:id/update` → `upload.single('news_image')`, `postUpdate`
    - `POST /news/:id/delete` → `postDelete`
  - Tambahkan route Benefits:
    - `GET  /benefits` → `getList`
    - `GET  /benefits/create` → `getCreate` (**harus sebelum** `/benefits/:id/edit`)
    - `POST /benefits` → `postCreate`
    - `GET  /benefits/:id/edit` → `getEdit`
    - `POST /benefits/:id/update` → `postUpdate`
    - `POST /benefits/:id/delete` → `postDelete`
  - Semua route dilindungi `isAuthenticated`
  - _Requirements: 5.13, 7.11, 10.2_

---

- [x] 11. Update `app.js` — tambah `res.locals.currentPath`
  - Di dalam middleware flash yang sudah ada, tambahkan baris `res.locals.currentPath = req.path`
  - Pastikan baris ini ada **sebelum** `next()` dan berada pada middleware yang sama dengan `res.locals.success_msg`
  - _Requirements: 9.5_

---

- [x] 12. Buat `views/home.ejs`
  - Include `header.ejs` dan `footer.ejs` menggunakan path `'layout/header'` dan `'layout/footer'`
  - **Hero Section**: tampilkan nama "Ahmad Dahlan Training Center", tagline, dan deskripsi singkat ADTC
  - **Benefit Section**: tampilkan Benefit_Statis (hardcoded) lalu loop `benefits` dari DB — tiap item tampilkan `benefit.title` dan `benefit.description`
  - **Training Unggulan**: loop `trainings` (maks 3); jika `trainings.length === 0` tampilkan "Belum ada pelatihan aktif."
  - **Navigasi bawah**: tombol/link "Lihat Semua Pelatihan" → `/trainings` dan "Lihat Berita" → `/berita`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4_

---

- [x] 13. Buat `views/news/list.ejs`
  - Buat direktori `views/news/` jika belum ada
  - Include `../layout/header` dan `../layout/footer`
  - Heading "Berita & Aktivitas ADTC"
  - Loop `newsList`: tiap item tampilkan gambar (atau placeholder jika `!news.image_path`), judul sebagai link ke `/berita/<%= news.slug %>`, dan `news.published_at`
  - Jika `newsList.length === 0`: tampilkan "Belum ada berita."
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.9_

---

- [x] 14. Buat `views/news/detail.ejs`
  - Include `../layout/header` dan `../layout/footer`
  - Tampilkan gambar `news.image_path` jika ada
  - Tampilkan `news.title`, `news.published_at`, dan `news.content`
  - Link kembali ke `/berita`
  - _Requirements: 4.1, 4.2, 6.9_

---

- [x] 15. Buat `views/admin/news/list.ejs`
  - Buat direktori `views/admin/news/` jika belum ada
  - Include `../../layout/header` dan `../../layout/footer`
  - Flash message sukses/error di bagian atas
  - Tombol "Tambah Berita Baru" → `/admin/news/create`
  - Tabel kolom: Judul, Tanggal Publikasi, Aksi
  - Aksi Edit → link `/admin/news/<%= news.id %>/edit`
  - Aksi Hapus → form `POST /admin/news/<%= news.id %>/delete` dengan hidden `_method` atau tombol submit langsung
  - _Requirements: 5.1, 5.6, 10.3_

---

- [x] 16. Buat `views/admin/news/form.ejs`
  - Include header dan footer
  - Flash message errors (loop `errors` array)
  - Form `enctype="multipart/form-data"`:
    - `action`: `/admin/news` jika `!isEdit`, `/admin/news/<%= news.id %>/update` jika `isEdit`
    - Field `title` (text, required) — pre-fill `news.title` jika edit
    - Field `content` (textarea, required) — pre-fill `news.content` jika edit
    - Field `published_at` (date, required) — pre-fill nilai yang ada jika edit
    - Field `news_image` (file, opsional)
    - Jika `isEdit && news.image_path`: tampilkan gambar saat ini dengan tag `<img>`
  - Tombol submit dan link batal kembali ke `/admin/news`
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.7, 5.8, 5.9, 6.1_

---

- [x] 17. Buat `views/admin/benefits/list.ejs`
  - Buat direktori `views/admin/benefits/` jika belum ada
  - Include `../../layout/header` dan `../../layout/footer`
  - Flash message sukses/error
  - Tombol "Tambah Benefit" → `/admin/benefits/create`
  - Tabel kolom: Judul, Deskripsi (truncated dengan CSS atau `substring`), Status (badge/label aktif vs nonaktif), Aksi
  - Aksi Edit → link `/admin/benefits/<%= benefit.id %>/edit`
  - Aksi Hapus → form `POST /admin/benefits/<%= benefit.id %>/delete`
  - _Requirements: 7.1, 7.6, 10.3_

---

- [x] 18. Buat `views/admin/benefits/form.ejs`
  - Include header dan footer
  - Flash message errors (loop `errors` array)
  - Form `POST`:
    - `action`: `/admin/benefits` jika `!isEdit`, `/admin/benefits/<%= benefit.id %>/update` jika `isEdit`
    - Field `title` (text, required) — pre-fill jika edit
    - Field `description` (textarea, required) — pre-fill jika edit
    - Field `status` (select: `aktif`/`nonaktif`) — **hanya ditampilkan** saat `isEdit`; opsi terpilih sesuai `benefit.status`
  - Tombol submit dan link batal kembali ke `/admin/benefits`
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.7, 7.8, 7.9_

---

- [x] 19. Update `views/layout/header.ejs` — navbar baru
  - Tambahkan link "Beranda" → `/`
  - Pastikan link "ADTC" (logo/nama) mengarah ke `/`
  - Pertahankan link "Katalog Pelatihan" → `/trainings`
  - Tambahkan link "Berita" → `/berita`
  - Gunakan `currentPath` dari `res.locals` untuk active indicator:
    - Beranda: `currentPath === '/'`
    - Katalog Pelatihan: `currentPath.startsWith('/trainings')`
    - Berita: `currentPath.startsWith('/berita')`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

---

- [x] 20. Update `views/admin/dashboard.ejs` — tambah menu navigasi ke News dan Benefits
  - Tambahkan link atau card menuju `/admin/news` (Manajemen Berita)
  - Tambahkan link atau card menuju `/admin/benefits` (Manajemen Benefit)
  - _Requirements: 10.1_

---

- [x] 21. Rebuild CSS Tailwind
  - Jalankan `npx tailwindcss -i ./public/css/input.css -o ./public/css/output.css --minify` setelah semua view selesai
  - Pastikan class Tailwind yang dipakai di view baru sudah masuk ke `output.css`
  - Verifikasi `tailwind.config.js` sudah mencakup path `views/**/*.ejs` di `content`

---

- [x] 22. Checkpoint — Verifikasi end-to-end
  - Jalankan `node app.js` dan buka browser di `http://localhost:3000`
  - Verifikasi `GET /` merender `views/home.ejs` (bukan redirect ke `/trainings`)
  - Verifikasi `GET /berita` merender daftar berita (atau pesan kosong jika belum ada data)
  - Verifikasi `GET /berita/:slug` merender detail atau 404 untuk slug tidak ada
  - Login ke admin, verifikasi `/admin/news` dan `/admin/benefits` accessible
  - Buat satu Benefit dari admin → cek muncul di Beranda publik
  - Buat satu Berita dari admin → cek muncul di `/berita`
  - Edit dan hapus Berita → cek file gambar dihapus dari filesystem
  - Akses `/admin/news` tanpa login → harus redirect ke `/admin/login`
  - _Requirements: 1.1, 3.1, 4.3, 5.13, 7.11, 10.2_
