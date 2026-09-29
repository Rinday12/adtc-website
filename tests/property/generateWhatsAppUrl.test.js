// tests/property/generateWhatsAppUrl.test.js

const fc = require('fast-check')
const { generateWhatsAppUrl } = require('../../utils/whatsapp')

/**
 * **Validates: Requirements 5.5, 5.6, 5.7**
 * 
 * Property 3: URL WhatsApp Selalu Valid dan Mengandung Data Peserta
 * 
 * For any kombinasi `name` non-kosong, `program` non-kosong, dan `price` bernilai positif, 
 * fungsi `generateWhatsAppUrl(name, program, price)` harus mengembalikan string URL yang 
 * diawali `https://wa.me/`, mengandung nomor admin (hanya digit), dan mengandung pesan 
 * yang sudah di-encode yang menyertakan nama peserta, nama program, dan harga dalam format Rupiah.
 */

describe('generateWhatsAppUrl Property Tests', () => {
  const originalEnv = process.env.WHATSAPP_ADMIN_NUMBER

  beforeEach(() => {
    // Set up a valid test phone number for all tests
    process.env.WHATSAPP_ADMIN_NUMBER = '+62812-3456-7890'
  })

  afterEach(() => {
    // Restore original environment
    process.env.WHATSAPP_ADMIN_NUMBER = originalEnv
  })

  test('Property 3: URL WhatsApp Selalu Valid dan Mengandung Data Peserta', () => {
    fc.assert(
      fc.property(
        // Generator untuk nama non-kosong (1-100 karakter, berisi huruf dan spasi)
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        
        // Generator untuk program non-kosong (1-100 karakter, berisi huruf dan spasi)
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        
        // Generator untuk harga positif (1 - 100,000,000)
        fc.integer({ min: 1, max: 100_000_000 }),
        
        (name, program, price) => {
          const result = generateWhatsAppUrl(name, program, price)

          // Verifikasi: URL selalu diawali 'https://wa.me/'
          expect(result).toMatch(/^https:\/\/wa\.me\//)

          // Verifikasi: URL mengandung nomor admin (hanya digit) setelah wa.me/
          const phoneNumberMatch = result.match(/https:\/\/wa\.me\/(\d+)/)
          expect(phoneNumberMatch).not.toBeNull()
          expect(phoneNumberMatch[1]).toMatch(/^\d+$/)
          
          // Nomor harus berisi hanya digit dari environment variable yang sudah dibersihkan
          const expectedCleanNumber = (process.env.WHATSAPP_ADMIN_NUMBER || '').replace(/\D/g, '')
          expect(phoneNumberMatch[1]).toBe(expectedCleanNumber)

          // Verifikasi: URL mengandung parameter text
          expect(result).toContain('?text=')

          // Decode URL parameter untuk memverifikasi isi pesan
          const textMatch = result.match(/text=([^&]*)/)
          expect(textMatch).not.toBeNull()
          
          const decodedMessage = decodeURIComponent(textMatch[1])

          // Verifikasi: pesan mengandung nama peserta
          expect(decodedMessage).toContain(name)

          // Verifikasi: pesan mengandung nama program
          expect(decodedMessage).toContain(program)

          // Verifikasi: pesan mengandung harga dalam format Rupiah
          const formattedPrice = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
          }).format(price)
          expect(decodedMessage).toContain(formattedPrice)

          // Verifikasi: struktur pesan sesuai template yang diharapkan
          expect(decodedMessage).toContain('Halo Admin ADTC')
          expect(decodedMessage).toContain('Nama   :')
          expect(decodedMessage).toContain('Program:')
          expect(decodedMessage).toContain('Total  :')
          expect(decodedMessage).toContain('Mohon konfirmasi pendaftaran saya')
        }
      ),
      { numRuns: 100 } // Menjalankan 100 iterasi dengan input acak
    )
  })

  test('Property 3 Edge Cases: URL tetap valid dengan karakter khusus dalam input', () => {
    fc.assert(
      fc.property(
        // Generator untuk nama dengan karakter khusus yang mungkin ada
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0)
          .map(s => s + ' & Special chars: @#$%'),
        
        // Generator untuk program dengan karakter khusus
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0)  
          .map(s => s + ' (Advanced) - Level 1'),
        
        // Generator untuk harga dengan nilai batas
        fc.oneof(
          fc.constant(1),           // Harga minimum
          fc.constant(999),         // Harga 3 digit
          fc.constant(1000000),     // Harga 7 digit
          fc.constant(50000000)     // Harga tinggi
        ),
        
        (name, program, price) => {
          const result = generateWhatsAppUrl(name, program, price)

          // Pastikan URL tetap valid meskipun ada karakter khusus
          expect(result).toMatch(/^https:\/\/wa\.me\/\d+\?text=/)
          
          // Pastikan encoding berjalan dengan baik
          const textMatch = result.match(/text=([^&]*)/)
          expect(textMatch).not.toBeNull()
          
          const decodedMessage = decodeURIComponent(textMatch[1])
          expect(decodedMessage).toContain(name)
          expect(decodedMessage).toContain(program)
          
          // Verifikasi format harga tetap konsisten
          const formattedPrice = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
          }).format(price)
          expect(decodedMessage).toContain(formattedPrice)
        }
      ),
      { numRuns: 50 }
    )
  })

  test('Property 3 Boundary: Menangani nomor WhatsApp kosong atau tidak valid', () => {
    // Test dengan nomor kosong
    const originalNumber = process.env.WHATSAPP_ADMIN_NUMBER
    process.env.WHATSAPP_ADMIN_NUMBER = ''
    
    const result = generateWhatsAppUrl('Test User', 'Test Program', 100000)
    expect(result).toBe('')
    
    // Test dengan nomor yang tidak mengandung digit
    process.env.WHATSAPP_ADMIN_NUMBER = '+++---abc'
    const result2 = generateWhatsAppUrl('Test User', 'Test Program', 100000)
    expect(result2).toBe('')
    
    // Restore original
    process.env.WHATSAPP_ADMIN_NUMBER = originalNumber
  })

  test('Property 3 Format: Konsistensi format harga Rupiah', () => {
    fc.assert(
      fc.property(
        fc.constant('Test User'),
        fc.constant('Test Program'),
        fc.integer({ min: 1, max: 999_999_999 }), // Range harga yang realistis
        
        (name, program, price) => {
          const result = generateWhatsAppUrl(name, program, price)
          const textMatch = result.match(/text=([^&]*)/)
          const decodedMessage = decodeURIComponent(textMatch[1])
          
          // Verifikasi format harga menggunakan format Indonesia
          const formattedPrice = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
          }).format(price)
          
          expect(decodedMessage).toContain(formattedPrice)
          
          // Verifikasi bahwa harga dimulai dengan 'Rp' (format Indonesia)
          expect(formattedPrice).toMatch(/^Rp\s?\d/)
        }
      ),
      { numRuns: 30 }
    )
  })
})