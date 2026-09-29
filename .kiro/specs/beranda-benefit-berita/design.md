# Design Document: Beranda, Benefit, dan Berita

## Overview

Fitur ini memperluas ADTC Website dengan tiga kapabilitas baru: **Halaman Beranda** sebagai landing page company profile, **Halaman Berita** publik, dan **Manajemen Konten Admin** untuk Berita dan Benefit dinamis.

Perubahan arsitektur bersifat **additive** — tidak ada komponen yang dihapus, hanya ada tambahan model, controller, view, dan route. Satu-satunya modifikasi file yang ada adalah:
- `views/layout/header.ejs` — update navbar
- `config/schema.sql` — tambah dua tabel
- `middleware/upload.js` — tambah routing untuk `news_images/`
- `routes/publicRoutes.js` — tambah 3 route publik
- `routes/adminRoutes.js` — tambah routes CRUD news & benefits

`app.js` **tidak perlu diubah** karena `publicRoutes` dan `adminRoutes` sudah terpasang.

---

## Architecture

Fitur mengikuti pola MVC yang sudah ada. Ditambahkan dua tabel (`news`, `benefits`), dua model, tiga controller baru, dan tujuh view baru.

```
Browser Request
      │
      ▼
  Router Layer
  ┌────────────────────────────────────────┐
  │  publicRoutes.js  │  adminRoutes.js    │
  │  GET /            │  GET /news         │
  │  GET /berita      │  GET /news/create  │
  │  GET /berita/:slug│  POST /news        │
  │                   │  GET /news/:id/edit│
  │                   │  POST /news/:id/.. │
  │                   │  GET /benefits/... │
  │                   │  POST /benefits/..│
  └────────────────────────────────────────┘
      │
      ▼
  Controller Layer
  ┌───────────────────────────────────────────────┐
  │  contentController       adminNewsController  │
  │  adminBenefitController                       │
  └───────────────────────────────────────────────┘
      │
      ▼
  Model Layer
  ┌──────────────────────────────┐
  │  News.js       Benefit.js    │
  └──────────────────────────────┘
      │
      ▼
  MySQL Database
  ┌──────────────────────────────┐
  │  tabel: news   tabel: benefits│
  └──────────────────────────────┘
```

### Ringkasan Semua Endpoint (Baru)

| Method | Path (efektif) | Controller | Auth | Deskripsi |
|--------|----------------|-----------|------|-----------|
| GET | `/` | contentController.getHome | Publik | Halaman Beranda |
| GET | `/berita` | contentController.getNewsList | Publik | Daftar berita |
| GET | `/berita/:slug` | contentController.getNewsDetail | Publik | Detail berita |
| GET | `/admin/news` | adminNewsController.getList | Admin | Daftar berita (admin) |
| GET | `/admin/news/create` | adminNewsController.getCreate | Admin | Form buat berita |
| POST | `/admin/news` | adminNewsController.postCreate | Admin | Simpan berita baru |
| GET | `/admin/news/:id/edit` | adminNewsController.getEdit | Admin | Form edit berita |
| POST | `/admin/news/:id/update` | adminNewsController.postUpdate | Admin | Simpan perubahan berita |
| POST | `/admin/news/:id/delete` | adminNewsController.postDelete | Admin | Hapus berita |
| GET | `/admin/benefits` | adminBenefitController.getList | Admin | Daftar benefit (admin) |
| GET | `/admin/benefits/create` | adminBenefitController.getCreate | Admin | Form buat benefit |
| POST | `/admin/benefits` | adminBenefitController.postCreate | Admin | Simpan benefit baru |
| GET | `/admin/benefits/:id/edit` | adminBenefitController.getEdit | Admin | Form edit benefit |
| POST | `/admin/benefits/:id/update` | adminBenefitController.postUpdate | Admin | Simpan perubahan benefit |
| POST | `/admin/benefits/:id/delete` | adminBenefitController.postDelete | Admin | Hapus benefit |

> **Catatan routing**: `adminRoutes.js` dipasang dengan `app.use('/admin', adminRoutes)` di `app.js`. Route di dalam `adminRoutes.js` sendiri ditulis **tanpa** prefix `/admin` (contoh: `router.get('/news', ...)` menghasilkan URL efektif `/admin/news`).

---

## Data Models

### Tabel `news` (Baru)

```sql
CREATE TABLE IF NOT EXISTS news (
  id           INT           AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(255)  NOT NULL,
  slug         VARCHAR(255)  NOT NULL UNIQUE,
  content      TEXT          NOT NULL,
  image_path   VARCHAR(500)  NULL,
  published_at DATE          NOT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_slug ON news (slug);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news (published_at);
```

