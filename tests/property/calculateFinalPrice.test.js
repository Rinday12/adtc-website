// tests/property/calculateFinalPrice.test.js
const fc = require('fast-check')

// Extract the calculateFinalPrice function to avoid database imports in tests.
// Signature: calculateFinalPrice(category, training, promo)
// - promo = null/undefined/!is_active → ignore promo, return normal price
// - promo aktif & dalam periode & promo_price < normalPrice → return promoPrice
// - promo aktif tapi di luar periode atau promoPrice >= normalPrice → normalPrice
function calculateFinalPrice(category, training, promo) {
  if (!training) return 0
  const priceMap = {
    'umum':          training.price_general,
    'mahasiswa_uad': training.price_student_uad,
    'karyawan_uad':  training.price_employee_uad
  }
  // DECIMAL(10,2) dari mysql2 = string → konversi ke Number agar aman
  const raw = priceMap[category] ?? training.price_general
  const normalPrice = isNaN(Number(raw)) ? 0 : Number(raw)

  // Promo global: hanya dipakai bila promo ada & is_active & dalam periode.
  if (promo && promo.is_active) {
    // Harga per training (byTraining, tabel promo_trainings) — fallback ke
    // harga default global bila training ini tak punya harga khusus.
    const byTrainingPrice = promo.byTraining && promo.byTraining[training.id] != null
      ? Number(promo.byTraining[training.id])
      : null
    const promoPrice = byTrainingPrice != null ? byTrainingPrice : Number(promo.promo_price)
    const now = Date.now()
    const starts = promo.promo_starts_at ? new Date(promo.promo_starts_at).getTime() : null
    const ends = promo.promo_ends_at ? new Date(promo.promo_ends_at).getTime() : null
    const withinWindow =
      (starts === null || now >= starts) &&
      (ends === null || now <= ends)
    // Harga promo hanya berlaku bila lebih murah dari harga normal kategori
    // ini — mencegah "promo" yang justru menaikkan harga.
    if (withinWindow && !isNaN(promoPrice) && promoPrice < normalPrice) {
      return promoPrice
    }
  }

  return normalPrice
}

// Helper: build a promo object that is "active & in-window" relative to a given
// baseline time. Used by property tests below.
function activePromo(promoPrice, { startsOffset = -3600e3, endsOffset = 3600e3, byTraining } = {}) {
  const base = Date.now()
  return {
    is_active: true,
    promo_price: promoPrice,
    ...(byTraining ? { byTraining } : {}),
    promo_starts_at: new Date(base + startsOffset).toISOString(),
    promo_ends_at: new Date(base + endsOffset).toISOString()
  }
}

