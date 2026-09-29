# Requirements Document

## Introduction

Ahmad Dahlan Training Center (ADTC) adalah platform website pelatihan berbasis web yang memungkinkan peserta mendaftar pelatihan secara langsung tanpa perlu membuat akun (frictionless). Sistem terdiri dari dua bagian utama: **Portal Publik** untuk peserta dan **Dashboard Admin** untuk pengelola. Konfirmasi pembayaran dilakukan melalui WhatsApp untuk mempercepat verifikasi.

Stack teknologi: Node.js + Express.js (backend), MySQL/mysql2 (database), EJS (view engine), Tailwind CSS (styling), Multer (upload file), bcrypt (enkripsi password), express-session (manajemen sesi admin).

---

## Glossary

- **System**: Aplikasi web ADTC secara keseluruhan
- **Portal_Publik**: Sisi aplikasi yang dapat diakses oleh peserta tanpa login
- **Dashboard_Admin**: Sisi aplikasi yang hanya dapat diakses oleh admin setelah login
- **Peserta**: Pengguna umum yang mengakses Portal_Publik untuk mendaftar pelatihan
- **Admin**: Pengguna terautentikasi yang mengelola pelatihan dan pendaftaran melalui Dashboard_Admin
- **Training**: Entitas pelatihan yang memiliki judul, deskripsi, harga bertingkat, kuota, dan tanggal mulai
- **Registration**: Entitas pendaftaran yang menghubungkan Peserta dengan Training beserta data pribadi dan status pembayaran
- **Slug**: Identifier URL-friendly unik untuk setiap Training (contoh: `python-basic-2025`)
- **Kategori**: Tipe peserta yang menentukan harga: `umum`, `mahasiswa_uad`, atau `karyawan_uad`
- **Final_Price**: Harga akhir yang dihitung server berdasarkan Kategori peserta dan harga Training
- **Status_Pendaftaran**: State pendaftaran: `pending` (menunggu verifikasi), `verified` (diverifikasi), atau `rejected` (ditolak)
- **KTM**: Kartu Tanda Mahasiswa — dokumen identitas mahasiswa UAD
- **NIY**: Nomor Induk Yayasan — nomor identitas karyawan UAD
- **NIM**: Nomor Induk Mahasiswa — nomor identitas mahasiswa UAD
- **Controller**: Komponen yang memproses request HTTP dan memanggil Model
- **Model**: Komponen yang mengabstraksi query ke database MySQL
- **Middleware**: Fungsi Express.js yang dieksekusi sebelum Controller (autentikasi, upload file)
- **Upload**: Proses penerimaan dan penyimpanan file menggunakan Multer
- **WhatsApp_URL**: URL `wa.me` yang di-generate sistem untuk konfirmasi pembayaran
- **Session**: Mekanisme express-session untuk mempertahankan status login Admin
- **Connection_Pool**: Pool koneksi mysql2 yang mengelola multiple koneksi database
- **Bcrypt**: Library hashing password dengan algoritma bcrypt
- **Flash_Message**: Pesan sementara yang ditampilkan sekali setelah redirect
- **Status_Approved**: State pendaftaran `approved` — admin telah menyetujui data peserta, menunggu bukti pembayaran diunggah
- **Status_Confirmed**: State pendaftaran `confirmed` — pembayaran telah diverifikasi admin, pendaftaran selesai
- **Payment_Proof**: File bukti pembayaran (jpg/jpeg/png/pdf, maks 5MB) yang diunggah Peserta setelah status `approved`
- **Rejection_Reason**: Alasan penolakan yang diisi Admin saat menolak pendaftaran, disimpan di kolom `rejection_reason` tabel `registrations`
- **Payment_Upload_Page**: Halaman yang dapat diakses Peserta via URL unik berbasis Registration ID untuk mengunggah Payment_Proof
- **Status_Payment_Uploaded**: State pendaftaran `payment_uploaded` — Peserta telah mengunggah Payment_Proof, menunggu konfirmasi Admin

---

## Requirements

### Requirement 1: Katalog Pelatihan Publik

**User Story:** Sebagai Peserta, saya ingin melihat semua pelatihan yang tersedia beserta informasi harga dan jadwal, sehingga saya dapat memilih pelatihan yang sesuai kebutuhan saya.

#### Acceptance Criteria

