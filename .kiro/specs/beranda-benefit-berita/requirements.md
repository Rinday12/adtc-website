# Requirements Document

## Introduction

Fitur **Beranda, Benefit, dan Berita** menambahkan tiga kapabilitas utama pada ADTC Website:

1. **Halaman Beranda (`/`)** — Landing page company profile yang menggantikan redirect ke `/trainings`. Menampilkan hero section tentang ADTC, section benefit/keunggulan, training terbaru/unggulan, dan tautan ke halaman berita.
2. **Halaman Berita (`/berita`)** — Halaman publik untuk daftar berita/aktivitas ADTC beserta halaman detail tiap berita (`/berita/:slug`).
3. **Manajemen Konten Admin** — CRUD Benefit dinamis dan CRUD Berita dari dashboard admin, sehingga admin dapat memperbarui konten tanpa mengubah kode.

Fitur ini juga mencakup pembaruan navbar untuk menampilkan link ke Beranda dan Berita, serta penambahan dua tabel database baru: `benefits` dan `news`.

---

## Glossary

- **Beranda**: Halaman utama (`/`) yang berfungsi sebagai landing page company profile ADTC
- **Benefit_Statis**: Item benefit/keunggulan yang sudah terdefinisi di tampilan dan tidak dapat dihapus (contoh: tagline, deskripsi perusahaan)
- **Benefit_Dinamis**: Item benefit/keunggulan yang dikelola admin melalui dashboard (tambah/edit/hapus)
- **Berita**: Entitas artikel/aktivitas dengan field Judul, Konten, Gambar, Tanggal, dan Slug
- **Slug_Berita**: Identifier URL-friendly unik untuk setiap Berita (contoh: `workshop-python-maret-2025`)
- **News_Image**: File gambar yang diunggah untuk setiap Berita, disimpan di `uploads/news_images/`
- **Admin**: Pengguna terautentikasi yang mengelola konten melalui Dashboard_Admin (sama dengan definisi di requirements utama)
- **Pengunjung**: Pengguna umum yang mengakses halaman publik tanpa login
- **CRUD**: Create, Read, Update, Delete — operasi pengelolaan data lengkap
- **Hero_Section**: Bagian atas halaman Beranda berisi branding utama, tagline, dan deskripsi singkat ADTC
- **Training_Unggulan**: Training dengan status `active` yang ditampilkan di Beranda (beberapa item terbaru)

---

## Requirements

### Requirement 1: Halaman Beranda Publik

**User Story:** Sebagai Pengunjung, saya ingin melihat halaman utama ADTC yang informatif, sehingga saya dapat memahami layanan ADTC dan menavigasi ke section yang relevan.

#### Acceptance Criteria

1. WHEN Pengunjung mengakses `GET /`, THE System SHALL merender halaman Beranda (bukan redirect ke `/trainings`).
2. WHEN halaman Beranda dirender, THE System SHALL menampilkan Hero_Section yang memuat nama organisasi "Ahmad Dahlan Training Center", tagline, dan deskripsi singkat tentang ADTC.
3. WHEN halaman Beranda dirender, THE System SHALL menampilkan section Benefit/Keunggulan yang memuat Benefit_Statis (konten built-in) dan seluruh Benefit_Dinamis yang tersimpan di database dengan status aktif.
4. WHEN halaman Beranda dirender, THE System SHALL mengambil daftar Training dengan status `active` dari database dan menampilkan maksimal 3 (tiga) Training terbaru berdasarkan `created_at` descending pada section Training Unggulan.
5. WHEN halaman Beranda dirender, THE System SHALL menampilkan tautan "Lihat Semua Pelatihan" yang mengarah ke `/trainings` dan tautan "Lihat Berita" yang mengarah ke `/berita`.
6. WHEN tidak ada Training aktif di database, THE System SHALL tetap merender halaman Beranda dengan section Training Unggulan kosong tanpa error.
7. IF terjadi kegagalan koneksi database saat query data Beranda, THEN THE System SHALL merender halaman error HTTP 500 dengan pesan generik tanpa mengekspos detail teknis kepada Pengunjung.

