// scripts/seed-admin.js
// Script untuk membuat admin awal pada tabel `admins`.
//
// Penggunaan:
//   node scripts/seed-admin.js <username> <password>
//   ADMIN_USERNAME=admin ADMIN_PASSWORD=secret node scripts/seed-admin.js
//
// Argumen CLI lebih diutamakan daripada environment variables.

'use strict'

require('dotenv').config()

const bcrypt = require('bcrypt')
const db = require('../config/db')

/**
 * Extracted core seeding logic for testability.
 * Creates admin user via bcrypt hash + parameterized INSERT.
 *
 * @param {object}  deps       - Injection point for testing
 * @param {string}  deps.username     - Admin username
 * @param {string}  deps.password     - Admin plain-text password
 * @param {function} deps.bcryptHash  - bcrypt.hash (mockable in tests)
 * @param {function} deps.dbExecute   - db.execute (mockable in tests)
 * @param {function} deps.onSuccess   - Callback on success
 * @param {function} deps.onError     - Callback on error
 *
 * @returns {Promise<void>}
 */
async function seedAdmin ({
  username,
  password,
  bcryptHash = bcrypt.hash,
  dbExecute = db.execute,
  onSuccess = () => process.exit(0),
  onError = (msg) => { console.error(msg); process.exit(1) }
} = {}) {
  try {
    // Hash password dengan bcrypt, salt rounds = 10 (persyaratan 6.8)
    const passwordHash = await bcryptHash(password, 10)

    // Insert menggunakan parameterized query untuk mencegah SQL injection
    await dbExecute(
      'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    )

    // Jangan tampilkan password atau hash ke console
    onSuccess()
  } catch (err) {
    // Tangani duplicate key error (MySQL error code 1062)
    if (err.code === 'ER_DUP_ENTRY') {
      onError(`Error: Username '${username}' sudah ada di database. Gunakan username yang berbeda.`)
    } else {
      // Error lain — tampilkan kode error tanpa mengekspos kredensial DB
      onError(`Error: Gagal membuat admin. (${err.code || 'UNKNOWN_ERROR'})`)
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

const cliUsername = process.argv[2] || process.env.ADMIN_USERNAME
const cliPassword = process.argv[3] || process.env.ADMIN_PASSWORD

if (!cliUsername || !cliPassword) {
  console.error('Error: Username dan password wajib diisi.')
  console.error('')
  console.error('Penggunaan:')
  console.error('  node scripts/seed-admin.js <username> <password>')
  console.error('')
  console.error('Atau gunakan environment variables:')
  console.error('  ADMIN_USERNAME=<username> ADMIN_PASSWORD=<password> node scripts/seed-admin.js')
  process.exit(1)
}

// Run seeding only when executed directly (not when required by tests)
if (require.main === module) {
  seedAdmin({ username: cliUsername, password: cliPassword })
}

module.exports = { seedAdmin }