1. WHEN Peserta mengakses `GET /trainings`, THE System SHALL mengambil semua Training dengan status `active` dari database dan merendernya pada halaman katalog.
2. WHEN Peserta mengakses `GET /`, THE System SHALL melakukan redirect ke `/trainings`.
3. WHEN tidak ada Training aktif di database, THE System SHALL menampilkan halaman katalog dengan daftar kosong tanpa error.
4. WHEN Peserta mengklik detail Training dari katalog, THE System SHALL menampilkan halaman detail dengan seluruh informasi Training berdasarkan Slug.
5. IF Peserta mengakses `GET /trainings/:slug` dengan Slug yang tidak ada di database, THEN THE System SHALL merender halaman error dengan HTTP status 404 dan pesan yang informatif tanpa mengekspos detail teknis kepada Peserta.
6. IF terjadi kegagalan koneksi database saat query Training diproses, THEN THE System SHALL merender halaman error HTTP 500 dengan pesan generik yang tidak mengekspos detail teknis, stack trace, atau informasi kredensial kepada Peserta.

---

### Requirement 2: Form Pendaftaran Frictionless

**User Story:** Sebagai Peserta, saya ingin mendaftar pelatihan tanpa harus membuat akun terlebih dahulu, sehingga proses pendaftaran lebih cepat dan mudah.

#### Acceptance Criteria

1. WHEN Peserta mengakses `GET /trainings/:slug/register`, THE System SHALL menampilkan form pendaftaran untuk Training yang sesuai dengan Slug.
2. WHEN Peserta mengakses form pendaftaran dengan Slug yang tidak ada di database, THE System SHALL merender halaman error dengan HTTP status 404.
3. THE System SHALL menyediakan field input: nama lengkap, email, nomor telepon, dan pilihan Kategori peserta (`umum`, `mahasiswa_uad`, `karyawan_uad`) pada form pendaftaran.
4. WHEN Peserta memilih Kategori `mahasiswa_uad` atau `karyawan_uad`, THE System SHALL menampilkan field tambahan NIM/NIY dan input upload file KTM/ID Card secara dinamis di sisi klien.
5. WHEN Peserta memilih Kategori `umum`, THE System SHALL menyembunyikan field NIM/NIY dan upload KTM/ID Card.
6. WHEN Peserta melakukan submit form dengan nama lengkap kurang dari 3 karakter, THE System SHALL menolak pendaftaran dan menampilkan pesan error "Nama lengkap minimal 3 karakter."
7. WHEN Peserta melakukan submit form dengan format email yang tidak sesuai pola `^[^\s@]+@[^\s@]+\.[^\s@]+$`, THE System SHALL menolak pendaftaran dan menampilkan pesan error yang spesifik.
8. WHEN Peserta melakukan submit form dengan nomor telepon yang memiliki kurang dari 10 digit (dihitung setelah strip karakter non-digit), THE System SHALL menolak pendaftaran dan menampilkan pesan error "Nomor telepon minimal 10 digit."
9. WHEN Peserta melakukan submit form dengan Kategori yang tidak termasuk `umum`, `mahasiswa_uad`, atau `karyawan_uad`, THE System SHALL menolak pendaftaran dan menampilkan pesan error.
10. WHEN Peserta dengan Kategori `mahasiswa_uad` atau `karyawan_uad` melakukan submit form tanpa mengisi NIM/NIY (kurang dari 5 karakter), THE System SHALL menolak pendaftaran dan menampilkan pesan error "NIM/NIY minimal 5 karakter."
11. WHEN Peserta dengan Kategori `mahasiswa_uad` atau `karyawan_uad` melakukan submit form tanpa melampirkan file KTM/ID Card, THE System SHALL menolak pendaftaran dan menampilkan pesan error "File KTM/ID Card wajib diunggah."
12. IF terjadi error validasi pada form pendaftaran, THEN THE System SHALL merender ulang form dengan pesan error yang spesifik dan mempertahankan data yang sudah diisi Peserta.
13. IF Training yang didaftarkan sudah penuh (kuota habis atau status = `full`), THEN THE System SHALL menolak pendaftaran dan menampilkan pesan error "Kuota pelatihan ini telah penuh."

---

### Requirement 3: Kalkulasi Harga Otomatis

**User Story:** Sebagai Peserta, saya ingin harga yang saya bayar dihitung secara otomatis berdasarkan kategori keanggotaan saya, sehingga saya mendapatkan harga yang sesuai tanpa perlu menghitung sendiri.

#### Acceptance Criteria

