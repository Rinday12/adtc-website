const nodemailer = require('nodemailer')

/**
 * Buat transporter SMTP dari environment variables.
 *
 * Variabel yang dibutuhkan:
 *   - EMAIL_HOST     (contoh: smtp.gmail.com)
 *   - EMAIL_PORT     (contoh: 587)
 *   - EMAIL_USER     (alamat email pengirim)
 *   - EMAIL_PASSWORD (password atau app password email pengirim)
 *   - EMAIL_FROM_NAME (nama pengirim yang muncul di kolom From)
 *
 * Jika variabel tidak tersedia, transporter menggunakan simulasi (transporter
 * langsung resolve tanpa mengirim ke server SMTP). Ini memungkinkan app tetap
 * berjalan tanpa error saat konfigurasi SMTP belum diatur.
 */
function createTransporter() {
  const host = process.env.EMAIL_HOST
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587
  const user = process.env.EMAIL_USER
  const password = process.env.EMAIL_PASSWORD
  const fromName = process.env.EMAIL_FROM_NAME || 'ADTC'

  if (!host || !user || !password) {
    // Simulasi: email tidak benar-benar dikirim, hanya di-log
    return {
      sendMail: async (info) => {
        console.log('[EMAIL SIMULASI] Pesan akan dikirim ke:', info.to)
        console.log('[EMAIL SIMULASI] Subject:', info.subject)
        console.log('[EMAIL SIMULASI] HTML preview (baris 1-200):', info.html?.substring(0, 200))
        return { messageId: 'simulated-' + Date.now() }
      }
    }
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
    tls: { rejectUnauthorized: false },
    requireTLS: true
  })

  // Don't verify on startup - verify only when sending (non-blocking)
  return transport

  return transport
}

const transporter = createTransporter()

/**
 * Render template email dari views/emails/*.ejs.
 * Menggunakan renderFile express/ejs built-in.
 */
async function renderEmailTemplate(templateName, locals) {
  const ejs = require('ejs')
  const path = require('path')
  const templatePath = path.join(__dirname, '../views/emails', templateName + '.ejs')
  return ejs.renderFile(templatePath, locals)
}

/**
 * Kirim email notifikasi perubahan status pendaftaran.
 *
 * @param {string} to       - alamat email penerima
 * @ {string} subject  - subjek email
 * @param {string} html     - isi HTML email (sudah di-render dari template)
 */
async function sendEmail(to, subject, html) {
  const fromName = process.env.EMAIL_FROM_NAME || 'ADTC'
  const from = process.env.EMAIL_USER || 'noreply@adtc.id'

  await transporter.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    subject,
    html
  })
}

/**
 * Kirim email notifikasi status pendaftaran.
 *
 * @param {object} registration - objek registrasi dari Registration.findById()
 * @param {string} newStatus    - status baru (approved / verified / rejected)
 */
async function sendStatusNotification(registration, newStatus) {
  let subject = ''
  let template = ''

  switch (newStatus) {
    case 'approved':
      subject = 'Pendaftaran Anda Disetujui - ADTC'
      template = 'status-approved'
      break
    case 'verified':
      subject = 'Pembayaran Terverifikasi - ADTC'
      template = 'status-verified'
      break
    case 'rejected':
      subject = 'Pendaftaran Ditolak - ADTC'
      template = 'status-rejected'
      break
    default:
      return
  }

  const bankAccount = {
    bankName:      process.env.BANK_NAME      || 'Bank Muamalat',
    accountNumber: process.env.BANK_ACCOUNT   || '0000000000',
    accountName:   process.env.BANK_ACC_NAME  || 'Ahmad Dahlan Training Center'
  }

  const html = await renderEmailTemplate(template, {
    registration,
    groupLink: registration.whatsapp_group_link || '',
    bankAccount
  })

  await sendEmail(registration.email, subject, html)
}

/**
 * Kirim email informasi rekening pembayaran.
 * Dipanggil ketika user mengakses halaman pembayaran.
 */
async function sendPaymentInfoEmail(registration) {
  const bankAccount = {
    bankName:      process.env.BANK_NAME      || 'Bank Muamalat',
    accountNumber: process.env.BANK_ACCOUNT   || '0000000000',
    accountName:   process.env.BANK_ACC_NAME  || 'Ahmad Dahlan Training Center'
  }

  const fmt = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  })

  const html = await renderEmailTemplate('payment-info', {
    registration,
    bankAccount,
    fmt
  })

  await sendEmail(
    registration.email,
    'Informasi Pembayaran - ' + registration.training_title,
    html
  )
}

module.exports = { sendStatusNotification, sendPaymentInfoEmail }
