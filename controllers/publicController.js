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
      const [groups, categories] = await Promise.all([
        Training.findAllGrouped(),
        Training.findCategories()
      ])
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
      const training = await Training.findBySlug(req.params.slug)
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
