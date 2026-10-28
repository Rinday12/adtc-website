// models/Service.js
// Model untuk entitas layanan/konsultasi ADTC (tabel `services`).
// Mengabstraksi query database agar Controller tidak perlu mengetahui detail SQL.
//
// Semua query menggunakan parameterized statement (prepared statement)
// untuk mencegah SQL injection (Persyaratan 8.6).

const db = require('../config/db')

const Service = {

  /**
   * Ambil semua layanan (aktif dan nonaktif) — dipakai dashboard admin.
   * Urut sort_order lalu nama agar stabil.
   */
  async findAll() {
    const [rows] = await db.execute(
      'SELECT * FROM services ORDER BY sort_order ASC, name ASC'
    )
    return rows
  },

  /**
   * Ambil hanya layanan aktif, urut sort_order — dipakai halaman kategori publik.
   */
  async findAllActive() {
    const [rows] = await db.execute(
      "SELECT * FROM services WHERE status = 'aktif' ORDER BY sort_order ASC, name ASC"
    )
    return rows
  },

  /**
   * Ambil layanan aktif untuk satu kategori (anchor kategori di tabel categories).
   * `categoryAnchor` opsional: jika diberikan, hanya layanan milik kategori itu.
   */
  async findAllActiveByCategory(categoryAnchor) {
    const [rows] = await db.execute(
      "SELECT * FROM services WHERE status = 'aktif' AND category_anchor = ? ORDER BY sort_order ASC, name ASC",
      [String(categoryAnchor)]
    )
    return rows
  },

  async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM services WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] || null
  },

  /**
   * Buat layanan baru.
   */
  async create(data) {
    const [result] = await db.execute(
      `INSERT INTO services (name, description, category_anchor, icon, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(data.name).trim(),
        String(data.description).trim(),
        String(data.category_anchor || 'konsultan'),
        data.icon ? String(data.icon) : '',
        parseInt(data.sort_order, 10) || 0,
        data.status === 'nonaktif' ? 'nonaktif' : 'aktif'
      ]
    )
    return result.insertId
  },

  /**
   * Perbarui layanan berdasarkan id.
   */
  async update(id, data) {
    const [result] = await db.execute(
      `UPDATE services
       SET name = ?, description = ?, category_anchor = ?, icon = ?, sort_order = ?, status = ?
       WHERE id = ?`,
      [
        String(data.name).trim(),
        String(data.description).trim(),
        String(data.category_anchor || 'konsultan'),
        data.icon ? String(data.icon) : '',
        parseInt(data.sort_order, 10) || 0,
        data.status === 'nonaktif' ? 'nonaktif' : 'aktif',
        id
      ]
    )
    return result.affectedRows
  },

  /**
   * Hapus layanan berdasarkan id (hard delete).
   */
  async delete(id) {
    const [result] = await db.execute(
      'DELETE FROM services WHERE id = ?',
      [id]
    )
    return result.affectedRows
  }
}

module.exports = Service
