# Implementation Plan: Ahmad Dahlan Training Center (ADTC) Website

## Overview

Implementasi platform website pelatihan ADTC secara incremental menggunakan Node.js + Express.js (MVC), MySQL/mysql2, EJS, Tailwind CSS, Multer, bcrypt, dan express-session. Dimulai dari fondasi proyek dan database, lalu model, middleware, utilitas, controller, routes, views, frontend JS, testing, dan diakhiri dengan seeder admin.

---

## Tasks

- [x] 1. Setup proyek dan struktur direktori
  - Buat `package.json` dengan semua dependensi: `express`, `ejs`, `mysql2`, `multer`, `bcrypt`, `express-session`, `connect-flash`, `dotenv`, `slugify`; dan devDependencies: `tailwindcss`, `nodemon`, `fast-check`, `jest`
  - Buat file `.env.example` yang mendokumentasikan semua environment variables: `PORT`, `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `WHATSAPP_ADMIN_NUMBER`, `BANK_NAME`, `BANK_ACCOUNT`, `BANK_ACC_NAME`
  - Buat file `.env` (dari `.env.example`) untuk development lokal
  - Buat struktur direktori lengkap: `config/`, `controllers/`, `models/`, `routes/`, `views/layout/`, `views/trainings/`, `views/registration/`, `views/admin/`, `middleware/`, `utils/`, `public/css/`, `public/js/`, `uploads/payment_proofs/`, `uploads/identity_cards/`
  - Buat `tailwind.config.js` dengan konfigurasi content path untuk semua file EJS dan JS
  - Tambahkan script di `package.json`: `start`, `dev` (nodemon), `build:css` (tailwind CLI), `test` (jest)
  - _Persyaratan: 8.4, 8.5, 9.1–9.9_

- [x] 2. Konfigurasi database dan skema SQL
  - [x] 2.1 Buat modul koneksi database `config/db.js`
    - Implementasikan connection pool mysql2 menggunakan `mysql.createPool` dengan `connectionLimit: 10`
    - Baca konfigurasi dari environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
    - Ekspor sebagai promise pool (`pool.promise()`) untuk mendukung async/await
    - _Persyaratan: 8.4, 8.5, 8.9_

  - [x] 2.2 Buat file skema SQL `config/schema.sql`
    - Buat tabel `trainings`: `id` (PK), `title`, `slug` (UNIQUE), `description`, `price_general`, `price_student_uad`, `price_employee_uad`, `quota`, `start_date`, `status` (ENUM: `active`, `inactive`, `full`), `created_at`
    - Buat tabel `registrations`: `id` (PK), `training_id` (FK → `trainings.id`), `full_name`, `email`, `phone`, `category` (ENUM), `identity_number`, `identity_card_proof`, `final_price`, `payment_proof`, `status` (ENUM: `pending`, `verified`, `rejected`, default `pending`), `created_at`
    - Buat tabel `admins`: `id` (PK), `username` (UNIQUE), `password_hash`, `created_at`
    - Tambahkan index pada kolom `slug` di tabel `trainings` dan `training_id` di tabel `registrations`
    - _Persyaratan: 8.1, 8.2, 8.3, 8.7, 8.8_

- [x] 3. Implementasi Model Layer
  - [x] 3.1 Buat `models/Training.js`
    - Implementasikan `Training.findAll()`: SELECT semua training dengan `status = 'active'`, diurutkan `start_date ASC`
    - Implementasikan `Training.findBySlug(slug)`: SELECT training berdasarkan slug menggunakan parameterized query, kembalikan `rows[0] || null`
    - _Persyaratan: 1.1, 1.4, 8.6_

  - [x] 3.2 Buat `models/Registration.js`
    - Implementasikan `Registration.create(data)`: INSERT pendaftaran baru dengan semua field, kembalikan `result.insertId`
    - Implementasikan `Registration.findById(id)`: SELECT dengan JOIN ke tabel `trainings`, kembalikan object gabungan atau `null`
    - Implementasikan `Registration.findAll(filters)`: SELECT dengan JOIN, dukung filter `status`, urutkan `created_at DESC`
    - Implementasikan `Registration.updateStatus(id, status)`: UPDATE status, kembalikan `affectedRows`
    - Pastikan semua query menggunakan parameterized query untuk mencegah SQL injection
    - _Persyaratan: 7.4, 8.2, 8.6, 8.8_

  - [x] 3.3 Buat `models/Admin.js`
    - Implementasikan `Admin.findByUsername(username)`: SELECT admin berdasarkan username menggunakan parameterized query, kembalikan `rows[0] || null`
    - _Persyaratan: 6.3, 6.4, 8.6_

- [x] 4. Implementasi Middleware
  - [x] 4.1 Buat `middleware/auth.js`
    - Implementasikan fungsi `isAuthenticated(req, res, next)`: cek `req.session.adminId`, jika ada panggil `next()`, jika tidak flash error dan redirect ke `/admin/login`
    - _Persyaratan: 6.7, 7.9_

  - [x] 4.2 Buat `middleware/upload.js`
    - Konfigurasi `multer.diskStorage` dengan fungsi `destination` (routing ke `uploads/identity_cards/` atau `uploads/payment_proofs/` berdasarkan `file.fieldname`) dan `filename` (format: `[fieldname]-[timestamp].[ext]`)
    - Implementasikan fungsi `ensureDir` untuk membuat direktori secara otomatis jika belum ada
    - Implementasikan `fileFilter` yang menerima hanya `.jpg`, `.jpeg`, `.png`, `.pdf` berdasarkan validasi ekstensi DAN MIME type secara bersamaan; tolak file lain dengan pesan error deskriptif
    - Konfigurasi batas ukuran file: `fileSize: 5 * 1024 * 1024` (5MB)
    - _Persyaratan: 4.1–4.7, 10.2, 10.3, 10.5_

  - [x]* 4.3 Tulis property test untuk fileFilter (Property 7)
    - **Property 7: File Filter Menerima Format Valid dan Menolak Format Tidak Valid**
    - Gunakan `fast-check` untuk generate kombinasi ekstensi dan MIME type acak
    - Verifikasi: file dengan ekstensi dan MIME type valid (jpeg/jpg/png/pdf) selalu diterima
    - Verifikasi: file dengan ekstensi atau MIME type di luar daftar selalu ditolak dengan Error
    - **Validates: Persyaratan 4.1, 4.3, 10.3**

- [x] 5. Implementasi Utilitas
  - [x] 5.1 Buat `utils/whatsapp.js`
    - Implementasikan `generateWhatsAppUrl(name, program, price)`:
      - Baca `WHATSAPP_ADMIN_NUMBER` dari environment variable, bersihkan karakter non-digit
      - Format `price` menggunakan `Intl.NumberFormat` dengan locale `id-ID` dan currency `IDR`
      - Susun pesan template sesuai desain dan encode dengan `encodeURIComponent`
      - Kembalikan URL `https://wa.me/[nomor]?text=[pesan_terenkode]`
    - _Persyaratan: 5.5, 5.6, 5.7, 5.9_

  - [x]* 5.2 Tulis property test untuk generateWhatsAppUrl (Property 3)
    - **Property 3: URL WhatsApp Selalu Valid dan Mengandung Data Peserta**
    - Gunakan `fast-check` untuk generate kombinasi `name`, `program`, dan `price` acak yang valid
    - Verifikasi: URL selalu diawali `https://wa.me/`
    - Verifikasi: URL mengandung nomor admin (hanya digit)
    - Verifikasi: URL mengandung nama, program, dan harga yang sudah di-encode
    - **Validates: Persyaratan 5.5, 5.6, 5.7**