1. WHEN Peserta dengan Kategori `umum` berhasil submit form pendaftaran, THE System SHALL menetapkan `final_price` sama dengan `price_general` dari Training yang bersangkutan.
2. WHEN Peserta dengan Kategori `mahasiswa_uad` berhasil submit form pendaftaran, THE System SHALL menetapkan `final_price` sama dengan `price_student_uad` dari Training yang bersangkutan.
3. WHEN Peserta dengan Kategori `karyawan_uad` berhasil submit form pendaftaran, THE System SHALL menetapkan `final_price` sama dengan `price_employee_uad` dari Training yang bersangkutan.
4. IF Peserta mengirimkan Kategori yang tidak termasuk `umum`, `mahasiswa_uad`, atau `karyawan_uad`, THEN THE System SHALL menolak submission dan menampilkan pesan error "Kategori peserta tidak valid."
5. THE System SHALL menyimpan `final_price` yang dihitung server ke dalam tabel `registrations` di database, bukan nilai yang dikirim dari sisi klien.
6. FOR ALL Registration yang tersimpan di database, `final_price` SHALL sama dengan hasil kalkulasi `calculateFinalPrice(category, training)` untuk Kategori dan Training yang bersangkutan.
7. IF harga Training untuk Kategori yang dipilih Peserta bernilai `null` atau tidak terdefinisi, THEN THE System SHALL menolak submission dan menampilkan pesan error yang menginformasikan bahwa harga untuk kategori tersebut belum tersedia.

---

### Requirement 4: Upload File KTM dan ID Card

**User Story:** Sebagai Admin, saya ingin menerima file identitas peserta kategori UAD, sehingga saya dapat memverifikasi keanggotaan mereka sebelum menyetujui pendaftaran.

#### Acceptance Criteria

1. THE System SHALL menerima upload file dengan format `.jpg`, `.jpeg`, `.png`, dan `.pdf` untuk field `identity_card_proof`, dengan ukuran maksimum 5MB per file.
2. IF file yang diunggah Peserta memiliki ukuran lebih dari 5MB, THEN THE System SHALL menolak file tersebut tanpa menyimpan file apapun dan menampilkan pesan error dengan penjelasan batas ukuran.
3. IF file yang diunggah Peserta memiliki format selain `.jpg`, `.jpeg`, `.png`, atau `.pdf`, THEN THE System SHALL menolak file tersebut tanpa menyimpan file apapun dan menampilkan pesan error dengan penjelasan format yang diterima.
4. WHEN file KTM/ID Card berhasil diunggah, THE System SHALL menyimpan file tersebut ke direktori `uploads/identity_cards/` di filesystem server.
5. THE System SHALL memberi nama file yang diunggah dengan format `[fieldname]-[timestamp].[ext]` untuk menghindari konflik nama file.
6. WHEN direktori tujuan upload belum ada, THE System SHALL membuat direktori tersebut secara otomatis sebelum menyimpan file.
7. THE System SHALL menyimpan path file yang tersimpan ke kolom `identity_card_proof` pada tabel `registrations` di database.
8. WHEN Admin mengakses halaman detail Registration, THE System SHALL menampilkan atau menyediakan link ke file identitas yang diunggah Peserta.
9. IF Peserta dengan Kategori `mahasiswa_uad` atau `karyawan_uad` tidak menyertakan file KTM/ID Card pada saat submit form, THE System SHALL menolak pendaftaran sesuai dengan Requirement 2 kriteria 11.

---

### Requirement 5: Pendaftaran Berhasil dan Konfirmasi WhatsApp

**User Story:** Sebagai Peserta, saya ingin mendapatkan instruksi pembayaran yang jelas dan tombol konfirmasi WhatsApp setelah mendaftar, sehingga saya dapat segera mengkonfirmasi pembayaran kepada admin.

#### Acceptance Criteria

