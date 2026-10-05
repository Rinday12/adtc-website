// Muat .env spesifik environment (development atau production)
// Jika NODE_ENV tidak di-set (misal di cPanel Passenger), fallback ke .env.production
const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env.production'
try { require('dotenv').config({ path: envFile, override: true }) } catch (_) {}
const express = require('express')
const session = require('express-session')
const flash = require('connect-flash')
const path = require('path')

const Training     = require('./models/Training')
const publicRoutes = require('./routes/publicRoutes')
const adminRoutes = require('./routes/adminRoutes')
const News         = require('./models/News')
const { metaTags } = require('./utils/seo')

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
      console.log('[MW] Categories loaded:', res.locals.navCategories?.length || 0)
    } else {
      res.locals.navCategories = []
    }
  } catch (err) {
    console.error('[MW] Categories load failed:', err.message)
    res.locals.navCategories = []
  }
  next()
})

// SEO: set res.locals.seoTags sebelum render, mengambil title/metaDescription
// dari opsi render (dipakai layout/header publik).
app.use((req, res, next) => {
  const origRender = res.render.bind(res)
  res.render = (view, opts, fn) => {
    if (typeof opts === 'function') { fn = opts; opts = {} }
    if (!req.path.startsWith('/admin')) {
      res.locals.seoTags = metaTags({
        title: opts.title,
        description: opts.metaDescription,
        url: req.path
      })
    }
    return origRender(view, opts, fn)
  }
  next()
})

// Routes
app.use('/', publicRoutes)
app.use('/admin', adminRoutes)

// Sitemap dinamis (untuk mesin pencari)
app.get('/sitemap.xml', async (req, res) => {
  try {
    const base = process.env.BASE_URL || 'https://adtcuad.id'
    const [trainings, news] = await Promise.all([
      Training.findAll(),
      News.findAll()
    ])

    const staticUrls = [
      { loc: base + '/', priority: '1.0' },
      { loc: base + '/trainings', priority: '0.9' },
      { loc: base + '/berita', priority: '0.8' },
      { loc: base + '/sertifikat', priority: '0.5' }
    ]

    const dynamicUrls = []
    if (Array.isArray(trainings)) {
      trainings.forEach(t => {
        if (t && t.slug) dynamicUrls.push({ loc: `${base}/trainings/${t.slug}`, priority: '0.7', changefreq: 'weekly', lastmod: t.updated_at })
      })
    }
    if (Array.isArray(news)) {
      news.forEach(n => {
        if (n && n.slug) dynamicUrls.push({ loc: `${base}/berita/${n.slug}`, priority: '0.6', changefreq: 'monthly', lastmod: n.published_at })
      })
    }

    const all = [...staticUrls, ...dynamicUrls]
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `<url>
  <loc>${u.loc}</loc>${u.lastmod ? `\n  <lastmod>${new Date(u.lastmod).toISOString().split('T')[0]}</lastmod>` : ''}${u.changefreq ? `\n  <changefreq>${u.changefreq}</changefreq>` : ''}${u.priority ? `\n  <priority>${u.priority}</priority>` : ''}
</url>`).join('\n')}
</urlset>`

    res.set('Content-Type', 'application/xml')
    res.send(xml)
  } catch (err) {
    console.error('[sitemap] Gagal generate:', err.message)
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>')
  }
})

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