describe('Property Tests: calculateFinalPrice', () => {

  /**
   * Property 1: Kalkulasi Harga Sesuai Kategori (tanpa promo)
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * For any valid category and training with positive prices, and no promo
   * (null/undefined), result must equal the matching price field.
   */
  test('Property 1: Kalkulasi Harga Sesuai Kategori - hasil selalu positif dan sesuai kategori (tanpa promo)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (category, training) => {
          const result = calculateFinalPrice(category, training, null)

          expect(result).toBeGreaterThan(0)

          let expectedPrice
          switch (category) {
            case 'umum':         expectedPrice = training.price_general; break
            case 'mahasiswa_uad': expectedPrice = training.price_student_uad; break
            case 'karyawan_uad':  expectedPrice = training.price_employee_uad; break
          }
          expect(result).toBe(expectedPrice)
        }
      ),
      { numRuns: 1000 }
    )
  })

  test('Property 1: Fallback ke price_general untuk kategori tidak valid', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s =>
          !['umum', 'mahasiswa_uad', 'karyawan_uad'].includes(s) &&
          !Object.prototype.hasOwnProperty.call(Object.prototype, s)
        ),
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (invalidCategory, training) => {
          const result = calculateFinalPrice(invalidCategory, training, null)
          expect(result).toBe(training.price_general)
          expect(result).toBeGreaterThan(0)
        }
      ),
      { numRuns: 500 }
    )
  })

  test('Property 1: Edge case - kategori undefined/null fallback ke price_general', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (category, training) => {
          const result = calculateFinalPrice(category, training, null)
          expect(result).toBe(training.price_general)
          expect(result).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 1: Konsistensi - memanggil fungsi berkali-kali dengan input sama menghasilkan output sama', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (category, training) => {
          const trainingWithId = { id: 1, ...training }
          const promo = activePromo(1) // any valid promo, just for consistency
          const result1 = calculateFinalPrice(category, trainingWithId, promo)
          const result2 = calculateFinalPrice(category, trainingWithId, promo)
          const result3 = calculateFinalPrice(category, trainingWithId, promo)
          expect(result1).toBe(result2)
          expect(result2).toBe(result3)
        }
      ),
      { numRuns: 200 }
    )
  })

  // ------------------------------------------------------------------
  // New properties for promo behaviour
  // ------------------------------------------------------------------

  /**
   * Property P: Promo aktif & lebih murah dari harga normal per kategori
   * → hasil = promo_price (bukan harga normal).
   */
  test('Property P: promo aktif & lebih murah → hasil = promo_price', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 100, max: 10000000 }),
          price_student_uad: fc.integer({ min: 100, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 100, max: 10000000 }),
        }),
        (category, training) => {
          // Promo harga 1 (selalu lebih murah dari harga normal min ≥ 100)
          const promo = activePromo(1)
          const result = calculateFinalPrice(category, training, promo)
          expect(result).toBe(1)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * Property P: promo aktif tapi promo_price > harga normal → tetap harga normal
   * (mencegah "promo" yang justru menaikkan harga).
   */
  test('Property P: promo harga lebih mahal dari normal → tetap harga normal', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 1, max: 1000000 }),
          price_student_uad: fc.integer({ min: 1, max: 1000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 1000000 }),
        }),
        (category, training) => {
          // Harga normal tertinggi dari 3 kategori; promo = normal + 1 → pasti lebih mahal
          const normalForCategory =
            category === 'umum' ? training.price_general
            : category === 'mahasiswa_uad' ? training.price_student_uad
            : training.price_employee_uad
          const promo = activePromo(normalForCategory + 1)
          const result = calculateFinalPrice(category, training, promo)
          expect(result).toBe(normalForCategory)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * Property P: promo sudah berakhir (ends < now) → tetap harga normal.
   */
  test('Property P: promo sudah berakhir → tetap harga normal', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (category, training) => {
          // Both starts & ends in the past
          const promo = {
            is_active: true,
            promo_price: 1,
            promo_starts_at: new Date(Date.now() - 7200e3).toISOString(),
            promo_ends_at: new Date(Date.now() - 3600e3).toISOString()
          }
          const result = calculateFinalPrice(category, training, promo)
          // Should equal the normal price for this category (bukan harga promo,
          // dan bukan "harga promo lebih besar" — harga normal bisa saja 1).
          let expected
          switch (category) {
            case 'umum':         expected = training.price_general; break
            case 'mahasiswa_uad': expected = training.price_student_uad; break
            case 'karyawan_uad':  expected = training.price_employee_uad; break
          }
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * Property P: promo belum mulai (starts > now) → tetap harga normal.
   */
  test('Property P: promo belum mulai → tetap harga normal', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (category, training) => {
          const promo = {
            is_active: true,
            promo_price: 1,
            promo_starts_at: new Date(Date.now() + 3600e3).toISOString(),
            promo_ends_at: new Date(Date.now() + 7200e3).toISOString()
          }
          const result = calculateFinalPrice(category, training, promo)
          let expected
          switch (category) {
            case 'umum':         expected = training.price_general; break
            case 'mahasiswa_uad': expected = training.price_student_uad; break
            case 'karyawan_uad':  expected = training.price_employee_uad; break
          }
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * Property P: promo is_active=false (nonaktif) → diabaikan, tetap harga normal.
   */
  test('Property P: promo is_active=false → diabaikan', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (category, training) => {
          const promo = {
            is_active: false,
            promo_price: 1,
            promo_starts_at: new Date(Date.now() - 3600e3).toISOString(),
            promo_ends_at: new Date(Date.now() + 3600e3).toISOString()
          }
          const result = calculateFinalPrice(category, training, promo)
          let expected
          switch (category) {
            case 'umum':         expected = training.price_general; break
            case 'mahasiswa_uad': expected = training.price_student_uad; break
            case 'karyawan_uad':  expected = training.price_employee_uad; break
          }
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * Property P: promo tanpa batas waktu (starts & ends null) tapi is_active
   * & lebih murah → berlaku selamanya selama aktif.
   */
  test('Property P: promo tanpa batas waktu (selamanya) & lebih murah → berlaku', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 100, max: 10000000 }),
          price_student_uad: fc.integer({ min: 100, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 100, max: 10000000 }),
        }),
        (category, training) => {
          const promo = {
            is_active: true,
            promo_price: 50, // always cheaper than min 100
            promo_starts_at: null,
            promo_ends_at: null
          }
          const result = calculateFinalPrice(category, training, promo)
          expect(result).toBe(50)
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * Property P: byTraining ada untuk training X & harga per training X
   * lebih murah dari harga normal kategori ��� hasil = harga per training X
   * (bukan harga promo global).
   */
  test('Property P: byTraining ada untuk training → pakai harga per training', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 100, max: 10000000 }),
          price_student_uad: fc.integer({ min: 100, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 100, max: 10000000 }),
        }),
        (category, training) => {
          const trainingId = 42
          const byTrainingPrice = 5
          const promo = activePromo(999999, { byTraining: { [trainingId]: byTrainingPrice } })
          const result = calculateFinalPrice(category, { id: trainingId, ...training }, promo)
          // byTraining harga (5) lebih murah dari semua harga normal min 100
          // → dipakai, bukan promo_price global (999999, lebih mahal → tak
          // akan terpilih lewat guard p < normalPrice).
          expect(result).toBe(byTrainingPrice)
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * Property P: byTraining TIDAK ada untuk training Y → fallback ke
   * promo_price global.
   */
  test('Property P: byTraining tak ada untuk training → fallback ke harga global', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        fc.record({
          price_general: fc.integer({ min: 100, max: 10000000 }),
          price_student_uad: fc.integer({ min: 100, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 100, max: 10000000 }),
        }),
        (category, training) => {
          const trainingId = 99
          const globalPromoPrice = 10
          // byTraining hanya untuk training lain (id 1), bukan trainingId
          const promo = activePromo(globalPromoPrice, { byTraining: { 1: 1 } })
          const result = calculateFinalPrice(category, { id: trainingId, ...training }, promo)
          expect(result).toBe(globalPromoPrice)
        }
      ),
      { numRuns: 300 }
    )
  })
})