1. WHEN Peserta berhasil submit form pendaftaran, THE System SHALL menyimpan Registration ke database dengan Status_Pendaftaran `pending` dan melakukan redirect ke `GET /registrations/:id/success`.
2. WHEN Peserta mengakses halaman sukses `GET /registrations/:id/success`, THE System SHALL menampilkan nama Peserta, nama Training, dan `final_price` yang harus dibayar diformat sebagai mata uang Rupiah (contoh: Rp 1.500.000).
3. WHEN Peserta mengakses halaman sukses, THE System SHALL menampilkan informasi rekening bank tujuan pembayaran (nama bank, nomor rekening, nama pemilik rekening).
4. WHEN Peserta mengakses halaman sukses, THE System SHALL menampilkan tombol "Konfirmasi via WhatsApp" yang membuka WhatsApp_URL di tab atau jendela baru.
5. THE System SHALL meng-generate WhatsApp_URL dengan format `https://wa.me/[nomor_admin]?text=[pesan_terenkode]`.
6. THE WhatsApp_URL SHALL mengandung nomor admin yang bersumber dari environment variable `WHATSAPP_ADMIN_NUMBER` yang telah dibersihkan dari karakter non-digit.
7. THE pesan WhatsApp otomatis SHALL mengandung: nama Peserta, nama program Training, dan `final_price` yang diformat sebagai mata uang Rupiah.
8. WHEN Peserta mengakses halaman sukses dengan ID Registration yang tidak ada di database, THE System SHALL merender halaman error dengan HTTP status 404.
9. IF environment variable `WHATSAPP_ADMIN_NUMBER` tidak terdefinisi atau bernilai kosong setelah pembersihan karakter non-digit, THEN THE System SHALL menyembunyikan tombol "Konfirmasi via WhatsApp" dan menampilkan pesan informasi alternatif yang menginstruksikan Peserta untuk menghubungi admin melalui cara lain.

---

### Requirement 6: Autentikasi Admin

**User Story:** Sebagai Admin, saya ingin login dengan username dan password yang aman, sehingga hanya saya yang dapat mengakses Dashboard_Admin untuk mengelola pendaftaran.

#### Acceptance Criteria

1. WHEN Admin mengakses `GET /admin/login` tanpa Session aktif, THE System SHALL menampilkan halaman form login.
2. WHEN Admin mengakses `GET /admin/login` dengan Session aktif, THE System SHALL melakukan redirect ke `/admin/dashboard`.
3. WHEN Admin mengirimkan username dan password yang valid via `POST /admin/login`, THE System SHALL memverifikasi password menggunakan `bcrypt.compare` terhadap `password_hash` yang tersimpan di database, membuat Session dengan `adminId`, dan melakukan redirect ke `/admin/dashboard`.
4. IF Admin mengirimkan username yang tidak ada di database, THEN THE System SHALL menampilkan Flash_Message error "Username atau password salah" dan kembali ke halaman login tanpa mengungkap apakah username atau password yang salah.
5. IF Admin mengirimkan password yang tidak cocok dengan hash di database, THEN THE System SHALL menampilkan Flash_Message error "Username atau password salah" dan kembali ke halaman login.
6. WHEN Admin mengakses `GET /admin/logout`, THE System SHALL menghapus Session dan melakukan redirect ke `/admin/login`.
7. WHILE Admin belum login (tidak ada `adminId` di Session), THE System SHALL menolak akses ke semua route `/admin/*` (kecuali login) dan melakukan redirect ke `/admin/login` dengan Flash_Message "Anda harus login terlebih dahulu."
8. THE System SHALL menyimpan password admin di database hanya dalam bentuk hash menggunakan Bcrypt dengan salt rounds minimal 10.
9. IF Admin mengirimkan username atau password yang kosong (0 karakter) via `POST /admin/login`, THEN THE System SHALL menampilkan pesan error "Username dan password wajib diisi." tanpa melakukan query ke database.

---

### Requirement 7: Dashboard Admin — Manajemen Pendaftaran

**User Story:** Sebagai Admin, saya ingin melihat dan mengelola semua pendaftaran yang masuk, sehingga saya dapat memverifikasi atau menolak peserta dengan cepat dan efisien di setiap tahap alur persetujuan.

#### Acceptance Criteria

