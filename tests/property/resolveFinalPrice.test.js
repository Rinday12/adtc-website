// tests/property/resolveFinalPrice.test.js
// Uji logika penentuan total tagihan peserta (controllers/registrationController.js):
//   - kategori berbayar  → harga sesuai kategori
//   - kategori gratis    → pilihan "gratis" (=0) / "dengan sertifikat" (= CERT_FEE)
//
// Logika di-inline di sini (meniru pola calculateFinalPrice.test.js) agar tidak
// menarik import model → database saat test.

const fc = require('fast-check')

function calculateFinalPrice(category, training) {
  if (!training) return 0
  const priceMap = {
    'umum':          training.price_general,
    'mahasiswa_uad': training.price_student_uad,
    'karyawan_uad':  training.price_employee_uad
  }
  const raw = priceMap[category] ?? training.price_general
  const num = Number(raw)
  return isNaN(num) ? 0 : num
}

function resolveFinalPrice(training, body, certFee) {
  if (training && training.is_free_tier) {
    // Kategori gratis murni (cert_available false/0) → selalu 0.
    if (training.cert_available === false || training.cert_available === 0) {
      return 0
    }
    if (body && body.payment_option === 'sertifikat') {
      const fee = Number(certFee)
      return isNaN(fee) || fee < 0 ? 0 : fee
    }
    return 0
  }
  return calculateFinalPrice(body?.category, training)
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
})
