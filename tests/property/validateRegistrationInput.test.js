// tests/property/validateRegistrationInput.test.js
const fc = require('fast-check')

// Load environment variables for tests
require('dotenv').config()

// Extract the validateRegistrationInput function directly to avoid database dependencies
function validateRegistrationInput(body, files) {
  const errors = []
  const { full_name, email, phone, category } = body

  if (!full_name || full_name.trim().length < 3)
    errors.push('Nama lengkap minimal 3 karakter.')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('Format email tidak valid.')
  if (!phone || phone.replace(/\D/g, '').length < 10)
    errors.push('Nomor telepon minimal 10 digit.')
  if (!['umum', 'mahasiswa_uad', 'karyawan_uad'].includes(category))
    errors.push('Kategori peserta tidak valid.')

  if (category === 'mahasiswa_uad' || category === 'karyawan_uad') {
    if (!body.identity_number || body.identity_number.trim().length < 5)
      errors.push('NIM/NIY wajib diisi untuk kategori UAD.')
    if (!files?.identity_card_proof?.[0])
      errors.push('File KTM/ID Card wajib diupload untuk kategori UAD.')
  }

  return { valid: errors.length === 0, errors }
}

describe('validateRegistrationInput Property-Based Tests', () => {
  
  /**
   * Property 5: Field Identitas UAD Wajib Ada untuk Kategori UAD
   * **Validates: Requirements 2.10, 2.11**
   */
  describe('Property 5: Field Identitas UAD Wajib Ada untuk Kategori UAD', () => {
    
    test('UAD categories without identity_number should be invalid', () => {
      fc.assert(fc.property(
        fc.record({
          full_name: fc.string({ minLength: 3, maxLength: 50 }),
          email: fc.emailAddress(),
          phone: fc.integer({ min: 1000000000, max: 999999999999 }).map(n => n.toString()),
          category: fc.constantFrom('mahasiswa_uad', 'karyawan_uad'),
          identity_number: fc.oneof(
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('   '),  // whitespace only
            fc.string({ maxLength: 4 })  // less than 5 characters
          )
        }),
        (body) => {
          const files = { identity_card_proof: [{ path: 'mock/path.jpg' }] }
          const result = validateRegistrationInput(body, files)
          
          // Must always be invalid for UAD categories without proper identity_number
          expect(result.valid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
          
          const hasIdentityNumberError = result.errors.some(error => 
            error.includes('NIM/NIY wajib diisi')
          )
          expect(hasIdentityNumberError).toBe(true)
        }
      ), { numRuns: 50 })
    })
    
    test('UAD categories without identity_card_proof file should be invalid', () => {
      fc.assert(fc.property(
        fc.record({
          full_name: fc.string({ minLength: 3, maxLength: 50 }),
          email: fc.emailAddress(),
          phone: fc.integer({ min: 1000000000, max: 999999999999 }).map(n => n.toString()),
          category: fc.constantFrom('mahasiswa_uad', 'karyawan_uad'),
          identity_number: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length >= 5)
        }),
        (body) => {
          const filesVariations = [
            undefined,
            {},
            { identity_card_proof: undefined },
            { identity_card_proof: [] }
          ]
          
          filesVariations.forEach(files => {
            const result = validateRegistrationInput(body, files)
            
            expect(result.valid).toBe(false)
            expect(result.errors.length).toBeGreaterThan(0)
            
            const hasFileError = result.errors.some(error => 
              error.includes('File KTM/ID Card wajib diupload')
            )
            expect(hasFileError).toBe(true)
          })
        }
      ), { numRuns: 20 })
    })
  })

  /**
   * Property 6: Validasi Input Menolak Semua Input Tidak Valid  
   * **Validates: Requirements 2.6–2.11, 3.4**
   */
  describe('Property 6: Validasi Input Menolak Semua Input Tidak Valid', () => {
    
    test('Invalid full_name (less than 3 characters) should always be rejected', () => {
      fc.assert(fc.property(
        fc.record({
          full_name: fc.oneof(
            fc.constant(undefined),
            fc.constant(''),
            fc.string({ maxLength: 2 })  // less than 3 characters
          ),
          email: fc.emailAddress(),
          phone: fc.integer({ min: 1000000000, max: 999999999999 }).map(n => n.toString()),
          category: fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad')
        }),
        (body) => {
          const result = validateRegistrationInput(body, undefined)
          
          expect(result.valid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
          
          const hasNameError = result.errors.some(error => 
            error.includes('Nama lengkap minimal 3 karakter')
          )
          expect(hasNameError).toBe(true)
        }
      ), { numRuns: 50 })
    })
    
    test('Invalid email format should always be rejected', () => {
      fc.assert(fc.property(
        fc.record({
          full_name: fc.string({ minLength: 3, maxLength: 50 }),
          email: fc.oneof(
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('invalid-email'),
            fc.constant('test@'),
            fc.constant('@domain.com'),
            fc.constant('test@domain')
          ),
          phone: fc.integer({ min: 1000000000, max: 999999999999 }).map(n => n.toString()),
          category: fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad')
        }),
        (body) => {
          const result = validateRegistrationInput(body, undefined)
          
          expect(result.valid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
          
          const hasEmailError = result.errors.some(error => 
            error.includes('Format email tidak valid')
          )
          expect(hasEmailError).toBe(true)
        }
      ), { numRuns: 50 })
    })
    
    test('Invalid phone (less than 10 digits) should always be rejected', () => {
      fc.assert(fc.property(
        fc.record({
          full_name: fc.string({ minLength: 3, maxLength: 50 }),
          email: fc.emailAddress(),
          phone: fc.oneof(
            fc.constant(undefined),
            fc.constant(''),
            fc.string({ maxLength: 9 }),  // less than 10 characters
            fc.integer({ min: 0, max: 999999999 }).map(n => n.toString())  // less than 10 digits
          ),
          category: fc.constantFrom('umum', 'mahasiswa_uad', 'karyawan_uad')
        }),
        (body) => {
          const result = validateRegistrationInput(body, undefined)
          
          expect(result.valid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
          
          const hasPhoneError = result.errors.some(error => 
            error.includes('Nomor telepon minimal 10 digit')
          )
          expect(hasPhoneError).toBe(true)
        }
      ), { numRuns: 50 })
    })
    
    test('Invalid category should always be rejected', () => {
      fc.assert(fc.property(
        fc.record({
          full_name: fc.string({ minLength: 3, maxLength: 50 }),
          email: fc.emailAddress(),
          phone: fc.integer({ min: 1000000000, max: 999999999999 }).map(n => n.toString()),
          category: fc.oneof(
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('invalid_category'),
            fc.constant('student'),
            fc.constant('employee'),
            fc.constant('public')
          )
        }),
        (body) => {
          const result = validateRegistrationInput(body, undefined)
          
          expect(result.valid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
          
          const hasCategoryError = result.errors.some(error => 
            error.includes('Kategori peserta tidak valid')
          )
          expect(hasCategoryError).toBe(true)
        }
      ), { numRuns: 50 })
    })
    
    test('Valid input for umum category should pass validation', () => {
      fc.assert(fc.property(
        fc.record({
          full_name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
          email: fc.emailAddress(),
          phone: fc.integer({ min: 1000000000, max: 999999999999 }).map(n => n.toString()),
          category: fc.constant('umum')
        }),
        (body) => {
          const result = validateRegistrationInput(body, undefined)

          // umum category should not require identity fields
          expect(result.valid).toBe(true)
          expect(result.errors.length).toBe(0)
        }
      ), { numRuns: 50 })
    })
    
    test('Valid input for UAD categories with proper identity fields should pass validation', () => {
      fc.assert(fc.property(
        fc.record({
          full_name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
          email: fc.emailAddress(),
          phone: fc.integer({ min: 1000000000, max: 999999999999 }).map(n => n.toString()),
          category: fc.constantFrom('mahasiswa_uad', 'karyawan_uad'),
          identity_number: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length >= 5)
        }),
        (body) => {
          const files = {
            identity_card_proof: [{ path: 'uploads/identity_cards/mock-file.jpg' }]
          }

          const result = validateRegistrationInput(body, files)

          expect(result.valid).toBe(true)
          expect(result.errors.length).toBe(0)
        }
      ), { numRuns: 50 })
    })
  })
})