1. WHEN Admin yang terautentikasi mengakses `GET /admin/dashboard`, THE System SHALL menampilkan daftar semua Registration beserta nama Training, nama Peserta, Kategori, `final_price`, dan Status_Pendaftaran.
2. WHEN Admin mengakses dashboard dengan query parameter `status` bernilai `pending`, `approved`, `payment_uploaded`, `confirmed`, atau `rejected`, THE System SHALL memfilter daftar Registration berdasarkan nilai status tersebut.
3. IF nilai query parameter `status` tidak termasuk `pending`, `approved`, `payment_uploaded`, `confirmed`, atau `rejected`, THEN THE System SHALL mengabaikan filter dan mengembalikan semua Registration tanpa filter.
4. THE System SHALL mengurutkan daftar Registration berdasarkan `created_at` secara descending (terbaru di atas).
5. WHEN Admin mengakses `GET /admin/registrations/:id`, THE System SHALL menampilkan detail lengkap Registration yang mencakup: `full_name`, `email`, `phone`, `category`, `identity_number`, `final_price`, `status`, `rejection_reason` (jika ada), nama Training, dan tanggal Training.
6. WHEN Admin mengakses detail Registration yang ID-nya tidak ada di database, THE System SHALL merender halaman error dengan HTTP status 404.
7. WHEN Admin mengirim `POST /admin/registrations/:id/approve` pada Registration dengan status `pending`, THE System SHALL mengubah Status_Pendaftaran menjadi `approved`, menampilkan Flash_Message sukses, dan melakukan redirect ke `/admin/dashboard`.
8. WHEN Admin mengirim `POST /admin/registrations/:id/reject` pada Registration dengan status `pending` atau `approved`, THE System SHALL memvalidasi bahwa field `reason` tidak kosong; jika tidak kosong, THE System SHALL menyimpan nilai tersebut ke kolom `rejection_reason`, mengubah Status_Pendaftaran menjadi `rejected`, menampilkan Flash_Message, dan melakukan redirect ke `/admin/dashboard`.
9. IF Admin mengirim `POST /admin/registrations/:id/reject` dengan field `reason` kosong, THEN THE System SHALL menampilkan Flash_Message error "Alasan penolakan wajib diisi." dan mengembalikan halaman detail tanpa mengubah status.
10. WHEN Admin mengirim `POST /admin/registrations/:id/confirm` pada Registration dengan status `payment_uploaded`, THE System SHALL mengubah Status_Pendaftaran menjadi `confirmed`, menampilkan Flash_Message sukses, dan melakukan redirect ke `/admin/dashboard`.
11. WHEN Admin mengirim `POST /admin/registrations/:id/reject-payment` pada Registration dengan status `payment_uploaded`, THE System SHALL memvalidasi bahwa field `reason` tidak kosong; jika tidak kosong, THE System SHALL menyimpan nilai ke `rejection_reason`, mengubah Status_Pendaftaran menjadi `approved`, menampilkan Flash_Message, dan melakukan redirect ke `/admin/dashboard` (Peserta dapat mengunggah ulang Payment_Proof).
12. IF request approve, reject, confirm, atau reject-payment dikirim tanpa Session admin yang valid, THEN THE System SHALL menolak request dan melakukan redirect ke `/admin/login`.
13. IF request approve, reject, confirm, atau reject-payment dikirim untuk Registration ID yang tidak ada di database, THEN THE System SHALL mengembalikan halaman error dengan HTTP status 404.
14. WHEN Admin mengakses detail Registration dengan status `payment_uploaded`, THE System SHALL menampilkan atau menyediakan link ke file Payment_Proof yang diunggah Peserta.

---

### Requirement 8: Skema Database

**User Story:** Sebagai pengembang, saya ingin skema database yang konsisten dan terdefinisi dengan baik, sehingga integritas data terjaga di seluruh aplikasi.

#### Acceptance Criteria

1. THE System SHALL memiliki tabel `trainings` dengan kolom: `id` (PK auto-increment), `title`, `slug` (UNIQUE), `description`, `price_general`, `price_student_uad`, `price_employee_uad`, `quota`, `start_date`, `status` (ENUM: `active`, `inactive`, `full`), dan `created_at`.
2. THE System SHALL memiliki tabel `registrations` dengan kolom: `id` (PK auto-increment), `training_id` (FK ke `trainings.id`), `full_name`, `email`, `phone`, `category` (ENUM: `umum`, `mahasiswa_uad`, `karyawan_uad`), `identity_number`, `identity_card_proof`, `final_price`, `payment_proof`, `status` (ENUM: `pending`, `approved`, `payment_uploaded`, `confirmed`, `rejected`, default `pending`), `rejection_reason` (TEXT, nullable), dan `created_at`.
3. THE System SHALL memiliki tabel `admins` dengan kolom: `id` (PK auto-increment), `username` (UNIQUE), `password_hash`, dan `created_at`.
4. THE System SHALL menggunakan Connection_Pool mysql2 (`createPool`) dengan `connectionLimit` minimal 10 untuk mengelola koneksi ke database MySQL.
5. THE System SHALL membaca konfigurasi koneksi database dari environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, dan `DB_NAME`; IF salah satu environment variable tersebut tidak terdefinisi saat startup, THEN THE System SHALL menghentikan proses dan menampilkan pesan error yang jelas sebelum melayani request apapun.
6. THE System SHALL menggunakan parameterized query (prepared statement) pada semua operasi database untuk mencegah SQL injection.
7. WHEN terdapat lebih dari satu Registration untuk Training yang sama, THE System SHALL tetap menjaga integritas referensial melalui foreign key `training_id` yang mengacu ke tabel `trainings`.
8. IF operasi INSERT ke tabel `registrations` dilakukan dengan nilai `training_id` yang tidak ada di tabel `trainings`, THEN THE System SHALL menolak operasi tersebut karena melanggar constraint foreign key.
9. IF koneksi ke database MySQL gagal pada saat runtime, THEN THE System SHALL mengembalikan error kepada pemanggil tanpa mengekspos kredensial database (username, password, host) dalam pesan error atau log yang dapat diakses pengguna.

