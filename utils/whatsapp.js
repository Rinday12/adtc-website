// utils/whatsapp.js

/**
 * Generate URL WhatsApp untuk konfirmasi pembayaran.
 *
 * Preconditions:
 *   - name adalah string non-kosong
 *   - program adalah string non-kosong
 *   - price adalah angka positif
 *   - WHATSAPP_ADMIN_NUMBER tersedia di environment variable
 *
 * Postconditions:
 *   - Mengembalikan URL string dimulai dengan 'https://wa.me/'
 *   - URL mengandung nomor admin yang sudah dibersihkan (tanpa +, spasi, strip)
 *   - Parameter text sudah di-encode dengan encodeURIComponent
 *   - Pesan mengandung nama, program, dan harga yang diformat
 *   - Jika nomor kosong setelah dibersihkan, kembalikan string kosong ''
 */
function generateWhatsAppUrl(name, program, price) {
  const rawNumber = process.env.WHATSAPP_ADMIN_NUMBER || ''
  const cleanNumber = rawNumber.replace(/\D/g, '')

  if (!cleanNumber) return ''

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(price)

  const message =
    `Halo Admin ADTC, saya telah mendaftar program pelatihan berikut:\n\n` +
    `Nama   : ${name}\n` +
    `Program: ${program}\n` +
    `Total  : ${formattedPrice}\n\n` +
    `Mohon konfirmasi pendaftaran saya. Terima kasih.`

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`
}

module.exports = { generateWhatsAppUrl }
