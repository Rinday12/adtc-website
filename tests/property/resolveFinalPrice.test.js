// tests/property/resolveFinalPrice.test.js
// Uji logika penentuan total tagihan peserta (controllers/registrationController.js):
//   - kategori berbayar  → harga sesuai kategori (promo bisa menimpa bila lebih murah)
//   - kategori gratis    → pilihan "gratis" (=0) / "dengan sertifikat" (= CERT_FEE)
//                          dan CERT_FEE itu sendiri bisa dipromo (Opsi A, Fix #61)
//
// Logika di-inline di sini (meniru pola calculateFinalPrice.test.js) agar tidak
// menarik import model → database saat test.

const fc = require('fast-check')

function calculateFinalPrice(category, training, promo) {
  if (!training) return 0
  const priceMap = {
    'umum':          training.price_general,
    'mahasiswa_uad': training.price_student_uad,
    'karyawan_uad':  training.price_employee_uad
  }
  const raw = priceMap[category] ?? training.price_general
  const normalPrice = Number(raw)
  const normal = isNaN(normalPrice) ? 0 : normalPrice

  if (promo && promo.is_active) {
    const p = effectivePromoPrice(promo, training)
    if (p != null && p < normal) return p
  }
  return normal
}

// Salinan effectivePromoPrice dari controller (period + byTraining + global).
function effectivePromoPrice(promo, training) {
  if (!promo || !promo.is_active) return null
  const byTrainingPrice = promo.byTraining && promo.byTraining[training.id] != null
    ? Number(promo.byTraining[training.id])
    : null
  const promoPrice = byTrainingPrice != null ? byTrainingPrice : Number(promo.promo_price)
  if (isNaN(promoPrice)) return null
  const now = Date.now()
  const starts = promo.promo_starts_at ? new Date(promo.promo_starts_at).getTime() : null
  const ends = promo.promo_ends_at ? new Date(promo.promo_ends_at).getTime() : null
  const withinWindow =
    (starts === null || now >= starts) &&
    (ends === null || now <= ends)
  if (!withinWindow) return null
  return promoPrice
}

function resolveFinalPrice(training, body, certFee, promo) {
  if (training && training.is_free_tier) {
    // Kategori gratis murni (cert_available false/0) → selalu 0.
    if (training.cert_available === false || training.cert_available === 0) {
      return 0
    }
    if (body && body.payment_option === 'sertifikat') {
      const fee = Number(certFee)
      const base = isNaN(fee) || fee < 0 ? 0 : fee
      // Opsi A: kategori gratis + sertifikat boleh dipromo → min(CERT_FEE, promo)
      const p = effectivePromoPrice(promo, training)
      if (p != null && p < base) return p
      return base
    }
    return 0
  }
  return calculateFinalPrice(body?.category, training, promo)
}