- [x] 6. Checkpoint — Verifikasi fondasi proyek
  - Pastikan semua modul dapat di-require tanpa error (db, models, middleware, utils)
  - Pastikan semua property test di fase 4 dan 5 lulus
  - Tanyakan kepada pengguna jika ada pertanyaan sebelum melanjutkan.

- [x] 7. Implementasi Controller Publik dan Pendaftaran
  - [x] 7.1 Buat `controllers/publicController.js`
    - Implementasikan `getCatalog`: panggil `Training.findAll()`, render `trainings/catalog` dengan data trainings; tangani error database dengan `next(err)`
    - Implementasikan `getTrainingDetail`: panggil `Training.findBySlug(slug)`, render `trainings/detail`; jika tidak ditemukan render error 404; tangani error database dengan `next(err)`
    - _Persyaratan: 1.1, 1.3, 1.4, 1.5, 1.6_

  - [x] 7.2 Buat fungsi helper di `controllers/registrationController.js`
    - Implementasikan `calculateFinalPrice(category, training)`:
      - Map kategori ke field harga yang sesuai: `umum` → `price_general`, `mahasiswa_uad` → `price_student_uad`, `karyawan_uad` → `price_employee_uad`
      - Gunakan `??` operator dengan `price_general` sebagai fallback
    - Implementasikan `validateRegistrationInput(body, files)`:
      - Validasi `full_name` minimal 3 karakter
      - Validasi `email` dengan regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`
      - Validasi `phone` minimal 10 digit setelah strip non-digit
      - Validasi `category` hanya dalam nilai yang diizinkan
      - Validasi `identity_number` minimal 5 karakter untuk kategori UAD
      - Validasi keberadaan file `identity_card_proof` untuk kategori UAD
      - Kembalikan `{ valid: boolean, errors: string[] }`
    - _Persyaratan: 2.6–2.11, 3.1–3.4_

  - [x]* 7.3 Tulis property test untuk calculateFinalPrice (Property 1)
    - **Property 1: Kalkulasi Harga Sesuai Kategori**
    - Gunakan `fast-check` untuk generate objek training dengan harga positif acak dan kategori valid
    - Verifikasi: hasil selalu positif
    - Verifikasi: hasil selalu identik dengan field harga yang sesuai kategori
    - **Validates: Persyaratan 3.1, 3.2, 3.3**

  - [x]* 7.4 Tulis property test untuk validateRegistrationInput (Property 5 & 6)
    - **Property 5: Field Identitas UAD Wajib Ada untuk Kategori UAD**
    - Gunakan `fast-check` untuk generate input dengan kategori UAD tanpa `identity_number` atau tanpa file
    - Verifikasi: selalu mengembalikan `valid: false`
    - **Property 6: Validasi Input Menolak Semua Input Tidak Valid**
    - Generate kombinasi input yang melanggar aturan (nama < 3 karakter, email invalid, telepon < 10 digit, kategori tidak valid)
    - Verifikasi: selalu mengembalikan `{ valid: false, errors: [...] }` dengan errors tidak kosong
    - **Validates: Persyaratan 2.6–2.11, 3.4**

  - [x] 7.5 Selesaikan implementasi `registrationController.js`
    - Implementasikan `getForm`: ambil training by slug, render `registration/form` dengan data training, errors kosong, dan formData kosong; render 404 jika tidak ditemukan
    - Implementasikan `submitForm`:
      1. Ambil training by slug (404 jika tidak ada)
      2. Validasi input dengan `validateRegistrationInput`; jika tidak valid render ulang form dengan errors dan formData
      3. Hitung `final_price` dengan `calculateFinalPrice`
      4. Simpan path file jika ada
      5. Panggil `Registration.create(data)`
      6. Redirect ke `/registrations/:id/success`
    - Implementasikan `getSuccess`: ambil registration by id, generate WhatsApp URL, render `registration/success` dengan data rekening bank dari env vars; render 404 jika tidak ditemukan
    - _Persyaratan: 2.1–2.13, 3.5–3.7, 5.1–5.9_

- [x] 8. Implementasi Controller Admin
  - [x] 8.1 Buat `controllers/adminController.js`
    - Implementasikan `getLogin`: redirect ke dashboard jika sudah login, render `admin/login`
    - Implementasikan `postLogin`: validasi username/password tidak kosong (flash error jika kosong), cari admin, `bcrypt.compare`, set session, redirect ke dashboard
    - Implementasikan `logout`: panggil `req.session.destroy()`, redirect ke login
    - Implementasikan `getDashboard`: ambil registrations dengan filter status dari query param, render `admin/dashboard`
    - Implementasikan `getRegistrationDetail`: ambil registration by id, render detail; 404 jika tidak ditemukan
    - Implementasikan `approveRegistration`: update status ke `verified`, flash success, redirect ke dashboard
    - Implementasikan `rejectRegistration`: update status ke `rejected`, flash error, redirect ke dashboard
    - _Persyaratan: 6.1–6.9, 7.1–7.10_

  - [x]* 8.2 Tulis unit test untuk adminController postLogin
    - Test: username kosong → flash error, tidak query database
    - Test: username tidak ada → flash "Username atau password salah"
    - Test: password salah → flash "Username atau password salah"
    - Test: kredensial valid → set session, redirect ke dashboard
    - _Persyaratan: 6.3, 6.4, 6.5, 6.9_

- [x] 9. Implementasi Routes
  - [x] 9.1 Buat `routes/publicRoutes.js`
    - Definisikan `GET /` → redirect ke `/trainings`
    - Definisikan `GET /trainings` → `publicController.getCatalog`
    - Definisikan `GET /trainings/:slug` → `publicController.getTrainingDetail`
    - Definisikan `GET /trainings/:slug/register` → `registrationController.getForm`
    - Definisikan `POST /trainings/:slug/register` → `upload.fields([{ name: 'identity_card_proof', maxCount: 1 }])`, `registrationController.submitForm`
    - Definisikan `GET /registrations/:id/success` → `registrationController.getSuccess`
    - _Persyaratan: 1.1, 1.2, 1.4, 2.1, 5.1_

  - [x] 9.2 Buat `routes/adminRoutes.js`
    - Definisikan `GET /login`, `POST /login` → `adminController.getLogin`, `adminController.postLogin`
    - Definisikan `GET /logout` → `isAuthenticated`, `adminController.logout`
    - Definisikan `GET /dashboard` → `isAuthenticated`, `adminController.getDashboard`
    - Definisikan `GET /registrations/:id` → `isAuthenticated`, `adminController.getRegistrationDetail`
    - Definisikan `POST /registrations/:id/approve` → `isAuthenticated`, `adminController.approveRegistration`
    - Definisikan `POST /registrations/:id/reject` → `isAuthenticated`, `adminController.rejectRegistration`
    - _Persyaratan: 6.1–6.7, 7.1, 7.5, 7.7, 7.8_

  - [x] 9.3 Buat `app.js` sebagai entry point aplikasi
    - Setup Express, EJS view engine, middleware global: `express.urlencoded`, `express.json`, `express.static`
    - Konfigurasi express-session dengan `SESSION_SECRET` dari env
    - Setup connect-flash dan locals untuk `success_msg`, `error_msg`, `adminUser`
    - Mount routes: `publicRoutes` di `/`, `adminRoutes` di `/admin`
    - Tambahkan 404 handler dan 500 error handler (render halaman error tanpa stack trace)
    - _Persyaratan: 9.7, 9.8_

- [x] 10. Checkpoint — Verifikasi backend berjalan
  - Pastikan `node app.js` berjalan tanpa error
  - Pastikan semua routes terdaftar dengan benar
  - Pastikan middleware auth dan upload berfungsi
  - Tanyakan kepada pengguna jika ada pertanyaan sebelum melanjutkan.

- [x] 11. Implementasi EJS Views — Layout dan Halaman Publik
  - [x] 11.1 Buat `views/layout/main.ejs`
    - Buat template HTML lengkap dengan tag `<html lang="id">`, meta charset, viewport, dan link ke `/css/output.css`
    - Implementasikan navbar dengan link ke `/trainings` dan brand "ADTC"
    - Tampilkan flash messages (`success_msg` dan `error_msg`) dengan styling Tailwind
    - Sertakan `<%- body %>` sebagai placeholder konten dan footer dengan copyright tahun dinamis
    - _Persyaratan: 1.1, 1.3_

  - [x] 11.2 Buat `views/trainings/catalog.ejs`
    - Tampilkan grid card pelatihan dari array `trainings` menggunakan Tailwind CSS
    - Setiap card menampilkan: judul, deskripsi singkat, tanggal mulai, harga mulai (price_general), status
    - Tampilkan pesan "Belum ada pelatihan aktif" jika array kosong
    - Sertakan tombol/link ke halaman detail masing-masing pelatihan
    - _Persyaratan: 1.1, 1.3_

  - [x] 11.3 Buat `views/trainings/detail.ejs`
    - Tampilkan semua informasi training: judul, deskripsi lengkap, jadwal mulai, kuota, ketiga harga berdasarkan kategori
    - Tampilkan tombol "Daftar Sekarang" yang mengarah ke form pendaftaran
    - _Persyaratan: 1.4_

  - [x] 11.4 Buat `views/registration/form.ejs`
    - Buat form dengan `action="/trainings/<%= training.slug %>/register"` dan `method="POST"` dengan `enctype="multipart/form-data"`
    - Sertakan field: nama lengkap, email, nomor telepon, select kategori (`umum`, `mahasiswa_uad`, `karyawan_uad`)
    - Buat div `#uadFields` tersembunyi yang berisi field NIM/NIY dan input file KTM/ID Card
    - Tampilkan array `errors` jika ada dan isi ulang field dengan data `formData`
    - Sertakan link script `<script src="/js/registration-form.js"></script>`
    - _Persyaratan: 2.1–2.5, 2.12_

  - [x] 11.5 Buat `views/registration/success.ejs`
    - Tampilkan nama peserta, nama training, dan `final_price` dalam format Rupiah
    - Tampilkan informasi rekening bank (nama bank, nomor rekening, nama pemilik)
    - Tampilkan tombol "Konfirmasi via WhatsApp" dengan `href="<%= whatsappUrl %>"` dan `target="_blank"`
    - Sembunyikan tombol WhatsApp jika `whatsappUrl` kosong dan tampilkan pesan alternatif
    - _Persyaratan: 5.2–5.9_

