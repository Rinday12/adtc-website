// config/db.js
// Modul koneksi database MySQL menggunakan connection pool mysql2.
//
// Preconditions:
//   - Environment variables DB_HOST, DB_USER, DB_PASSWORD, DB_NAME harus terdefinisi
//   - MySQL server harus dapat dijangkau pada host:port yang ditentukan
//
// Postconditions:
//   - Mengembalikan promise pool yang siap digunakan dengan async/await
//   - Pool mengelola hingga 10 koneksi secara bersamaan (connectionLimit: 10)

const mysql = require('mysql2')

// Validasi environment variables wajib sebelum membuat pool.
// Aplikasi dihentikan lebih awal agar tidak melayani request tanpa koneksi DB.
const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME']
const missingVars = requiredVars.filter((v) => !process.env[v])

if (missingVars.length > 0) {
  console.error(
    `[FATAL] Environment variables database tidak terdefinisi: ${missingVars.join(', ')}. ` +
    'Pastikan file .env sudah dikonfigurasi dengan benar.'
  )
  process.exit(1)
}

/**
 * Connection Pool MySQL menggunakan mysql2.
 * Menggunakan pool (bukan single connection) untuk concurrency yang lebih baik.
 *
 * Konfigurasi dibaca dari environment variables:
 *   DB_HOST     - hostname MySQL server (default: 'localhost')
 *   DB_PORT     - port MySQL server (default: 3306)
 *   DB_USER     - username MySQL
 *   DB_PASSWORD - password MySQL
 *   DB_NAME     - nama database
 */
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT, 10) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0
})

// Ekspor sebagai promise pool agar semua operasi mendukung async/await.
// Kredensial tidak di-ekspos pada event error; pesan error bersifat generik.
const promisePool = pool.promise()

pool.on('error', (err) => {
  // Log error tanpa mengekspos kredensial (host, user, password)
  console.error('[DB] Koneksi database mengalami error:', err.code || 'UNKNOWN_ERROR')
})

module.exports = promisePool
