// controllers/adminController.js
const bcrypt = require('bcrypt')
const https = require('https')
const fs = require('fs')
const path = require('path')
const xlsx = require('xlsx')
const Admin = require('../models/Admin')
const Registration = require('../models/Registration')
const Training = require('../models/Training')
const { sendStatusNotification } = require('../utils/email')

const validStatuses = ['pending', 'approved', 'payment_uploaded', 'verified', 'rejected']

function notifyAdminWhatsApp(name, trainingTitle, phone) {
  try {
    const numbers = [process.env.WHATSAPP_ADMIN_1_NUMBER, process.env.WHATSAPP_ADMIN_2_NUMBER]
      .filter(n => n && n.trim())
    if (!numbers.length) return
    const cleanNumber = numbers[0].replace(/\D/g, '')
    if (!cleanNumber) return

    const message =
      `Halo Admin ADTC,\n\n` +
      `Pendaftaran baru telah disetujui:\n` +
      `Nama   : ${name}\n` +
      `Program: ${trainingTitle}\n` +
      `Telepon: ${phone}\n\n` +
      `Silakan lanjut ke tahap pembayaran.`

    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`
    https.get(url, () => {}).on('error', () => {})
  } catch (_) {}
}

function notifyVerifiedWhatsApp(groupLink) {
  try {
    if (!groupLink) return
    https.get(groupLink, () => {}).on('error', () => {})
  } catch (_) {}
}

const adminController = {

  getLogin: (req, res) => {
    if (req.session.adminId) return res.redirect('/admin/landing')
    res.render('admin/login', { title: 'Login Admin ADTC' })
  },

  getLanding: async (req, res, next) => {
    try {
      const [regStats, totalTrainings] = await Promise.all([
        Registration.countByStatus(),
        Training.count()
      ])
      res.render('admin/landing', {
        title: 'Dashboard Admin',
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: '/admin/landing',
        stats: { ...regStats, total_trainings: totalTrainings }
      })
    } catch (err) {
      next(err)
    }
  },

  postLogin: async (req, res, next) => {
    try {
      const { username, password } = req.body

      if (!username || !password) {
        req.flash('error', 'Username dan password wajib diisi.')
        return res.redirect('/admin/login')
      }

      const admin = await Admin.findByUsername(username)
      if (!admin) {
        req.flash('error', 'Username atau password salah.')
        return res.redirect('/admin/login')
      }

      const isMatch = await bcrypt.compare(password, admin.password_hash)
      if (!isMatch) {
        req.flash('error', 'Username atau password salah.')
        return res.redirect('/admin/login')
      }

      req.session.adminId = admin.id
      req.session.adminUsername = admin.username
      res.redirect('/admin/landing')
    } catch (err) {
      next(err)
    }
  },

  logout: (req, res) => {
    req.session.destroy(() => {
      res.redirect('/admin/login')
    })
  },

  getDashboard: async (req, res, next) => {
    try {
      const { status, search, training_search } = req.query
      const filters = {
        status: validStatuses.includes(status) ? status : undefined,
        search: search || '',
        training_search: training_search || ''
      }

      const registrations = await Registration.findAll(filters)
      const fmt = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      })
      res.render('admin/dashboard', {
        registrations,
        title: 'Dashboard Admin',
        activeFilter: status || 'all',
        filters: {
          search: filters.search,
          training_search: filters.training_search
        },
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl,
        fmt
      })
    } catch (err) {
      next(err)
    }
  },

  getRegistrationDetail: async (req, res, next) => {
    try {
      const registration = await Registration.findById(req.params.id)
      if (!registration) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }
      res.render('admin/registration-detail', {
        registration,
        title: `Detail Pendaftaran #${registration.id}`,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  postUpdateCertificateUrl: async (req, res, next) => {
    try {
      const registration = await Registration.findById(req.params.id)
      if (!registration) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }

      const { certificate_url } = req.body
      if (!certificate_url || !certificate_url.trim()) {
        req.flash('error', 'Link Google Drive sertifikat wajib diisi.')
        return res.redirect(`/admin/registrations/${registration.id}`)
      }

      const affected = await Registration.updateCertificateUrl(registration.id, certificate_url.trim())
      if (affected === 0) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }

      req.flash('success', 'Link sertifikat berhasil diperbarui.')
      res.redirect(`/admin/registrations/${registration.id}`)
    } catch (err) {
      next(err)
    }
  },

  approveRegistration: async (req, res, next) => {
    try {
      const registration = await Registration.findById(req.params.id)
      if (!registration) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }
      if (registration.status !== 'pending') {
        req.flash('error', 'Pendaftaran ini tidak dalam status pending.')
        return res.redirect('/admin/dashboard')
      }

      // Validasi: admin harus sudah melihat KTM/ID card jika ada
      const { verify_ktm } = req.body
      if (registration.identity_card_proof && !verify_ktm) {
        req.flash('error', 'Anda wajib mencentang kotak konfirmasi bahwa telah memeriksa KTM/ID Card peserta.')
        return res.redirect(`/admin/registrations/${registration.id}`)
      }

      const affected = await Registration.updateStatus(req.params.id, 'approved')
      if (affected === 0) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }

      sendStatusNotification(registration, 'approved')
        .then(() => console.log('[EMAIL] Notifikasi approval dikirim ke:', registration.email))
        .catch(err => console.error('[EMAIL] Gagal mengirim notifikasi approval:', err.message))

      notifyAdminWhatsApp(
        registration.full_name,
        registration.training_title,
        registration.phone
      )

      req.flash('success', 'Pendaftaran berhasil disetujui.')
      res.redirect('/admin/dashboard')
    } catch (err) {
      next(err)
    }
  },

  rejectRegistration: async (req, res, next) => {
    try {
      const registration = await Registration.findById(req.params.id)
      if (!registration) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }
      if (registration.status !== 'pending') {
        req.flash('error', 'Pendaftaran ini tidak dalam status pending.')
        return res.redirect('/admin/dashboard')
      }

      const rejectionReason = (req.body.rejection_reason || '').trim()
      const affected = await Registration.updateStatusWithReason(
        req.params.id, 'rejected', rejectionReason
      )
      if (affected === 0) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }

      sendStatusNotification(registration, 'rejected').catch(() => {})

      req.flash('error', 'Pendaftaran telah ditolak.')
      res.redirect('/admin/dashboard')
    } catch (err) {
      next(err)
    }
  },

  rejectPayment: async (req, res, next) => {
    try {
      const registration = await Registration.findById(req.params.id)
      if (!registration) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }
      if (registration.status !== 'payment_uploaded') {
        req.flash('error', 'Pendaftaran ini belum memiliki bukti pembayaran.')
        return res.redirect('/admin/dashboard')
      }

      const rejectionReason = (req.body.rejection_reason || '').trim()
      const affected = await Registration.updateStatusWithReason(
        req.params.id, 'rejected', rejectionReason
      )
      if (affected === 0) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }

      sendStatusNotification(registration, 'rejected').catch(() => {})

      req.flash('error', 'Bukti pembayaran ditolak.')
      res.redirect('/admin/dashboard')
    } catch (err) {
      next(err)
    }
  },

  verifyPayment: async (req, res, next) => {
    try {
      const registration = await Registration.findById(req.params.id)
      if (!registration) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }
      if (registration.status !== 'payment_uploaded') {
        req.flash('error', 'Pendaftaran ini belum memiliki bukti pembayaran.')
        return res.redirect('/admin/dashboard')
      }

      const groupLink = process.env.WHATSAPP_GROUP_LINK || ''
      const affected = await Registration.updateStatus(req.params.id, 'verified')
      if (affected === 0) {
        return res.status(404).render('error', {
          message: 'Pendaftaran tidak ditemukan', code: 404
        })
      }

      sendStatusNotification(registration, 'verified').catch(() => {})

      if (groupLink) {
        notifyVerifiedWhatsApp(groupLink)
      }

      req.flash('success', 'Pembayaran berhasil diverifikasi.')
      res.redirect('/admin/dashboard')
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /admin/registrations/export
   * Download peserta yang telah diverifikasi ke file Excel, dipisah per kategori pelatihan.
   */
  getExportRegistrations: async (req, res, next) => {
    try {
      const registrations = await Registration.findAll({ status: 'verified' })

      if (!registrations || registrations.length === 0) {
        return res.status(404).send('Belum ada peserta terverifikasi.')
      }

      // Enrich dengan training_title (perlu query manual karena findAll tidak JOIN)
      const db = require('../config/db')
      const [rows] = await db.execute(
        `SELECT r.id, r.full_name, r.email, r.phone, r.category, r.reference_code,
                r.certificate_url, r.created_at,
                t.title AS training_title
         FROM registrations r
         JOIN trainings t ON r.training_id = t.id
         WHERE r.status = 'verified'
         ORDER BY t.title, r.full_name`
      )

      if (!rows || rows.length === 0) {
        return res.status(404).send('Belum ada peserta terverifikasi.')
      }

      // Group by training_title
      const grouped = {}
      rows.forEach(row => {
        const key = row.training_title || 'Tanpa Pelatihan'
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(row)
      })

      // Create workbook
      const wb = xlsx.utils.book_new()

      // Summary sheet
      const summaryData = [['Kategori Pelatihan', 'Jumlah Peserta']]
      Object.entries(grouped).forEach(([title, members]) => {
        summaryData.push([title, members.length])
      })
      summaryData.push(['TOTAL', rows.length])
      const wsSummary = xlsx.utils.aoa_to_sheet(summaryData)
      wsSummary['!cols'] = [{ wch: 40 }, { wch: 15 }]
      xlsx.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

      // One sheet per training category
      Object.entries(grouped).forEach(([title, members]) => {
        const cleanTitle = title.replace(/[^a-zA-Z0-9áàâãéèêíìîóòôõúùûçñÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/g, '_').substring(0, 31)
        const sheetData = [['No', 'Nama Lengkap', 'Email', 'Telepon', 'Kategori', 'Kode Referensi', 'Tanggal Daftar']]
        members.forEach((m, i) => {
          const dateStr = m.created_at
            ? new Date(m.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '-'
          sheetData.push([
            i + 1,
            m.full_name,
            m.email,
            m.phone,
            m.category === 'umum' ? 'Umum' : m.category === 'mahasiswa_uad' ? 'Mahasiswa UAD' : 'Karyawan UAD',
            m.reference_code,
            dateStr
          ])
        })
        const ws = xlsx.utils.aoa_to_sheet(sheetData)
        ws['!cols'] = [
          { wch: 5 },
          { wch: 30 },
          { wch: 35 },
          { wch: 15 },
          { wch: 15 },
          { wch: 18 },
          { wch: 12 }
        ]
        xlsx.utils.book_append_sheet(wb, ws, cleanTitle)
      })

      const filename = `peserta_verified_${new Date().toISOString().slice(0, 10)}.xlsx`
      const filePath = path.join(__dirname, '..', 'exports', filename)

      // Ensure exports directory exists
      const exportsDir = path.join(__dirname, '..', 'exports')
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true })
      }

      xlsx.writeFile(wb, filePath)

      res.download(filePath, filename, (err) => {
        // Clean up after download
        if (err) console.error('[Export Error]', err.message)
        fs.unlinkSync(filePath)
      })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = adminController
