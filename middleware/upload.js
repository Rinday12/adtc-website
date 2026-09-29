// middleware/upload.js
const multer = require('multer')
const path = require('path')
const fs = require('fs')

/**
 * Membuat direktori secara rekursif jika belum ada.
 *
 * Preconditions:  dir adalah path string yang valid
 * Postconditions: Direktori `dir` dipastikan ada di filesystem
 */
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Konfigurasi penyimpanan file Multer (diskStorage).
 *
 * Routing direktori berdasarkan fieldname:
 *   - `payment_proof`       → uploads/payment_proofs/
 *   - `identity_card_proof` → uploads/identity_cards/  (default)
 *
 * Format nama file: `[fieldname]-[timestamp].[ext]`
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dirs = {
      payment_proof:      'uploads/payment_proofs',
      identity_card_proof:'uploads/identity_cards',
      news_image:         'uploads/news_images',
      training_cover:     'uploads/training_covers',
      training_excel:     'uploads/training_imports'
    }
    const dest = dirs[file.fieldname] || 'uploads/identity_cards'
    ensureDir(dest)
    cb(null, dest)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const uniqueName = `${file.fieldname}-${Date.now()}${ext}`
    cb(null, uniqueName)
  }
})

/**
 * Filter tipe file yang diizinkan.
 *
 * Validasi dilakukan terhadap EKSTENSI dan MIME TYPE secara bersamaan.
 *
 * Postconditions:
 *   - File dengan ekstensi dan MIME type valid (jpg, jpeg, png, pdf) → cb(null, true)
 *   - File yang gagal salah satu validasi → cb(new Error(...))
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '')

  if (file.fieldname === 'training_excel') {
    const excelPattern = /xlsx|xls/
    if (excelPattern.test(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Format file Excel tidak didukung. Gunakan .xlsx atau .xls.'))
    }
    return
  }

  const imagePattern = /jpeg|jpg|png|pdf|webp/

  const extValid = imagePattern.test(ext)
  const mimeValid = imagePattern.test(file.mimetype)

  if (extValid && mimeValid) {
    cb(null, true)
  } else {
    cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau PDF.'))
  }
}

/**
 * Instance Multer yang dikonfigurasi dengan:
 *   - diskStorage: routing direktori dan penamaan file
 *   - fileFilter: validasi ekstensi + MIME type
 *   - limits.fileSize: maksimal 5MB per file
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
})

module.exports = upload