describe('Property Tests: resolveFinalPrice', () => {
  /**
   * KATEGORI BERBAYAR: hasil selalu identik dengan harga kategori
   * (pilihan pembayaran diabaikan — tidak relevan untuk non-gratis).
   */
  test('berbayar → harga sesuai kategori, pilihan pembayaran diabaikan', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general:     fc.integer({ min: 100000, max: 10000000 }),
          price_student_uad: fc.integer({ min: 100000, max: 10000000 }),
          price_employee_uad:fc.integer({ min: 100000, max: 10000000 }),
          is_free_tier:      fc.constant(false)
        }),
        fc.constantFrom('gratis', 'sertifikat', undefined),
        fc.integer({ min: 1, max: 200000 }),
        (category, training, paymentOption, certFee) => {
          const body = { category }
          if (paymentOption !== undefined) body.payment_option = paymentOption

          const result = resolveFinalPrice(training, body, certFee)

          // Harusnya sama persis dengan harga kategori
          expect(result).toBe(calculateFinalPrice(category, training))
          expect(result).toBeGreaterThan(0)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * KATEGORI GRATIS: hasil hanya bergantung pada pilihan pembayaran & CERT_FEE.
   * - "gratis" / tak diisi  → 0
   * - "sertifikat"           → CERT_FEE
   * Harga kategori diabaikan.
   */
  test('gratis "gratis"/kosong → 0 (termasuk jika kategori punya harga)', () => {
    fc.assert(
      fc.property(
        // Sengaja berikan harga besar di kategori — harus tetap diabaikan
        fc.record({
          price_general:     fc.integer({ min: 0, max: 10000000 }),
          price_student_uad: fc.integer({ min: 0, max: 10000000 }),
          price_employee_uad:fc.integer({ min: 0, max: 10000000 }),
          is_free_tier:      fc.constant(true)
        }),
        fc.constantFrom('gratis', undefined, null, ''),
        (training, opt) => {
          const body = opt === undefined ? {} : { category: 'umum' }
          if (opt !== null) body.payment_option = opt

          expect(resolveFinalPrice(training, body, 75000)).toBe(0)
        }
      ),
      { numRuns: 300 }
    )
  })

  test('gratis "sertifikat" → nilai CERT_FEE dari env, bukan form', () => {
    fc.assert(
      fc.property(
        fc.constant({ is_free_tier: true, price_general: 0 }),
        fc.integer({ min: 1, max: 500000 }),
        (training, certFee) => {
          const result = resolveFinalPrice(training, { payment_option: 'sertifikat' }, certFee)
          expect(result).toBe(certFee)
          expect(result).toBeGreaterThan(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  // Nilai CERT_FEE tidak valid (string kosong / NaN / negatif) → anggap 0
  test('gratis "sertifikat" dengan CERT_FEE invalid → 0', () => {
    const t = { is_free_tier: true, price_general: 0 }
    expect(resolveFinalPrice(t, { payment_option: 'sertifikat' }, '')).toBe(0)
    expect(resolveFinalPrice(t, { payment_option: 'sertifikat' }, 'abc')).toBe(0)
    expect(resolveFinalPrice(t, { payment_option: 'sertifikat' }, -5)).toBe(0)
  })

  /**
   * KATEGORI GRATIS MURNI (full free): cert_available = 0/false.
   * Setiap pilihan pembayaran (termasuk 'sertifikat') → selalu 0.
   */
  test('gratis murni (cert_available=0) → selalu 0, pilihan diabaikan', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('gratis', 'sertifikat', undefined),
        (opt) => {
          const body = opt === undefined ? {} : { payment_option: opt }
          // Varian angka 0 dan bolean false keduanya harus memaksa 0
          expect(resolveFinalPrice({ is_free_tier: true, cert_available: 0 }, body, 75000)).toBe(0)
          expect(resolveFinalPrice({ is_free_tier: true, cert_available: false }, body, 75000)).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('gratis + cert_available=1 → pilihan "sertifikat" tetap memakai CERT_FEE', () => {
    const t = { is_free_tier: true, cert_available: 1 }
    expect(resolveFinalPrice(t, { payment_option: 'sertifikat' }, 75000)).toBe(75000)
    expect(resolveFinalPrice(t, { payment_option: 'gratis' }, 75000)).toBe(0)
  })

  // Edge: training null/undefined → fallback aman 0
  test('training null → 0', () => {
    expect(resolveFinalPrice(null, { category: 'umum' }, 75000)).toBe(0)
    expect(resolveFinalPrice(undefined, {}, 75000)).toBe(0)
  })

  // Deterministik: input sama → output sama
  test('deterministik', () => {
    const t = { is_free_tier: true, price_general: 0 }
    const b1 = { payment_option: 'sertifikat' }
    const b2 = { payment_option: 'gratis' }
    expect(resolveFinalPrice(t, b1, 75000)).toBe(resolveFinalPrice(t, b1, 75000))
    expect(resolveFinalPrice(t, b2, 75000)).toBe(resolveFinalPrice(t, b2, 75000))
  })

  /**
   * cert_override (di-convert oleh model menjadi cert_available) —
   * Skenario per-training: kategori gratis dengan cert_available=true,
   * tapi cert_override=0 → model set cert_available=false sebelum
   * resolveFinalPrice dipanggil. Di sini kita test langsung nilai
   * cert_available yang sudah di-convert (mimik output model).
   */
  test('cert_override=0 (model set cert_available=false) → selalu 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('gratis', 'sertifikat', undefined),
        (opt) => {
          const body = opt === undefined ? {} : { payment_option: opt }
          // cert_override=0 → model sudah set cert_available=false
          const training = { is_free_tier: true, cert_available: false }
          expect(resolveFinalPrice(training, body, 75000)).toBe(0)
        }
      ),
      { numRuns: 50 }
    )
  })

  test('cert_override=1 (model set cert_available=true) → sertifikat = CERT_FEE', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500000 }),
        (certFee) => {
          const training = { is_free_tier: true, cert_available: true }
          expect(resolveFinalPrice(training, { payment_option: 'sertifikat' }, certFee)).toBe(certFee)
          expect(resolveFinalPrice(training, { payment_option: 'gratis' }, certFee)).toBe(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('cert_override=null (default, model tidak mengubah cert_available kategori) → ikuti kategori', () => {
    // Kategori gratis dengan cert_available=1 (default kategori)
    const tPaket = { is_free_tier: true, cert_available: 1 }
    expect(resolveFinalPrice(tPaket, { payment_option: 'sertifikat' }, 75000)).toBe(75000)

    // Kategori gratis dengan cert_available=0 (full free di kategori)
    const tPure = { is_free_tier: true, cert_available: 0 }
    expect(resolveFinalPrice(tPure, { payment_option: 'sertifikat' }, 75000)).toBe(0)
  })

  // ── Opsi A (Fix #61): kategori gratis + sertifikat boleh ikut promo ──

  test('gratis + sertifikat + promo byTraining lebih murah → harga promo', () => {
    const training = { id: 42, is_free_tier: true, cert_available: 1 }
    const promo = {
      is_active: true,
      promo_price: 50000,
      byTraining: { 42: 57000 },
      promo_starts_at: null,
      promo_ends_at: null
    }
    // CERT_FEE = 75000 > 57000 → ambil 57000
    expect(resolveFinalPrice(training, { payment_option: 'sertifikat' }, 75000, promo)).toBe(57000)
  })

  test('gratis + sertifikat + promo global (tanpa byTraining) lebih murah → harga global', () => {
    const training = { id: 42, is_free_tier: true, cert_available: 1 }
    const promo = {
      is_active: true,
      promo_price: 50000,
      byTraining: {},
      promo_starts_at: null,
      promo_ends_at: null
    }
    // CERT_FEE = 75000 > 50000 → ambil 50000
    expect(resolveFinalPrice(training, { payment_option: 'sertifikat' }, 75000, promo)).toBe(50000)
  })

  test('gratis + sertifikat + promo lebih mahal dari CERT_FEE → tetap CERT_FEE', () => {
    const training = { id: 42, is_free_tier: true, cert_available: 1 }
    const promo = {
      is_active: true,
      promo_price: 100000,
      byTraining: {},
      promo_starts_at: null,
      promo_ends_at: null
    }
    // CERT_FEE = 75000 < 100000 → promo tak dipakai
    expect(resolveFinalPrice(training, { payment_option: 'sertifikat' }, 75000, promo)).toBe(75000)
  })

  test('gratis + sertifikat + promo di luar periode → tetap CERT_FEE', () => {
    const training = { id: 42, is_free_tier: true, cert_available: 1 }
    const promo = {
      is_active: true,
      promo_price: 10000,
      byTraining: {},
      promo_starts_at: '2020-01-01',
      promo_ends_at: '2020-12-31'
    }
    expect(resolveFinalPrice(training, { payment_option: 'sertifikat' }, 75000, promo)).toBe(75000)
  })

  test('gratis + sertifikat + promo nonaktif → tetap CERT_FEE', () => {
    const training = { id: 42, is_free_tier: true, cert_available: 1 }
    const promo = {
      is_active: false,
      promo_price: 10000,
      byTraining: { 42: 10000 },
      promo_starts_at: null,
      promo_ends_at: null
    }
    expect(resolveFinalPrice(training, { payment_option: 'sertifikat' }, 75000, promo)).toBe(75000)
  })

  test('gratis + "gratis" + promo → tetap 0 (promo tidak mengubah opsi gratis)', () => {
    const training = { id: 42, is_free_tier: true, cert_available: 1 }
    const promo = {
      is_active: true,
      promo_price: 50000,
      byTraining: {},
      promo_starts_at: null,
      promo_ends_at: null
    }
    expect(resolveFinalPrice(training, { payment_option: 'gratis' }, 75000, promo)).toBe(0)
    expect(resolveFinalPrice(training, {}, 75000, promo)).toBe(0)
  })

  test('gratis murni (cert_available=0) + promo + sertifikat → tetap 0', () => {
    const training = { id: 42, is_free_tier: true, cert_available: 0 }
    const promo = {
      is_active: true,
      promo_price: 50000,
      byTraining: {},
      promo_starts_at: null,
      promo_ends_at: null
    }
    expect(resolveFinalPrice(training, { payment_option: 'sertifikat' }, 75000, promo)).toBe(0)
  })

  // Property: hasil gratis+sertifikat+promo selalu = min(CERT_FEE, promo) saat promo valid
  test('gratis + sertifikat + promo valid → min(CERT_FEE, promo)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200000 }),
        fc.integer({ min: 0, max: 200000 }),
        (certFee, promoPrice) => {
          const training = { id: 1, is_free_tier: true, cert_available: 1 }
          const promo = {
            is_active: true,
            promo_price: promoPrice,
            byTraining: {},
            promo_starts_at: null,
            promo_ends_at: null
          }
          const result = resolveFinalPrice(training, { payment_option: 'sertifikat' }, certFee, promo)
          // promoPrice valid & dalam periode → hasil harus min(certFee, promoPrice)
          const expected = Math.min(certFee, promoPrice)
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 200 }
    )
  })

  // Property: promo tak berlaku (nonaktif / luar periode / harga tak valid) → hasil = CERT_FEE
  test('gratis + sertifikat + promo tak berlaku → CERT_FEE', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200000 }),
        (certFee) => {
          const training = { id: 1, is_free_tier: true, cert_available: 1 }
          // Nonaktif
          expect(resolveFinalPrice(
            training, { payment_option: 'sertifikat' }, certFee,
            { is_active: false, promo_price: 1000, byTraining: {} }
          )).toBe(certFee)
          // Promo null / undefined
          expect(resolveFinalPrice(training, { payment_option: 'sertifikat' }, certFee, null)).toBe(certFee)
          expect(resolveFinalPrice(training, { payment_option: 'sertifikat' }, certFee, undefined)).toBe(certFee)
        }
      ),
      { numRuns: 200 }
    )
  })

  // Property: berbayar + promo byTraining lebih murah → harga per training
  test('berbayar + promo byTraining → harga per training, lebih murah dari normal', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100000, max: 1000000 }),
        fc.integer({ min: 0, max: 99999 }),
        (normalPrice, promoPrice) => {
          const training = {
            id: 7,
            is_free_tier: false,
            price_general: normalPrice,
            price_student_uad: normalPrice,
            price_employee_uad: normalPrice
          }
          const promo = {
            is_active: true,
            promo_price: normalPrice, // global mahal, tak relevan
            byTraining: { 7: promoPrice },
            promo_starts_at: null,
            promo_ends_at: null
          }
          const result = resolveFinalPrice(training, { category: 'umum' }, 75000, promo)
          // byTraining (promoPrice < normalPrice) harus menang
          expect(result).toBe(promoPrice)
        }
      ),
      { numRuns: 300 }
    )
  })

  test('berbayar + promo byTraining tidak ada → fallback ke harga global', () => {
    const training = {
      id: 9,
      is_free_tier: false,
      price_general: 200000,
      price_student_uad: 180000,
      price_employee_uad: 190000
    }
    const promo = {
      is_active: true,
      promo_price: 150000,
      byTraining: { 7: 50000 }, // training 7 ada, training 9 tidak
      promo_starts_at: null,
      promo_ends_at: null
    }
    // training 9 → fallback ke global 150000 (< 180000 normal mahasiswa)
    const result = resolveFinalPrice(training, { category: 'mahasiswa_uad' }, 75000, promo)
    expect(result).toBe(150000)
  })
})
