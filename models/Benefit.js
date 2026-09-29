// models/Benefit.js
// Model untuk entitas benefit/keunggulan ADTC.
// Mengabstraksi query database agar Controller tidak perlu mengetahui detail SQL.
//
// Semua query menggunakan parameterized statement (prepared statement)
// untuk mencegah SQL injection (Persyaratan 8.6).

const db = require('../config/db')

const Benefit = {

  /**
   * Ambil semua benefit dengan status 'aktif'.
   * Digunakan di halaman Beranda publik.
   *
   * Postconditions:
   *   - Mengembalikan array of benefit objects (bisa kosong)
   *   - Setiap objek yang dikembalikan memiliki status === 'aktif'
   *
   * Persyaratan: 2.2, 2.4
   */
  async findAllActive() {
    const [rows] = await db.execute(
      "SELECT * FROM benefits WHERE status = 'aktif' ORDER BY created_at ASC"
    )
    return rows
  },

  /**
   * Ambil semua benefit (aktif dan nonaktif).
   * Digunakan di dashboard admin.
   *
   * Postconditions:
   *   - Mengembalikan array of benefit objects (bisa kosong)
   *
   * Persyaratan: 7.1
   */
  async findAll() {
    const [rows] = await db.execute(
      'SELECT * FROM benefits ORDER BY created_at ASC'
    )
    return rows
  },

  /**
   * Ambil satu benefit berdasarkan ID.
   *
   * Preconditions:  id adalah integer positif
   * Postconditions:
   *   - Mengembalikan objek benefit jika ID ditemukan
   *   - Mengembalikan null jika ID tidak ada di database
   *
   * Persyaratan: 7.3, 7.5
   */
  async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM benefits WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] || null
  },

  /**
   * Simpan benefit baru ke database dengan status default 'aktif'.
   *
   * Preconditions:
   *   - data.title tidak kosong setelah trim
   *   - data.description tidak kosong setelah trim
   *
   * Postconditions:
   *   - Mengembalikan insertId dari baris yang baru dibuat
   *   - Benefit tersimpan dengan status 'aktif'
   *
   * Persyaratan: 7.3, 8.2, 8.3
   */
  async create(data) {
    const { title, description } = data
    const [result] = await db.execute(
      'INSERT INTO benefits (title, description) VALUES (?, ?)',
      [title, description]
    )
    return result.insertId
  },

  /**
   * Perbarui data benefit berdasarkan ID.
   *
   * Preconditions:
   *   - data.status harus 'aktif' atau 'nonaktif'
   *   - data.title tidak kosong setelah trim
   *   - data.description tidak kosong setelah trim
   *
   * Postconditions:
   *   - Mengembalikan affectedRows (0 jika ID tidak ditemukan, 1 jika berhasil)
   *
   * Persyaratan: 7.5, 8.2, 8.3
   */
  async update(id, data) {
    const { title, description, status } = data
    const [result] = await db.execute(
      'UPDATE benefits SET title = ?, description = ?, status = ? WHERE id = ?',
      [title, description, status, id]
    )
    return result.affectedRows
  },

  /**
   * Hapus benefit berdasarkan ID (hard delete).
   *
   * Preconditions:  id adalah integer positif
   * Postconditions:
   *   - Mengembalikan affectedRows (0 jika ID tidak ditemukan, 1 jika berhasil)
   *
   * Persyaratan: 7.6, 8.3
   */
  async delete(id) {
    const [result] = await db.execute(
      'DELETE FROM benefits WHERE id = ?',
      [id]
    )
    return result.affectedRows
  }

}

module.exports = Benefit