**Aturan Validasi**:
- `title` wajib, tidak boleh kosong setelah trim
- `slug` di-generate otomatis dari `title` (huruf kecil, spasi → `-`, non-alfanumerik dihapus); suffix numerik jika duplikat
- `content` wajib, tidak boleh kosong setelah trim
- `image_path` opsional; diisi path relatif file jika ada upload
- `published_at` wajib, format DATE (YYYY-MM-DD)

### Tabel `benefits` (Baru)

```sql
CREATE TABLE IF NOT EXISTS benefits (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(255)  NOT NULL,
  description TEXT          NOT NULL,
  status      ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Aturan Validasi**:
- `title` wajib, tidak boleh kosong setelah trim
- `description` wajib, tidak boleh kosong setelah trim
- `status` hanya menerima `'aktif'` atau `'nonaktif'`; default `'aktif'` saat create

---

## Model Layer

### `models/News.js`

```javascript
// models/News.js
const db = require('../config/db')

const News = {

  /**
   * Ambil semua berita diurutkan berdasarkan published_at DESC.
   *
   * Postconditions:
   *   - Mengembalikan array of news objects (bisa kosong)
   */
  async findAll() {
    const [rows] = await db.execute(
      'SELECT * FROM news ORDER BY published_at DESC, created_at DESC'
    )
    return rows
  },

  /**
   * Ambil satu berita berdasarkan slug.
   *
   * Preconditions:  slug adalah string non-kosong
   * Postconditions: Mengembalikan objek news atau null
   */
  async findBySlug(slug) {
    const [rows] = await db.execute(
      'SELECT * FROM news WHERE slug = ? LIMIT 1',
      [slug]
    )
    return rows[0] || null
  },

  /**
   * Ambil satu berita berdasarkan ID.
   *
   * Postconditions: Mengembalikan objek news atau null
   */
  async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM news WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] || null
  },

  /**
   * Simpan berita baru ke database.
   *
   * Preconditions:
   *   - data.title, data.slug, data.content, data.published_at tidak kosong
   *   - data.slug sudah dipastikan unik oleh controller
   *
   * Postconditions: Mengembalikan insertId
   */
  async create(data) {
    const { title, slug, content, image_path, published_at } = data
    const [result] = await db.execute(
      `INSERT INTO news (title, slug, content, image_path, published_at)
       VALUES (?, ?, ?, ?, ?)`,
      [title, slug, content, image_path || null, published_at]
    )
    return result.insertId
  },

  /**
   * Perbarui data berita berdasarkan ID.
   *
   * Postconditions: Mengembalikan affectedRows
   */
  async update(id, data) {
    const { title, slug, content, image_path, published_at } = data
    const [result] = await db.execute(
      `UPDATE news SET title = ?, slug = ?, content = ?,
       image_path = ?, published_at = ? WHERE id = ?`,
      [title, slug, content, image_path ?? null, published_at, id]
    )
    return result.affectedRows
  },

  /**
   * Hapus berita berdasarkan ID (hard delete).
   *
   * Postconditions: Mengembalikan affectedRows
   */
  async delete(id) {
    const [result] = await db.execute(
      'DELETE FROM news WHERE id = ?',
      [id]
    )
    return result.affectedRows
  }
}

module.exports = News
```

### `models/Benefit.js`

```javascript
// models/Benefit.js
const db = require('../config/db')

const Benefit = {

  /**
   * Ambil semua benefit dengan status 'aktif'.
   * Digunakan di halaman Beranda publik.
   *
   * Postconditions: Mengembalikan array (bisa kosong)
   */
  async findAllActive() {
    const [rows] = await db.execute(
      "SELECT * FROM benefits WHERE status = 'aktif' ORDER BY created_at ASC"
    )
    return rows
  },

  /**
   * Ambil semua benefit (aktif dan nonaktif).
   * Digunakan di dashboard admin.
   *
   * Postconditions: Mengembalikan array (bisa kosong)
   */
  async findAll() {
    const [rows] = await db.execute(
      'SELECT * FROM benefits ORDER BY created_at ASC'
    )
    return rows
  },

  /**
   * Ambil satu benefit berdasarkan ID.
   *
   * Postconditions: Mengembalikan objek benefit atau null
   */
  async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM benefits WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] || null
  },

  /**
   * Simpan benefit baru dengan status default 'aktif'.
   *
   * Preconditions:
   *   - data.title dan data.description tidak kosong setelah trim
   *
   * Postconditions: Mengembalikan insertId
   */
  async create(data) {
    const { title, description } = data
    const [result] = await db.execute(
      "INSERT INTO benefits (title, description) VALUES (?, ?)",
      [title, description]
    )
    return result.insertId
  },

  /**
   * Perbarui data benefit berdasarkan ID.
   *
   * Preconditions:
   *   - data.status harus 'aktif' atau 'nonaktif'
   *
   * Postconditions: Mengembalikan affectedRows
   */
  async update(id, data) {
    const { title, description, status } = data
    const [result] = await db.execute(
      'UPDATE benefits SET title = ?, description = ?, status = ? WHERE id = ?',
      [title, description, status, id]
    )
    return result.affectedRows
  },

  /**
   * Hapus benefit berdasarkan ID (hard delete).
   *
   * Postconditions: Mengembalikan affectedRows
   */
  async delete(id) {
    const [result] = await db.execute(
      'DELETE FROM benefits WHERE id = ?',
      [id]
    )
    return result.affectedRows
  }
}

