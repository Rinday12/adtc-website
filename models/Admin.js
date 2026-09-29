// models/Admin.js
// Model untuk entitas Admin — abstraksi query ke tabel `admins`.
//
// Digunakan oleh adminController untuk proses autentikasi login.

const db = require('../config/db')

const Admin = {

  /**
   * Cari admin berdasarkan username untuk proses login.
   *
   * Preconditions:
   *   - username adalah string non-kosong
   *
   * Postconditions:
   *   - Mengembalikan objek admin (termasuk password_hash) jika ditemukan
   *   - Mengembalikan null jika username tidak ada di database
   *
   * Keamanan:
   *   - Menggunakan parameterized query untuk mencegah SQL injection (Req 8.6)
   *   - Tidak memfilter kolom — controller bertanggung jawab tidak mengekspos
   *     password_hash ke layer view
   */
  async findByUsername(username) {
    const [rows] = await db.execute(
      'SELECT * FROM admins WHERE username = ? LIMIT 1',
      [username]
    )
    return rows[0] || null
  }

}

module.exports = Admin