---

### Requirement 2: Section Benefit di Halaman Beranda

**User Story:** Sebagai Pengunjung, saya ingin melihat keunggulan dan benefit mengikuti pelatihan di ADTC, sehingga saya dapat mempertimbangkan untuk mendaftar.

#### Acceptance Criteria

1. WHEN Pengunjung mengakses halaman Beranda, THE System SHALL menampilkan Benefit_Statis yang sudah terdefinisi di tampilan, termasuk minimal: tagline utama ADTC dan deskripsi umum organisasi.
2. WHEN Pengunjung mengakses halaman Beranda, THE System SHALL mengambil semua Benefit_Dinamis dengan status `aktif` dari tabel `benefits` di database dan menampilkannya bersama Benefit_Statis.
3. WHEN tidak ada Benefit_Dinamis di database, THE System SHALL tetap menampilkan Benefit_Statis tanpa error.
4. WHEN Benefit_Dinamis ditampilkan, THE System SHALL merender judul dan deskripsi setiap item benefit sesuai data yang tersimpan di database.
5. IF terjadi kegagalan koneksi database saat mengambil Benefit_Dinamis, THEN THE System SHALL tetap merender halaman Beranda dengan Benefit_Statis saja dan mencatat error ke log server tanpa menampilkan pesan error teknis kepada Pengunjung.

---

### Requirement 3: Halaman Daftar Berita Publik

**User Story:** Sebagai Pengunjung, saya ingin melihat daftar berita dan aktivitas terbaru ADTC, sehingga saya dapat mengikuti perkembangan organisasi.

#### Acceptance Criteria

1. WHEN Pengunjung mengakses `GET /berita`, THE System SHALL mengambil semua Berita dari tabel `news` dan merendernya pada halaman daftar berita.
2. WHEN halaman daftar Berita dirender, THE System SHALL menampilkan setiap item berita dengan: Judul, Gambar (jika ada), dan Tanggal publikasi.
3. THE System SHALL mengurutkan daftar Berita berdasarkan `published_at` secara descending (berita terbaru di atas).
4. WHEN tidak ada Berita di database, THE System SHALL menampilkan halaman daftar berita dengan pesan informatif "Belum ada berita." tanpa error.
5. WHEN Pengunjung mengklik item berita, THE System SHALL mengarahkan ke halaman detail berita di `/berita/:slug`.
6. IF terjadi kegagalan koneksi database saat query Berita, THEN THE System SHALL merender halaman error HTTP 500 dengan pesan generik tanpa mengekspos detail teknis kepada Pengunjung.

---

### Requirement 4: Halaman Detail Berita Publik

**User Story:** Sebagai Pengunjung, saya ingin membaca isi lengkap sebuah berita, sehingga saya dapat mengetahui detail aktivitas atau pengumuman dari ADTC.

#### Acceptance Criteria

1. WHEN Pengunjung mengakses `GET /berita/:slug`, THE System SHALL mengambil Berita dari database berdasarkan `Slug_Berita` dan merendernya pada halaman detail.
2. WHEN halaman detail Berita dirender, THE System SHALL menampilkan: Judul, Konten teks lengkap, Gambar (jika ada), dan Tanggal publikasi.
3. IF Pengunjung mengakses `/berita/:slug` dengan slug yang tidak ada di database, THEN THE System SHALL merender halaman error dengan HTTP status 404 dan pesan yang informatif tanpa mengekspos detail teknis.
4. IF terjadi kegagalan koneksi database saat query detail Berita, THEN THE System SHALL merender halaman error HTTP 500 dengan pesan generik tanpa mengekspos detail teknis kepada Pengunjung.

---

### Requirement 5: Manajemen Berita di Dashboard Admin