- [x] 12. Implementasi EJS Views — Admin
  - [x] 12.1 Buat `views/admin/login.ejs`
    - Buat form login dengan field username dan password, method POST ke `/admin/login`
    - Tampilkan flash error messages jika ada
    - _Persyaratan: 6.1, 6.4, 6.5, 6.9_

  - [x] 12.2 Buat `views/admin/dashboard.ejs`
    - Tampilkan tabel semua registrations dengan kolom: nama peserta, nama training, kategori, final_price, status, tanggal daftar
    - Tambahkan filter tab/link untuk status: Semua, Pending, Verified, Rejected (gunakan query param `?status=...`)
    - Setiap baris memiliki link ke halaman detail registration
    - Tampilkan pesan jika daftar kosong
    - _Persyaratan: 7.1–7.4_

  - [x] 12.3 Buat `views/admin/registration-detail.ejs`
    - Tampilkan semua field registration: nama, email, telepon, kategori, NIM/NIY, final_price, status, nama training, tanggal training
    - Tampilkan/link ke file identitas (`identity_card_proof`) jika ada
    - Tampilkan tombol form "Approve" (POST ke `/admin/registrations/:id/approve`) dan "Reject" (POST ke `/admin/registrations/:id/reject`)
    - _Persyaratan: 7.5, 7.7, 7.8_

  - [x] 12.4 Buat `views/error.ejs`
    - Tampilkan kode error HTTP dan pesan yang diterima dari variabel `code` dan `message`
    - Sertakan link navigasi kembali ke halaman sebelumnya atau ke `/trainings`
    - _Persyaratan: 1.5, 1.6, 9.7, 9.8_

