// models/Category.js
// Model untuk entitas kategori pelatihan (tabel `categories`).
// Mengabstraksi query database agar Controller tidak perlu mengetahui detail SQL.
//
// Semua query menggunakan parameterized statement (prepared statement)
// untuk mencegah SQL injection (Persyaratan 8.6).

const db = require('../config/db')

/**
 * Slug URL-friendly dari nama kategori — konsisten dengan logika anchor di
 * models/Training.js (nama → lowercase, spasi → '-', buang non-alphanumeric).
 */
function buildAnchor(name) {
  return String(name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

const Category = {
  buildAnchor,

  /**
   * Ambil semua kategori (admin) — aktif & nonaktif, urut sort_order lalu nama.
   */
  async findAll() {
    const [rows] = await db.execute(
      'SELECT * FROM categories ORDER BY sort_order ASC, name ASC'
    )
    return rows
  },

  /**
   * Ambil hanya kategori aktif, urut sort_order — dipakai navbar & katalog publik.
   * Return baris asli sehingga view memakai `category.name` / `category.anchor`.
   */
  async findActiveOrdered() {
    const [rows] = await db.execute(
      "SELECT * FROM categories WHERE status = 'aktif' ORDER BY sort_order ASC, name ASC"
    )
    return rows
  },

  /**
   * Cari kategori berdasarkan nama persis (untuk auto-create saat form training).
   */
  async findByName(name) {
    const [rows] = await db.execute(
      'SELECT * FROM categories WHERE name = ? LIMIT 1',
      [String(name)]
    )
    return rows[0] || null
  },

  /**
   * Buat kategori baru. Anchor dibuat otomatis dari nama bila tidak diberikan.
   */
  /**
   * Normalisasi icon: URL-decode bila ter-encode (mis. "%F0%9F%8E%89" dari
   * submit form), trim, dan buang bila hasil decode masih tampak percent-encoded.
   */
  normalizeIcon(raw) {
    let v = raw ? String(raw).trim() : ''
    if (v && /^%[0-9A-F]{2}(?:%[0-9A-F]{2})+$/i.test(v)) {
      try { const d = decodeURIComponent(v); if (d && !/^%[0-9A-F]{2}/.test(d)) v = d } catch (_) {}
    }
    return v
  },

  async create(data) {
    const name = String(data.name).trim()
    const anchor = data.anchor && data.anchor.trim() ? String(data.anchor).trim() : buildAnchor(name)
    const accent = data.accent || 'blue'
    const icon = this.normalizeIcon(data.icon)
    // cert_available: default 1 (pakai opsi paket/sertifikat berbayar).
    // hanya dipaksa 0 bila EXPLICIT diberi false — agar pemanggil lama yang
    // tidak tahu field ini tetap dapat perilaku wajar.
    const certAvail = data.cert_available === false ? 0 : 1
    const [result] = await db.execute(
      `INSERT INTO categories (name, anchor, sort_order, is_free_tier, cert_available, status, accent, icon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        anchor,
        parseInt(data.sort_order, 10) || 0,
        data.is_free_tier ? 1 : 0,
        certAvail,
        data.status === 'nonaktif' ? 'nonaktif' : 'aktif',
        accent,
        icon
      ]
    )
    return result.insertId
  },

  /**
   * Perbarui kategori berdasarkan id.
   */
  async update(id, data) {
    const name = String(data.name).trim()
    const anchor = data.anchor && data.anchor.trim() ? String(data.anchor).trim() : buildAnchor(name)
    const accent = data.accent || 'blue'
    const icon = this.normalizeIcon(data.icon)
    // cert_available: default pertahankan nilai saat ini bila tak disentuh.
    const certAvail = data.cert_available === undefined
      ? null // ditangani di bawah via CASE
      : (data.cert_available ? 1 : 0)
    const [result] = await db.execute(
      certAvail === null
        ? `UPDATE categories
            SET name = ?, anchor = ?, sort_order = ?, is_free_tier = ?, status = ?, accent = ?, icon = ?
            WHERE id = ?`
        : `UPDATE categories
            SET name = ?, anchor = ?, sort_order = ?, is_free_tier = ?, cert_available = ?, status = ?, accent = ?, icon = ?
            WHERE id = ?`,
      certAvail === null
        ? [name, anchor, parseInt(data.sort_order, 10) || 0, data.is_free_tier ? 1 : 0,
           data.status === 'nonaktif' ? 'nonaktif' : 'aktif', accent, icon, id]
        : [name, anchor, parseInt(data.sort_order, 10) || 0, data.is_free_tier ? 1 : 0, certAvail,
           data.status === 'nonaktif' ? 'nonaktif' : 'aktif', accent, icon, id]
    )
    return result.affectedRows
  },

  /**
   * Hapus kategori berdasarkan id (hard delete).
   * Catatan: bila kategori masih dipakai di trainings, keputusan tolak/diare
   * dilakukan di controller.
   */
  async delete(id) {
    const [result] = await db.execute('DELETE FROM categories WHERE id = ?', [id])
    return result.affectedRows
  }
}

module.exports = Category