**User Story:** Sebagai Admin, saya ingin menambah, mengedit, dan menghapus berita dari dashboard, sehingga saya dapat memperbarui konten berita tanpa mengubah kode aplikasi.

#### Acceptance Criteria

1. WHEN Admin yang terautentikasi mengakses `GET /admin/news`, THE System SHALL menampilkan daftar semua Berita dengan kolom: Judul, Tanggal publikasi, dan aksi Edit/Hapus.
2. WHEN Admin mengakses `GET /admin/news/create`, THE System SHALL menampilkan form pembuatan Berita dengan field: Judul, Konten, upload Gambar (opsional), dan Tanggal publikasi.
3. WHEN Admin mengisi form dan mengirim `POST /admin/news`, THE System SHALL memvalidasi input, menyimpan Berita baru ke tabel `news`, dan melakukan redirect ke `/admin/news` dengan Flash_Message sukses.
4. WHEN Admin mengakses `GET /admin/news/:id/edit`, THE System SHALL menampilkan form edit Berita yang telah terisi dengan data Berita yang dipilih berdasarkan ID.
5. WHEN Admin mengisi form edit dan mengirim `POST /admin/news/:id/update`, THE System SHALL memvalidasi input, menyimpan perubahan ke database, dan melakukan redirect ke `/admin/news` dengan Flash_Message sukses.
6. WHEN Admin mengklik hapus dan mengirim `POST /admin/news/:id/delete`, THE System SHALL menghapus Berita dari database beserta referensi path gambarnya dan melakukan redirect ke `/admin/news` dengan Flash_Message sukses.
7. IF Admin mengirim form pembuatan atau edit Berita dengan Judul kosong (0 karakter setelah trim), THEN THE System SHALL menolak penyimpanan dan menampilkan pesan error "Judul berita wajib diisi."
8. IF Admin mengirim form pembuatan atau edit Berita dengan Konten kosong (0 karakter setelah trim), THEN THE System SHALL menolak penyimpanan dan menampilkan pesan error "Konten berita wajib diisi."
9. IF Admin mengirim form pembuatan atau edit Berita tanpa mengisi Tanggal publikasi, THEN THE System SHALL menolak penyimpanan dan menampilkan pesan error "Tanggal publikasi wajib diisi."
10. WHEN Admin menyimpan Berita baru, THE System SHALL meng-generate Slug_Berita secara otomatis dari Judul berita (huruf kecil, spasi diganti `-`, karakter non-alfanumerik dihapus).
11. IF Slug_Berita yang di-generate sudah ada di database, THEN THE System SHALL menambahkan suffix numerik unik (contoh: `-2`, `-3`) untuk memastikan keunikan slug.
12. IF Admin mengakses `GET /admin/news/:id/edit` dengan ID yang tidak ada di database, THEN THE System SHALL merender halaman error dengan HTTP status 404.
13. IF request hapus, edit, atau create dikirim tanpa Session admin yang valid, THEN THE System SHALL menolak request dan melakukan redirect ke `/admin/login`.

---

### Requirement 6: Upload Gambar Berita

**User Story:** Sebagai Admin, saya ingin mengunggah gambar untuk setiap berita, sehingga tampilan berita lebih menarik dan informatif.

#### Acceptance Criteria

