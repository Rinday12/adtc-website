// controllers/certificateController.js
// Menangani halaman pencarian dan download e-sertifikat.

const Registration = require('../models/Registration')
const db = require('../config/db')

const certificateController = {

  /**
   * GET /sertifikat
   * Tampilkan halaman form pencarian sertifikat.
   */
  getPage: (req, res) => {
    res.render('certificate/index', {
      title: 'Pusat Download Sertifikat',
      error: null,
      kodeRef: '',
      registration: null
    })
  },

  /**
   * POST /sertifikat/search
   * Cari pendaftaran berdasarkan kode referensi.
   */
  search: async (req, res, next) => {
    try {
      const kodeRef = req.body.kode_referensi?.trim().toUpperCase()

      if (!kodeRef) {
        return res.render('certificate/index', {
          title: 'Pusat Download Sertifikat',
          error: 'Masukkan kode referensi terlebih dahulu.',
          kodeRef: '',
          registration: null
        })
      }

      // Cari berdasarkan reference_code
      const [rows] = await db.execute(
        `SELECT r.*, t.title AS training_title, t.start_date
         FROM registrations r
         JOIN trainings t ON r.training_id = t.id
         WHERE r.reference_code = ?`,
        [kodeRef]
      )

      if (!rows || rows.length === 0) {
        return res.render('certificate/index', {
          title: 'Pusat Download Sertifikat',
          error: 'Kode referensi tidak ditemukan. Periksa kembali.',
          kodeRef,
          registration: null
        })
      }

      const reg = rows[0]

      // Hanya status verified yang bisa download
      if (reg.status !== 'verified') {
        return res.render('certificate/index', {
          title: 'Pusat Download Sertifikat',
          error: `Sertifikat belum tersedia. Status pendaftaran: ${reg.status}`,
          kodeRef,
          registration: reg
        })
      }

      res.render('certificate/index', {
        title: 'Pusat Download Sertifikat',
        error: null,
        kodeRef,
        registration: reg
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /sertifikat/:id/download
   * Redirect ke Google Drive untuk download sertifikat.
   */
  download: async (req, res, next) => {
    try {
      const registration = await Registration.findById(req.params.id)

      if (!registration) {
        return res.status(404).render('error', {
          message: 'Data tidak ditemukan',
          code: 404
        })
      }

      if (registration.status !== 'verified') {
        return res.status(403).render('error', {
          message: 'Sertifikat belum tersedia untuk pendaftaran ini.',
          code: 403
        })
      }

      if (!registration.certificate_url) {
        return res.status(404).render('error', {
          message: 'Link sertifikat belum tersedia. Hubungi admin.',
          code: 404
        })
      }

      res.redirect(registration.certificate_url)
    } catch (err) {
      next(err)
    }
  }
}

module.exports = certificateController