- [x] 13. Implementasi Frontend JavaScript
  - [x] 13.1 Buat `public/js/registration-form.js`
    - Implementasikan logika toggle: ambil elemen `#categorySelect` dan `#uadFields`
    - Definisikan fungsi `toggleUadFields()`: jika kategori adalah `mahasiswa_uad` atau `karyawan_uad`, tampilkan `#uadFields` dan tambahkan atribut `required` ke semua input di dalamnya; sebaliknya sembunyikan dan hapus atribut `required`
    - Tambahkan event listener `change` pada `#categorySelect` dan panggil `toggleUadFields()` saat DOM loaded
    - _Persyaratan: 2.4, 2.5_

- [x] 14. Setup Tailwind CSS
  - [x] 14.1 Inisialisasi dan build Tailwind CSS
    - Konfigurasi `tailwind.config.js` dengan content paths: `./views/**/*.ejs` dan `./public/js/**/*.js`
    - Buat file sumber `public/css/input.css` dengan direktif `@tailwind base`, `@tailwind components`, `@tailwind utilities`
    - Jalankan build: `npx tailwindcss -i ./public/css/input.css -o ./public/css/output.css` untuk menghasilkan `output.css`
    - _Persyaratan: (setup frontend)_

- [x] 15. Checkpoint — Verifikasi tampilan dan alur pengguna
  - Pastikan halaman katalog, detail, form, dan success dapat dirender tanpa error
  - Pastikan halaman admin (login, dashboard, detail) dapat dirender
  - Pastikan form pendaftaran menampilkan/menyembunyikan field UAD dengan benar
  - Tanyakan kepada pengguna jika ada pertanyaan sebelum melanjutkan.

