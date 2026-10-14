// scripts/add-exec-mode.js
// Jalankan sekali: node scripts/add-exec-mode.js
// Menambah kolom exec_mode + fasilitas ke tabel trainings bila belum ada.

require('dotenv').config()
const mysql = require('mysql2')

const conn = mysql.createConnection({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
})
const pc = conn.promise()

;(async () => {
  const [cols] = await pc.query('SHOW COLUMNS FROM trainings')
  const names = cols.map((c) => c.Field)

  if (!names.includes('exec_mode')) {
    await pc.query("ALTER TABLE trainings ADD COLUMN exec_mode ENUM('online','offline') NOT NULL DEFAULT 'offline' AFTER status")
    console.log('ALTER exec_mode OK')
  } else console.log('exec_mode sudah ada')

  if (!names.includes('fasilitas')) {
    await pc.query('ALTER TABLE trainings ADD COLUMN fasilitas TEXT NULL AFTER exec_mode')
    console.log('ALTER fasilitas OK')
  } else console.log('fasilitas sudah ada')

  const [c] = await pc.query('SHOW COLUMNS FROM trainings')
  c.filter((x) => ['exec_mode', 'fasilitas'].includes(x.Field))
   .forEach((x) => console.log(x.Field, x.Type, 'null:', x.Null, 'default:', x.Default))

  await pc.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
