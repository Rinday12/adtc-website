// controllers/publicController.js
const Training = require('../models/Training')

const publicController = {

  /**
   * GET /trainings[?category=xxx]
   * Tampilkan katalog pelatihan dikelompokkan per kategori.
   * Jika query ?category= ada, scroll ke section tersebut (ditangani di client).
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
      res.render('trainings/catalog', {
        groups,
        categories,
        activeCategory: req.query.category || null,
        title: 'Katalog Pelatihan ADTC'
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
      res.render('trainings/detail', { training, title: training.title })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = publicController
