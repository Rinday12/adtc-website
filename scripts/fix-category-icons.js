// scripts/fix-category-icons.js
// Jalankan: node scripts/fix-category-icons.js
// Memperbaiki emoji kategori yang tercorrupt sebagai '?' (latin1 → utf8mb4).
//
// Teknik: emoji ditulis sebagai UNHEX('F09F939A') — bukan string literal.
// Ini melewati semua negosiasi charset antar client/server: byte raw yang
// diputar jadi utf8mb4, tanpa bergantung SET NAMES.

const path = require('path')

// Muat .env sesuai environment
const envFile = process.env.NODE_ENV === 'development'
  ? '.env.development'
  : '.env.production'
try { require('dotenv').config({ path: path.join(__dirname, '..', envFile), override: true }) } catch (_) {}

const mysql = require('mysql2/promise')

const DB_HOST     = process.env.DB_HOST     || 'localhost'
const DB_USER     = process.env.DB_USER     || ''
const DB_PASSWORD = process.env.DB_PASSWORD || ''
const DB_NAME     = process.env.DB_NAME     || 'adtcuadi_adtc_app'
const DB_PORT     = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined

// Helper: convert UTF-8 character to UNHEX() SQL expression
function unhex(ch) {
  const buf = Buffer.from(ch, 'utf8')
  const hex = buf.toString('hex').toUpperCase()
  return `UNHEX('${hex}')`
}

const ICON_MAP = [
  { anchor: 'pelatihan',              icon: '📚', accent: 'blue'   },
  { anchor: 'konsultan',             icon: '💼', accent: 'navy'   },
  { anchor: 'in-house-training',     icon: '🏭', accent: 'teal'   },
  { anchor: 'pelatihan-gratis',      icon: '🎁', accent: 'green'  },
  { anchor: 'bnsp',                  icon: '🏅', accent: 'blue'   },
  { anchor: 'awareness-lingkungan',  icon: '🌱', accent: 'teal'   },
  { anchor: 'awareness-umum',        icon: '📣', accent: 'blue'   },
  { anchor: 'data-analyst',          icon: '🌐', accent: 'navy'   },
  { anchor: 'data-scientist',        icon: '🤖', accent: 'purple' },
  { anchor: 'web-developer',         icon: '💻', accent: 'purple' },
  { anchor: 'social-media-marketing',icon: '📱', accent: 'green'  },
]
const FALLBACK = { icon: '📋', accent: 'blue' }

async function main() {
  // Koneksi dengan charset utf8mb4 + SET NAMES untuk pembacaan.
  // Penulisan memakai UNHEX() sehingga tidak bergantung charset client.
  const db = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    charset: 'utf8mb4',
  })

  // 1. Update emoji per anchor via UNHEX()
  for (const row of ICON_MAP) {
    const [result] = await db.query(
      `UPDATE categories SET icon = ${unhex(row.icon)}, accent = ? WHERE anchor = ?`,
      [row.accent, row.anchor],
    )
    if (result.affectedRows > 0) {
      console.log(`  ✅ ${row.anchor}: ${row.icon}`)
    }
  }

  // 2. Kategori tersisa (icon = '?' / '???' / kosong) → fallback
  const [remaining] = await db.query(
    "SELECT id, anchor, name FROM categories WHERE icon IN ('?', '???', '????', '')",
  )
  for (const r of remaining) {
    const [result] = await db.query(
      `UPDATE categories SET icon = ${unhex(FALLBACK.icon)}, accent = ? WHERE id = ?`,
      [FALLBACK.accent, r.id],
    )
    if (result.affectedRows > 0) {
      console.log(`  📋 ${r.anchor || '(tanpa anchor)'} → ${FALLBACK.icon}`)
    }
  }

  // 3. Verifikasi
  const [rows] = await db.query(
    'SELECT anchor, name, icon, HEX(icon) AS hex FROM categories ORDER BY sort_order'
  )
  console.log('\nHasil verifikasi:')
  console.table(rows.map(r => ({
    anchor: r.anchor,
    nama: r.name,
    icon: r.icon,
    hex: r.hex,
    status: r.hex.startsWith('F0') ? '✅ OK' : '❌ CORRUPT',
  })))

  await db.end()
  console.log('\nSelesai. Jalankan: pm2 restart adtc-app')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
