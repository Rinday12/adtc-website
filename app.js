// Muat .env spesifik environment (development atau production)
// Jangan load .env default dulu agar tidak override NODE_ENV dari cPanel
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
try { require('dotenv').config({ path: envFile, override: true }) } catch (_) {}
const express = require('express')
const session = require('express-session')
const flash = require('connect-flash')
const path = require('path')

const Training     = require('./models/Training')
const publicRoutes = require('./routes/publicRoutes')
const adminRoutes = require('./routes/adminRoutes')

const app = express()
const PORT = process.env.PORT || 3000

// View Engine
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Middleware Global
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'adtc-dev-secret-key-minimum-32-chars',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 jam
}))

// Flash Messages
app.use(flash())
app.use((req, res, next) => {
  res.locals.success_msg  = req.flash('success')
  res.locals.error_msg    = req.flash('error')
  res.locals.adminUser    = req.session.adminId || null
  res.locals.currentPath  = req.path
  // Footer: panel admin memakai footer simple, halaman publik memakai footer lengkap
  res.locals.footer       = req.path.startsWith('/admin') ? 'admin' : 'user'
  // Nomor WA admin untuk tombol floating
  res.locals.waAdmins = [
    { number: process.env.WHATSAPP_ADMIN_1_NUMBER, name: process.env.WHATSAPP_ADMIN_1_NAME || 'Admin 1' },
    { number: process.env.WHATSAPP_ADMIN_2_NUMBER, name: process.env.WHATSAPP_ADMIN_2_NAME || 'Admin 2' },
  ].filter(a => a.number && a.number.trim() !== '')
  // Backward compat (dipakai footer kolom kontak)
  res.locals.waNumber = (process.env.WHATSAPP_ADMIN_1_NUMBER || process.env.WHATSAPP_ADMIN_2_NUMBER || '')
  next()
})

// Middleware: load kategori training untuk navbar dropdown (semua halaman publik)
app.use(async (req, res, next) => {
  try {
    if (!req.path.startsWith('/admin')) {
      res.locals.navCategories = await Training.findCategories()
    } else {
      res.locals.navCategories = []
    }
  } catch (_) {
    res.locals.navCategories = []
  }
  next()
})

// Routes
app.use('/', publicRoutes)
app.use('/admin', adminRoutes)

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Halaman tidak ditemukan', code: 404 })
})

// 500 Handler
app.use((err, req, res, next) => {
  console.error('[500]', new Date().toISOString(), req.method, req.originalUrl, err.stack || err)
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
  res.status(500).render('error', {
    message: 'Terjadi kesalahan server',
    code: 500,
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

app.listen(PORT, () => {
  console.log(`Server ADTC berjalan di http://localhost:${PORT}`)
})

module.exports = app
