// routes/publicRoutes.js
const express = require('express')
const router = express.Router()

const publicController       = require('../controllers/publicController')
const registrationController = require('../controllers/registrationController')
const paymentController      = require('../controllers/paymentController')
const certificateController  = require('../controllers/certificateController')
const contentController      = require('../controllers/contentController')
const upload                 = require('../middleware/upload')

// Halaman Beranda
router.get('/', contentController.getHome)

// Halaman Berita
router.get('/berita', contentController.getNewsList)
router.get('/berita/:slug', contentController.getNewsDetail)

// Katalog pelatihan
router.get('/trainings', publicController.getCatalog)

// Detail pelatihan
router.get('/trainings/:slug', publicController.getTrainingDetail)

// Form pendaftaran
router.get('/trainings/:slug/register', registrationController.getForm)

// Submit pendaftaran (dengan upload file opsional)
router.post(
  '/trainings/:slug/register',
  upload.fields([{ name: 'identity_card_proof', maxCount: 1 }]),
  registrationController.submitForm
)

// Halaman sukses pendaftaran
router.get('/registrations/:id/success', registrationController.getSuccess)

// ─── Payment Upload Routes (public) ──────────────────────────────────────────
// User yang terdaftar dapat mengunggah bukti pembayaran setelah pendaftaran disetujui.

// Halaman upload bukti pembayaran
router.get('/registrations/:id/payment', paymentController.getPaymentForm)

// Submit bukti pembayaran (dengan upload file)
router.post(
  '/registrations/:id/payment',
  upload.single('payment_proof'),
  paymentController.submitPayment
)

// Halaman sukses setelah upload bukti pembayaran
router.get('/registrations/:id/payment-success', paymentController.getPaymentSuccess)

// ─── E-Sertifikat Routes ──────────────────────────────────────────────────────
// Halaman pencarian dan download e-sertifikat untuk peserta.

// Halaman utama download sertifikat
router.get('/sertifikat', certificateController.getPage)

// Search sertifikat by reference code
router.post('/sertifikat/search', certificateController.search)

// Download PDF sertifikat
router.get('/sertifikat/:id/download', certificateController.download)

module.exports = router
