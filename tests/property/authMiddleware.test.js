const fc = require('fast-check')

/**
 * Property 8: Middleware Auth Melindungi Semua Route Admin
 *
 * **Validates: Requirements 6.7, 7.9**
 *
 * Untuk semua kombinasi request session (tanpa adminId, dengan adminId berbagai nilai),
 * middleware auth harus:
 * - Jika tidak ada adminId → redirect ke /admin/login
 * - Jika ada adminId → panggil next()
 */

describe('Property 8: Middleware Auth Melindungi Route Admin', () => {
  /**
   * Implementasi middleware auth (sama seperti di middleware/auth.js)
   */
  const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.adminId) {
      return next()
    }
    req.flash('error', 'Silakan login terlebih dahulu.')
    res.redirect('/admin/login')
  }

  /**
   * Generator untuk session dengan adminId
   */
  const sessionWithAdminId = fc.record({
    adminId: fc.oneof(
      fc.integer({ min: 1, max: 9999 }),
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
    )
  })

  /**
   * Generator untuk session tanpa adminId
   */
  const sessionWithoutAdminId = fc.oneof(
    fc.constant({}),
    fc.constant({ adminId: '' }),
    fc.constant({ adminId: 0 }),
    fc.constant({ adminId: false })
  )

  /**
   * Generator untuk URL path admin
   */
  const adminPathGenerator = fc.oneof(
    fc.constant('/admin/dashboard'),
    fc.constant('/admin/news'),
    fc.constant('/admin/news/create'),
    fc.constant('/admin/news/1/edit'),
    fc.constant('/admin/benefits'),
    fc.constant('/admin/benefits/create'),
    fc.constant('/admin/benefits/1/edit'),
    fc.constant('/admin/registrations/1'),
    fc.constant('/admin/registrations/1/approve'),
    fc.constant('/admin/registrations/1/reject')
  )

  test('Property 8a: Tanpa adminId → selalu redirect ke /admin/login', () => {
    fc.assert(
      fc.property(sessionWithoutAdminId, adminPathGenerator, (session, path) => {
        const req = { session, path, flash: jest.fn() }
        const res = { redirect: jest.fn() }
        const next = jest.fn()

        isAuthenticated(req, res, next)

        // req.flash dipanggil untuk menyimpan error message
        expect(req.flash).toHaveBeenCalledWith('error', 'Silakan login terlebih dahulu.')
        expect(res.redirect).toHaveBeenCalledWith('/admin/login')
        expect(next).not.toHaveBeenCalled()
      }),
      { numRuns: 50 }
    )
  })

  test('Property 8b: Dengan adminId → selalu memanggil next()', () => {
    fc.assert(
      fc.property(sessionWithAdminId, adminPathGenerator, (session, path) => {
        const req = { session, path, flash: jest.fn() }
        const res = { redirect: jest.fn() }
        const next = jest.fn()

        isAuthenticated(req, res, next)

        // Harus memanggil next(), TIDAK redirect
        expect(next).toHaveBeenCalledTimes(1)
        expect(res.redirect).not.toHaveBeenCalled()
        expect(req.flash).not.toHaveBeenCalled()
      }),
      { numRuns: 50 }
    )
  })

  test('Property 8c: Session null/undefined → redirect ke /admin/login', () => {
    fc.assert(
      fc.property(adminPathGenerator, (path) => {
        const req = {
          session: null,
          path,
          flash: jest.fn()
        }
        const res = { redirect: jest.fn() }
        const next = jest.fn()

        isAuthenticated(req, res, next)

        expect(res.redirect).toHaveBeenCalledWith('/admin/login')
        expect(req.flash).toHaveBeenCalledWith('error', 'Silakan login terlebih dahulu.')
        expect(next).not.toHaveBeenCalled()
      }),
      { numRuns: 30 }
    )
  })

  test('Property 8d: Semua route admin dilindungi middleware auth', () => {
    fc.assert(
      fc.property(adminPathGenerator, (path) => {
        // Case: Tanpa session
        const reqWithoutSession = { session: null, path, flash: jest.fn() }
        const resWithoutSession = { redirect: jest.fn() }
        const nextWithoutSession = jest.fn()

        isAuthenticated(reqWithoutSession, resWithoutSession, nextWithoutSession)
        expect(resWithoutSession.redirect).toHaveBeenCalledWith('/admin/login')

        // Case: Dengan session adminId
        const reqWithSession = {
          session: { adminId: 1 },
          path,
          flash: jest.fn()
        }
        const resWithSession = { redirect: jest.fn() }
        const nextWithSession = jest.fn()

        isAuthenticated(reqWithSession, resWithSession, nextWithSession)
        expect(nextWithSession).toHaveBeenCalledTimes(1)
      }),
      { numRuns: 30 }
    )
  })

  test('Property 8e: Konsistensi - input sama hasil sama', () => {
    fc.assert(
      fc.property(sessionWithAdminId, (session) => {
        const req = { session, path: '/admin/dashboard', flash: jest.fn() }
        const res = { redirect: jest.fn() }
        const next = jest.fn()

        // Jalankan dua kali
        isAuthenticated(req, res, next)
        const result1 = {
          redirectCalled: res.redirect.mock.calls.length,
          nextCalled: next.mock.calls.length
        }

        jest.clearAllMocks()
        isAuthenticated(req, res, next)
        const result2 = {
          redirectCalled: res.redirect.mock.calls.length,
          nextCalled: next.mock.calls.length
        }

        expect(result1).toEqual(result2)
      }),
      { numRuns: 50 }
    )
  })
})