---

### Requirement 9: Konfigurasi Aplikasi dan Environment

**User Story:** Sebagai pengembang, saya ingin semua konfigurasi sensitif dibaca dari environment variables, sehingga aplikasi aman dan mudah dikonfigurasi di berbagai environment.

#### Acceptance Criteria

1. THE System SHALL membaca konfigurasi session dari environment variable `SESSION_SECRET` untuk mengamankan Session admin.
2. THE System SHALL membaca nomor WhatsApp admin dari environment variable `WHATSAPP_ADMIN_NUMBER`.
3. THE System SHALL membaca informasi rekening bank (nama bank, nomor rekening, nama pemilik) dari environment variables `BANK_NAME`, `BANK_ACCOUNT`, dan `BANK_ACC_NAME`.
4. THE System SHALL membaca port server dari environment variable `PORT` dengan nilai default `3000` jika tidak terdefinisi.
5. THE System SHALL menyediakan file `.env.example` yang mendokumentasikan semua environment variables yang diperlukan tanpa menyertakan nilai sensitif.
6. IF environment variable `SESSION_SECRET` tidak terdefinisi atau memiliki panjang kurang dari 32 karakter, THEN THE System SHALL menggunakan nilai default sementara untuk keperluan development, namun konfigurasi produksi HARUS menggunakan nilai acak dengan panjang minimal 32 karakter.
7. WHEN terjadi exception yang tidak tertangani (unhandled error), THE System SHALL merender halaman error HTTP 500 dengan pesan generik yang tidak menampilkan stack trace, path file, nama modul, atau detail internal sistem kepada pengguna.
8. THE System SHALL menerapkan handler route tidak ditemukan (404) yang merender halaman error dengan pesan informatif ketika Peserta mengakses URL yang tidak terdaftar.
9. WHEN aplikasi pertama kali dijalankan, THE System SHALL memvalidasi bahwa environment variables wajib (`SESSION_SECRET`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) telah terdefinisi dan tidak kosong sebelum mulai melayani request.

---

### Requirement 10: Keamanan Upload dan Akses File

**User Story:** Sebagai Admin, saya ingin file yang diunggah peserta tersimpan dengan aman dan tidak dapat diakses langsung melalui URL publik, sehingga data identitas peserta terlindungi.

#### Acceptance Criteria

1. THE System SHALL menyimpan semua file upload di luar direktori `public/` (yaitu di direktori `uploads/`) sehingga tidak dapat diakses langsung melalui URL statis.
2. THE System SHALL membatasi ukuran maksimal file upload sebesar 5MB per file melalui konfigurasi Multer.
3. THE System SHALL memvalidasi tipe file upload berdasarkan validasi ekstensi DAN MIME type secara bersamaan; file yang tidak lolos salah satu validasi SHALL ditolak.
4. WHERE Admin mengakses bukti identitas Peserta, THE System SHALL menyediakan mekanisme akses file yang memverifikasi autentikasi Admin sebelum mengirimkan file dan mengembalikan HTTP 403 jika Admin tidak terautentikasi.
5. THE System SHALL memisahkan direktori penyimpanan: `uploads/identity_cards/` untuk KTM/ID Card dan `uploads/payment_proofs/` untuk bukti pembayaran.
6. IF file yang diminta Admin tidak ditemukan di filesystem server, THEN THE System SHALL menampilkan pesan error informatif dengan HTTP status 404 tanpa mengekspos stack trace, path absolut, atau detail internal sistem.

