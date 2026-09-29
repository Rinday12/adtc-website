// controllers/adminNewsController.js
// CRUD Berita untuk dashboard admin.
// Semua handler memerlukan middleware `isAuthenticated` (dipasang di router).
//
// Persyaratan: 5.1–5.13, 6.1–6.9

const fs   = require('fs')
const News = require('../models/News')

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────

/**
 * Generate slug URL-friendly dari judul berita.
 *
 * Contoh: "Workshop Python 2025!" → "workshop-python-2025"
 *
 * Algoritma:
 *   1. Lowercase semua karakter
 *   2. Hapus karakter non-alfanumerik kecuali spasi dan strip
 *   3. Trim spasi di awal/akhir
 *   4. Ganti satu atau lebih spasi dengan satu `-`
 *   5. Collapse beberapa `-` berurutan menjadi satu `-`
 *
 * Persyaratan: 5.10
 *
 * @param {string} title
 * @returns {string}
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
 * Pastikan slug unik di database.
 * Jika `baseSlug` sudah dipakai oleh berita lain, tambahkan suffix -2, -3, dst.
 * Saat edit, `excludeId` mencegah berita saat ini dianggap konflik dengan dirinya sendiri.
 *
 * Persyaratan: 5.11
 *
 * @param {string}      baseSlug   - Slug dasar tanpa suffix
 * @param {number|null} excludeId  - ID berita yang sedang diedit (null untuk create)
 * @returns {Promise<string>}       - Slug unik yang aman untuk disimpan
 */
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let candidate = baseSlug
  let counter   = 1

  while (true) {
    const existing = await News.findBySlug(candidate)

    // Tidak ada konflik, atau konflik dengan berita yang sedang diedit sendiri
    if (!existing || existing.id === excludeId) {
      return candidate
    }

    counter++
    candidate = `${baseSlug}-${counter}`
  }
}

