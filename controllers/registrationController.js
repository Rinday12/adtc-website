// controllers/registrationController.js
const Training = require('../models/Training')
const Registration = require('../models/Registration')
const { generateWhatsAppUrl } = require('../utils/whatsapp')

function calculateFinalPrice(category, training) {
  const priceMap = {
    'umum':          training.price_general,
    'mahasiswa_uad': training.price_student_uad,
    'karyawan_uad':  training.price_employee_uad
  }
  return priceMap[category] ?? training.price_general
}

/**
 * Tanggal efektif pelatihan: reschedule_date (postpone) bila terisi,
 * selain itu start_date. Return null jika keduanya kosong.
 */
function effectiveDate(training) {
  const raw = training.reschedule_date || training.start_date
  if (!raw) return null
  // DATE MySQL bisa jadi string 'YYYY-MM-DD' — jadikan Date UTC yang aman
  const d = raw instanceof Date ? raw : new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function isTrainingClosed(training) {
  const d = effectiveDate(training)
  return !!d && d < new Date()
}

function validateRegistrationInput(body, files) {
  const errors = []
  const { full_name, email, phone, category } = body

  if (!full_name || full_name.trim().length < 3)
    errors.push('Nama lengkap minimal 3 karakter.')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('Format email tidak valid.')
  if (!phone || phone.replace(/\D/g, '').length < 10)
    errors.push('Nomor telepon minimal 10 digit.')
  if (!['umum', 'mahasiswa_uad', 'karyawan_uad'].includes(category))
    errors.push('Kategori peserta tidak valid.')

  if (category === 'mahasiswa_uad' || category === 'karyawan_uad') {
    if (!body.identity_number || body.identity_number.trim().length < 5)
      errors.push('NIM/NIY wajib diisi untuk kategori UAD.')
    if (!files?.identity_card_proof?.[0])
      errors.push('File KTM/ID Card wajib diupload untuk kategori UAD.')
  }

  return { valid: errors.length === 0, errors }
}

const registrationController = {

  getForm: async (req, res, next) => {
    let training
    try {
      training = await Training.findBySlug(req.params.slug)
    } catch (err) {
      console.error('[getForm] Query pelatihan gagal:', err.message)
      training = null
    }
    if (!training) {
      return res.status(404).render('error', { message: 'Pelatihan tidak ditemukan', code: 404 })
    }

    // Pelatihan sudah selesai (tanggal mulai/reschedule sudah lewat) — form
    // tidak lagi dibuka; arahkan ke halaman detail.
    if (isTrainingClosed(training)) {
      return res.redirect(`/trainings/${training.slug}`)
    }

    res.render('registration/form', {
      training,
      title: `Daftar - ${training.title}`,
      errors: [],
      formData: {}
    })
  },

  submitForm: async (req, res, next) => {
    try {
      let training
      try {
        training = await Training.findBySlug(req.params.slug)
      } catch (err) {
        console.error('[submitForm] Query pelatihan gagal:', err.message)
        training = null
      }
      if (!training) {
        return res.status(404).render('error', { message: 'Pelatihan tidak ditemukan', code: 404 })
      }

      // Validasi server-side: pelatihan sudah selesai (tanggal efektif lewat)
      // ditolak — tidak bisa mengandalkan form yang di-redirect saja.
      if (isTrainingClosed(training)) {
        return res.render('registration/form', {
          training,
          title: `Daftar - ${training.title}`,
          errors: ['Pelatihan ini sudah selesai. Pendaftaran ditutup.'],
          formData: req.body
        })
      }

      const { valid, errors } = validateRegistrationInput(req.body, req.files)
      if (!valid) {
        return res.render('registration/form', {
          training,
          title: `Daftar - ${training.title}`,
          errors,
          formData: req.body
        })
      }

      // Validate quota availability
      const registeredCount = training.registered_count || 0
      if (registeredCount >= training.quota) {
        return res.render('registration/form', {
          training,
          title: `Daftar - ${training.title}`,
          errors: ['Kuota pelatihan ini sudah penuh. Pilih pelatihan lain.'],
          formData: req.body
        })
      }

      const final_price = calculateFinalPrice(req.body.category, training) || 0
      const identity_card_proof = req.files?.identity_card_proof?.[0]?.path || null

      console.log('[Register] Pre-insert data:', {
        training_id: training.id,
        full_name: req.body.full_name.trim(),
        email: req.body.email.trim().toLowerCase(),
        phone: req.body.phone.trim(),
        category: req.body.category,
        final_price,
        identity_card_proof
      })

      // Validate training exists and has required fields
      if (!training || !training.id) {
        return res.status(404).render('error', { message: 'Pelatihan tidak ditemukan', code: 404 })
      }

      // Ensure final_price is a valid number
      const safeFinalPrice = typeof final_price === 'number' && !isNaN(final_price) ? final_price : 0

      console.log('[Register] Attempting to insert with data:', {
        training_id: training.id,
        full_name: req.body.full_name.trim(),
        email: req.body.email.trim().toLowerCase(),
        phone: req.body.phone.trim(),
        category: req.body.category,
        final_price: safeFinalPrice,
        identity_card_proof
      })

      const registrationId = await Registration.create({
        training_id:         training.id,
        full_name:           req.body.full_name.trim(),
        email:               req.body.email.trim().toLowerCase(),
        phone:               req.body.phone.trim(),
        category:            req.body.category,
        identity_number:     req.body.identity_number?.trim() || null,
        identity_card_proof,
        final_price: safeFinalPrice
      })

      console.log('[Register] Created registration with ID:', registrationId)
      res.redirect(`/registrations/${registrationId}/success`)
    } catch (err) {
      console.error('[Register] Critical error:', err)
      console.error('[Register] Error code:', err.code)
      console.error('[Register] Error message:', err.message)
      console.error('[Register] SQL state:', err.sqlState)
      console.error('[Register] Stack:', err.stack)

      // Return user-friendly error
      return res.status(500).render('error', {
        message: 'Terjadi kesalahan saat memproses pendaftaran. Silakan coba lagi.',
        code: 500
      })
    }
  },

  getSuccess: async (req, res, next) => {
    let registration
    try {
      registration = await Registration.findById(req.params.id)
    } catch (err) {
      console.error('[getSuccess] Query pendaftaran gagal:', err.message)
      registration = null
    }
    if (!registration) {
      return res.status(404).render('error', { message: 'Data pendaftaran tidak ditemukan', code: 404 })
    }

    try {
      const whatsappUrl = generateWhatsAppUrl(
        registration.full_name,
        registration.training_title,
        registration.final_price
      )

      const fmt = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      })

      res.render('registration/success', {
        registration,
        whatsappUrl,
        fmt,
        title: 'Pendaftaran Berhasil'
      })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = registrationController
module.exports.calculateFinalPrice = calculateFinalPrice
module.exports.validateRegistrationInput = validateRegistrationInput