module.exports = Benefit
```

---

## Controller Layer

### `controllers/contentController.js`

Controller untuk halaman-halaman publik baru.

```javascript
// controllers/contentController.js
const Training = require('../models/Training')
const News     = require('../models/News')
const Benefit  = require('../models/Benefit')

const contentController = {

  /**
   * GET /
   * Halaman Beranda: hero section, benefit dinamis, training unggulan, link berita.
   *
   * Postconditions:
   *   - Render views/home.ejs dengan: benefits (array aktif), trainings (maks 3 terbaru), title
   *   - Jika query benefit gagal, render tetap berhasil dengan benefits = [] dan log error
   *   - Jika query training gagal, lanjut ke error handler
   */
  getHome: async (req, res, next) => {
    try {
      // Jalankan dua query paralel; jika benefit gagal, fallback ke array kosong
      const [trainings, benefits] = await Promise.allSettled([
        Training.findLatest(3),  // SELECT 3 training aktif terbaru (method baru di Training model)
        Benefit.findAllActive()
      ])

      res.render('home', {
        title:     'Beranda',
        trainings: trainings.status === 'fulfilled' ? trainings.value : [],
        benefits:  benefits.status  === 'fulfilled' ? benefits.value  : []
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /berita
   * Daftar semua berita, urut published_at DESC.
   *
   * Postconditions:
   *   - Render views/news/list.ejs dengan newsList (bisa array kosong)
   */
  getNewsList: async (req, res, next) => {
    try {
      const newsList = await News.findAll()
      res.render('news/list', { title: 'Berita ADTC', newsList })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /berita/:slug
   * Detail satu berita.
   *
   * Postconditions:
   *   - Render views/news/detail.ejs jika ditemukan
   *   - HTTP 404 jika slug tidak ada
   */
  getNewsDetail: async (req, res, next) => {
    try {
      const news = await News.findBySlug(req.params.slug)
      if (!news) {
        return res.status(404).render('error', {
          message: 'Berita tidak ditemukan', code: 404
        })
      }
      res.render('news/detail', { title: news.title, news })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = contentController
```

> **Catatan**: `Training.findLatest(limit)` adalah method baru yang perlu ditambahkan ke `models/Training.js`. Method ini melakukan `SELECT * FROM trainings WHERE status = 'active' ORDER BY created_at DESC LIMIT ?`.

### `controllers/adminNewsController.js`

CRUD Berita di dashboard admin. Semua handler memerlukan `isAuthenticated` (dipasang di router).

```javascript
// controllers/adminNewsController.js
const path = require('path')
const fs   = require('fs')
const News = require('../models/News')

/**
 * Generate slug dari judul.
 * Contoh: "Workshop Python 2025" → "workshop-python-2025"
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/**
 * Pastikan slug unik; tambahkan suffix -2, -3, dst. jika perlu.
 * Mengecualikan berita dengan excludeId (untuk operasi edit).
 */
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let candidate = baseSlug
  let counter   = 1
  while (true) {
    const existing = await News.findBySlug(candidate)
    if (!existing || existing.id === excludeId) return candidate
    counter++
    candidate = `${baseSlug}-${counter}`
  }
}

/**
 * Validasi input form berita.
 * Mengembalikan { valid: boolean, errors: string[] }
 */
function validateNewsInput(body) {
  const errors = []
  if (!body.title || body.title.trim().length === 0)
    errors.push('Judul berita wajib diisi.')
  if (!body.content || body.content.trim().length === 0)
    errors.push('Konten berita wajib diisi.')
  if (!body.published_at || body.published_at.trim().length === 0)
    errors.push('Tanggal publikasi wajib diisi.')
  return { valid: errors.length === 0, errors }
}

const adminNewsController = {

  /** GET /news → /admin/news */
  getList: async (req, res, next) => {
    try {
      const newsList = await News.findAll()
      res.render('admin/news/list', { title: 'Manajemen Berita', newsList })
    } catch (err) { next(err) }
  },

  /** GET /news/create → /admin/news/create */
  getCreate: (req, res) => {
    res.render('admin/news/form', {
      title: 'Buat Berita Baru', news: null, errors: [], isEdit: false
    })
  },

  /**
   * POST /news → /admin/news
   * Simpan berita baru. Jika ada file upload, simpan path ke image_path.
   */
  postCreate: async (req, res, next) => {
    try {
      const { valid, errors } = validateNewsInput(req.body)
      if (!valid) {
        // Hapus file yang sudah terupload jika validasi gagal
        if (req.file) fs.unlink(req.file.path, () => {})
        return res.render('admin/news/form', {
          title: 'Buat Berita Baru', news: null, errors, isEdit: false
        })
      }

      const baseSlug  = generateSlug(req.body.title.trim())
      const slug      = await ensureUniqueSlug(baseSlug)
      const imagePath = req.file ? req.file.path : null

      await News.create({
        title:        req.body.title.trim(),
        slug,
        content:      req.body.content.trim(),
        image_path:   imagePath,
        published_at: req.body.published_at.trim()
      })

      req.flash('success', 'Berita berhasil dibuat.')
      res.redirect('/news')  // akan menjadi /admin/news karena prefix di app.js
    } catch (err) { next(err) }
  },

  /** GET /news/:id/edit → /admin/news/:id/edit */
  getEdit: async (req, res, next) => {
    try {
      const news = await News.findById(req.params.id)
      if (!news) {
        return res.status(404).render('error', { message: 'Berita tidak ditemukan', code: 404 })
      }
      res.render('admin/news/form', {
        title: 'Edit Berita', news, errors: [], isEdit: true
      })
    } catch (err) { next(err) }
  },

  /**
   * POST /news/:id/update → /admin/news/:id/update
   * Jika ada gambar baru, hapus gambar lama sebelum menyimpan.
   */
  postUpdate: async (req, res, next) => {
    try {
      const news = await News.findById(req.params.id)
      if (!news) {
        return res.status(404).render('error', { message: 'Berita tidak ditemukan', code: 404 })
      }

      const { valid, errors } = validateNewsInput(req.body)
      if (!valid) {
        if (req.file) fs.unlink(req.file.path, () => {})
        return res.render('admin/news/form', {
          title: 'Edit Berita', news, errors, isEdit: true
        })
      }

      const baseSlug  = generateSlug(req.body.title.trim())
      const slug      = await ensureUniqueSlug(baseSlug, parseInt(req.params.id))

      // Tentukan image_path: gunakan gambar baru jika ada, atau pertahankan yang lama
      let imagePath = news.image_path
      if (req.file) {
        // Hapus gambar lama dari filesystem
        if (news.image_path && fs.existsSync(news.image_path)) {
          fs.unlink(news.image_path, () => {})
        }
        imagePath = req.file.path
      }

      await News.update(req.params.id, {
        title:        req.body.title.trim(),
        slug,
        content:      req.body.content.trim(),
        image_path:   imagePath,
        published_at: req.body.published_at.trim()
      })

      req.flash('success', 'Berita berhasil diperbarui.')
      res.redirect('/news')
    } catch (err) { next(err) }
  },

  /**
   * POST /news/:id/delete → /admin/news/:id/delete
   * Hapus berita dan file gambarnya dari filesystem.
   */
  postDelete: async (req, res, next) => {
    try {
      const news = await News.findById(req.params.id)
      if (news && news.image_path && fs.existsSync(news.image_path)) {
        fs.unlink(news.image_path, () => {})
      }
      await News.delete(req.params.id)
      req.flash('success', 'Berita berhasil dihapus.')
      res.redirect('/news')
    } catch (err) { next(err) }
  }
}

module.exports = adminNewsController
module.exports.validateNewsInput   = validateNewsInput
module.exports.generateSlug        = generateSlug
module.exports.ensureUniqueSlug    = ensureUniqueSlug
```

> **Catatan redirect**: Karena router dipasang di `app.use('/admin', adminRoutes)`, dan controller melakukan `res.redirect('/news')` — ini akan mengarah ke URL publik `/news` yang tidak ada. Redirect harus menggunakan path absolut `/admin/news`. Di implementasi aktual gunakan `res.redirect('/admin/news')`.

### `controllers/adminBenefitController.js`

CRUD Benefit dinamis di dashboard admin.

```javascript
// controllers/adminBenefitController.js
const Benefit = require('../models/Benefit')

/**
 * Validasi input form benefit.
 * Mengembalikan { valid: boolean, errors: string[] }
 */
function validateBenefitInput(body) {
  const errors = []
  if (!body.title || body.title.trim().length === 0)
    errors.push('Judul benefit wajib diisi.')
  if (!body.description || body.description.trim().length === 0)
    errors.push('Deskripsi benefit wajib diisi.')
  return { valid: errors.length === 0, errors }
}

const adminBenefitController = {

  /** GET /benefits → /admin/benefits */
  getList: async (req, res, next) => {
    try {
      const benefits = await Benefit.findAll()
      res.render('admin/benefits/list', { title: 'Manajemen Benefit', benefits })
    } catch (err) { next(err) }
  },

  /** GET /benefits/create → /admin/benefits/create */
  getCreate: (req, res) => {
    res.render('admin/benefits/form', {
      title: 'Tambah Benefit', benefit: null, errors: [], isEdit: false
    })
  },

  /** POST /benefits → /admin/benefits */
  postCreate: async (req, res, next) => {
    try {
      const { valid, errors } = validateBenefitInput(req.body)
      if (!valid) {
        return res.render('admin/benefits/form', {
          title: 'Tambah Benefit', benefit: null, errors, isEdit: false
        })
      }

      await Benefit.create({
        title:       req.body.title.trim(),
        description: req.body.description.trim()
      })

      req.flash('success', 'Benefit berhasil ditambahkan.')
      res.redirect('/admin/benefits')
    } catch (err) { next(err) }
  },

  /** GET /benefits/:id/edit → /admin/benefits/:id/edit */
  getEdit: async (req, res, next) => {
    try {
      const benefit = await Benefit.findById(req.params.id)
      if (!benefit) {
        return res.status(404).render('error', { message: 'Benefit tidak ditemukan', code: 404 })
      }
      res.render('admin/benefits/form', {
        title: 'Edit Benefit', benefit, errors: [], isEdit: true
      })
    } catch (err) { next(err) }
  },

  /** POST /benefits/:id/update → /admin/benefits/:id/update */
  postUpdate: async (req, res, next) => {
    try {
      const benefit = await Benefit.findById(req.params.id)
      if (!benefit) {
        return res.status(404).render('error', { message: 'Benefit tidak ditemukan', code: 404 })
      }

      const { valid, errors } = validateBenefitInput(req.body)
      if (!valid) {
        return res.render('admin/benefits/form', {
          title: 'Edit Benefit', benefit, errors, isEdit: true
        })
      }

      // Normalisasi status: hanya terima nilai yang valid
      const status = req.body.status === 'nonaktif' ? 'nonaktif' : 'aktif'

      await Benefit.update(req.params.id, {
        title:       req.body.title.trim(),
        description: req.body.description.trim(),
        status
      })

      req.flash('success', 'Benefit berhasil diperbarui.')
      res.redirect('/admin/benefits')
    } catch (err) { next(err) }
  },

  /** POST /benefits/:id/delete → /admin/benefits/:id/delete */
  postDelete: async (req, res, next) => {
    try {
      await Benefit.delete(req.params.id)
      req.flash('success', 'Benefit berhasil dihapus.')
      res.redirect('/admin/benefits')
    } catch (err) { next(err) }
  }
}

module.exports = adminBenefitController
module.exports.validateBenefitInput = validateBenefitInput
```

---

## File Modifications

### `models/Training.js` — Tambah `findLatest`

Method baru yang dibutuhkan oleh `contentController.getHome`:

```javascript
/**
 * Ambil N training aktif terbaru berdasarkan created_at DESC.
 *
 * Preconditions:  limit adalah integer positif
 * Postconditions: Mengembalikan array dengan panjang maksimal `limit`
 */
async findLatest(limit = 3) {
  const [rows] = await db.execute(
    `SELECT * FROM trainings WHERE status = 'active'
     ORDER BY created_at DESC LIMIT ?`,
    [limit]
  )
  return rows
}
```

### `middleware/upload.js` — Tambah routing `news_images/`

Tambahkan kondisi baru di fungsi `destination`:

```javascript
// Sebelum (kondisi yang ada):
destination: (req, file, cb) => {
  let dest = 'uploads/identity_cards'
  if (file.fieldname === 'payment_proof') {
    dest = 'uploads/payment_proofs'
  }
  // ...
}

// Sesudah (dengan tambahan news_image):
destination: (req, file, cb) => {
  let dest = 'uploads/identity_cards'
  if (file.fieldname === 'payment_proof') {
    dest = 'uploads/payment_proofs'
  } else if (file.fieldname === 'news_image') {
    dest = 'uploads/news_images'
  }
  ensureDir(dest)
  cb(null, dest)
}
```

Tambahkan juga `webp` ke dalam `fileFilter` untuk mendukung format gambar berita:

```javascript
// Sebelum:
const allowedPattern = /jpeg|jpg|png|pdf/

// Sesudah (fileFilter untuk news_image perlu webp, tapi kita buat satu filter global):
// Pertimbangan: buat dua fileFilter terpisah, atau tambahkan webp secara global.
// Solusi yang dipilih: tambahkan webp ke pola yang ada karena tidak merusak filter existing.
const allowedPattern = /jpeg|jpg|png|pdf|webp/
```

> **Catatan**: Menambahkan `webp` ke pola existing tidak merusak validasi upload KTM/ID Card karena format KTM (jpg, png, pdf) tetap valid. Format pdf tidak relevan untuk gambar berita tapi tidak berbahaya dibiarkan karena validasi format disesuaikan per fieldname jika diperlukan di masa depan.

### `routes/publicRoutes.js` — Route baru

```javascript
const contentController = require('../controllers/contentController')

// Ganti route root:
// SEBELUM: router.get('/', (req, res) => res.redirect('/trainings'))
// SESUDAH:
router.get('/', contentController.getHome)

// Tambah route berita:
router.get('/berita', contentController.getNewsList)
router.get('/berita/:slug', contentController.getNewsDetail)
```

### `routes/adminRoutes.js` — Route CRUD baru

```javascript
const adminNewsController    = require('../controllers/adminNewsController')
const adminBenefitController = require('../controllers/adminBenefitController')

// News (tanpa prefix /admin karena sudah di-handle app.js)
router.get('/news',              isAuthenticated, adminNewsController.getList)
router.get('/news/create',       isAuthenticated, adminNewsController.getCreate)
router.post('/news',             isAuthenticated, upload.single('news_image'), adminNewsController.postCreate)
router.get('/news/:id/edit',     isAuthenticated, adminNewsController.getEdit)
router.post('/news/:id/update',  isAuthenticated, upload.single('news_image'), adminNewsController.postUpdate)
router.post('/news/:id/delete',  isAuthenticated, adminNewsController.postDelete)

// Benefits
router.get('/benefits',             isAuthenticated, adminBenefitController.getList)
router.get('/benefits/create',      isAuthenticated, adminBenefitController.getCreate)
router.post('/benefits',            isAuthenticated, adminBenefitController.postCreate)
router.get('/benefits/:id/edit',    isAuthenticated, adminBenefitController.getEdit)
router.post('/benefits/:id/update', isAuthenticated, adminBenefitController.postUpdate)
router.post('/benefits/:id/delete', isAuthenticated, adminBenefitController.postDelete)
```

> **Penting**: Route `/news/create` harus didefinisikan **sebelum** `/news/:id/edit` agar Express tidak menafsirkan `create` sebagai `:id`. Urutan yang sama berlaku untuk `/benefits/create`.

### `views/layout/header.ejs` — Update navbar

Navbar saat ini hanya punya satu link. Update menjadi:

```html
<nav class="bg-blue-700 text-white shadow-md">
  <div class="container mx-auto px-4 py-3 flex justify-between items-center">
    <a href="/" class="font-bold text-xl">ADTC</a>
    <div class="flex gap-6 text-sm">
      <a href="/"          class="hover:underline <%= typeof currentPath !== 'undefined' && currentPath === '/' ? 'font-bold underline' : '' %>">Beranda</a>
      <a href="/trainings" class="hover:underline <%= typeof currentPath !== 'undefined' && currentPath === '/trainings' ? 'font-bold underline' : '' %>">Katalog Pelatihan</a>
      <a href="/berita"    class="hover:underline <%= typeof currentPath !== 'undefined' && currentPath.startsWith('/berita') ? 'font-bold underline' : '' %>">Berita</a>
    </div>
  </div>
</nav>
```

Active link indicator membutuhkan `currentPath` tersedia di `res.locals`. Tambahkan middleware di `app.js`:

```javascript
app.use((req, res, next) => {
  res.locals.currentPath = req.path
  // ... middleware flash yang sudah ada
  next()
})
```

### `config/schema.sql` — Tambah dua tabel

Append ke file yang sudah ada:

```sql
-- ============================================================
-- Tabel: news
-- Menyimpan artikel berita dan aktivitas ADTC.
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
-- ============================================================
CREATE TABLE IF NOT EXISTS benefits (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(255)  NOT NULL,
  description TEXT          NOT NULL,
  status      ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## View Layer

Semua view menggunakan pola include yang sudah ada: `<%- include('../layout/header', { title }) %>` di atas dan `<%- include('../layout/footer') %>` di bawah (path disesuaikan relatif masing-masing view).

### `views/home.ejs`

Beranda publik. Data yang diterima dari controller: `title`, `benefits` (array), `trainings` (array maks 3).

**Seksi yang dirender**:
1. **Hero Section** — nama, tagline, tombol CTA ke `/trainings`
2. **Benefit Section** — Benefit_Statis (hardcoded di template) + loop `benefits` dari DB
3. **Training Unggulan** — loop `trainings` (maks 3); jika kosong, tampilkan teks "Belum ada pelatihan aktif."
4. **Link navigasi** — "Lihat Semua Pelatihan" → `/trainings`, "Lihat Berita" → `/berita`

### `views/news/list.ejs`

Daftar berita publik. Data: `title`, `newsList` (array).

**Konten**:
- Heading "Berita & Aktivitas ADTC"
- Loop `newsList`: tiap item menampilkan gambar (atau placeholder), judul (link ke `/berita/:slug`), dan tanggal
- Jika `newsList.length === 0`: teks "Belum ada berita."

### `views/news/detail.ejs`

Detail satu berita. Data: `title`, `news` (objek).

**Konten**:
- Gambar berita (jika `news.image_path` ada)
- Judul `news.title`
- Tanggal `news.published_at`
- Konten `news.content` (render sebagai preformatted text atau `<%- %>` jika HTML)
- Link kembali ke `/berita`

### `views/admin/news/list.ejs`

Admin: daftar berita. Data: `title`, `newsList`.

**Konten**:
- Tabel: Judul, Tanggal Publikasi, Aksi (Edit → `/admin/news/:id/edit`, Hapus → form POST ke `/admin/news/:id/delete`)
- Tombol "Tambah Berita Baru" → `/admin/news/create`
- Flash message success/error

### `views/admin/news/form.ejs`

Digunakan untuk create dan edit. Data: `title`, `news` (null saat create, objek saat edit), `errors`, `isEdit`.

**Field**:
- `title` (text, required)
- `content` (textarea, required)
- `published_at` (date, required)
- `news_image` (file, opsional) — `enctype="multipart/form-data"`
- Jika `isEdit && news.image_path`: tampilkan gambar saat ini dengan opsi ganti

**Action form**:
- Create: `POST /admin/news`
- Edit: `POST /admin/news/:id/update`

### `views/admin/benefits/list.ejs`

Admin: daftar benefit. Data: `title`, `benefits`.

**Konten**:
- Tabel: Judul, Deskripsi (truncated), Status (badge aktif/nonaktif), Aksi (Edit, Hapus)
- Tombol "Tambah Benefit" → `/admin/benefits/create`

### `views/admin/benefits/form.ejs`

Create dan edit benefit. Data: `title`, `benefit` (null atau objek), `errors`, `isEdit`.

**Field**:
- `title` (text, required)
- `description` (textarea, required)
- `status` (select: `aktif` / `nonaktif`) — hanya ditampilkan saat `isEdit`

**Action form**:
- Create: `POST /admin/benefits`
- Edit: `POST /admin/benefits/:id/update`

---

## Implementation Notes

### Slug Generation

Fungsi `generateSlug` di `adminNewsController.js` mengikuti aturan:
1. Lowercase semua karakter
2. Hapus karakter non-alfanumerik kecuali spasi dan strip
3. Trim spasi di awal/akhir
4. Ganti satu atau lebih spasi dengan satu `-`
5. Ganti satu atau lebih `-` berurutan dengan satu `-`

Fungsi `ensureUniqueSlug` mengecek slug candidate ke database. Jika sudah ada (dan bukan berita yang sedang diedit), tambahkan `-2`, `-3`, dst.

### Penanganan File Gambar Berita

- Upload ke `uploads/news_images/` via Multer dengan fieldname `news_image`
- Saat edit: jika ada file baru, hapus file lama via `fs.unlink` (fire-and-forget, tidak blocking)
- Saat delete: hapus file terkait dari filesystem sebelum delete dari DB
- Direktori `uploads/news_images/` dibuat otomatis oleh `ensureDir` di Multer destination callback

### Fallback Benefit di Beranda

`contentController.getHome` menggunakan `Promise.allSettled` agar kegagalan query benefit tidak membuat halaman error 500. Jika query benefit gagal, `benefits` di view menjadi array kosong dan hanya Benefit_Statis (hardcoded di template) yang tampil. Error tetap dicatat via `console.error`.

### Active Link di Navbar

`currentPath` di-set lewat `res.locals` di middleware `app.js`. View `header.ejs` membandingkan `currentPath` dengan path masing-masing link untuk menentukan class active. Untuk path dinamis seperti `/berita/slug-tertentu`, digunakan `currentPath.startsWith('/berita')`.

---

## Correctness Properties

### Property 1: Halaman Beranda Selalu Dapat Dirender

_For any_ kombinasi data (benefits array kosong, benefits array terisi, trainings array kosong, trainings array terisi), `contentController.getHome` SHALL berhasil merender `views/home.ejs` dengan HTTP 200, termasuk ketika query benefit ke database gagal (fallback ke array kosong).

**Validates: Requirements 1.3, 1.4, 1.6, 2.3, 2.5**

---

### Property 2: Konsistensi Slug Berita — Selalu Unik

_For any_ dua Berita yang disimpan ke database dengan Judul yang sama atau Judul yang menghasilkan slug identik, fungsi `ensureUniqueSlug` SHALL menghasilkan slug yang berbeda untuk masing-masing Berita, sehingga tidak ada dua baris di tabel `news` yang memiliki nilai `slug` identik.

**Validates: Requirements 5.10, 5.11, 8.1**

---

### Property 3: Validasi Input Berita Menolak Semua Kombinasi Input Tidak Valid

_For any_ kombinasi `req.body` form berita di mana `title` kosong (setelah trim), `content` kosong (setelah trim), atau `published_at` kosong (setelah trim), fungsi `validateNewsInput` SHALL mengembalikan `{ valid: false, errors: [...] }` dengan pesan error deskriptif yang sesuai, dan controller SHALL tidak menyimpan data apapun ke database.

**Validates: Requirements 5.7, 5.8, 5.9**

---

### Property 4: Validasi Input Benefit Menolak Semua Kombinasi Input Tidak Valid

_For any_ kombinasi `req.body` form benefit di mana `title` kosong (setelah trim) atau `description` kosong (setelah trim), fungsi `validateBenefitInput` SHALL mengembalikan `{ valid: false, errors: [...] }` dengan pesan error deskriptif, dan controller SHALL tidak menyimpan data apapun ke database.

**Validates: Requirements 7.7, 7.8**

---

### Property 5: Status Benefit Selalu Berada dalam Nilai yang Valid

_For any_ operasi update pada tabel `benefits`, nilai `status` yang tersimpan di database SHALL selalu berupa salah satu dari `'aktif'` atau `'nonaktif'`; tidak ada nilai lain yang dapat tersimpan, karena controller menormalisasi input sebelum meneruskan ke model.

**Validates: Requirements 7.9, 8.2**

---

### Property 6: Konsistensi File Gambar — Tidak Ada Orphaned File

_For any_ operasi edit Berita yang menyertakan gambar baru, file gambar lama SHALL dihapus dari filesystem setelah gambar baru berhasil disimpan. _For any_ operasi hapus Berita yang memiliki `image_path`, file gambar terkait SHALL dihapus dari `uploads/news_images/` sebelum baris dihapus dari database.

**Validates: Requirements 6.7, 6.8**

---

### Property 7: Semua Route Admin News dan Benefit Dilindungi Autentikasi

_For any_ HTTP request ke endpoint `/admin/news/*` atau `/admin/benefits/*` tanpa `req.session.adminId` yang valid, middleware `isAuthenticated` SHALL melakukan redirect ke `/admin/login` tanpa memproses request lebih lanjut, sehingga tidak ada data yang dapat dibaca, dibuat, diubah, atau dihapus oleh pengguna yang tidak terautentikasi.

**Validates: Requirements 5.13, 7.11, 10.2**

---

### Property 8: Filter `findAllActive` Mengembalikan Hanya Benefit Aktif

_For any_ query `Benefit.findAllActive()`, setiap objek yang dikembalikan SHALL memiliki `status === 'aktif'`; tidak ada Benefit dengan `status === 'nonaktif'` yang tersisip dalam hasil, sehingga Beranda publik hanya menampilkan benefit yang diaktifkan admin.

**Validates: Requirements 2.2, 2.4**

---

## Error Handling

### Skenario Error 1: Slug Berita Duplikat saat Edit

**Kondisi**: Admin mengubah judul berita ke judul yang slug-nya sudah digunakan oleh berita lain.
**Respons**: `ensureUniqueSlug(baseSlug, excludeId)` mengembalikan slug dengan suffix numerik; data tersimpan dengan slug baru. Admin tidak melihat error.

### Skenario Error 2: File Gambar Berita Terlalu Besar atau Format Tidak Didukung

**Kondisi**: Admin mengupload file > 5MB atau format selain jpg/jpeg/png/webp.
**Respons**: Multer melempar error; file tidak tersimpan. Controller menangkap error Multer dan merender form kembali dengan pesan error deskriptif.

### Skenario Error 3: Berita/Benefit tidak Ditemukan saat Edit atau Delete

**Kondisi**: Admin mengakses `/admin/news/:id/edit` dengan ID yang tidak ada.
**Respons**: HTTP 404, render `error.ejs` dengan pesan "Berita tidak ditemukan".

### Skenario Error 4: Query Database Gagal saat Render Beranda

**Kondisi**: MySQL tidak dapat dijangkau saat `contentController.getHome` dipanggil.
**Respons**: `Promise.allSettled` memastikan query training yang gagal masih diteruskan ke error handler via `next(err)`, sedangkan query benefit yang gagal menghasilkan array kosong. Halaman error 500 dirender untuk kegagalan query training.

### Skenario Error 5: Hapus File Gagal saat Delete Berita

**Kondisi**: File gambar tidak ada di filesystem meskipun `image_path` terisi di database.
**Respons**: `fs.unlink` di-call dengan fire-and-forget; jika file tidak ada, error diabaikan. Operasi delete database tetap dilanjutkan.