/**
 * Validasi input form berita.
 * Semua field wajib diperiksa setelah trim.
 *
 * Persyaratan: 5.7, 5.8, 5.9
 *
 * @param {object} body - req.body dari form
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateNewsInput(body) {
  const errors = []

  if (!body.title || body.title.trim().length === 0) {
    errors.push('Judul berita wajib diisi.')
  }
  if (!body.content || body.content.trim().length === 0) {
    errors.push('Konten berita wajib diisi.')
  }
  if (!body.published_at || body.published_at.trim().length === 0) {
    errors.push('Tanggal publikasi wajib diisi.')
  }

  return { valid: errors.length === 0, errors }
}

// ─────────────────────────────────────────────
// Controller Handlers
// ─────────────────────────────────────────────

const adminNewsController = {

  /**
   * GET /admin/news
   * Tampilkan daftar semua berita.
   *
   * Postconditions:
   *   - Render admin/news/list dengan newsList (bisa kosong)
   *
   * Persyaratan: 5.1
   */
  getList: async (req, res, next) => {
    try {
      const newsList = await News.findAll()
      res.render('admin/news/list', {
        title: 'Manajemen Berita',
        newsList,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /admin/news/create
   * Tampilkan form pembuatan berita baru.
   *
   * Postconditions:
   *   - Render admin/news/form dengan nilai default kosong
   *
   * Persyaratan: 5.2
   */
  getCreate: (req, res) => {
    res.render('admin/news/form', {
      title:  'Buat Berita Baru',
      news:   null,
      errors: [],
      isEdit: false,
      adminUser: req.session.adminUsername || 'Admin',
      currentPath: req.originalUrl
    })
  },

  /**
   * GET /admin/news/:id/edit
   * Tampilkan form edit berita berdasarkan ID.
   *
   * Postconditions:
   *   - Render admin/news/form dengan data berita yang ada jika ID ditemukan
   *   - HTTP 404 + error view jika ID tidak ditemukan
   *
   * Persyaratan: 5.4, 5.12
   */
  getEdit: async (req, res, next) => {
    try {
      const news = await News.findById(req.params.id)
      if (!news) {
        return res.status(404).render('error', {
          message: 'Berita tidak ditemukan',
          code:    404
        })
      }

      res.render('admin/news/form', {
        title:  'Edit Berita',
        news,
        errors: [],
        isEdit: true,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /admin/news
   * Simpan berita baru ke database.
   *
   * Flow:
   *   1. Validasi input; jika gagal, hapus file upload (fire-and-forget) dan re-render form
   *   2. Generate slug unik dari judul
   *   3. Simpan via News.create
   *   4. Redirect ke /admin/news dengan flash sukses
   *
   * Persyaratan: 5.3, 5.7, 5.8, 5.9, 5.10, 5.11, 6.4, 6.5, 6.6
   */
  postCreate: async (req, res, next) => {
    try {
      const { valid, errors } = validateNewsInput(req.body)

      if (!valid) {
        // Hapus file yang sudah terupload agar tidak menjadi orphan
        if (req.file) {
          fs.unlink(req.file.path, () => {})
        }
        return res.render('admin/news/form', {
          title:  'Buat Berita Baru',
          news:   null,
          errors,
          isEdit: false,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl
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
      res.redirect('/admin/news')
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /admin/news/:id/update
   * Perbarui berita yang sudah ada.
   *
   * Flow:
   *   1. Cari berita by ID; HTTP 404 jika tidak ada
   *   2. Validasi input; jika gagal, hapus file upload baru (fire-and-forget) dan re-render form
   *   3. Jika ada file baru, hapus file lama dari filesystem
   *   4. Generate slug unik dengan excludeId
   *   5. Simpan perubahan via News.update
   *   6. Redirect ke /admin/news dengan flash sukses
   *
   * Persyaratan: 5.5, 5.7, 5.8, 5.9, 5.10, 5.11, 6.7
   */
  postUpdate: async (req, res, next) => {
    try {
      const news = await News.findById(req.params.id)
      if (!news) {
        return res.status(404).render('error', {
          message: 'Berita tidak ditemukan',
          code:    404
        })
      }

      const { valid, errors } = validateNewsInput(req.body)

      if (!valid) {
        // Hapus file upload baru yang belum terpakai agar tidak menjadi orphan
        if (req.file) {
          fs.unlink(req.file.path, () => {})
        }
        return res.render('admin/news/form', {
          title:  'Edit Berita',
          news,
          errors,
          isEdit: true,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl
        })
      }

      const baseSlug = generateSlug(req.body.title.trim())
      const slug     = await ensureUniqueSlug(baseSlug, parseInt(req.params.id, 10))

      // Tentukan image_path: gunakan gambar baru jika ada, pertahankan yang lama jika tidak
      let imagePath = news.image_path
      if (req.file) {
        // Hapus file gambar lama dari filesystem (fire-and-forget)
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
      res.redirect('/admin/news')
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /admin/news/:id/delete
   * Hapus berita beserta file gambarnya dari filesystem.
   *
   * Flow:
   *   1. Cari berita by ID untuk mendapatkan image_path (jika ada)
   *   2. Hapus file gambar dari filesystem jika ada (fire-and-forget)
   *   3. Hapus baris dari database via News.delete
   *   4. Redirect ke /admin/news dengan flash sukses
   *
   * Persyaratan: 5.6, 6.8, 8.5
   */
  postDelete: async (req, res, next) => {
    try {
      const news = await News.findById(req.params.id)

      // Hapus file gambar dari filesystem jika ada (fire-and-forget, tidak blocking)
      if (news && news.image_path && fs.existsSync(news.image_path)) {
        fs.unlink(news.image_path, () => {})
      }

      await News.delete(req.params.id)

      req.flash('success', 'Berita berhasil dihapus.')
      res.redirect('/admin/news')
    } catch (err) {
      next(err)
    }
  }
}

module.exports = adminNewsController

// Ekspor helper functions untuk unit testing dan penggunaan eksternal (Persyaratan 5.7–5.11)
module.exports.validateNewsInput = validateNewsInput
module.exports.generateSlug      = generateSlug
module.exports.ensureUniqueSlug  = ensureUniqueSlug
