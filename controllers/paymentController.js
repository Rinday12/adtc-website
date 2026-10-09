// controllers/paymentController.js
// Menangani halaman upload bukti pembayaran dan submit untuk peserta publik.

const Registration = require('../models/Registration')

const paymentController = {

  /**
   * GET /registrations/:id/payment
   * Tampilkan halaman upload bukti pembayaran untuk registration yang sudah approved.
   */
  getPaymentForm: async (req, res, next) => {
    try {
      const registration = await Registration.findByToken(req.params.token)
      if (!registration) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }
      if (registration.status !== 'approved') {
        return res.status(400).render('error', {
          message: `Status pendaftaran saat ini: ${registration.status}. Tidak dapat mengunggah bukti pembayaran.`,
          code: 400
        })
      }

      const fmt = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      })

      res.render('registration/payment', {
        registration,
        title: `Konfirmasi Pembayaran - ${registration.training_title}`,
        fmt,
        baseUrl: process.env.BASE_URL || 'http://localhost:3000'
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /registrations/:token/payment
   * Simpan bukti pembayaran dan ubah status jadi payment_uploaded.
   */
  submitPayment: async (req, res, next) => {
    try {
      const registration = await Registration.findByToken(req.params.token)
      if (!registration) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }
      if (registration.status !== 'approved') {
        return res.status(400).render('error', {
          message: 'Pendaftaran tidak dalam status approved.', code: 400
        })
      }

      const paymentProof = req.file?.path || null
      if (!paymentProof) {
        return res.status(400).render('error', {
          message: 'Bukti pembayaran wajib diunggah.', code: 400
        })
      }

      await Registration.updatePaymentProof(registration.id, paymentProof)
      await Registration.updateStatus(registration.id, 'payment_uploaded')

      res.redirect(`/registrations/${registration.access_token}/payment-success`)
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /registrations/:token/payment-success
   * Tampilkan halaman sukses setelah bukti pembayaran diunggah.
   */
  getPaymentSuccess: async (req, res, next) => {
    try {
      const registration = await Registration.findByToken(req.params.token)
      if (!registration) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }

      const fmt = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      })

      const groupLink = registration.whatsapp_group_link || null

      res.render('registration/payment-success', {
        registration,
        groupLink,
        title: 'Bukti Pembayaran Terkirim',
        fmt,
        baseUrl: process.env.BASE_URL || 'http://localhost:3000'
      })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = paymentController
