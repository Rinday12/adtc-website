// models/Training.js
// Model untuk entitas pelatihan (Training).
// Mengabstraksi query database agar Controller tidak perlu mengetahui detail SQL.
//
// Semua query menggunakan parameterized statement (prepared statement)
// untuk mencegah SQL injection (Persyaratan 8.6).

const db = require('../config/db')
const slugify = require('slugify')

/**
 * Validate satu baris data training dari Excel.
 * @param {object} row - object dengan kunci kolom Excel
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateTrainingRow(row) {
  const errors = []
  const title = (row.title || '').toString().trim()
  const category = (row.category || '').toString().trim()
  const priceGeneral = parseFloat(row.price_general)
  const priceStudent = parseFloat(row.price_student_uad)
  const priceEmployee = parseFloat(row.price_employee_uad)
  const quota = parseInt(row.quota, 10)

  if (!title) errors.push('Kolom "title" kosong.')
  if (!category) errors.push('Kolom "category" kosong.')
  if (isNaN(priceGeneral) || priceGeneral < 0) errors.push('Kolom "price_general" harus angka >= 0.')
  if (isNaN(priceStudent) || priceStudent < 0) errors.push('Kolom "price_student_uad" harus angka >= 0.')
  if (isNaN(priceEmployee) || priceEmployee < 0) errors.push('Kolom "price_employee_uad" harus angka >= 0.')
  if (isNaN(quota) || quota < 1) errors.push('Kolom "quota" harus angka bulat >= 1.')

  return { valid: errors.length === 0, errors }
}

/**
 * Konversi baris Excel ke object data training.
 * @param {object} row
 * @returns {object}
 */
function parseTrainingRow(row) {
  return {
    title:              (row.title || '').toString().trim(),
    category:           (row.category || '').toString().trim(),
    description:        row.description ? (row.description).toString().trim() || null : null,
    price_general:      parseFloat(row.price_general) || 0,
    price_student_uad:  parseFloat(row.price_student_uad) || 0,
    price_employee_uad: parseFloat(row.price_employee_uad) || 0,
    quota:              parseInt(row.quota, 10) || 30,
    start_date:         row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : null,
    category_order:     parseInt(row.category_order, 10) || 99,
    whatsapp_group_link:row.whatsapp_group_link ? (row.whatsapp_group_link).toString().trim() || null : null
  }
}

