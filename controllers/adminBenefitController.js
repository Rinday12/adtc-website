// controllers/adminBenefitController.js
// Controller CRUD untuk manajemen Benefit/Keunggulan ADTC di dashboard admin.
// Semua route yang menggunakan controller ini dilindungi middleware isAuthenticated.
//
// Persyaratan: 7.1–7.11, 10.2–10.4

const Benefit = require('../models/Benefit')

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Validasi input form benefit.
 *
 * Memastikan `title` dan `description` tidak kosong setelah trim.
 *
 * @param {object} body - req.body dari form submission
 * @returns {{ valid: boolean, errors: string[] }}
 *
 * Persyaratan: 7.7, 7.8
 */
function validateBenefitInput(body) {
  const errors = []

  if (!body.title || body.title.trim().length === 0) {
    errors.push('Judul benefit wajib diisi.')
  }

  if (!body.description || body.description.trim().length === 0) {
    errors.push('Deskripsi benefit wajib diisi.')
  }

  return { valid: errors.length === 0, errors }
}

// ─── Controller ──────────────────────────────────────────────────────────────

const adminBenefitController = {

  /**
   * GET /admin/benefits
   * Tampilkan daftar semua benefit (aktif dan nonaktif) untuk admin.
   *
   * Persyaratan: 7.1, 7.2, 10.3
   */
  getList: async (req, res, next) => {
    try {
      const benefits = await Benefit.findAll()
      res.render('admin/benefits/list', {
        title: 'Manajemen Benefit',
        benefits,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /admin/benefits/create
   * Tampilkan form kosong untuk membuat benefit baru.
   *
   * Persyaratan: 7.3, 7.4
   */
  getCreate: (req, res) => {
    res.render('admin/benefits/form', {
      title:   'Tambah Benefit',
      benefit: null,
      errors:  [],
      isEdit:  false,
      adminUser: req.session.adminUsername || 'Admin',
      currentPath: req.originalUrl
    })
  },

  /**
   * POST /admin/benefits
   * Simpan benefit baru ke database.
   * Status default 'aktif' ditangani oleh model.
   *
   * Jika validasi gagal → render form kembali dengan pesan error.
   * Jika berhasil → flash success, redirect ke /admin/benefits.
   *
   * Persyaratan: 7.3, 7.7, 7.8
   */
  postCreate: async (req, res, next) => {
    try {
      const { valid, errors } = validateBenefitInput(req.body)

      if (!valid) {
        return res.render('admin/benefits/form', {
          title:   'Tambah Benefit',
          benefit: null,
          errors,
          isEdit:  false,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl
        })
      }

      await Benefit.create({
        title:       req.body.title.trim(),
        description: req.body.description.trim()
      })

      req.flash('success', 'Benefit berhasil ditambahkan.')
      res.redirect('/admin/benefits')
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /admin/benefits/:id/edit
   * Tampilkan form terisi untuk mengedit benefit yang ada.
   * HTTP 404 jika benefit dengan ID tersebut tidak ditemukan.
   *
   * Persyaratan: 7.4, 7.5, 7.10
   */
  getEdit: async (req, res, next) => {
    try {
      const benefit = await Benefit.findById(req.params.id)

      if (!benefit) {
        return res.status(404).render('error', {
          message: 'Benefit tidak ditemukan',
          code: 404
        })
      }

      res.render('admin/benefits/form', {
        title:  'Edit Benefit',
        benefit,
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
   * POST /admin/benefits/:id/update
   * Simpan perubahan pada benefit yang ada.
   *
   * - HTTP 404 jika benefit tidak ditemukan
   * - Validasi input; jika gagal render form kembali dengan errors
   * - Normalisasi status: hanya terima 'nonaktif', semua nilai lain → 'aktif'
   * - Flash success, redirect ke /admin/benefits
   *
   * Persyaratan: 7.5, 7.7, 7.8, 7.9
   */
  postUpdate: async (req, res, next) => {
    try {
      const benefit = await Benefit.findById(req.params.id)

      if (!benefit) {
        return res.status(404).render('error', {
          message: 'Benefit tidak ditemukan',
          code: 404
        })
      }

      const { valid, errors } = validateBenefitInput(req.body)

      if (!valid) {
        return res.render('admin/benefits/form', {
          title:  'Edit Benefit',
          benefit,
          errors,
          isEdit: true,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl
        })
      }

      // Normalisasi status: hanya terima nilai 'nonaktif' secara eksplisit;
      // semua nilai lain (termasuk input berbahaya/tidak terduga) jatuh ke 'aktif'.
      const status = req.body.status === 'nonaktif' ? 'nonaktif' : 'aktif'

      await Benefit.update(req.params.id, {
        title:       req.body.title.trim(),
        description: req.body.description.trim(),
        status
      })

      req.flash('success', 'Benefit berhasil diperbarui.')
      res.redirect('/admin/benefits')
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /admin/benefits/:id/delete
   * Hapus benefit dari database (hard delete).
   *
   * Flash success, redirect ke /admin/benefits.
   *
   * Persyaratan: 7.6, 8.6
   */
  postDelete: async (req, res, next) => {
    try {
      await Benefit.delete(req.params.id)
      req.flash('success', 'Benefit berhasil dihapus.')
      res.redirect('/admin/benefits')
    } catch (err) {
      next(err)
    }
  }

}

module.exports = adminBenefitController
module.exports.validateBenefitInput = validateBenefitInput
