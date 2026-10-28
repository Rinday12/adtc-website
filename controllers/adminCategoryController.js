// controllers/adminCategoryController.js
// Controller CRUD untuk manajemen Kategori di dashboard admin.
// Pola mengikuti adminBenefitController.js.

const Category = require('../models/Category')
const Training = require('../models/Training')

function validateCategoryInput(body) {
  const errors = []
  if (!body.name || body.name.trim().length === 0)
    errors.push('Nama kategori wajib diisi.')
  if (body.name && body.name.trim().length > 100)
    errors.push('Nama kategori maksimal 100 karakter.')
  return { valid: errors.length === 0, errors }
}

// Nominal biaya sertifikat dari env, diformat IDR — dipakai form untuk
// menampilkan varian "gratis + paket komplit (Rp X)".
function feeCtx() {
  const certFee = Number(process.env.CERT_FEE || 0)
  return {
    certFee,
    certFeeFmt: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(certFee)
  }
}

const adminCategoryController = {

  getList: async (req, res, next) => {
    try {
      const categories = await Category.findAll()
      // Hitung berapa training yang memakai tiap kategori (nama persis)
      const allTrainings = await Training.findAll({})
      const usageCount = {}
      allTrainings.forEach(t => {
        const key = t.category
        usageCount[key] = (usageCount[key] || 0) + 1
      })
      res.render('admin/categories/list', {
        title: 'Manajemen Kategori',
        categories,
        usageCount,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  getCreate: async (req, res, next) => {
    try {
      res.render('admin/categories/form', {
        title:   'Tambah Kategori',
        category: null,
        errors:  [],
        isEdit:  false,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl,
        ...feeCtx()
      })
    } catch (err) {
      next(err)
    }
  },

  postCreate: async (req, res, next) => {
    try {
      const { valid, errors } = validateCategoryInput(req.body)
      if (!valid) {
        return res.render('admin/categories/form', {
          title:   'Tambah Kategori',
          category: null,
          errors,
          isEdit:  false,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl,
          ...feeCtx()
        })
      }

      const existing = await Category.findByName(req.body.name)
      if (existing) {
        return res.render('admin/categories/form', {
          title:   'Tambah Kategori',
          category: null,
          errors:  ['Kategori dengan nama ini sudah ada.'],
          isEdit:  false,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl,
          ...feeCtx()
        })
      }

      await Category.create({
        name:        req.body.name.trim(),
        sort_order:  req.body.sort_order,
        is_free_tier: req.body.is_free_tier === 'on' ? 1 : 0,
        // Checkbox "Gratis murni" (free_pure): dicentang → kategori gratis
        // TANPA opsi paket/sertifikat berbayar. Tidak dikirim = tak
        // dicentang = opsi paket tersedia. Boolean, bukan 0/1: model
        // Category.create hanya memaksa 0 saat diberi `false` eksplisit.
        cert_available: req.body.free_pure !== 'on',
        status:      'aktif',
        accent:      req.body.accent || 'blue',
        icon:        req.body.icon ? req.body.icon.trim() : ''
      })

      req.flash('success', 'Kategori berhasil ditambahkan.')
      res.redirect('/admin/categories')
    } catch (err) {
      next(err)
    }
  },

  getEdit: async (req, res, next) => {
    try {
      const categories = await Category.findAll()
      const category = categories.find(c => String(c.id) === String(req.params.id)) || null
      if (!category) {
        return res.status(404).render('error', { message: 'Kategori tidak ditemukan', code: 404 })
      }
      res.render('admin/categories/form', {
        title:    'Edit Kategori',
        category,
        errors:   [],
        isEdit:   true,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl,
        ...feeCtx()
      })
    } catch (err) {
      next(err)
    }
  },

  postUpdate: async (req, res, next) => {
    try {
      const categories = await Category.findAll()
      const category = categories.find(c => String(c.id) === String(req.params.id)) || null
      if (!category) {
        return res.status(404).render('error', { message: 'Kategori tidak ditemukan', code: 404 })
      }

      const { valid, errors } = validateCategoryInput(req.body)
      if (!valid) {
        return res.render('admin/categories/form', {
          title:    'Edit Kategori',
          category,
          errors,
          isEdit:   true,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl,
          ...feeCtx()
        })
      }

      // free_pure hanya relevan saat kategori gratis; form selalu mengirimnya
      // (checked / tidak), jadi aman ditagih langsung.
      await Category.update(req.params.id, {
        name:        req.body.name.trim(),
        sort_order:  req.body.sort_order,
        is_free_tier: req.body.is_free_tier === 'on' ? 1 : 0,
        cert_available: req.body.free_pure === 'on' ? 0 : 1,
        status:      req.body.status === 'nonaktif' ? 'nonaktif' : 'aktif',
        accent:      req.body.accent || 'blue',
        icon:        req.body.icon ? req.body.icon.trim() : ''
      })

      req.flash('success', 'Kategori berhasil diperbarui.')
      res.redirect('/admin/categories')
    } catch (err) {
      next(err)
    }
  },

  postDelete: async (req, res, next) => {
    try {
      const categories = await Category.findAll()
      const category = categories.find(c => String(c.id) === String(req.params.id))
      if (!category) {
        return res.status(404).render('error', { message: 'Kategori tidak ditemukan', code: 404 })
      }

      // Jangan biarkan kategori yang masih dipakai training terhapus tanpa akibat:
      // training yang bersangkutan di-"move" ke kategori default 'Pelatihan'.
      const allTrainings = await Training.findAll({})
      const inUse = allTrainings.filter(t => t.category === category.name)
      if (inUse.length > 0) {
        const fallback = categories.find(c => c.name === 'Pelatihan' && String(c.id) !== String(req.params.id))
        await Training.updateManyByCategory(category.name, fallback ? fallback.name : 'Pelatihan')
      }

      await Category.delete(req.params.id)
      req.flash('success', 'Kategori berhasil dihapus.' + (inUse.length ? ` ${inUse.length} pelatihan dipindah ke kategori cadangan.` : ''))
      res.redirect('/admin/categories')
    } catch (err) {
      next(err)
    }
  }
}

module.exports = adminCategoryController
module.exports.validateCategoryInput = validateCategoryInput
