// utils/seo.js
// Helper metadata SEO untuk halaman publik: canonical, Open Graph,
// JSON-LD (schema.org), dan meta description.
// Dipakai di layout/header publik (views/layout/header.ejs) agar satu sumber.

const BASE = process.env.BASE_URL || 'https://adtcuad.id'

// Keyword yang ingin diindeks mesin pencari — dipakai di meta description
// beranda & JSON-LD agar Google melihat situs ini relevan untuk pencarian
// "Pelatihan UAD", "BNSP", "Pelatihan K3", dll.
const KEYWORDS = [
  'Pelatihan UAD',
  'Pelatihan BNSP',
  'Pelatihan K3',
  'Pelatihan Sertifikasi Yogyakarta',
  'Sertifikasi BNSP Yogyakarta',
  'Pelatihan Kerja Ahmad Dahlan'
].join(', ')

const DEFAULTS = {
  description:
    'ADTC — Ahmad Dahlan Training Center UAD, penyelenggara ' +
    'Pelatihan UAD dan Pelatihan K3 berlisensi, sertifikasi ' +
    'BNSP untuk tenaga kerja profesional di Yogyakarta.',
  siteName: 'ADTC — Ahmad Dahlan Training Center',
  twitter: '@adtcuad',
  ogImage: '/images/logo/adtc-og-image.png'
}

function jsonLd(opts) {
  const { title = 'Beranda | ADTC', description = DEFAULTS.description, url = '' } = opts || {}
  const canonical = url ? `${BASE}${url}` : BASE
  const payload = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${BASE}/#website`,
        url: BASE,
        name: DEFAULTS.siteName,
        description
      },
      {
        '@type': 'Organization',
        '@id': `${BASE}/#org`,
        name: 'Ahmad Dahlan Training Center',
        url: BASE,
        logo: `${BASE}/images/logo/adtc-logo.svg`,
        image: `${BASE}${DEFAULTS.ogImage}`,
        sameAs: ['https://www.instagram.com/adtc_uad']
      },
      {
        '@type': 'WebPage',
        '@id': canonical,
        url: canonical,
        name: title,
        description,
        isPartOf: { '@id': `${BASE}/#website` },
        about: { '@id': `${BASE}/#org` }
      }
    ]
  }
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`
}

function metaTags(opts) {
  const {
    title,
    description = DEFAULTS.description,
    url = '',
    image = DEFAULTS.ogImage,
    type = 'website'
  } = opts || {}

  const canonical = url ? `${BASE}${url}` : BASE
  const fullTitle = title || 'ADTC — Ahmad Dahlan Training Center'

  return `
  <!-- SEO / Metadata -->
  <meta name="description" content="${description.replace(/"/g, '&quot;')}" />
  <meta name="keywords" content="${KEYWORDS}" />
  <link rel="canonical" href="${canonical}" />

  <!-- Favicon (logo muncul di tab browser & hasil pencarian) -->
  <link rel="icon" type="image/png" sizes="16x16" href="/images/logo/favicon-16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/images/logo/favicon-32x32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/images/logo/favicon-180x180.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/images/logo/favicon-192x192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/images/logo/favicon-512x512.png" />

  <!-- Open Graph (preview saat link dibagikan) -->
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="${DEFAULTS.siteName}" />
  <meta property="og:title" content="${fullTitle}" />
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${BASE}${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${DEFAULTS.siteName}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="${DEFAULTS.twitter}" />
  <meta name="twitter:title" content="${fullTitle}" />
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
  <meta name="twitter:image" content="${BASE}${image}" />

  ${jsonLd({ title: fullTitle, description, url })}
`
}

module.exports = { metaTags, jsonLd, BASE, KEYWORDS, DEFAULTS }
