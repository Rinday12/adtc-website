// controllers/adminPromoController.js
// Controller untuk setting promo global (1 form, bukan CRUD lengkap) —
// mengikuti pola adminServiceController.js / adminBenefitController.js.
// Hanya 1 promo aktif dalam satu waktu; form menampilkan yang aktif
// (atau kosong) dan POST menyimpan/overwrites. Harga promo bisa di-set
// per training (checkbox + input harga), atau dibiarkan kosong untuk
// memakai harga default global (promo_price).

const PromoSetting = require('../models/PromoSetting')
const Training = require('../models/Training')

const adminPromoController = {

  getForm: async (req, res, next) => {
    try {
      let promo = null
      let trainings = []
      try {
        promo = await PromoSetting.findActive()
      } catch (_) {
        promo = null
      }
      try {
        trainings = await Training.findAll({ status: 'all' })
      } catch (err) {
        console.error('[adminPromoController.getForm] Training query gagal:', err.message)
        trainings = []
      }
      res.render('admin/promo/form', {
        title:      'Setting Promo Harga',
        promo,
        trainings,
        errors:     [],
        adminUser:  req.session.adminUsername || 'Admin',
        currentPath: req.originalUrl
      })
    } catch (err) {
      next(err)
    }
  },

  postSave: async (req, res, next) => {
    try {
      const label = (req.body.label || '').trim()
      const promoPrice = parseFloat(req.body.promo_price)
      const startsAt = req.body.promo_starts_at || null
      const endsAt = req.body.promo_ends_at || null
      const isActive = req.body.is_active === '1' || req.body.is_active === 'on' ? 1 : 0

      // Harga per training: req.body.training_ids = array string (id training
      // yang dicentang), req.body.promo_prices = array string paralel (harga
      // per training, boleh kosong → fallback ke promo_price global).
      const trainingIds = Array.isArray(req.body.training_ids)
        ? req.body.training_ids
        : req.body.training_ids ? [req.body.training_ids] : []
      const promoPrices = Array.isArray(req.body.promo_prices)
        ? req.body.promo_prices
        : req.body.promo_prices != null ? [req.body.promo_prices] : []

      const byTraining = {}
      const errors = []
      if (isNaN(promoPrice) || promoPrice < 0) {
        errors.push('Harga promo default harus angka >= 0.')
      }
      if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
        errors.push('Tanggal mulai promo harus sebelum tanggal berakhir.')
      }
      if (isActive && label.length === 0) {
        errors.push('Nama promo wajib diisi bila promo diaktifkan.')
      }

      for (let i = 0; i < trainingIds.length; i++) {
        const idStr = String(trainingIds[i])
        const priceStr = promoPrices[i]
        if (priceStr === undefined || priceStr === null || String(priceStr).trim() === '') {
          // Boleh kosong — pakai harga default global (promo_price).
          continue
        }
        const p = Number(priceStr)
        if (isNaN(p) || p < 0) {
          errors.push(`Harga promo untuk training #${idStr} tidak valid (harus angka >= 0).`)
          continue
        }
        byTraining[idStr] = p
      }

      if (errors.length > 0) {
        const [promo, trainings] = await Promise.allSettled([
          PromoSetting.findActive(),
          Training.findAll({ status: 'all' })
        ])
        const promo2 = promo.status === 'fulfilled' ? promo.value : null
        const trainings2 = trainings.status === 'fulfilled' ? trainings.value : []
        return res.render('admin/promo/form', {
          title:     'Setting Promo Harga',
          promo: promo2,
          trainings: trainings2,
          errors,
          values:   { label, promo_price: req.body.promo_price, promo_starts_at: startsAt,
                       promo_ends_at: endsAt, is_active: isActive,
                       training_ids: trainingIds, promo_prices: promoPrices },
          adminUser: req.session.adminUsername || 'Admin',
          currentPath: req.originalUrl
        })
      }

      // trainingIds dipakai sebagai kunci object — konversi ke string agar
      // konsisten dengan cara byTraining dipakai di view (training.id dari
      // DB biasanya number, tapi di JS object key selalu string).
      await PromoSetting.set({
        label,
        promo_price: promoPrice,
        promo_starts_at: startsAt,
        promo_ends_at: endsAt,
        is_active: isActive,
        byTraining
      })

      req.flash('success', 'Setting promo berhasil disimpan.')
      res.redirect('/admin/promo-settings')
    } catch (err) {
      next(err)
    }
  }
}

module.exports = adminPromoController
