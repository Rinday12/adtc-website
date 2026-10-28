// controllers/adminTrainingController.js
// Controller CRUD untuk manajemen Pelatihan di dashboard admin.

const Training = require('../models/Training')
const Category = require('../models/Category')
const XLSX = require('xlsx')
const path = require('path')

// Buat kategori baru bila nama belum terdaftar di tabel `categories`,
// sehingga form training bisa mengetik nama baru (auto-create) tanpa
// memaksa admin buka halaman CRUD kategori.
// `isFreeTier` menandai kategori GRATIS hanya saat KATEGORI DIKREASIKAN;
// kategori yang sudah ada tidak diubah (tier-nya dikelola lewat
// /admin/categories agar tidak mengubah tier seluruh training sejenis).
async function ensureCategory(name, isFreeTier = 0) {
  const nm = String(name || '').trim()
  if (!nm) return
  const existing = await Category.findByName(nm)
  if (existing) return
  await Category.create({ name: nm, is_free_tier: isFreeTier ? 1 : 0, status: 'aktif' })
}

// Konteks form tambahan: nominal biaya sertifikat (dari env) + formatter
// IDR, agar form bisa memberi tahu admin apa yang terjadi bila kategori
// bertipe gratis.
function formCtx() {
  const certFee = Number(process.env.CERT_FEE || 0)
  return {
    certFee,
    certFeeFmt: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(certFee)
  }
}

// Harga boleh 0 (gratis) atau positif — cukup cek: ada nilai, tidak NaN, tidak negatif.
// Untuk kategori gratis (is_free_tier=1) field harga TIDAK diverifikasi
// (dinonaktifkan di form, di-server dipaksa 0 bila terisi) — harga peserta
// ditentukan tier kategori + CERT_FEE, bukan angka form.
function validatePriceField(body, field, label, errors, required = true) {
  if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
    if (required) errors.push(`${label} wajib diisi.`)
    return
  }
  const val = parseFloat(body[field])
  if (isNaN(val)) {
    errors.push(`${label} wajib berupa angka.`)
  } else if (val < 0) {
    errors.push(`${label} tidak boleh negatif.`)
  }
}

/**
 * Validasi input form training. Async karena perlu mengecek tier kategori
 * (kategori gratis → 3 field harga opsional; berbayar → wajib terisi).
 * @returns {Promise<{valid:boolean, errors:string[], freeTier:boolean}>}
 *   freeTier: true bila kategori terpilih bertipe gratis (atau kategori tak
 *   ditemukan — agar tidak salah memaksa harga pada tier yang belum
 *   terdaftar). Dipakai view untuk menandai field harga disabled + dipakai
 *   caller untuk memaksa harga 0.
 */
async function validateTrainingInput(body) {
  const errors = []

  if (!body.title || body.title.trim().length === 0)
    errors.push('Judul pelatihan wajib diisi.')
  if (!body.category || body.category.trim().length === 0)
    errors.push('Kategori wajib diisi.')

  let freeTier = false
  if (body.category && body.category.trim()) {
    const cat = await Category.findByName(body.category.trim())
    freeTier = !cat || !!cat.is_free_tier
  }

  validatePriceField(body, 'price_general',     'Harga umum', errors, !freeTier)
  validatePriceField(body, 'price_student_uad', 'Harga mahasiswa UAD', errors, !freeTier)
  validatePriceField(body, 'price_employee_uad','Harga karyawan UAD', errors, !freeTier)

  if (!body.quota || isNaN(parseInt(body.quota, 10)) || parseInt(body.quota, 10) < 1)
    errors.push('Kuota wajib angka bulat >= 1.')

  return { valid: errors.length === 0, errors, freeTier }
}

