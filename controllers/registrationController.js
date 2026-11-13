// controllers/registrationController.js
const Training = require('../models/Training')
const Registration = require('../models/Registration')
const { generateWhatsAppUrl } = require('../utils/whatsapp')

function calculateFinalPrice(category, training) {
  if (!training) return 0
  const priceMap = {
    'umum':          training.price_general,
    'mahasiswa_uad': training.price_student_uad,
    'karyawan_uad':  training.price_employee_uad
  }
  // DECIMAL(10,2) dari mysql2 = string → konversi ke Number agar aman
  const raw = priceMap[category] ?? training.price_general
  const num = Number(raw)
  return isNaN(num) ? 0 : num
}

/**
 * Kembalikan true bila kategori gratis — semua kategori gratis menampilkan
 * opsi "gratis / dengan sertifikat" sehingga peserta bisa memilih Rp 0
 * atau CERT_FEE. Dipakai di getForm & submitForm.
 */
function freeTierWithCertOption(training) {
  if (!training || !training.is_free_tier) return false
  return true
}

/**
 * Hitung total tagihan peserta berdasarkan kategori + pilihan pembayaran.
 *
 * - Kategori BERPAYAR → harga dari kategori (lihat calculateFinalPrice).
 * - Kategori GRATIS: peserta memilih "gratis" (=0) atau "paket lengkap" (= CERT_FEE)
 *
 * Nilai CERT_FEE dibaca dari env, bukan dari form, sehingga angka tidak
 * bisa dimanipulasi client. Flag cert_available juga dari DB — form hanya
 * memilih antara apa yang DIIZINKAN server.
 *
 * Di-export agar bisa diuji oleh property test.
 */
