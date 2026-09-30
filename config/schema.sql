-- config/schema.sql
-- Skema database ADTC (Ahmad Dahlan Training Center)
-- Jalankan script ini satu kali untuk membuat semua tabel yang diperlukan.
--
-- Requirements: 8.1, 8.2, 8.3, 8.7, 8.8

-- Gunakan database yang sesuai (sesuaikan dengan DB_NAME di .env)
-- USE adtc_db;

-- ============================================================
-- Tabel: trainings
-- Menyimpan data program pelatihan yang ditawarkan ADTC.
-- ============================================================
CREATE TABLE IF NOT EXISTS trainings (
  id                  INT             AUTO_INCREMENT PRIMARY KEY,
  title               VARCHAR(255)    NOT NULL,
  slug                VARCHAR(255)    NOT NULL UNIQUE,       -- URL-friendly identifier, misal: python-basic-2025
  description         TEXT,
  category            VARCHAR(100)    NOT NULL DEFAULT 'Umum',         -- Kategori pelatihan (BNSP, Awareness, dll)
  category_order      INT             NOT NULL DEFAULT 99,              -- Urutan tampilan kategori
  price_general       DECIMAL(10, 2)  NOT NULL,              -- Harga untuk peserta umum
  price_student_uad   DECIMAL(10, 2)  NOT NULL,              -- Harga untuk mahasiswa UAD
  price_employee_uad  DECIMAL(10, 2)  NOT NULL,              -- Harga untuk karyawan UAD
  quota               INT             NOT NULL DEFAULT 30,   -- Jumlah peserta maksimal
  start_date          DATE,                                  -- Tanggal mulai pelatihan
  whatsapp_group_link VARCHAR(500) NULL,                    -- Link invite grup WA khusus pelatihan ini (opsional)
  cover_image         VARCHAR(500) NULL,                    -- Path file gambar cover pelatihan (opsional)
  status              ENUM('active', 'postpone', 'full') NOT NULL DEFAULT 'active',
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index pada slug untuk mempercepat lookup detail pelatihan (GET /trainings/:slug)
CREATE INDEX IF NOT EXISTS idx_trainings_slug     ON trainings (slug);
CREATE INDEX IF NOT EXISTS idx_trainings_category ON trainings (category);


-- ============================================================
-- Tabel: registrations
-- Menyimpan data pendaftaran peserta untuk setiap pelatihan.
-- ============================================================
CREATE TABLE IF NOT EXISTS registrations (
  id                  INT             AUTO_INCREMENT PRIMARY KEY,
  training_id         INT             NOT NULL,              -- FK ke trainings.id
  full_name           VARCHAR(255)    NOT NULL,
  email               VARCHAR(255)    NOT NULL,
  phone               VARCHAR(20)     NOT NULL,
  category            ENUM('umum', 'mahasiswa_uad', 'karyawan_uad') NOT NULL,
  identity_number     VARCHAR(50),                           -- NIM (mahasiswa UAD) atau NIY (karyawan UAD)
  identity_card_proof VARCHAR(500),                          -- Path file KTM/ID Card yang diunggah
  final_price         DECIMAL(10, 2)  NOT NULL,              -- Harga final dihitung server berdasarkan kategori
  payment_proof       VARCHAR(500),                          -- Path file bukti pembayaran (opsional)
  reference_code      VARCHAR(50)   NOT NULL UNIQUE,         -- Kode referensi unik (ADTC-YYYY-NNNN)
  certificate_url     VARCHAR(500)  NULL,                    -- Link Google Drive sertifikat (opsional)
  status              ENUM('pending', 'approved', 'payment_uploaded', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  rejection_reason    TEXT,
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key constraint memastikan integritas referensial ke tabel trainings
  CONSTRAINT fk_registrations_training
    FOREIGN KEY (training_id) REFERENCES trainings (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

-- Index pada training_id untuk mempercepat query JOIN dan filter per pelatihan
CREATE INDEX IF NOT EXISTS idx_registrations_training_id ON registrations (training_id);


-- ============================================================
-- Tabel: admins
-- Menyimpan data akun admin Dashboard ADTC.
-- Password disimpan sebagai hash bcrypt (bukan plain text).
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,                      -- Hash bcrypt dengan salt rounds >= 10
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- Tabel: news
-- Menyimpan artikel berita dan aktivitas ADTC.
-- Requirements: 8.1, 8.3
-- ============================================================
CREATE TABLE IF NOT EXISTS news (
  id           INT           AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(255)  NOT NULL,
  slug         VARCHAR(255)  NOT NULL UNIQUE,
  content      TEXT          NOT NULL,
  image_path   VARCHAR(500)  NULL,
  published_at DATE          NOT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_slug         ON news (slug);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news (published_at);


-- ============================================================
-- Tabel: benefits
-- Menyimpan item benefit/keunggulan ADTC yang dikelola admin.
-- Requirements: 8.2
-- ============================================================
CREATE TABLE IF NOT EXISTS benefits (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(255)  NOT NULL,
  description TEXT          NOT NULL,
  status      ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