// Helper: tawarkan harga utk tier gratis selalu disimpan 0 (form dinonaktifkan,
// admin tak boleh mengarsipkan nominal yang tak terpakai).
function freeTierPrices(freeTier, body) {
  if (freeTier) return { price_general: 0, price_student_uad: 0, price_employee_uad: 0 }
  return {
    price_general:      parseFloat(body.price_general),
    price_student_uad:  parseFloat(body.price_student_uad),
    price_employee_uad: parseFloat(body.price_employee_uad)
  }
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

  getCreate: async (req, res, next) => {
    try {
      const categories = await Category.findActiveOrdered()
      res.render('admin/trainings/form', {
        title:      'Tambah Pelatihan',
        training:   null,
        categories,
        errors:     [],
        isEdit:     false,
        adminUser:  req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl,
        ...formCtx()
      })
    } catch (err) { next(err) }
  },

  postCreate: async (req, res, next) => {
    try {
      const { valid, errors, freeTier } = await validateTrainingInput(req.body)
      if (!valid) {
        return res.render('admin/trainings/form', {
          title:   'Tambah Pelatihan',
          training: null,
          categories: await Category.findActiveOrdered(),
          errors,
          isEdit:  false,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl,
          ...formCtx()
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
      const execMode = req.body.exec_mode === 'online' ? 'online' : 'offline'
      // fasilitas hanya relevan untuk offline; simpan sebagai teks (satuan per baris)
      const fasilitas = execMode === 'offline' ? (req.body.fasilitas || '').trim() || null : null

      // Auto-buat kategori bila nama baru belum terdaftar; centang
      // "new_cat_is_free" hanya relevan saat kategori ini baru dibuat.
      await ensureCategory(req.body.category, req.body.new_cat_is_free === 'on' ? 1 : 0)

      await Training.create({
        title:              req.body.title.trim(),
        slug:               finalSlug,
        description:        req.body.description || null,
        category:           req.body.category.trim(),
        category_order:     parseInt(req.body.category_order, 10) || 99,
        ...freeTierPrices(freeTier, req.body),
        quota:              parseInt(req.body.quota, 10),
        start_date:         req.body.start_date || null,
        whatsapp_group_link: req.body.whatsapp_group_link?.trim() || null,
        cover_image:        coverImage,
        exec_mode:          execMode,
        fasilitas:          fasilitas
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
      const categories = await Category.findActiveOrdered()
      res.render('admin/trainings/form', {
        title:    'Edit Pelatihan',
        training,
        categories,
        errors:   [],
        isEdit:   true,
        adminUser: req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl,
        ...formCtx()
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

      const { valid, errors, freeTier } = await validateTrainingInput(req.body)
      if (!valid) {
        return res.render('admin/trainings/form', {
          title:    'Edit Pelatihan',
          training,
          categories: await Category.findActiveOrdered(),
          errors,
          isEdit:   true,
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl,
          ...formCtx()
        })
      }

      const status = req.body.status === 'postpone' ? 'postpone' : (req.body.status === 'full' ? 'full' : 'active')
      const coverImage = req.file?.path || training.cover_image
      const execMode = req.body.exec_mode === 'online' ? 'online' : 'offline'
      const fasilitas = execMode === 'offline' ? (req.body.fasilitas || '').trim() || null : null

      // Auto-buat kategori bila nama baru belum terdaftar (centang free
      // hanya berlaku saat kategori ini DIKREASIKAN).
      await ensureCategory(req.body.category, req.body.new_cat_is_free === 'on' ? 1 : 0)

      await Training.update(training.id, {
        title:              req.body.title.trim(),
        slug:               training.slug,
        description:        req.body.description || null,
        category:           req.body.category.trim(),
        category_order:     parseInt(req.body.category_order, 10) || 99,
        ...freeTierPrices(freeTier, req.body),
        quota:              parseInt(req.body.quota, 10),
        start_date:         req.body.start_date || null,
        reschedule_date:    req.body.reschedule_date || null,
        status,
        whatsapp_group_link: req.body.whatsapp_group_link?.trim() || null,
        cover_image:        coverImage,
        exec_mode:          execMode,
        fasilitas:          fasilitas
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
      const db = require('../config/db')
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
module.exports.validateTrainingInput = validateTrainingInput