- [x] 16. Property-Based Testing dengan fast-check
  - [x] 16.1 Setup framework testing Jest
    - Tambahkan konfigurasi Jest di `package.json` atau `jest.config.js` untuk mengenali file `*.test.js`
    - Buat direktori `tests/` dengan subdirektori `unit/` dan `property/`
    - _Persyaratan: (testing setup)_

  - [x] 16.2 Tulis property test untuk konsistensi final_price di database (Property 2)
    - **Property 2: Konsistensi Final Price Tersimpan di Database**
    - Gunakan `fast-check` untuk generate pasangan category dan training acak
    - Verifikasi: `Registration.create` menyimpan `final_price` yang sama dengan hasil `calculateFinalPrice(category, training)`
    - Gunakan database in-memory atau mock mysql2 untuk test ini
    - **Validates: Persyaratan 3.5, 3.6**

  - [x] 16.3 Tulis property test untuk status pendaftaran (Property 4)
    - **Property 4: Status Pendaftaran Selalu Berada dalam State Valid**
    - Gunakan `fast-check` untuk generate sequence operasi create/approve/reject acak
    - Verifikasi: nilai `status` selalu salah satu dari `['pending', 'verified', 'rejected']` pada setiap titik
    - Gunakan mock `Registration.updateStatus` untuk memverifikasi nilai yang dikirim
    - **Validates: Persyaratan 5.1, 7.6, 7.7**

  - [x] 16.4 Tulis property test untuk middleware auth (Property 8)
    - **Property 8: Middleware Auth Melindungi Semua Route Admin**
    - Gunakan `fast-check` untuk generate objek request dengan berbagai kombinasi session (tanpa `adminId`, dengan `adminId` berbagai nilai)
    - Verifikasi: jika tidak ada `adminId` → selalu redirect ke `/admin/login` tanpa memanggil `next()`
    - Verifikasi: jika ada `adminId` → selalu memanggil `next()`
    - **Validates: Persyaratan 6.7, 7.9**

  - [x] 16.5 Tulis property test untuk filter dashboard (Property 9)
    - **Property 9: Filter Dashboard Mengembalikan Hanya Registration Sesuai Status**
    - Gunakan `fast-check` untuk generate array registrations dengan status acak dan nilai filter status
    - Verifikasi: semua hasil `Registration.findAll({ status })` memiliki status yang identik dengan filter
    - Mock query database untuk mengembalikan data yang dikontrol
    - **Validates: Persyaratan 7.2**