---

### Requirement 11: Alur Persetujuan Bertahap — Status Baru

**User Story:** Sebagai Admin, saya ingin alur pendaftaran yang bertahap sehingga saya dapat memisahkan verifikasi data peserta dari verifikasi pembayaran, dan setiap tahap memiliki state yang jelas.

#### Acceptance Criteria

1. THE System SHALL mendukung lima Status_Pendaftaran yang valid: `pending`, `approved`, `payment_uploaded`, `confirmed`, dan `rejected`.
2. WHEN Registration baru dibuat, THE System SHALL menetapkan status awal `pending`.
3. WHEN Admin mengubah status Registration dari `pending` ke `approved`, THE System SHALL mencatat perubahan tanpa mengubah data lain pada Registration.
4. WHEN Registration berada dalam status `approved`, THE System SHALL mengizinkan Peserta untuk mengunggah Payment_Proof melalui Payment_Upload_Page.
5. WHEN Peserta mengunggah Payment_Proof pada Registration dengan status `approved`, THE System SHALL mengubah status menjadi `payment_uploaded`.
6. WHEN Admin mengkonfirmasi pembayaran pada Registration dengan status `payment_uploaded`, THE System SHALL mengubah status menjadi `confirmed`.
7. IF Admin mencoba melakukan aksi approve pada Registration yang tidak berstatus `pending`, THEN THE System SHALL mengembalikan halaman error dengan HTTP status 422 dan pesan yang menjelaskan bahwa transisi status tidak valid.
8. IF Admin mencoba melakukan aksi confirm pada Registration yang tidak berstatus `payment_uploaded`, THEN THE System SHALL mengembalikan halaman error dengan HTTP status 422 dan pesan yang menjelaskan bahwa transisi status tidak valid.
9. FOR ALL Registration yang tersimpan di database, nilai kolom `status` SHALL selalu merupakan salah satu dari: `pending`, `approved`, `payment_uploaded`, `confirmed`, `rejected`.

---

### Requirement 12: Penolakan Pendaftaran dengan Alasan

**User Story:** Sebagai Admin, saya ingin dapat menolak pendaftaran dengan menyertakan alasan, sehingga Peserta memahami mengapa pendaftaran mereka ditolak dan dapat mengambil tindakan yang tepat.

#### Acceptance Criteria

1. WHEN Admin mengirim `POST /admin/registrations/:id/reject` atau `POST /admin/registrations/:id/reject-payment`, THE System SHALL mewajibkan field `reason` yang tidak kosong (minimal 5 karakter) dalam request body.
2. IF field `reason` tidak ada atau memiliki panjang kurang dari 5 karakter, THEN THE System SHALL menampilkan Flash_Message error "Alasan penolakan wajib diisi (minimal 5 karakter)." dan mengembalikan halaman detail Registration tanpa mengubah status.
3. WHEN Admin menolak Registration dari status `pending` dengan alasan yang valid, THE System SHALL menyimpan nilai `reason` ke kolom `rejection_reason` dan mengubah status menjadi `rejected`.
4. WHEN Admin menolak pembayaran Registration dari status `payment_uploaded` dengan alasan yang valid, THE System SHALL menyimpan nilai `reason` ke kolom `rejection_reason` dan mengubah status kembali menjadi `approved` sehingga Peserta dapat mengunggah ulang Payment_Proof.
5. WHEN Admin mengakses halaman detail Registration dengan `rejection_reason` yang tidak null, THE System SHALL menampilkan nilai `rejection_reason` tersebut pada halaman detail.
6. THE System SHALL menyimpan Rejection_Reason sebagai kolom `rejection_reason` bertipe TEXT yang nullable pada tabel `registrations`.
7. WHEN status Registration berubah dari `rejected` atau `approved` (akibat reject-payment) kembali ke status lain, THE System SHALL mempertahankan nilai `rejection_reason` terakhir yang tersimpan untuk keperluan audit.

---

### Requirement 13: Upload Bukti Pembayaran oleh Peserta

**User Story:** Sebagai Peserta, saya ingin dapat mengunggah bukti pembayaran setelah pendaftaran saya disetujui admin, sehingga proses verifikasi pembayaran dapat dilakukan secara terstruktur.

#### Acceptance Criteria

