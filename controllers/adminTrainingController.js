// controllers/adminTrainingController.js
// Controller CRUD untuk manajemen Pelatihan di dashboard admin.

const Training = require('../models/Training')
const XLSX = require('xlsx')
const path = require('path')

function validateTrainingInput(body) {
  const errors = []

  if (!body.title || body.title.trim().length === 0)
    errors.push('Judul pelatihan wajib diisi.')
  if (!body.category || body.category.trim().length === 0)
    errors.push('Kategori wajib diisi.')
  if (!body.price_general || isNaN(parseFloat(body.price_general)) || parseFloat(body.price_general) < 0)
    errors.push('Harga umum wajib angka positif.')
  if (!body.price_student_uad || isNaN(parseFloat(body.price_student_uad)) || parseFloat(body.price_student_uad) < 0)
    errors.push('Harga mahasiswa UAD wajib angka positif.')
  if (!body.price_employee_uad || isNaN(parseFloat(body.price_employee_uad)) || parseFloat(body.price_employee_uad) < 0)
    errors.push('Harga karyawan UAD wajib angka positif.')
  if (!body.quota || isNaN(parseInt(body.quota, 10)) || parseInt(body.quota, 10) < 1)
    errors.push('Kuota wajib angka bulat >= 1.')

  return { valid: errors.length === 0, errors }
}

