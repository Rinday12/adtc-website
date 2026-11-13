// models/Registration.js
// Model untuk operasi database tabel `registrations`.
//
// Semua query menggunakan parameterized query (prepared statement) untuk
// mencegah SQL injection sesuai Requirement 8.6.

const db = require('../config/db')
const crypto = require('crypto')

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

/**
 * Generate access token acak (UUID v4) untuk membuka halaman detail
 * pendaftaran — pengganti ID numerik yang bisa ditebak.
 */
function generateAccessToken() {
  return crypto.randomUUID()
}

const Registration = {

  /**
   * Fungsi publik untuk generator kode referensi & token (dipakai oleh unit test).
   */
  generateReferenceCode,
  generateAccessToken,

  async create(data) {
    const {
      training_id,
      full_name,
      email,
      phone,
      category,
      institution,
      payment_option,
      identity_number,
      identity_card_proof,
      social_proof,
      ig_story_proof,
      wa_share_proof,
      ig_comment_proof,
      final_price
    } = data

    const referenceCode = generateReferenceCode()
    const accessToken   = generateAccessToken()

    // Peserta gratis (final_price = 0) tidak ada tahap pembayaran,
    // jadi langsung auto-verify tanpa perlu approval admin.
    // Peserta berbayar tetap 'pending' — menunggu admin approve.
    const initialStatus = Number(final_price) > 0 ? 'pending' : 'verified'

    // INSERT tanpa identity_card_proof, social_proof, institution,
    // payment_option — kolom-kolom opsional ini ditangani terpisah agar
    // kompatibel dengan skema DB yang belum punya kolom tersebut (DB lama).
    const [result] = await db.execute(
      `INSERT INTO registrations
        (training_id, full_name, email, phone, category,
         identity_number, final_price, reference_code, access_token, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        training_id,
        full_name,
        email,
        phone,
        category,
        identity_number || null,
        final_price,
        referenceCode,
        accessToken,
        initialStatus
      ]
    )

    const insertId = result.insertId

    const optionalUpdates = []
    if (institution) {
      optionalUpdates.push([
        'UPDATE registrations SET institution = ? WHERE id = ?',
        [institution, insertId]
      ])
    }
    if (payment_option && ['gratis', 'sertifikat'].includes(payment_option)) {
      optionalUpdates.push([
        'UPDATE registrations SET payment_option = ? WHERE id = ?',
        [payment_option, insertId]
      ])
    }
    if (identity_card_proof) {
      optionalUpdates.push([
        'UPDATE registrations SET identity_card_proof = ? WHERE id = ?',
        [identity_card_proof, insertId]
      ])
    }
    if (social_proof) {
      optionalUpdates.push([
        'UPDATE registrations SET social_proof = ? WHERE id = ?',
        [social_proof, insertId]
      ])
    }
    if (ig_story_proof) {
      optionalUpdates.push([
        'UPDATE registrations SET ig_story_proof = ? WHERE id = ?',
        [ig_story_proof, insertId]
      ])
    }
    if (wa_share_proof) {
      optionalUpdates.push([
        'UPDATE registrations SET wa_share_proof = ? WHERE id = ?',
        [wa_share_proof, insertId]
      ])
    }
    if (ig_comment_proof) {
      optionalUpdates.push([
        'UPDATE registrations SET ig_comment_proof = ? WHERE id = ?',
        [ig_comment_proof, insertId]
      ])
    }

    // UPDATE terpisah per kolom opsional — error di-swallow agar pendaftaran
    // tetap sukses bila kolom belum ada di skema DB (migration belum dijalankan).
    for (const [sql, params] of optionalUpdates) {
      try {
        await db.execute(sql, params)
      } catch (err) {
        console.error('[Registration.create] optional column update gagal:', err.message)
        // Tidak membatalkan pendaftaran — data inti sudah tersimpan.
      }
    }

    return { id: insertId, accessToken }
  },

  async findByToken(token) {
    const [rows] = await db.execute(
      `SELECT r.*,
              t.title            AS training_title,
              t.slug             AS training_slug,
              t.start_date,
              t.description      AS training_description,
              t.whatsapp_group_link,
              (SELECT is_free_tier FROM categories c
                WHERE c.name = t.category LIMIT 1) AS is_free_tier,
              (SELECT cert_available FROM categories c
                WHERE c.name = t.category LIMIT 1) AS cert_available
       FROM registrations r
       JOIN trainings t ON r.training_id = t.id
       WHERE r.access_token = ?
       LIMIT 1`,
      [token]
    )
    const row = rows[0] || null
    if (row) {
      if (row.final_price !== undefined) row.final_price = Number(row.final_price)
      row.is_free_tier = row.is_free_tier === 1
      // NULL → anggap paket tersedia (perilaku lama tidak berubah).
      row.cert_available = row.cert_available !== 0
    }
    return row
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
    const row = rows[0] || null
    // DECIMAL(10,2) dari mysql2 = string → konversi ke number agar
    // fmt.format() dan Intl.NumberFormat bekerja dengan benar di view.
    if (row && row.final_price !== undefined) {
      row.final_price = Number(row.final_price)
    }
    return row
  },

  async findAll(filters = {}) {
    let query = `
      SELECT r.*, t.title AS training_title,
             (SELECT is_free_tier FROM categories c
               WHERE c.name = t.category LIMIT 1) AS is_free_tier
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
    rows.forEach(r => { if (r.is_free_tier !== undefined) r.is_free_tier = r.is_free_tier === 1 })
    return rows
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
