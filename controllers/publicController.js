// controllers/publicController.js
const Training = require('../models/Training')
const Service  = require('../models/Service')

const publicController = {

  /**
   * GET /trainings[?category=xxx]
   * Tampilkan katalog pelatihan dikelompokkan per kategori.
   * Jika query ?category= ada, scroll ke section tersebut (ditangani di client).
   *
   * Kategori diambil dari tabel `categories` (findCategories) sehingga
   * kategori kosong tetap tampil di tab & section.
   */
  getCatalog: async (req, res, next) => {
    try {
      const [groupsResult, categoriesResult] = await Promise.allSettled([
        Training.findAllGrouped(),
        Training.findCategories()
      ])
      const groups = groupsResult.status === 'fulfilled' ? groupsResult.value : []
      const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
      if (groupsResult.status === 'rejected') {
        console.error('[getCatalog] Query training gagal, fallback ke array kosong:', groupsResult.reason)
      }
      if (categoriesResult.status === 'rejected') {
        console.error('[getCatalog] Query kategori gagal, fallback ke array kosong:', categoriesResult.reason)
      }

      // Map training per nama kategori agar template bisa mengambil grup
      // sesuai daftar kategori resmi (termasuk yang kosong).
      const groupMap = new Map()
      groups.forEach(g => groupMap.set(g.category, g))
      const totalActive = groups.reduce((sum, g) => sum + g.trainings.length, 0)

      res.render('trainings/catalog', {
        groups,
        categories,
        groupMap,
        totalActive,
        activeCategory: req.query.category || null,
        title: 'Katalog Pelatihan ADTC'
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /trainings/:anchor
   * Halaman katalog terpisah per kategori (anchor kategori, mis. 'pelatihan',
   * 'konsultan', 'in-house-training', 'pelatihan-gratis').
   */
  getCategoryPage: async (req, res, next) => {
    try {
      const anchor = req.params.anchor

      // Validasi: anchor harus ada di tabel categories & aktif
      let categories
      try {
        categories = await Training.findCategories()
      } catch (err) {
        console.error('[getCategoryPage] Query kategori gagal:', err.message)
        return res.status(500).render('error', {
          message: 'Gagal memuat data kategori', code: 500
        })
      }
      const category = categories.find(c => c.anchor === anchor)
      if (!category) {
        return res.status(404).render('error', {
          message: 'Kategori tidak ditemukan', code: 404
        })
      }

      let trainings
      try {
        trainings = await Training.findAllByCategory(category.category)
      } catch (err) {
        console.error('[getCategoryPage] Query training gagal:', err.message)
        trainings = []
      }

      // Ambil layanan aktif yang terkait kategori ini
      let services
      try {
        services = await Service.findAllActiveByCategory(anchor)
      } catch (err) {
        console.error('[getCategoryPage] Query layanan gagal:', err.message)
        services = []
      }

      res.render('trainings/category', {
        category,
        trainings,
        services,
        total: trainings.length,
        title: `${category.category} — ADTC`
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /trainings/:slug
   * Tampilkan detail satu pelatihan.
   */
  getTrainingDetail: async (req, res, next) => {
    try {
      let training
      try {
        training = await Training.findBySlug(req.params.slug)
      } catch (err) {
        console.error('[getTrainingDetail] Query detail gagal:', err.message)
        training = null
      }
      if (!training) {
        return res.status(404).render('error', {
          message: 'Pelatihan tidak ditemukan', code: 404
        })
      }
      res.render('trainings/detail', {
        training,
        title: training.title,
        certFee: Number(process.env.CERT_FEE || 0),
      })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = publicController