1. THE System SHALL menerima upload gambar untuk Berita dengan format `.jpg`, `.jpeg`, `.png`, dan `.webp`, dengan ukuran maksimum 5MB per file.
2. IF file yang diunggah Admin memiliki ukuran lebih dari 5MB, THEN THE System SHALL menolak file tersebut tanpa menyimpan file apapun dan menampilkan pesan error dengan penjelasan batas ukuran.
3. IF file yang diunggah Admin memiliki format selain `.jpg`, `.jpeg`, `.png`, atau `.webp`, THEN THE System SHALL menolak file tersebut tanpa menyimpan file apapun dan menampilkan pesan error dengan penjelasan format yang diterima.
4. WHEN gambar Berita berhasil diunggah, THE System SHALL menyimpan file ke direktori `uploads/news_images/` di filesystem server.
5. THE System SHALL memberi nama file gambar Berita dengan format `[fieldname]-[timestamp].[ext]` untuk menghindari konflik nama file.
6. THE System SHALL menyimpan path file gambar ke kolom `image_path` pada tabel `news` di database.
7. WHEN Admin mengedit Berita dan mengunggah gambar baru, THE System SHALL mengganti gambar lama dengan gambar baru dan menghapus file gambar lama dari filesystem.
8. WHEN Admin menghapus Berita, THE System SHALL menghapus file gambar yang terkait dari direktori `uploads/news_images/` jika file tersebut ada di filesystem.
9. WHEN Pengunjung mengakses halaman detail atau daftar Berita, THE System SHALL menampilkan gambar Berita jika `image_path` tersedia, atau menampilkan placeholder jika tidak ada gambar.

---

### Requirement 7: Manajemen Benefit Dinamis di Dashboard Admin

**User Story:** Sebagai Admin, saya ingin menambah, mengedit, dan menghapus item benefit/keunggulan dari dashboard, sehingga saya dapat memperbarui konten promosi ADTC tanpa mengubah kode.

#### Acceptance Criteria

1. WHEN Admin yang terautentikasi mengakses `GET /admin/benefits`, THE System SHALL menampilkan daftar semua Benefit_Dinamis dari tabel `benefits` dengan kolom: Judul, Deskripsi, Status (aktif/nonaktif), dan aksi Edit/Hapus.
2. WHEN Admin mengakses `GET /admin/benefits/create`, THE System SHALL menampilkan form pembuatan Benefit_Dinamis dengan field: Judul dan Deskripsi.
3. WHEN Admin mengisi form dan mengirim `POST /admin/benefits`, THE System SHALL memvalidasi input, menyimpan Benefit_Dinamis baru ke tabel `benefits` dengan status default `aktif`, dan melakukan redirect ke `/admin/benefits` dengan Flash_Message sukses.
4. WHEN Admin mengakses `GET /admin/benefits/:id/edit`, THE System SHALL menampilkan form edit Benefit_Dinamis yang telah terisi dengan data yang dipilih berdasarkan ID.
5. WHEN Admin mengisi form edit dan mengirim `POST /admin/benefits/:id/update`, THE System SHALL memvalidasi input, menyimpan perubahan ke database, dan melakukan redirect ke `/admin/benefits` dengan Flash_Message sukses.
6. WHEN Admin mengklik hapus dan mengirim `POST /admin/benefits/:id/delete`, THE System SHALL menghapus Benefit_Dinamis dari database dan melakukan redirect ke `/admin/benefits` dengan Flash_Message sukses.
7. IF Admin mengirim form pembuatan atau edit Benefit_Dinamis dengan Judul kosong (0 karakter setelah trim), THEN THE System SHALL menolak penyimpanan dan menampilkan pesan error "Judul benefit wajib diisi."
8. IF Admin mengirim form pembuatan atau edit Benefit_Dinamis dengan Deskripsi kosong (0 karakter setelah trim), THEN THE System SHALL menolak penyimpanan dan menampilkan pesan error "Deskripsi benefit wajib diisi."
9. WHEN Admin mengirim `POST /admin/benefits/:id/update`, THE System SHALL mengizinkan perubahan status antara `aktif` dan `nonaktif`.
10. IF Admin mengakses `GET /admin/benefits/:id/edit` dengan ID yang tidak ada di database, THEN THE System SHALL merender halaman error dengan HTTP status 404.
11. IF request hapus, edit, atau create dikirim tanpa Session admin yang valid, THEN THE System SHALL menolak request dan melakukan redirect ke `/admin/login`.

---

