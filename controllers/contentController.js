// controllers/contentController.js
// Controller untuk halaman-halaman publik: Beranda, Berita, dan Detail Berita.
//
// Persyaratan: 1.1, 1.3, 1.4, 1.6, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3

const Training = require('../models/Training')
const News     = require('../models/News')
const Benefit  = require('../models/Benefit')

const contentController = {

  /**
   * GET /
   * Halaman Beranda: hero section, benefit dinamis, training unggulan, link berita.
   *
   * Menggunakan Promise.allSettled agar kegagalan query benefit tidak menyebabkan
   * error 500 — fallback ke array kosong jika benefit gagal.
   * Jika query training gagal, error diteruskan ke error handler via next(err).
   *
   * Postconditions:
   *   - Render views/home.ejs dengan: benefits (array aktif), trainings (maks 3 terbaru), title
   *   - Jika query benefit gagal, render tetap berhasil dengan benefits = [] dan log error
   *   - Jika query training gagal, lanjut ke error handler (500)
   *
   * Validates: Requirements 1.1, 1.3, 1.4, 1.6, 2.2, 2.3, 2.5
   */
  getHome: async (req, res, next) => {
    try {
      const [trainingsResult, benefitsResult] = await Promise.allSettled([
        Training.findLatest(3),
        Benefit.findAllActive()
      ])

      // Jika query training gagal, teruskan ke error handler
      if (trainingsResult.status === 'rejected') {
        return next(trainingsResult.reason)
      }

      // Jika query benefit gagal, fallback ke array kosong dan log error
      if (benefitsResult.status === 'rejected') {
        console.error('Gagal memuat benefit untuk halaman Beranda:', benefitsResult.reason)
      }

      res.render('home', {
        title:     'Beranda',
        trainings: trainingsResult.value,
        benefits:  benefitsResult.status === 'fulfilled' ? benefitsResult.value : []
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /berita
   * Daftar semua berita, urut published_at DESC.
   *
   * Postconditions:
   *   - Render views/news/list.ejs dengan newsList (bisa array kosong)
   *
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   */
  getNewsList: async (req, res, next) => {
    try {
      const newsList = await News.findAll()
      res.render('news/list', { title: 'Berita ADTC', newsList })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /berita/:slug
   * Detail satu berita berdasarkan slug.
   *
   * Postconditions:
   *   - Render views/news/detail.ejs jika berita ditemukan
   *   - HTTP 404 jika slug tidak ada di database
   *
   * Validates: Requirements 4.1, 4.2, 4.3
   */
  getNewsDetail: async (req, res, next) => {
    try {
      const news = await News.findBySlug(req.params.slug)
      if (!news) {
        return res.status(404).render('error', {
          message: 'Berita tidak ditemukan', code: 404
        })
      }
      res.render('news/detail', { title: news.title, news })
    } catch (err) {
      next(err)
    }
  }

}

module.exports = contentController
