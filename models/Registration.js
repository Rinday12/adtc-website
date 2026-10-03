// models/Registration.js
// Model untuk operasi database tabel `registrations`.
//
// Semua query menggunakan parameterized query (prepared statement) untuk
// mencegah SQL injection sesuai Requirement 8.6.

const db = require('../config/db')

const validStatuses = ['pending', 'approved', 'payment_uploaded', 'verified', 'rejected']

/**
 * Generate kode referensi unik format ADTC-YYYY-NNNN.
 * Dipakai peserta sebagai identifikasi transfer agar admin mudah mencocokkan.
 */
function generateReferenceCode() {
  const year = new Date().getFullYear()
  const ts = Date.now().toString(36).toUpperCase()
  const rand = (Math.floor(Math.random() * 9000) + 1000).toString()
  return `ADTC-${year}-${ts}${rand}`
}

const Registration = {

  /**
   * Fungsi publik untuk generator kode referensi (dipakai oleh unit test).
   */
  generateReferenceCode,

  async create(data) {
    const {
      training_id,
      full_name,
      email,
      phone,
      category,
      identity_number,
      identity_card_proof,
      final_price
    } = data

    const referenceCode = generateReferenceCode()

    const [result] = await db.execute(
      `INSERT INTO registrations
        (training_id, full_name, email, phone, category,
         identity_number, identity_card_proof, final_price, reference_code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        training_id,
        full_name,
        email,
        phone,
        category,
        identity_number || null,
        identity_card_proof || null,
        final_price,
        referenceCode,
        'pending'
      ]
    )

    return result.insertId
  },

  async findById(id) {
    const [rows] = await db.execute(
      `SELECT r.*,
              t.title            AS training_title,
              t.slug             AS training_slug,
              t.start_date,
              t.description      AS training_description,
              t.whatsapp_group_link
       FROM registrations r
       JOIN trainings t ON r.training_id = t.id
       WHERE r.id = ?
       LIMIT 1`,
      [id]
    )

    return rows[0] || null
  },

  async findAll(filters = {}) {
    let query = `
      SELECT r.*, t.title AS training_title
      FROM registrations r
      JOIN trainings t ON r.training_id = t.id
    `
    const conditions = []
    const params = []

    if (filters.status && validStatuses.includes(filters.status)) {
      conditions.push('r.status = ?')
      params.push(filters.status)
    }

    // Filter by participant name
    if (filters.search && filters.search.trim()) {
      conditions.push('r.full_name LIKE ?')
      params.push(`%${filters.search.trim()}%`)
    }

    // Filter by training title or category
    if (filters.training_search && filters.training_search.trim()) {
      conditions.push('(t.title LIKE ? OR t.category LIKE ?)')
      params.push(`%${filters.training_search.trim()}%`, `%${filters.training_search.trim()}%`)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY r.created_at DESC'

    const [rows] = await db.execute(query, params)
    return rows
  },

  async countByTraining(trainingId) {
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS count FROM registrations WHERE training_id = ? AND status != 'rejected'`,
      [trainingId]
    )
    return parseInt(rows[0]?.count || 0, 10)
  },

  async countByStatus() {
    const [rows] = await db.execute(
      `SELECT status, COUNT(*) AS count FROM registrations GROUP BY status`
    )
    const result = { total: 0, pending: 0, approved: 0, payment_uploaded: 0, verified: 0, rejected: 0 }
    rows.forEach(row => { result[row.status] = parseInt(row.count, 10); result.total += parseInt(row.count, 10) })
    return result
  },

  async removeById(id) {
    const [result] = await db.execute(
      'DELETE FROM registrations WHERE id = ?',
      [id]
    )
    return result.affectedRows
  },

  async updateStatus(id, status) {
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`)
    }
    const [result] = await db.execute(
      'UPDATE registrations SET status = ? WHERE id = ?',
      [status, id]
    )
    return result.affectedRows
  },

  async updateStatusWithReason(id, status, rejectionReason) {
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`)
    }
    const [result] = await db.execute(
      'UPDATE registrations SET status = ?, rejection_reason = ? WHERE id = ?',
      [status, rejectionReason || null, id]
    )
    return result.affectedRows
  },

  async updatePaymentProof(id, paymentProof) {
    const [result] = await db.execute(
      'UPDATE registrations SET payment_proof = ? WHERE id = ?',
      [paymentProof, id]
    )
    return result.affectedRows
  },

  async updateCertificateUrl(id, certificateUrl) {
    const [result] = await db.execute(
      'UPDATE registrations SET certificate_url = ? WHERE id = ?',
      [certificateUrl || null, id]
    )
    return result.affectedRows
  }
}

module.exports = Registration