### Requirement 8: Skema Database Baru

**User Story:** Sebagai pengembang, saya ingin tabel database yang terdefinisi dengan baik untuk menyimpan data Berita dan Benefit_Dinamis, sehingga integritas dan konsistensi data terjaga.

#### Acceptance Criteria

1. THE System SHALL memiliki tabel `news` dengan kolom: `id` (PK auto-increment), `title` (VARCHAR NOT NULL), `slug` (VARCHAR UNIQUE NOT NULL), `content` (TEXT NOT NULL), `image_path` (VARCHAR NULL), `published_at` (DATE NOT NULL), dan `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP).
2. THE System SHALL memiliki tabel `benefits` dengan kolom: `id` (PK auto-increment), `title` (VARCHAR NOT NULL), `description` (TEXT NOT NULL), `status` (ENUM: `aktif`, `nonaktif`, DEFAULT `aktif`), dan `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP).
3. THE System SHALL menggunakan parameterized query (prepared statement) pada semua operasi database ke tabel `news` dan `benefits` untuk mencegah SQL injection.
4. IF operasi INSERT atau UPDATE pada tabel `news` dilakukan dengan nilai `slug` yang sudah ada, THEN THE System SHALL menangani constraint UNIQUE violation dan mengembalikan pesan error yang sesuai tanpa mengekspos detail teknis.
5. WHEN Admin menghapus Berita dari tabel `news`, THE System SHALL menghapus baris tersebut secara permanen dari database (hard delete).
6. WHEN Admin menghapus Benefit_Dinamis dari tabel `benefits`, THE System SHALL menghapus baris tersebut secara permanen dari database (hard delete).

---

### Requirement 9: Pembaruan Navigasi (Navbar)

**User Story:** Sebagai Pengunjung, saya ingin navbar yang mencantumkan link ke Beranda dan Berita, sehingga saya dapat berpindah antar halaman dengan mudah.

#### Acceptance Criteria

1. WHEN halaman publik manapun dirender menggunakan layout (`views/layout/header.ejs`), THE System SHALL menampilkan logo/nama "ADTC" di navbar yang mengarah ke `/` (Beranda).
2. WHEN halaman publik dirender, THE System SHALL menampilkan link "Beranda" di navbar yang mengarah ke `/`.
3. WHEN halaman publik dirender, THE System SHALL menampilkan link "Katalog Pelatihan" di navbar yang mengarah ke `/trainings`.
4. WHEN halaman publik dirender, THE System SHALL menampilkan link "Berita" di navbar yang mengarah ke `/berita`.
5. WHEN Pengunjung sedang berada di halaman yang sesuai dengan salah satu link navbar, THE System SHALL memberikan visual indicator (contoh: teks bold atau warna berbeda) pada link yang aktif tersebut.

---

### Requirement 10: Integrasi Dashboard Admin

**User Story:** Sebagai Admin, saya ingin mengakses manajemen Berita dan Benefit dari dashboard admin yang sudah ada, sehingga semua pengelolaan konten terpusat di satu tempat.

#### Acceptance Criteria

1. WHEN Admin yang terautentikasi mengakses `GET /admin/dashboard`, THE System SHALL menampilkan tautan atau menu navigasi menuju halaman manajemen Berita (`/admin/news`) dan manajemen Benefit (`/admin/benefits`).
2. WHEN Admin mengakses halaman manajemen Berita atau Benefit, THE System SHALL memverifikasi autentikasi melalui middleware `isAuthenticated` sebelum memproses request.
3. WHEN Admin berhasil membuat, mengedit, atau menghapus Berita maupun Benefit, THE System SHALL menampilkan Flash_Message sukses yang deskriptif setelah redirect.
4. IF operasi CRUD pada Berita atau Benefit gagal karena error database, THEN THE System SHALL menampilkan Flash_Message error yang informatif kepada Admin tanpa mengekspos detail teknis atau stack trace.
