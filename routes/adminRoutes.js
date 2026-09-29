// routes/adminRoutes.js
const express = require('express')
const router = express.Router()

const adminController        = require('../controllers/adminController')
const adminNewsController    = require('../controllers/adminNewsController')
const adminBenefitController = require('../controllers/adminBenefitController')
const adminTrainingController = require('../controllers/adminTrainingController')
const { isAuthenticated }    = require('../middleware/auth')
const upload                 = require('../middleware/upload')

// Login
router.get('/login', adminController.getLogin)
router.post('/login', adminController.postLogin)

// Logout (dilindungi)
router.get('/logout', isAuthenticated, adminController.logout)

// Landing / Dashboard utama (dilindungi)
router.get('', isAuthenticated, adminController.getLanding)
router.get('/landing', isAuthenticated, adminController.getLanding)

// Dashboard detail pendaftaran (dilindungi)
router.get('/dashboard', isAuthenticated, adminController.getDashboard)

// ─── Registrations Routes ─────────────────────────────────────────────────────
// CATATAN: /registrations/export harus didefinisikan SEBELUM /registrations/:id
// agar Express tidak menginterpretasikan literal "export" sebagai parameter :id.

router.get('/registrations/export', isAuthenticated, adminController.getExportRegistrations)
router.get('/registrations/:id', isAuthenticated, adminController.getRegistrationDetail)
router.post('/registrations/:id/certificate', isAuthenticated, adminController.postUpdateCertificateUrl)

// Approve pendaftaran (dilindungi)
router.post('/registrations/:id/approve', isAuthenticated, adminController.approveRegistration)

// Reject pendaftaran (dilindungi)
router.post('/registrations/:id/reject', isAuthenticated, adminController.rejectRegistration)

// Verifikasi pembayaran (dilindungi)
router.post('/registrations/:id/verify', isAuthenticated, adminController.verifyPayment)

// Tolak bukti pembayaran (dilindungi)
router.post('/registrations/:id/reject-payment', isAuthenticated, adminController.rejectPayment)

// ─── News Routes ─────────────────────────────────────────────────────────────
// Persyaratan: 5.13
// CATATAN: /news/create harus didefinisikan SEBELUM /news/:id/edit agar Express
// tidak menginterpretasikan literal "create" sebagai parameter :id.

router.get('/news',             isAuthenticated, adminNewsController.getList)
router.get('/news/create',      isAuthenticated, adminNewsController.getCreate)
router.post('/news',            isAuthenticated, upload.single('news_image'), adminNewsController.postCreate)
router.get('/news/:id/edit',    isAuthenticated, adminNewsController.getEdit)
router.post('/news/:id/update', isAuthenticated, adminNewsController.postUpdate)
router.post('/news/:id/delete', isAuthenticated, adminNewsController.postDelete)

// ─── Benefits Routes ──────────────────────────────────────────────────────────
// Persyaratan: 7.11
// CATATAN: /benefits/create harus didefinisikan SEBELUM /benefits/:id/edit.

router.get('/benefits',             isAuthenticated, adminBenefitController.getList)
router.get('/benefits/create',      isAuthenticated, adminBenefitController.getCreate)
router.post('/benefits',            isAuthenticated, adminBenefitController.postCreate)
router.get('/benefits/:id/edit',    isAuthenticated, adminBenefitController.getEdit)
router.post('/benefits/:id/update', isAuthenticated, adminBenefitController.postUpdate)
router.post('/benefits/:id/delete', isAuthenticated, adminBenefitController.postDelete)

// ─── Training Routes ──────────────────────────────────────────────────────────
// CRUD untuk manajemen pelatihan (termasuk link grup WA per pelatihan).
// Redirect dari singular 'training' ke plural 'trainings' untuk user-friendly URL.

router.get('/training',         isAuthenticated, (req, res) => res.redirect('/admin/trainings'))
router.get('/training/create',  isAuthenticated, (req, res) => res.redirect('/admin/trainings/create'))
router.post('/training',        isAuthenticated, upload.single('training_cover'), adminTrainingController.postCreate)
router.get('/training/:id/edit',isAuthenticated, (req, res) => res.redirect(`/admin/trainings/${req.params.id}/edit`))
router.post('/training/:id/update', isAuthenticated, upload.single('training_cover'), adminTrainingController.postUpdate)
router.post('/training/:id/delete', isAuthenticated, adminTrainingController.postDelete)
router.get('/training/import',  isAuthenticated, (req, res) => res.redirect('/admin/trainings'))
router.post('/training/import', isAuthenticated, upload.single('training_excel'), adminTrainingController.postBulkImport)

router.get('/trainings',          isAuthenticated, adminTrainingController.getList)
router.get('/trainings/create',   isAuthenticated, adminTrainingController.getCreate)
router.post('/trainings',         isAuthenticated, upload.single('training_cover'), adminTrainingController.postCreate)
router.get('/trainings/:id/edit', isAuthenticated, adminTrainingController.getEdit)
router.post('/trainings/:id/update', isAuthenticated, upload.single('training_cover'), adminTrainingController.postUpdate)
router.post('/trainings/:id/delete', isAuthenticated, adminTrainingController.postDelete)

// Bulk import pelatihan dari Excel
router.get('/trainings/import',   isAuthenticated, (req, res) => {
  res.redirect('/admin/trainings')
})
router.post('/trainings/import',  isAuthenticated, upload.single('training_excel'), adminTrainingController.postBulkImport)

module.exports = router
