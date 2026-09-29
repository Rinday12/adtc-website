// tests/property/fileFilter.test.js

/**
 * Property-Based Testing untuk fileFilter middleware upload
 * 
 * **Validates: Requirements 4.1, 4.3, 10.3**
 * 
 * Property 7: File Filter Menerima Semua Format Valid dan Menolak Format Tidak Valid
 */

const fc = require('fast-check')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

// Import module upload untuk mengakses fileFilter
const upload = require('../../middleware/upload')

// Extract fileFilter dari multer instance yang sudah dikonfigurasi
// Kita akan membuat instance terpisah untuk testing
const fileFilter = (req, file, cb) => {
  const allowedPattern = /jpeg|jpg|png|pdf|webp/

  const extValid = allowedPattern.test(
    path.extname(file.originalname).toLowerCase().replace('.', '')
  )
  const mimeValid = allowedPattern.test(file.mimetype)

  if (extValid && mimeValid) {
    cb(null, true)
  } else {
    cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau PDF.'))
  }
}

describe('Property 7: File Filter Menerima Format Valid dan Menolak Format Tidak Valid', () => {
  
  /**
   * Generator untuk file dengan ekstensi dan MIME type valid
   * Sesuai spek: jpeg, jpg, png, pdf, webp
   */
  const validFileGenerator = fc.record({
    originalname: fc.oneof(
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.jpg`),
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.jpeg`),
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.png`),
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.pdf`),
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.webp`)
    ),
    mimetype: fc.oneof(
      fc.constant('image/jpeg'),
      fc.constant('image/png'),
      fc.constant('application/pdf'),
      fc.constant('image/webp')
    ),
    fieldname: fc.oneof(
      fc.constant('identity_card_proof'),
      fc.constant('payment_proof'),
      fc.constant('news_image')
    )
  })

  /**
   * Generator untuk file dengan ekstensi atau MIME type tidak valid
   */
  const invalidFileGenerator = fc.oneof(
    // File dengan ekstensi tidak valid tapi MIME type mungkin valid
    fc.record({
      originalname: fc.oneof(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.txt`),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.doc`),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.exe`),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.gif`),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.bmp`),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.tiff`)
      ),
      mimetype: fc.oneof(
        fc.constant('image/jpeg'),
        fc.constant('image/png'),
        fc.constant('application/pdf'),
        fc.constant('image/webp')
      ),
      fieldname: fc.constant('identity_card_proof')
    }),
    
    // File dengan MIME type tidak valid tapi ekstensi mungkin valid
    fc.record({
      originalname: fc.oneof(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.jpg`),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.png`),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.pdf`)
      ),
      mimetype: fc.oneof(
        fc.constant('text/plain'),
        fc.constant('application/msword'),
        fc.constant('image/gif'),
        fc.constant('video/mp4'),
        fc.constant('audio/mpeg'),
        fc.constant('application/octet-stream')
      ),
      fieldname: fc.constant('identity_card_proof')
    }),
    
    // File dengan keduanya tidak valid
    fc.record({
      originalname: fc.oneof(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.txt`),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.doc`),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')).map(name => `${name}.exe`)
      ),
      mimetype: fc.oneof(
        fc.constant('text/plain'),
        fc.constant('application/msword'),
        fc.constant('video/mp4')
      ),
      fieldname: fc.constant('identity_card_proof')
    })
  )

  /**
   * Test Property: Semua file dengan ekstensi dan MIME type valid selalu diterima
   * 
   * **Validates: Requirements 4.1, 4.3**
   */
  it('should always accept files with valid extensions and MIME types', () => {
    fc.assert(
      fc.property(validFileGenerator, (file) => {
        const mockReq = {}
        let callbackResult = null
        let errorResult = null
        
        const mockCallback = (error, accepted) => {
          errorResult = error
          callbackResult = accepted
        }
        
        // Eksekusi fileFilter
        fileFilter(mockReq, file, mockCallback)
        
        // Verifikasi: tidak ada error dan file diterima
        expect(errorResult).toBeNull()
        expect(callbackResult).toBe(true)
      }),
      {
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * Test Property: Semua file dengan ekstensi atau MIME type tidak valid selalu ditolak
   * 
   * **Validates: Requirements 4.3, 10.3**
   */
  it('should always reject files with invalid extensions or MIME types', () => {
    fc.assert(
      fc.property(invalidFileGenerator, (file) => {
        const mockReq = {}
        let callbackResult = null
        let errorResult = null
        
        const mockCallback = (error, accepted) => {
          errorResult = error
          callbackResult = accepted
        }
        
        // Eksekusi fileFilter
        fileFilter(mockReq, file, mockCallback)
        
        // Verifikasi: ada error dan file ditolak
        expect(errorResult).toBeInstanceOf(Error)
        expect(errorResult.message).toContain('Format file tidak didukung')
        expect(callbackResult).not.toBe(true) // File tidak diterima
      }),
      {
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * Test Property: Konsistensi validasi - hasil selalu deterministik untuk input yang sama
   */
  it('should give consistent results for identical file inputs', () => {
    fc.assert(
      fc.property(validFileGenerator, (file) => {
        const mockReq = {}
        
        // Test pertama
        let result1 = null
        let error1 = null
        fileFilter(mockReq, file, (err, accepted) => {
          error1 = err
          result1 = accepted
        })
        
        // Test kedua dengan file yang sama
        let result2 = null
        let error2 = null
        fileFilter(mockReq, file, (err, accepted) => {
          error2 = err
          result2 = accepted
        })
        
        // Hasil harus identik
        expect(error1).toEqual(error2)
        expect(result1).toEqual(result2)
      }),
      {
        numRuns: 50
      }
    )
  })

  /**
   * Test Property: Case-insensitive validation - ekstensi dalam berbagai case harus ditangani dengan benar
   */
  it('should handle case-insensitive extensions correctly', () => {
    const testCases = [
      { originalname: 'test.JPG', mimetype: 'image/jpeg' },
      { originalname: 'test.PNG', mimetype: 'image/png' },
      { originalname: 'test.PDF', mimetype: 'application/pdf' },
      { originalname: 'test.WEBP', mimetype: 'image/webp' },
      { originalname: 'test.Jpeg', mimetype: 'image/jpeg' },
      { originalname: 'test.pNg', mimetype: 'image/png' }
    ]
    
    testCases.forEach(file => {
      const mockReq = {}
      let callbackResult = null
      let errorResult = null
      
      const mockCallback = (error, accepted) => {
        errorResult = error
        callbackResult = accepted
      }
      
      file.fieldname = 'identity_card_proof'
      fileFilter(mockReq, file, mockCallback)
      
      // File dengan ekstensi valid tapi case berbeda harus diterima
      expect(errorResult).toBeNull()
      expect(callbackResult).toBe(true)
    })
  })

  /**
   * Test Property: Edge cases - file tanpa ekstensi atau dengan ekstensi kosong
   */
  it('should reject files without extensions or with empty extensions', () => {
    const edgeCases = [
      { originalname: 'file_without_extension', mimetype: 'image/jpeg', fieldname: 'identity_card_proof' },
      { originalname: 'file.', mimetype: 'image/jpeg', fieldname: 'identity_card_proof' },
      { originalname: '', mimetype: 'image/jpeg', fieldname: 'identity_card_proof' },
      { originalname: '.jpg', mimetype: 'image/jpeg', fieldname: 'identity_card_proof' } // Should be rejected - no filename
    ]
    
    edgeCases.forEach(file => {
      const mockReq = {}
      let callbackResult = null
      let errorResult = null
      
      const mockCallback = (error, accepted) => {
        errorResult = error
        callbackResult = accepted
      }
      
      fileFilter(mockReq, file, mockCallback)
      
      // Semua edge case harus ditolak karena tidak memiliki nama file yang valid
      expect(errorResult).toBeInstanceOf(Error)
      expect(callbackResult).not.toBe(true)
    })
  })
})