const Training = {

  /**
   * Ambil semua pelatihan dengan status 'active', diurutkan berdasarkan
   * tanggal mulai secara ascending.
   *
   * Postconditions:
   *   - Mengembalikan array of training objects (bisa kosong jika tidak ada yang aktif)
   *   - Tidak pernah mengembalikan null; selalu array
   *
   * Persyaratan: 1.1, 1.3
   */
  async findAll(filters = {}) {
    let query = `
      SELECT t.*,
             (SELECT COUNT(*) FROM registrations r
              WHERE r.training_id = t.id AND r.status != 'rejected') AS registered_count
      FROM trainings t
      WHERE 1=1
    `
    const params = []

    // Filter by status
    if (filters.status && filters.status !== 'all') {
      query += ' AND t.status = ?'
      params.push(filters.status)
    }

    // Filter by category
    if (filters.category && filters.category !== 'all') {
      query += ' AND t.category = ?'
      params.push(filters.category)
    }

    // Filter by search (title or category)
    if (filters.search) {
      query += ' AND (t.title LIKE ? OR t.category LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }

    // Filter by date range
    if (filters.start_date_from) {
      query += ' AND t.start_date >= ?'
      params.push(filters.start_date_from)
    }
    if (filters.start_date_to) {
      query += ' AND t.start_date <= ?'
      params.push(filters.start_date_to)
    }

    // Filter by completed/upcoming
    if (filters.time_filter === 'completed') {
      query += ' AND t.start_date < CURDATE()'
    } else if (filters.time_filter === 'upcoming') {
      query += ' AND t.start_date >= CURDATE()'
    }

    // Filter by quota status
    if (filters.quota_filter === 'full') {
      query += ' AND t.status = ?'
      params.push('full')
    } else if (filters.quota_filter === 'available') {
      // Show only trainings that have available slots (active and not full)
      query += ' AND t.status = ?'
      params.push('active')
      query += ' AND registered_count < t.quota'
    }

    query += ' ORDER BY t.start_date ASC, t.created_at DESC'

    const [rows] = await db.execute(query, params)
    return rows
  },

  async count() {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM trainings')
    return parseInt(rows[0]?.total || 0, 10)
  },

  /**
   * Ambil satu pelatihan berdasarkan slug.
   *
   * Preconditions:  slug adalah string non-kosong
   * Postconditions:
   *   - Mengembalikan objek training jika slug ditemukan
   *   - Mengembalikan null jika slug tidak ada di database
   *
   * Persyaratan: 1.4, 1.5
   */
  async findById(id) {
    const [rows] = await db.execute(
      `SELECT t.*,
              (SELECT COUNT(*) FROM registrations r
               WHERE r.training_id = t.id AND r.status != 'rejected') AS registered_count
       FROM trainings t
       WHERE t.id = ? LIMIT 1`,
      [id]
    )
    return rows[0] || null
  },

  async findBySlug(slug) {
    const [rows] = await db.execute(
      `SELECT t.*,
              (SELECT COUNT(*) FROM registrations r
               WHERE r.training_id = t.id AND r.status != 'rejected') AS registered_count,
              (SELECT is_free_tier FROM categories c
                WHERE c.name = t.category LIMIT 1) AS is_free_tier,
              (SELECT cert_available FROM categories c
                WHERE c.name = t.category LIMIT 1) AS cert_available,
              (SELECT lock_paid_option FROM categories c
                WHERE c.name = t.category LIMIT 1) AS lock_paid_option
       FROM trainings t
       WHERE t.slug = ? LIMIT 1`,
      [slug]
    )
    if (rows[0]) {
      rows[0].is_free_tier = rows[0].is_free_tier === 1
      // NULL (kategori tak dikenal / DB lama) → anggap paket tersedia,
      // agar perilaku kategori gratis lama tidak berubah.
      rows[0].cert_available = rows[0].cert_available !== 0
      // lock_paid_option: 1 = opsi berbayar DIKUNCI di level kategori;
      // cert_override per-training tak bisa re-aktifkan.
      // Set flag dulu agar di bawah kita skip cert_override bila lock=1.
      rows[0].lock_paid_option = rows[0].lock_paid_option === 1
      // cert_override (per training, di luar kategori):
      //   NULL = ikut default kategori (tidak mengubah perilaku lama)
      //   0    = "Tanpa e-Sertifikat": Rp 0 tidak termasuk e-sertifikat,
      //          tapi opsi Paket Lengkap (Rp certFee) tetap tersedia
      //   1    = "Dengan e-Sertifikat": Rp 0 sudah termasuk e-sertifikat,
      //          opsi Paket Lengkap (Rp certFee) tetap tersedia
      //   2    = "Full Free": Rp 0 untuk semua, TIDAK ada opsi Paket Lengkap
      //          (cert_available dipaksa false → form publik menyembunyikan
      //          blok radio "Jenis Pembayaran" dan resolveFinalPrice = 0).
      if (rows[0].lock_paid_option) {
        // Kunci kategori: cert_available dipaksa false, cert_override diabaikan
        rows[0].cert_available = false
      } else if (rows[0].cert_override === 1) {
        rows[0].cert_available = true
      } else if (rows[0].cert_override === 2) {
        rows[0].cert_available = false
      }
      // cert_override=0: tidak mengubah cert_available (opsi Rp 75.000 tetap ada),
      // hanya label "Rp 0" yang berbeda (tanpa e-sertifikat).
      // Biarkan cert_override tetap ada di object (untuk form admin)
      // tapi hilangkan nilai NULL untuk kebersihan view.
      if (rows[0].cert_override === null || rows[0].cert_override === undefined) {
        delete rows[0].cert_override
      }
    }
    return rows[0] || null
  },

  /**
   * Ambil N training aktif terbaru berdasarkan created_at DESC.
   *
   * Preconditions:  limit adalah integer positif
   * Postconditions:
   *   - Mengembalikan array dengan panjang maksimal `limit`
   *   - Tidak pernah mengembalikan null; selalu array
   *
   * Persyaratan: 1.4, 1.6
   */
  async findLatest(limit = 3) {
    const [rows] = await db.execute(
      `SELECT * FROM trainings WHERE status = 'active' ORDER BY created_at DESC LIMIT ?`,
      [limit]
    )
    return rows
  },

  /**
   * Ambil semua training untuk satu kategori (nama persis), status aktif.
   * Dipakai halaman /trainings/:anchor yang terpisah per kategori.
   * @param {string} categoryName
   * @returns {Promise<Array>} baris training; kosong bila tak ada
   */
  async findAllByCategory(categoryName) {
    const [rows] = await db.execute(
      `SELECT t.*,
              (SELECT COUNT(*) FROM registrations r
               WHERE r.training_id = t.id AND r.status != 'rejected') AS registered_count,
              (SELECT is_free_tier FROM categories c
                WHERE c.name = t.category LIMIT 1) AS is_free_tier,
              (SELECT cert_available FROM categories c
                WHERE c.name = t.category LIMIT 1) AS cert_available,
              (SELECT lock_paid_option FROM categories c
                WHERE c.name = t.category LIMIT 1) AS lock_paid_option
       FROM trainings t
       WHERE t.category = ? AND t.status != 'postpone'
       ORDER BY t.category_order ASC, t.start_date ASC`,
      [categoryName]
    )
    if (rows.length) {
      for (const row of rows) {
        row.is_free_tier = row.is_free_tier === 1
        row.cert_available = row.cert_available !== 0
        row.lock_paid_option = row.lock_paid_option === 1
        if (row.lock_paid_option) row.cert_available = false
      }
    }
    return rows
  },

  /**
   * Ambil semua training, dikelompokkan per kategori.
   * Hanya kategori yang statusnya 'aktif' di tabel `categories` yang
   * masuk ke hasil — sehingga kategori nonaktif otomatis disembunyikan
   * dari katalog publik.
   *
   * @returns {Promise<Array<{category, anchor, trainings[]}>>}
   */
  async findAllGrouped() {
    const [rows] = await db.execute(
      `SELECT t.*,
              (SELECT COUNT(*) FROM registrations r
               WHERE r.training_id = t.id AND r.status != 'rejected') AS registered_count,
              (SELECT is_free_tier FROM categories c
                WHERE c.name = t.category LIMIT 1) AS is_free_tier,
              (SELECT cert_available FROM categories c
                WHERE c.name = t.category LIMIT 1) AS cert_available,
              (SELECT lock_paid_option FROM categories c
                WHERE c.name = t.category LIMIT 1) AS lock_paid_option
       FROM trainings t
       WHERE t.category IN (SELECT name FROM categories WHERE status = 'aktif')
       ORDER BY t.category_order ASC, t.start_date ASC`
    )
    // Normalisasi field kategori di tiap row (sama pola dengan findBySlug)
    for (const row of rows) {
      row.is_free_tier = row.is_free_tier === 1
      row.cert_available = row.cert_available !== 0
      row.lock_paid_option = row.lock_paid_option === 1
      if (row.lock_paid_option) row.cert_available = false
    }
    const map = new Map()
    for (const row of rows) {
      if (!map.has(row.category)) {
        map.set(row.category, {
          category: row.category,
          anchor:   row.category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          trainings: []
        })
      }
      map.get(row.category).trainings.push(row)
    }
    return Array.from(map.values())
  },

  /**
   * Ambil daftar kategori aktif dari tabel `categories` beserta jumlah
   * training non-postpone per kategori.
   *
   * Kategori tetap tampil walau count-nya 0 (keputusan: kategori kosong
   * tetap ada di navbar & tab katalog). Anchor & is_free_tier diambil dari
   * tabel, bukan di-generate dari teks.
   *
   * Bentuk hasil konsisten dengan query lama ({category, anchor, count})
   * plus field baru is_free_tier, sehingga view (navbar, admin filter,
   * katalog) tetap memakai `item.category` tanpa perlu diubah.
   * @returns {Promise<Array<{category, anchor, count, is_free_tier}>>}
   */
  async findCategories() {
    const [rows] = await db.execute(
      `SELECT c.name      AS category,
              c.anchor,
              c.is_free_tier,
              c.cert_available,
              c.lock_paid_option,
              c.accent,
              c.icon,
              (SELECT COUNT(*) FROM trainings t
                WHERE t.category = c.name AND t.status != 'postpone') AS cnt
       FROM categories c
       WHERE c.status = 'aktif'
       ORDER BY c.sort_order ASC, c.name ASC`
    )
    return rows.map(r => {
      const lockPaid = r.lock_paid_option === 1
      return {
        category:     r.category,
        anchor:       r.anchor,
        count:        r.cnt,
        is_free_tier: r.is_free_tier === 1,
        // NULL (DB lama / kolom belum migrasi) → anggap paket tersedia,
        // sama dengan findBySlug — perilaku kategori gratis lama tak berubah.
        // cert_override per-training (0=null-pure free, 1=tetap ada paket)
        // di-hitung di subquery findBySlug; di sini hanya level kategori.
        cert_available: lockPaid ? false : r.cert_available !== 0,
        lock_paid_option: lockPaid,
        accent:       r.accent || 'blue',
        icon:         r.icon || ''
      }
    })
  },

  /**
   * Pindahkan semua training yang memakai `fromCategory` ke `toCategory`.
   * Dipakai saat admin menghapus kategori: training tak boleh dibiarkan
   * menunjuk kategori yang sudah tidak ada.
   * @returns {Promise<number>} jumlah baris yang diubah
   */
  async updateManyByCategory(fromCategory, toCategory) {
    const [result] = await db.execute(
      'UPDATE trainings SET category = ? WHERE category = ?',
      [toCategory, fromCategory]
    )
    return result.affectedRows
  },

  /**
   * Buat satu training baru (manual form).
   * @param {object} data - data training yang sudah diverifikasi
   * @returns {Promise<number>} id training yang dibuat
   */
  async create(data) {
    const [result] = await db.execute(
      `INSERT INTO trainings
        (title, slug, description, category, category_order,
         price_general, price_student_uad, price_employee_uad,
         quota, start_date, whatsapp_group_link, cover_image,
         exec_mode, fasilitas, training_document, cert_override, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        data.title, data.slug, data.description || null,
        data.category, data.category_order || 99,
        data.price_general || 0, data.price_student_uad || 0,
        data.price_employee_uad || 0, data.quota || 30,
        data.start_date || null, data.whatsapp_group_link || null,
        data.cover_image || null,
        data.exec_mode || 'offline', data.fasilitas || null,
        data.training_document || null,
        data.cert_override ?? null
      ]
    )
    return result.insertId
  },

  /**
   * Import banyak training dari array baris Excel.
   * Setiap baris divalidasi, slug di-generate unik, dan disisipkan satu per satu.
   * @param {Array<object>} rows - array baris parsed (sudah lewat parseTrainingRow)
   * @returns {Promise<{created: number, skipped: number, errors: Array<{row: number, errors: string[]}>}>}
   */
  async bulkCreate(rows) {
    const results = { created: 0, skipped: 0, errors: [] }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const validation = validateTrainingRow(row)
      if (!validation.valid) {
        results.skipped++
        results.errors.push({ row: i + 2, errors: validation.errors })
        continue
      }
      try {
        const parsed = parseTrainingRow(row)
        const baseSlug = slugify(parsed.title, { lower: true, strict: true })
        let finalSlug = baseSlug
        let counter = 1
        while (true) {
          const [existing] = await db.execute(
            'SELECT id FROM trainings WHERE slug = ? LIMIT 1', [finalSlug]
          )
          if (existing.length === 0) break
          finalSlug = `${baseSlug}-${counter}`
          counter++
        }
        await db.execute(
          `INSERT INTO trainings
            (title, slug, description, category, category_order,
             price_general, price_student_uad, price_employee_uad,
             quota, start_date, whatsapp_group_link, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            parsed.title, finalSlug, parsed.description, parsed.category,
            parsed.category_order, parsed.price_general, parsed.price_student_uad,
            parsed.price_employee_uad, parsed.quota, parsed.start_date,
            parsed.whatsapp_group_link
          ]
        )
        results.created++
      } catch (err) {
        results.skipped++
        results.errors.push({ row: i + 2, errors: [err.message] })
      }
    }
    return results
  },

  /**
   * Update semua field training berdasarkan id.
   * Hanya menerima field yang diketahui aman untuk di-update.
   */
  async update(id, data) {
    const allowedFields = [
      'title', 'slug', 'description', 'category', 'category_order',
      'price_general', 'price_student_uad', 'price_employee_uad',
      'quota', 'start_date', 'status', 'whatsapp_group_link', 'cover_image',
      'exec_mode', 'fasilitas', 'training_document', 'cert_override'
    ]
    // Kolom nullable — boleh di-set ke NULL (menghapus isi, mis. hapus fasilitas).
    // Kolom wajib: null = tidak diubah; undefined = tidak dikirim.
    const nullableFields = new Set(['description', 'start_date', 'whatsapp_group_link',
      'cover_image', 'exec_mode', 'fasilitas', 'training_document', 'cert_override'])
    const sets = []
    const values = []
    for (const key of allowedFields) {
      if (data[key] === undefined) continue
      if (data[key] === null && nullableFields.has(key)) {
        // eksplisit hapus isi → SET key = NULL
        sets.push(`${key} = ?`)
        values.push(null)
      } else if (data[key] !== null) {
        sets.push(`${key} = ?`)
        values.push(data[key])
      }
    }
    if (sets.length === 0) return 0
    values.push(id)
    const [result] = await db.execute(
      `UPDATE trainings SET ${sets.join(', ')} WHERE id = ?`,
      values
    )
    return result.affectedRows
  }
}

module.exports = Training
module.exports.validateTrainingRow = validateTrainingRow
module.exports.parseTrainingRow = parseTrainingRow
