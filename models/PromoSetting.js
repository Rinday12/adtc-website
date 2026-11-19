// models/PromoSetting.js
// Setting promo (1 baris per periode promo aktif) — label + periode + is_active,
// terpisah dari harga normal per kategori di tabel `trainings`. Harga bisa
// di-set per training (tabel anak `promo_trainings`) atau dibiarkan kosong
// untuk memakai `promo_settings.promo_price` sebagai harga default global —
// lihat docs/decision di rencana fitur "diskon/promo" per training.
//
// Semua query memakai parameterized statement untuk mencegah SQL injection.

const db = require('../config/db')

const PromoSetting = {

  /**
   * Ambil satu promo aktif (is_active = 1), plus harga per training (bisa
   * empty object bila belum ada baris anak — fallback ke promo_price global).
   * Bentuk hasil: { ...parentRow, byTraining: { [trainingId]: promoPrice } }
   * dengan byTraining sebagai Object biasa (bukan Map) agar aman serialisasi
   * / pemakaian di EJS & property test tanpa konversi ekstra.
   * @returns {Promise<object|null>}
   */
  async findActive() {
    const [parentRows] = await db.execute(
      `SELECT * FROM promo_settings WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
    )
    if (!parentRows[0]) return null
    const parent = parentRows[0]

    const [childRows] = await db.execute(
      `SELECT training_id, promo_price FROM promo_trainings WHERE promo_id = ?`,
      [parent.id]
    )
    const byTraining = {}
    childRows.forEach(r => {
      byTraining[r.training_id] = Number(r.promo_price)
    })

    return { ...parent, byTraining }
  },

  /**
   * Ambil harga promo per training untuk satu promo aktif, tanpa parent row —
   * untuk dipakai view publik yang sudah tahu training.id & promo-nya.
   * Bentuk: { [trainingId]: promoPrice }.
   * @returns {Promise<object>}
   */
  async findActiveByTraining() {
    const [rows] = await db.execute(
      `SELECT pt.training_id, pt.promo_price
         FROM promo_trainings pt
         JOIN promo_settings p ON p.id = pt.promo_id
        WHERE p.is_active = 1`
    )
    const byTraining = {}
    rows.forEach(r => {
      byTraining[r.training_id] = Number(r.promo_price)
    })
    return byTraining
  },

  /**
   * Ambil baris promo dengan id tertentu (bisa nonaktif), plus byTraining-nya.
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  async get(id) {
    const [rows] = await db.execute(
      'SELECT * FROM promo_settings WHERE id = ? LIMIT 1',
      [id]
    )
    if (!rows[0]) return null
    const parent = rows[0]
    const [childRows] = await db.execute(
      'SELECT training_id, promo_price FROM promo_trainings WHERE promo_id = ?',
      [id]
    )
    const byTraining = {}
    childRows.forEach(r => {
      byTraining[r.training_id] = Number(r.promo_price)
    })
    return { ...parent, byTraining }
  },

  /**
   * Buat promo baru + overwrite harga per training-nya. Bila data.is_active = 1,
   * promo lama yang aktif dinonaktifkan otomatis (hanya satu promo aktif dalam
   * satu waktu — asumsi skema global); baris anak promo lama ikut terhapus
   * via ON DELETE CASCADE hanya bila baris parent-nya sendiri dihapus — di sini
   * parent TIDAK dihapus, hanya dinonaktifkan, jadi baris anak lama tetap
   * tersimpan (aman: tak terpakai selama promo lama is_active=0).
   * @param {object} data - {label, promo_price, promo_starts_at, promo_ends_at, is_active,
   *                        byTraining: {[trainingId]: price}}
   * @returns {Promise<number>} id baris
   */
  async set(data) {
    const [existing] = await db.execute(
      'SELECT id FROM promo_settings WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    )
    const promoActive = data.is_active === 1 || data.is_active === true || data.is_active === '1'
    if (promoActive && existing[0]) {
      await db.execute('UPDATE promo_settings SET is_active = 0 WHERE id = ?', [existing[0].id])
    }
    const [result] = await db.execute(
      `INSERT INTO promo_settings
         (label, promo_price, promo_starts_at, promo_ends_at, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.label || '',
        data.promo_price || 0,
        data.promo_starts_at || null,
        data.promo_ends_at || null,
        promoActive ? 1 : 0
      ]
    )
    const newId = result.insertId

    if (data.byTraining && Object.keys(data.byTraining).length > 0) {
      const entries = Object.entries(data.byTraining)
      const values = entries.map(([, price]) => '(?, ?, ?)').join(', ')
      const params = entries.flatMap(([trainingId, price]) => [newId, trainingId, price])
      await db.execute(
        `INSERT INTO promo_trainings (promo_id, training_id, promo_price) VALUES ${values}`,
        params
      )
    }

    return newId
  }
}

module.exports = PromoSetting
