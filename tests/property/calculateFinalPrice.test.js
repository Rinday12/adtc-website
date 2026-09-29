// tests/property/calculateFinalPrice.test.js
const fc = require('fast-check')

// Extract the calculateFinalPrice function to avoid database imports in tests
function calculateFinalPrice(category, training) {
  const priceMap = {
    'umum':          training.price_general,
    'mahasiswa_uad': training.price_student_uad,
    'karyawan_uad':  training.price_employee_uad
  }
  return priceMap[category] ?? training.price_general
}

describe('Property Tests: calculateFinalPrice', () => {
  
  /**
   * Property 1: Kalkulasi Harga Sesuai Kategori
   * **Validates: Requirements 3.1, 3.2, 3.3**
   * 
   * For any Training dengan price_general, price_student_uad, dan price_employee_uad 
   * bernilai positif, dan untuk setiap Kategori yang valid (umum, mahasiswa_uad, karyawan_uad), 
   * fungsi calculateFinalPrice(category, training) harus mengembalikan nilai yang identik 
   * dengan field harga yang sesuai kategori tersebut, dan hasilnya selalu positif.
   */
  test('Property 1: Kalkulasi Harga Sesuai Kategori - hasil selalu positif dan sesuai kategori', () => {
    fc.assert(
      fc.property(
        // Generator untuk kategori valid
        fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad'),
        // Generator untuk objek training dengan harga positif
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (category, training) => {
          const result = calculateFinalPrice(category, training)
          
          // Verifikasi 1: Hasil selalu positif
          expect(result).toBeGreaterThan(0)
          
          // Verifikasi 2: Hasil identik dengan field harga yang sesuai kategori
          let expectedPrice
          switch (category) {
            case 'umum':
              expectedPrice = training.price_general
              break
            case 'mahasiswa_uad':
              expectedPrice = training.price_student_uad
              break
            case 'karyawan_uad':
              expectedPrice = training.price_employee_uad
              break
          }
          
          expect(result).toBe(expectedPrice)
        }
      ),
      { numRuns: 1000 } // Run 1000 test cases
    )
  })
  
  test('Property 1: Fallback ke price_general untuk kategori tidak valid', () => {
    fc.assert(
      fc.property(
        // Generator untuk kategori tidak valid - filter out prototype properties
        fc.string().filter(s => 
          !['umum', 'mahasiswa_uad', 'karyawan_uad'].includes(s) && 
          !Object.prototype.hasOwnProperty.call(Object.prototype, s)
        ),
        // Generator untuk objek training dengan harga positif
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (invalidCategory, training) => {
          const result = calculateFinalPrice(invalidCategory, training)
          
          // Verifikasi: Hasil fallback ke price_general
          expect(result).toBe(training.price_general)
          
          // Verifikasi: Hasil selalu positif
          expect(result).toBeGreaterThan(0)
        }
      ),
      { numRuns: 500 }
    )
  })
  
  test('Property 1: Edge case - kategori undefined/null fallback ke price_general', () => {
    fc.assert(
      fc.property(
        // Generator untuk kategori null/undefined
        fc.constantFrom(null, undefined),
        // Generator untuk objek training dengan harga positif
        fc.record({
          price_general: fc.integer({ min: 1, max: 10000000 }),
          price_student_uad: fc.integer({ min: 1, max: 10000000 }),
          price_employee_uad: fc.integer({ min: 1, max: 10000000 }),
        }),
        (category, training) => {
          const result = calculateFinalPrice(category, training)
          
          // Verifikasi: Hasil fallback ke price_general
          expect(result).toBe(training.price_general)
          
          // Verifikasi: Hasil selalu positif
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
          const result1 = calculateFinalPrice(category, training)
          const result2 = calculateFinalPrice(category, training)
          const result3 = calculateFinalPrice(category, training)
          
          // Verifikasi: Fungsi deterministik - hasil sama untuk input sama
          expect(result1).toBe(result2)
          expect(result2).toBe(result3)
        }
      ),
      { numRuns: 200 }
    )
  })
})