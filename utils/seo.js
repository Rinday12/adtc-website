// utils/seo.js
// Helper metadata SEO untuk halaman publik: canonical, Open Graph, dan meta description.
// Dipakai di layout/header publik (views/layout/header.ejs) agar satu sumber.

const BASE = process.env.BASE_URL || 'https://adtcuad.id'

const DEFAULTS = {
  description: 'ADTC — Ahmad Dahlan Training Center, penyelenggara pelatihan profesional di Yogyakarta. Daftar program sertifikasi dan pelatihan kerja terbaru.',
  siteName: 'ADTC — Ahmad Dahlan Training Center',
  twitter: '@adtcuad'
}

function metaTags(opts) {
  const {
    title,
    description = DEFAULTS.description,
    url = '',
    image = `${BASE}/images/logo/adtc-icon.svg`,
    type = 'website'
  } = opts || {}

  const canonical = url ? `${BASE}${url}` : BASE
  const fullTitle = title || 'ADTC — Ahmad Dahlan Training Center'

  return `
  <!-- SEO / Metadata -->
  <meta name="description" content="${description.replace(/"/g, '&quot;')}" />
  <link rel="canonical" href="${canonical}" />

  <!-- Open Graph (preview saat link dibagikan) -->
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="${DEFAULTS.siteName}" />
  <meta property="og:title" content="${fullTitle}" />
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${image}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:site" content="${DEFAULTS.twitter}" />
  <meta name="twitter:title" content="${fullTitle}" />
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
`
}

module.exports = { metaTags, BASE }