function resolveFinalPrice(training, body, certFee) {
  if (training && training.is_free_tier) {
    if (body && body.payment_option === 'sertifikat') {
      const fee = Number(certFee)
      // Nilai tak valid (NaN/kosong) atau negatif → anggap 0, jangan tagih negatif
      return isNaN(fee) || fee < 0 ? 0 : fee
    }
    return 0
  }
  return calculateFinalPrice(body?.category, training)
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

/**
 * Kategori peserta yang diizinkan per kategori training:
 *   - Gratis / Gratis + berbayar (is_free_tier)      → umum + mahasiswa_uad
 *   - "Pelatihan Sertifikasi" (berbayar)               → umum + mahasiswa_uad + karyawan_uad
 *   - In-house training                                  → umum saja
 *   - Kategori lain (mis. "Konsultan")                  → umum saja
 * Dipakai untuk membatasi opsi select form & memvalidasi input server-side.
 */
function allowedCategories(training) {
  if (!training) return ['umum', 'mahasiswa_uad', 'karyawan_uad']
  if (training.is_free_tier) return ['umum', 'mahasiswa_uad']
  if (training.category === 'Sertifikasi' || training.category === 'Pelatihan Sertifikasi' || training.category === 'Pelatihan')
    return ['umum', 'mahasiswa_uad', 'karyawan_uad']
  return ['umum']
}

/**
 * Kategori UAD (mahasiswa/karyawan) yang mewajibkan NIM/NIY + upload KTM/ID
 * Card, terlepas dari kategori training.
 */
function isUadCategory(category) {
  return category === 'mahasiswa_uad' || category === 'karyawan_uad'
}

function validateRegistrationInput(body, files, training) {
  const errors = []
  const { full_name, email, phone, category } = body

  if (!full_name || full_name.trim().length < 3)
    errors.push('Nama lengkap minimal 3 karakter.')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('Format email tidak valid.')
  if (!phone || phone.replace(/\D/g, '').length < 10)
    errors.push('Nomor telepon minimal 10 digit.')

  const allowed = allowedCategories(training)
  if (!allowed.includes(category))
    errors.push('Kategori peserta tidak valid untuk kategori pelatihan ini.')

  if (isUadCategory(category)) {
    if (!body.identity_number || body.identity_number.trim().length < 5)
      errors.push('NIM/NIY wajib diisi untuk kategori UAD.')
    if (!files?.identity_card_proof?.[0])
      errors.push('File KTM/ID Card wajib diupload untuk kategori UAD.')
  }

  // Field baru — wajib untuk semua kategori
  if (!body.institution || !body.institution.trim())
    errors.push('Asal instansi wajib diisi.')

  // Persyaratan kategori gratis — wajib khusus is_free_tier,
  // KECUALI peserta memilih "Dengan Sertifikat" (berbayar) — promo
  // tidak relevan lagi karena peserta membayar, bukan dapat slot gratis.
  // Sertakan social_proof di syarat promo ini karena form menampilkannya
  // di section Persyaratan (bukan di blok terpisah) untuk kategori gratis.
  if (training?.is_free_tier && body.payment_option !== 'sertifikat') {
    if (!files?.social_proof?.[0])
      errors.push('Bukti follow adtc_uad wajib diupload (kategori gratis).')
    if (!files?.ig_story_proof?.[0])
      errors.push('Bukti post flyer di IG story wajib diupload (kategori gratis).')
    if (!files?.wa_share_proof?.[0])
      errors.push('Bukti share ke 3 grup WhatsApp wajib diupload (kategori gratis).')
    if (!files?.ig_comment_proof?.[0])
      errors.push('Bukti komentar di postingan IG adtc_uad wajib diupload (kategori gratis).')
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
      allowedCategories: allowedCategories(training),
      title: `Daftar - ${training.title}`,
      errors: [],
      formData: {},
      certFee: Number(process.env.CERT_FEE || 0),
      fmt: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
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

      // Konteks form untuk render ulang saat error (tier gratis → pilih bayar)
      const formCtx = {
        allowedCategories: allowedCategories(training),
        certFee: Number(process.env.CERT_FEE || 0),
        fmt: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
      }

      // Validasi server-side: pelatihan sudah selesai (tanggal efektif lewat)
      // ditolak — tidak bisa mengandalkan form yang di-redirect saja.
      if (isTrainingClosed(training)) {
        return res.render('registration/form', {
          training,
          title: `Daftar - ${training.title}`,
          errors: ['Pelatihan ini sudah selesai. Pendaftaran ditutup.'],
          formData: req.body,
          ...formCtx
        })
      }

      const { valid, errors } = validateRegistrationInput(req.body, req.files, training)
      if (!valid) {
        return res.render('registration/form', {
          training,
          title: `Daftar - ${training.title}`,
          errors,
          formData: req.body,
          ...formCtx
        })
      }

      // Validate quota availability
      const registeredCount = training.registered_count || 0
      if (registeredCount >= training.quota) {
        return res.render('registration/form', {
          training,
          title: `Daftar - ${training.title}`,
          errors: ['Kuota pelatihan ini sudah penuh. Pilih pelatihan lain.'],
          formData: req.body,
          ...formCtx
        })
      }

      // Total tagihan: dari harga kategori (berbayar), atau pilihan
      // "gratis / dengan sertifikat" (tier gratis). CERT_FEE dari env,
      // bukan dari form, agar nominal tidak bisa dimanipulasi client.
      const certFee = Number(process.env.CERT_FEE || 0)
      const final_price = resolveFinalPrice(training, req.body, certFee)
      const identity_card_proof = req.files?.identity_card_proof?.[0]?.path || null
      const social_proof = req.files?.social_proof?.[0]?.path || null
      const ig_story_proof = req.files?.ig_story_proof?.[0]?.path || null
      const wa_share_proof = req.files?.wa_share_proof?.[0]?.path || null
      const ig_comment_proof = req.files?.ig_comment_proof?.[0]?.path || null
      const institution = req.body.institution?.trim() || null
      // Simpan pilihan pembayaran hanya untuk tier gratis yang memakai paket
      // (sertifikat / gratis murni); kategori berbayar mengabaikan field ini.
      const payment_option = freeTierWithCertOption(training) ? (req.body.payment_option || 'gratis') : null

      console.log('[Register] Pre-insert data:', {
        training_id: training.id,
        full_name: req.body.full_name.trim(),
        email: req.body.email.trim().toLowerCase(),
        phone: req.body.phone.trim(),
        category: req.body.category,
        institution,
        payment_option,
        final_price,
        identity_card_proof,
        social_proof,
        ig_story_proof,
        wa_share_proof,
        ig_comment_proof
      })

      // Validate training exists and has required fields
      if (!training || !training.id) {
        return res.status(404).render('error', { message: 'Pelatihan tidak ditemukan', code: 404 })
      }

      // final_price sudah berupa number dari calculateFinalPrice;
      // guard terakhir untuk edge case (harusnya tidak terjadi).
      const safeFinalPrice = (typeof final_price === 'number' && !isNaN(final_price)) ? final_price : 0

      const { accessToken } = await Registration.create({
        training_id:         training.id,
        full_name:           req.body.full_name.trim(),
        email:               req.body.email.trim().toLowerCase(),
        phone:               req.body.phone.trim(),
        category:            req.body.category,
        institution,
        payment_option,
        identity_number:     req.body.identity_number?.trim() || null,
        identity_card_proof,
        social_proof,
        ig_story_proof,
        wa_share_proof,
        ig_comment_proof,
        final_price: safeFinalPrice
      })

      console.log('[Register] Created registration with token:', accessToken)
      // Peserta gratis (final_price = 0) langsung auto-verified — kirim
      // email konfirmasi agar peserta tahu sudah terdaftar tanpa perlu
      // menunggu admin.
      if (safeFinalPrice === 0) {
        const { sendStatusNotification } = require('../utils/email')
        const created = {
          email: req.body.email.trim().toLowerCase(),
          full_name: req.body.full_name.trim(),
          training_title: training.title,
          final_price: 0,
          access_token: accessToken,
          status: 'verified'
        }
        sendStatusNotification(created, 'verified')
          .then(() => console.log('[EMAIL] Notifikasi auto-verify gratis dikirim ke:', created.email))
          .catch(err => console.error('[EMAIL] Gagal mengirim notifikasi auto-verify:', err.message))
      }
      res.redirect(`/registrations/${accessToken}/success`)
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
      registration = await Registration.findByToken(req.params.token)
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
        certFee: Number(process.env.CERT_FEE || 0),
        title: 'Pendaftaran Berhasil'
      })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = registrationController
module.exports.calculateFinalPrice = calculateFinalPrice
module.exports.resolveFinalPrice = resolveFinalPrice
module.exports.allowedCategories = allowedCategories
module.exports.isUadCategory = isUadCategory
module.exports.freeTierWithCertOption = freeTierWithCertOption
module.exports.validateRegistrationInput = validateRegistrationInput