1. WHEN Registration berada dalam status `approved`, THE System SHALL menyediakan halaman Payment_Upload_Page yang dapat diakses Peserta melalui `GET /registrations/:id/upload-payment` tanpa memerlukan autentikasi.
2. IF Peserta mengakses `GET /registrations/:id/upload-payment` dan Registration tidak berstatus `approved`, THEN THE System SHALL menampilkan pesan informatif yang sesuai dengan status terkini (misalnya: sudah dikonfirmasi, masih pending, atau sudah ditolak) tanpa merender form upload.
3. IF Peserta mengakses `GET /registrations/:id/upload-payment` dengan Registration ID yang tidak ada di database, THEN THE System SHALL merender halaman error dengan HTTP status 404.
4. THE Payment_Upload_Page SHALL menampilkan nama Peserta, nama Training, `final_price` yang diformat sebagai mata uang Rupiah, dan informasi rekening bank tujuan pembayaran.
5. WHEN Peserta mengirim `POST /registrations/:id/upload-payment` dengan file yang valid, THE System SHALL menerima file Payment_Proof dengan format `.jpg`, `.jpeg`, `.png`, atau `.pdf` dan ukuran maksimum 5MB.
6. IF file Payment_Proof yang diunggah memiliki ukuran lebih dari 5MB, THEN THE System SHALL menolak file tersebut tanpa menyimpannya dan menampilkan pesan error yang menjelaskan batas ukuran.
7. IF file Payment_Proof yang diunggah memiliki format selain `.jpg`, `.jpeg`, `.png`, atau `.pdf`, THEN THE System SHALL menolak file tersebut tanpa menyimpannya dan menampilkan pesan error yang menjelaskan format yang diterima.
8. WHEN file Payment_Proof berhasil diunggah, THE System SHALL menyimpan file tersebut ke direktori `uploads/payment_proofs/` di filesystem server.
9. THE System SHALL memberi nama file Payment_Proof dengan format `[fieldname]-[timestamp].[ext]` untuk menghindari konflik nama file.
10. WHEN Peserta berhasil mengunggah Payment_Proof, THE System SHALL menyimpan path file ke kolom `payment_proof` pada tabel `registrations`, mengubah status Registration menjadi `payment_uploaded`, dan melakukan redirect ke `GET /registrations/:id/status`.
11. IF Peserta mengirim `POST /registrations/:id/upload-payment` tanpa menyertakan file, THEN THE System SHALL menampilkan pesan error "File bukti pembayaran wajib diunggah." dan merender ulang Payment_Upload_Page.

---

### Requirement 14: Halaman Status Pendaftaran

**User Story:** Sebagai Peserta, saya ingin dapat melihat status terkini pendaftaran saya beserta informasi yang relevan di setiap tahap, sehingga saya selalu mengetahui langkah selanjutnya yang perlu dilakukan.

#### Acceptance Criteria

1. THE System SHALL menyediakan halaman status yang dapat diakses Peserta melalui `GET /registrations/:id/status` tanpa memerlukan autentikasi.
2. IF Peserta mengakses `GET /registrations/:id/status` dengan Registration ID yang tidak ada di database, THEN THE System SHALL merender halaman error dengan HTTP status 404.
3. WHEN Peserta mengakses halaman status Registration dengan status `pending`, THE System SHALL menampilkan pesan bahwa pendaftaran sedang menunggu review Admin.
4. WHEN Peserta mengakses halaman status Registration dengan status `approved`, THE System SHALL menampilkan pesan bahwa pendaftaran telah disetujui, beserta informasi rekening bank dan tombol navigasi menuju Payment_Upload_Page.
5. WHEN Peserta mengakses halaman status Registration dengan status `payment_uploaded`, THE System SHALL menampilkan pesan bahwa bukti pembayaran sedang diverifikasi Admin.
6. WHEN Peserta mengakses halaman status Registration dengan status `confirmed`, THE System SHALL menampilkan pesan konfirmasi pendaftaran selesai beserta nama Peserta, nama Training, dan `final_price` yang diformat sebagai mata uang Rupiah.
7. WHEN Peserta mengakses halaman status Registration dengan status `rejected`, THE System SHALL menampilkan Rejection_Reason yang tersimpan di kolom `rejection_reason` dan tombol "Daftar Ulang" yang mengarahkan ke form pendaftaran Training yang sama.
8. THE System SHALL menampilkan nama Peserta, nama Training, dan Status_Pendaftaran terkini pada semua kondisi status di halaman status.