const adminTrainingController = {

  getList: async (req, res, next) => {
    try {
      const filters = {
        search: req.query.search || '',
        status: req.query.status || 'all',
        category: req.query.category || 'all',
        start_date_from: req.query.start_date_from || '',
        start_date_to: req.query.start_date_to || '',
        time_filter: req.query.time_filter || 'all',
        quota_filter: req.query.quota_filter || 'all'
      }

      const trainings = await Training.findAll(filters)
      const categories = await Training.findCategories()
      const allCategories = ['all', ...categories.map(c => c.category)]

      res.render('admin/trainings/list', {
        title: 'Manajemen Pelatihan',
        trainings,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl,
        coverImageBaseUrl: (process.env.BASE_URL || 'http://localhost:3000') + '/uploads/training_covers',
        filters,
        allCategories
      })
    } catch (err) {
      next(err)
    }
  },

  getCreate: (req, res) => {
    res.render('admin/trainings/form', {
      title:   'Tambah Pelatihan',
      training: null,
      errors:  [],
      isEdit:  false,
      adminUser: req.session.adminUsername || 'Admin',
      currentPath: req.originalUrl
    })
  },

  postCreate: async (req, res, next) => {
    try {
      const { valid, errors } = validateTrainingInput(req.body)
      if (!valid) {
        return res.render('admin/trainings/form', {
          title:   'Tambah Pelatihan',
          training: null,
          errors,
          isEdit:  false,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl
        })
      }

      const slug = require('slugify')(req.body.title.trim(), { lower: true, strict: true })
      const baseSlug = slug
      let finalSlug = baseSlug
      let counter = 1
      while (true) {
        const [existing] = await require('../config/db').execute(
          'SELECT id FROM trainings WHERE slug = ? LIMIT 1', [finalSlug]
        )
        if (existing.length === 0) break
        finalSlug = `${baseSlug}-${counter}`
        counter++
      }

      const coverImage = req.file?.path || null

      await Training.create({
        title:              req.body.title.trim(),
        slug:               finalSlug,
        description:        req.body.description || null,
        category:           req.body.category.trim(),
        category_order:     parseInt(req.body.category_order, 10) || 99,
        price_general:      parseFloat(req.body.price_general),
        price_student_uad:  parseFloat(req.body.price_student_uad),
        price_employee_uad: parseFloat(req.body.price_employee_uad),
        quota:              parseInt(req.body.quota, 10),
        start_date:         req.body.start_date || null,
        whatsapp_group_link: req.body.whatsapp_group_link?.trim() || null,
        cover_image:        coverImage
      })

      req.flash('success', 'Pelatihan berhasil ditambahkan.')
      res.redirect('/admin/trainings')
    } catch (err) {
      next(err)
    }
  },

  getEdit: async (req, res, next) => {
    try {
      const training = await Training.findById(req.params.id)
      if (!training) {
        return res.status(404).render('error', { message: 'Pelatihan tidak ditemukan', code: 404 })
      }
      res.render('admin/trainings/form', {
        title:    'Edit Pelatihan',
        training,
        errors:   [],
        isEdit:   true,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  postUpdate: async (req, res, next) => {
    try {
      const training = await Training.findById(req.params.id)
      if (!training) {
        return res.status(404).render('error', { message: 'Pelatihan tidak ditemukan', code: 404 })
      }

      const { valid, errors } = validateTrainingInput(req.body)
      if (!valid) {
        return res.render('admin/trainings/form', {
          title:    'Edit Pelatihan',
          training,
          errors,
          isEdit:   true,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl
        })
      }

      const status = req.body.status === 'inactive' ? 'inactive' : (req.body.status === 'full' ? 'full' : 'active')
      const coverImage = req.file?.path || training.cover_image

      await Training.update(training.id, {
        title:              req.body.title.trim(),
        slug:               training.slug,
        description:        req.body.description || null,
        category:           req.body.category.trim(),
        category_order:     parseInt(req.body.category_order, 10) || 99,
        price_general:      parseFloat(req.body.price_general),
        price_student_uad:  parseFloat(req.body.price_student_uad),
        price_employee_uad: parseFloat(req.body.price_employee_uad),
        quota:              parseInt(req.body.quota, 10),
        start_date:         req.body.start_date || null,
        status,
        whatsapp_group_link: req.body.whatsapp_group_link?.trim() || null,
        cover_image:        coverImage
      })

      req.flash('success', 'Pelatihan berhasil diperbarui.')
      res.redirect('/admin/trainings')
    } catch (err) {
      next(err)
    }
  },

  postBulkImport: async (req, res, next) => {
    try {
      if (!req.file) {
        req.flash('error', 'File Excel wajib diunggah.')
        return res.redirect('/admin/trainings')
      }

      const workbook = XLSX.readFile(req.file.path)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rawData = XLSX.utils.sheet_to_json(worksheet)

      if (rawData.length === 0) {
        req.flash('error', 'File Excel kosong. Pastikan ada baris data.')
        return res.redirect('/admin/trainings')
      }

      const rows = rawData.map(row => ({
        title:              row['title'] ?? row['judul'] ?? '',
        category:           row['category'] ?? row['kategori'] ?? '',
        description:        row['description'] ?? row['deskripsi'] ?? '',
        price_general:      row['price_general'] ?? row['harga_umum'] ?? 0,
        price_student_uad:  row['price_student_uad'] ?? row['harga_mahasiswa'] ?? 0,
        price_employee_uad: row['price_employee_uad'] ?? row['harga_karyawan'] ?? 0,
        quota:              row['quota'] ?? 30,
        start_date:         row['start_date'] ?? row['tanggal_mulai'] ?? '',
        category_order:     row['category_order'] ?? row['urutan'] ?? 99,
        whatsapp_group_link:row['whatsapp_group_link'] ?? ''
      }))

      const result = await Training.bulkCreate(rows)

      if (result.errors.length > 0) {
        const errorDetails = result.errors.slice(0, 5).map(e => `Baris ${e.row}: ${e.errors.join('; ')}`).join('<br>')
        if (result.created > 0) {
          req.flash('success', `Berhasil import ${result.created} pelatihan. ${result.errors.length} baris dilewati.`)
        } else {
          req.flash('error', `Gagal import. ${result.errors.length} baris bermasalah:<br>${errorDetails}`)
        }
      } else {
        req.flash('success', `Berhasil import ${result.created} pelatihan.`)
      }

      res.redirect('/admin/trainings')
    } catch (err) {
      next(err)
    }
  },

  postDelete: async (req, res, next) => {
    try {
      const { db } = require('../config/db')
      await db.execute('DELETE FROM registrations WHERE training_id = ?', [req.params.id])
      await db.execute('DELETE FROM trainings WHERE id = ?', [req.params.id])
      req.flash('success', 'Pelatihan berhasil dihapus.')
      res.redirect('/admin/trainings')
    } catch (err) {
      next(err)
    }
  }
}

module.exports = adminTrainingController
