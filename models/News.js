// models/News.js
// Model untuk entitas berita (News).
// Mengabstraksi query database agar Controller tidak perlu mengetahui detail SQL.
//
// Semua query menggunakan parameterized statement (prepared statement)
// untuk mencegah SQL injection (Persyaratan 8.3, 8.5).

const db = require('../config/db')

const News = {

  /**
   * Ambil semua berita diurutkan berdasarkan published_at DESC, created_at DESC.
   *
   * Postconditions:
   *   - Mengembalikan array of news objects (bisa kosong)
   *   - Tidak pernah mengembalikan null; selalu array
   *
   * Persyaratan: 3.1, 3.3
   */
  async findAll() {
    const [rows] = await db.execute(
      'SELECT * FROM news ORDER BY published_at DESC, created_at DESC'
    )
    return rows
  },

  /**
   * Ambil satu berita berdasarkan slug.
   *
   * Preconditions:  slug adalah string non-kosong
   * Postconditions:
   *   - Mengembalikan objek news jika slug ditemukan
   *   - Mengembalikan null jika slug tidak ada di database
   *
   * Persyaratan: 4.1, 8.1, 8.5
   */
  async findBySlug(slug) {
    const [rows] = await db.execute(
      'SELECT * FROM news WHERE slug = ? LIMIT 1',
      [slug]
    )
    return rows[0] || null
  },

  /**
   * Ambil satu berita berdasarkan ID.
   *
   * Postconditions:
   *   - Mengembalikan objek news jika ID ditemukan
   *   - Mengembalikan null jika ID tidak ada di database
   *
   * Persyaratan: 5.1, 5.5, 8.3, 8.5
   */
  async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM news WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] || null
  },

  /**
   * Simpan berita baru ke database.
   *
   * Preconditions:
   *   - data.title, data.slug, data.content, data.published_at tidak kosong
   *   - data.slug sudah dipastikan unik oleh controller
   *
   * Postconditions:
   *   - Mengembalikan insertId dari baris yang baru dibuat
   *
   * Persyaratan: 5.3, 8.1, 8.5
   */
  async create(data) {
    const { title, slug, content, image_path, published_at } = data
    const [result] = await db.execute(
      `INSERT INTO news (title, slug, content, image_path, published_at)
       VALUES (?, ?, ?, ?, ?)`,
      [title, slug, content, image_path || null, published_at]
    )
    return result.insertId
  },

  /**
   * Perbarui data berita berdasarkan ID.
   *
   * Postconditions:
   *   - Mengembalikan affectedRows (0 jika ID tidak ditemukan, 1 jika berhasil)
   *
   * Persyaratan: 5.5, 8.3, 8.5
   */
  async update(id, data) {
    const { title, slug, content, image_path, published_at } = data
    const [result] = await db.execute(
      `UPDATE news SET title = ?, slug = ?, content = ?,
       image_path = ?, published_at = ? WHERE id = ?`,
      [title, slug, content, image_path ?? null, published_at, id]
    )
    return result.affectedRows
  },

  /**
   * Hapus berita berdasarkan ID (hard delete).
   *
   * Postconditions:
   *   - Mengembalikan affectedRows (0 jika ID tidak ditemukan, 1 jika berhasil)
   *
   * Persyaratan: 5.6, 8.5
   */
  async delete(id) {
    const [result] = await db.execute(
      'DELETE FROM news WHERE id = ?',
      [id]
    )
    return result.affectedRows
  }

}

module.exports = News