- [x] 17. Buat seeder admin awal
  - [x] 17.1 Buat script `scripts/seed-admin.js`
    - Buat script yang membaca `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dari argumen CLI atau environment variable
    - Hash password menggunakan `bcrypt.hash(password, 10)` dengan salt rounds 10
    - Insert record admin ke tabel `admins` menggunakan `db.execute` dengan parameterized query
    - Tampilkan pesan sukses dengan username yang dibuat; jangan tampilkan password atau hash ke console
    - Tangani error jika username sudah ada (duplicate key)
    - _Persyaratan: 6.8_

  - [x] 17.2 Tulis unit test untuk script seeder
    - Test: hash password menggunakan bcrypt dengan salt rounds ≥ 10
    - Test: insert menggunakan parameterized query (bukan string interpolation)
    - Mock `bcrypt.hash` dan `db.execute` untuk menghindari operasi riil
    - _Persyaratan: 6.8_

- [x] 18. Checkpoint akhir — Semua test lulus
  - Jalankan `npm test` dan pastikan semua test (unit dan property-based) lulus
  - Verifikasi semua property dari design document tercakup oleh test
  - Tanyakan kepada pengguna jika ada pertanyaan sebelum dianggap selesai.

---

## Notes

- Task bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan persyaratan spesifik untuk keterlacakan
- Checkpoint memastikan validasi incremental di setiap fase utama
- Property test memvalidasi properti kebenaran universal yang didefinisikan dalam design
- Unit test memvalidasi contoh spesifik dan kondisi edge case
- Semua query database menggunakan parameterized query untuk mencegah SQL injection
- File upload disimpan di luar direktori `public/` untuk keamanan
- Password admin selalu disimpan sebagai hash bcrypt dengan salt rounds ≥ 10

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["4.1", "4.2", "5.1"] },
    { "id": 3, "tasks": ["4.3", "5.2", "7.1", "7.2"] },
    { "id": 4, "tasks": ["7.3", "7.4", "7.5", "8.1", "9.1", "9.2"] },
    { "id": 5, "tasks": ["8.2", "9.3", "16.1"] },
    { "id": 6, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 7, "tasks": ["13.1", "14.1"] },
    { "id": 8, "tasks": ["16.2", "16.3", "16.4", "16.5", "17.1"] },
    { "id": 9, "tasks": ["17.2"] }
  ]
}
```
