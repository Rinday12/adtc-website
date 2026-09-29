// middleware/auth.js

/**
 * Middleware: Proteksi route admin.
 *
 * Preconditions:  req.session tersedia (express-session telah dikonfigurasi)
 * Postconditions:
 *   - Jika req.session.adminId ada → next() dipanggil
 *   - Jika tidak ada → redirect ke /admin/login
 */
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return next()
  }
  req.flash('error', 'Silakan login terlebih dahulu.')
  res.redirect('/admin/login')
}

module.exports = { isAuthenticated }
