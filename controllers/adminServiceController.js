// controllers/adminServiceController.js
// Controller CRUD untuk manajemen Layanan Konsultan di dashboard admin.
// Pola mengikuti adminBenefitController.js + adminCategoryController.js
// (form perlu daftar kategori untuk pilihan `category_anchor`).

const Service = require('../models/Service')
const Category = require('../models/Category')

function validateServiceInput(body) {
  const errors = []
  if (!body.name || body.name.trim().length === 0)
    errors.push('Nama layanan wajib diisi.')
  if (body.name && body.name.trim().length > 150)
    errors.push('Nama layanan maksimal 150 karakter.')
  if (!body.description || body.description.trim().length === 0)
    errors.push('Deskripsi layanan wajib diisi.')
  return { valid: errors.length === 0, errors }
}

async function getActiveCategories() {
  try {
    return await Category.findActiveOrdered()
  } catch (err) {
    console.error('[adminServiceController] Gagal ambil daftar kategori:', err.message)
    return []
  }
}

const adminServiceController = {

  getList: async (req, res, next) => {
    try {
      const services = await Service.findAll()
      res.render('admin/services/list', {
        title: 'Manajemen Layanan',
        services,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  getCreate: async (req, res, next) => {
    try {
      const categories = await getActiveCategories()
      res.render('admin/services/form', {
        title:    'Tambah Layanan',
        service:  null,
        categories,
        errors:   [],
        isEdit:   false,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  postCreate: async (req, res, next) => {
    try {
      const { valid, errors } = validateServiceInput(req.body)
      const categories = await getActiveCategories()

      if (!valid) {
        return res.render('admin/services/form', {
          title:    'Tambah Layanan',
          service:  null,
          categories,
          errors,
          isEdit:   false,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl
        })
      }

      await Service.create({
        name:            req.body.name.trim(),
        description:     req.body.description.trim(),
        category_anchor: req.body.category_anchor || 'konsultan',
        icon:            req.body.icon ? req.body.icon.trim() : '',
        sort_order:      req.body.sort_order,
        status:          req.body.status === 'nonaktif' ? 'nonaktif' : 'aktif'
      })

      req.flash('success', 'Layanan berhasil ditambahkan.')
      res.redirect('/admin/services')
    } catch (err) {
      next(err)
    }
  },

  getEdit: async (req, res, next) => {
    try {
      const service = await Service.findById(req.params.id)
      if (!service) {
        return res.status(404).render('error', { message: 'Layanan tidak ditemukan', code: 404 })
      }
      const categories = await getActiveCategories()
      res.render('admin/services/form', {
        title:      'Edit Layanan',
        service,
        categories,
        errors:     [],
        isEdit:     true,
        adminUser:  req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  postUpdate: async (req, res, next) => {
    try {
      const service = await Service.findById(req.params.id)
      if (!service) {
        return res.status(404).render('error', { message: 'Layanan tidak ditemukan', code: 404 })
      }

      const { valid, errors } = validateServiceInput(req.body)
      const categories = await getActiveCategories()

      if (!valid) {
        return res.render('admin/services/form', {
          title:      'Edit Layanan',
          service,
          categories,
          errors,
          isEdit:     true,
          adminUser:  req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl
        })
      }

      await Service.update(req.params.id, {
        name:            req.body.name.trim(),
        description:     req.body.description.trim(),
        category_anchor: req.body.category_anchor || 'konsultan',
        icon:            req.body.icon ? req.body.icon.trim() : '',
        sort_order:      req.body.sort_order,
        status:          req.body.status === 'nonaktif' ? 'nonaktif' : 'aktif'
      })

      req.flash('success', 'Layanan berhasil diperbarui.')
      res.redirect('/admin/services')
    } catch (err) {
      next(err)
    }
  },

  postDelete: async (req, res, next) => {
    try {
      await Service.delete(req.params.id)
      req.flash('success', 'Layanan berhasil dihapus.')
      res.redirect('/admin/services')
    } catch (err) {
      next(err)
    }
  }
}

module.exports = adminServiceController
module.exports.validateServiceInput = validateServiceInput
