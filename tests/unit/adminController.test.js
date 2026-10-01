// tests/unit/adminController.test.js
/**
 * Unit tests untuk adminController, khususnya postLogin method
 * Task 8.2 - Tulis unit test untuk adminController postLogin
 * 
 * Test cases:
 * - Login berhasil dengan kredensial valid
 * - Login gagal dengan kredensial invalid
 * - Handling session dan redirects
 * - Error handling
 */

// Mock database module before importing other modules
jest.mock('../../config/db', () => ({
  execute: jest.fn(),
  promise: jest.fn()
}))

// fs di-spy per-test (lihat deleteRegistration) untuk mengisolasi
// pembersihan file bukti saat deleteRegistration — record DB yang
// sudah terhapus tidak boleh bergantung pada ketersediaan file.
const adminController = require('../../controllers/adminController')
const Admin = require('../../models/Admin')
const bcrypt = require('bcrypt')
const fs = require('fs')

const Registration = require('../../models/Registration')

// Mock dependencies
jest.mock('../../models/Admin')
jest.mock('bcrypt')
jest.mock('../../models/Registration')

describe('adminController', () => {
  describe('postLogin', () => {
    let req, res, next

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks()

      // Mock request object
      req = {
        body: {},
        session: {},
        flash: jest.fn()
      }

      // Mock response object
      res = {
        redirect: jest.fn()
      }

      // Mock next function
      next = jest.fn()
    })

    describe('Input validation', () => {
      it('should flash error and redirect when username is empty', async () => {
        req.body = { username: '', password: 'password123' }

        await adminController.postLogin(req, res, next)

        expect(req.flash).toHaveBeenCalledWith('error', 'Username dan password wajib diisi.')
        expect(res.redirect).toHaveBeenCalledWith('/admin/login')
        expect(Admin.findByUsername).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
      })

      it('should flash error and redirect when password is empty', async () => {
        req.body = { username: 'admin', password: '' }

        await adminController.postLogin(req, res, next)

        expect(req.flash).toHaveBeenCalledWith('error', 'Username dan password wajib diisi.')
        expect(res.redirect).toHaveBeenCalledWith('/admin/login')
        expect(Admin.findByUsername).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
      })

      it('should flash error and redirect when both username and password are empty', async () => {
        req.body = { username: '', password: '' }

        await adminController.postLogin(req, res, next)

        expect(req.flash).toHaveBeenCalledWith('error', 'Username dan password wajib diisi.')
        expect(res.redirect).toHaveBeenCalledWith('/admin/login')
        expect(Admin.findByUsername).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
      })

      it('should flash error and redirect when username is undefined', async () => {
        req.body = { password: 'password123' }

        await adminController.postLogin(req, res, next)

        expect(req.flash).toHaveBeenCalledWith('error', 'Username dan password wajib diisi.')
        expect(res.redirect).toHaveBeenCalledWith('/admin/login')
        expect(Admin.findByUsername).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
      })

      it('should flash error and redirect when password is undefined', async () => {
        req.body = { username: 'admin' }

        await adminController.postLogin(req, res, next)

        expect(req.flash).toHaveBeenCalledWith('error', 'Username dan password wajib diisi.')
        expect(res.redirect).toHaveBeenCalledWith('/admin/login')
        expect(Admin.findByUsername).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
      })
    })

    describe('Username verification', () => {
      it('should flash error when username does not exist', async () => {
        req.body = { username: 'nonexistent', password: 'password123' }
        Admin.findByUsername.mockResolvedValue(null)

        await adminController.postLogin(req, res, next)

        expect(Admin.findByUsername).toHaveBeenCalledWith('nonexistent')
        expect(req.flash).toHaveBeenCalledWith('error', 'Username atau password salah.')
        expect(res.redirect).toHaveBeenCalledWith('/admin/login')
        expect(bcrypt.compare).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
      })

      it('should not reveal whether username or password is wrong', async () => {
        req.body = { username: 'nonexistent', password: 'wrongpassword' }
        Admin.findByUsername.mockResolvedValue(null)

        await adminController.postLogin(req, res, next)

        expect(req.flash).toHaveBeenCalledWith('error', 'Username atau password salah.')
        // Should not reveal specific reason (username vs password)
        expect(req.flash).not.toHaveBeenCalledWith('error', expect.stringContaining('username'))
      })
    })

    describe('Password verification', () => {
      const mockAdmin = {
        id: 1,
        username: 'admin',
        password_hash: '$2b$10$hashedpassword'
      }

      it('should flash error when password is incorrect', async () => {
        req.body = { username: 'admin', password: 'wrongpassword' }
        Admin.findByUsername.mockResolvedValue(mockAdmin)
        bcrypt.compare.mockResolvedValue(false)

        await adminController.postLogin(req, res, next)

        expect(Admin.findByUsername).toHaveBeenCalledWith('admin')
        expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', '$2b$10$hashedpassword')
        expect(req.flash).toHaveBeenCalledWith('error', 'Username atau password salah.')
        expect(res.redirect).toHaveBeenCalledWith('/admin/login')
        expect(req.session.adminId).toBeUndefined()
        expect(next).not.toHaveBeenCalled()
      })

      it('should not reveal whether username or password is wrong', async () => {
        req.body = { username: 'admin', password: 'wrongpassword' }
        Admin.findByUsername.mockResolvedValue(mockAdmin)
        bcrypt.compare.mockResolvedValue(false)

        await adminController.postLogin(req, res, next)

        // Should use the same generic error message as for invalid username
        expect(req.flash).toHaveBeenCalledWith('error', 'Username atau password salah.')
        expect(req.flash).toHaveBeenCalledTimes(1)
      })
    })

    describe('Successful login', () => {
      const mockAdmin = {
        id: 1,
        username: 'admin',
        password_hash: '$2b$10$hashedpassword'
      }

      it('should set session and redirect to dashboard on valid credentials', async () => {
        req.body = { username: 'admin', password: 'correctpassword' }
        Admin.findByUsername.mockResolvedValue(mockAdmin)
        bcrypt.compare.mockResolvedValue(true)

        await adminController.postLogin(req, res, next)

        expect(Admin.findByUsername).toHaveBeenCalledWith('admin')
        expect(bcrypt.compare).toHaveBeenCalledWith('correctpassword', '$2b$10$hashedpassword')
        expect(req.session.adminId).toBe(1)
        expect(req.session.adminUsername).toBe('admin')
        expect(res.redirect).toHaveBeenCalledWith('/admin/landing')
        expect(req.flash).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
      })

      it('should handle admin with different id and username correctly', async () => {
        const differentAdmin = {
          id: 42,
          username: 'superadmin',
          password_hash: '$2b$10$differenthashedpassword'
        }
        
        req.body = { username: 'superadmin', password: 'adminpassword' }
        Admin.findByUsername.mockResolvedValue(differentAdmin)
        bcrypt.compare.mockResolvedValue(true)

        await adminController.postLogin(req, res, next)

        expect(req.session.adminId).toBe(42)
        expect(req.session.adminUsername).toBe('superadmin')
        expect(res.redirect).toHaveBeenCalledWith('/admin/landing')
      })

      it('should not call flash on successful login', async () => {
        req.body = { username: 'admin', password: 'correctpassword' }
        Admin.findByUsername.mockResolvedValue(mockAdmin)
        bcrypt.compare.mockResolvedValue(true)

        await adminController.postLogin(req, res, next)

        expect(req.flash).not.toHaveBeenCalled()
      })
    })

    describe('Error handling', () => {
      it('should call next with error when Admin.findByUsername throws', async () => {
        req.body = { username: 'admin', password: 'password123' }
        const dbError = new Error('Database connection failed')
        Admin.findByUsername.mockRejectedValue(dbError)

        await adminController.postLogin(req, res, next)

        expect(next).toHaveBeenCalledWith(dbError)
        expect(req.flash).not.toHaveBeenCalled()
        expect(res.redirect).not.toHaveBeenCalled()
      })

      it('should call next with error when bcrypt.compare throws', async () => {
        const mockAdmin = {
          id: 1,
          username: 'admin',
          password_hash: '$2b$10$hashedpassword'
        }
        
        req.body = { username: 'admin', password: 'password123' }
        Admin.findByUsername.mockResolvedValue(mockAdmin)
        const bcryptError = new Error('Bcrypt comparison failed')
        bcrypt.compare.mockRejectedValue(bcryptError)

        await adminController.postLogin(req, res, next)

        expect(next).toHaveBeenCalledWith(bcryptError)
        expect(req.flash).not.toHaveBeenCalled()
        expect(res.redirect).not.toHaveBeenCalled()
      })

      it('should handle unexpected errors gracefully', async () => {
        req.body = { username: 'admin', password: 'password123' }
        const unexpectedError = new Error('Unexpected error occurred')
        Admin.findByUsername.mockImplementation(() => {
          throw unexpectedError
        })

        await adminController.postLogin(req, res, next)

        expect(next).toHaveBeenCalledWith(unexpectedError)
      })
    })

    describe('Security considerations', () => {
      it('should use bcrypt.compare for password verification', async () => {
        const mockAdmin = {
          id: 1,
          username: 'admin',
          password_hash: '$2b$10$hashedpassword'
        }
        
        req.body = { username: 'admin', password: 'testpassword' }
        Admin.findByUsername.mockResolvedValue(mockAdmin)
        bcrypt.compare.mockResolvedValue(true)

        await adminController.postLogin(req, res, next)

        expect(bcrypt.compare).toHaveBeenCalledWith('testpassword', '$2b$10$hashedpassword')
        expect(bcrypt.compare).toHaveBeenCalledTimes(1)
      })

      it('should not store password in session', async () => {
        const mockAdmin = {
          id: 1,
          username: 'admin',
          password_hash: '$2b$10$hashedpassword'
        }
        
        req.body = { username: 'admin', password: 'testpassword' }
        Admin.findByUsername.mockResolvedValue(mockAdmin)
        bcrypt.compare.mockResolvedValue(true)

        await adminController.postLogin(req, res, next)

        expect(req.session.password).toBeUndefined()
        expect(req.session.password_hash).toBeUndefined()
        expect(req.session.adminId).toBe(1)
        expect(req.session.adminUsername).toBe('admin')
      })

      it('should use same error message for both invalid username and password', async () => {
        const errorMessage = 'Username atau password salah.'
        
        // Test invalid username
        req.body = { username: 'invalid', password: 'password123' }
        Admin.findByUsername.mockResolvedValue(null)
        
        await adminController.postLogin(req, res, next)
        expect(req.flash).toHaveBeenCalledWith('error', errorMessage)
        
        // Reset and test invalid password
        jest.clearAllMocks()
        const mockAdmin = {
          id: 1,
          username: 'admin',
          password_hash: '$2b$10$hashedpassword'
        }
        
        req.body = { username: 'admin', password: 'wrongpassword' }
        Admin.findByUsername.mockResolvedValue(mockAdmin)
        bcrypt.compare.mockResolvedValue(false)
        
        await adminController.postLogin(req, res, next)
        expect(req.flash).toHaveBeenCalledWith('error', errorMessage)
      })
    })

    describe('Input sanitization', () => {
      it('should handle whitespace in username and password', async () => {
        req.body = { username: '  admin  ', password: '  password123  ' }
        Admin.findByUsername.mockResolvedValue(null)

        await adminController.postLogin(req, res, next)

        // Should query with the exact input (no trimming expected in controller)
        expect(Admin.findByUsername).toHaveBeenCalledWith('  admin  ')
        expect(req.flash).toHaveBeenCalledWith('error', 'Username atau password salah.')
      })

      it('should handle special characters in credentials', async () => {
        req.body = { username: 'admin@domain.com', password: 'p@ssw0rd!#$' }
        Admin.findByUsername.mockResolvedValue(null)

        await adminController.postLogin(req, res, next)

        expect(Admin.findByUsername).toHaveBeenCalledWith('admin@domain.com')
        expect(req.flash).toHaveBeenCalledWith('error', 'Username atau password salah.')
      })
    })

    describe('Integration scenarios', () => {
      it('should complete full authentication flow correctly', async () => {
        const mockAdmin = {
          id: 1,
          username: 'admin',
          password_hash: '$2b$10$hashedpassword'
        }
        
        req.body = { username: 'admin', password: 'correctpassword' }

        // Mock the complete flow
        Admin.findByUsername.mockResolvedValue(mockAdmin)
        bcrypt.compare.mockResolvedValue(true)

        await adminController.postLogin(req, res, next)

        // Verify complete flow
        expect(Admin.findByUsername).toHaveBeenCalledWith('admin')
        expect(bcrypt.compare).toHaveBeenCalledWith('correctpassword', '$2b$10$hashedpassword')
        expect(req.session.adminId).toBe(1)
        expect(req.session.adminUsername).toBe('admin')
        expect(res.redirect).toHaveBeenCalledWith('/admin/landing')
        expect(req.flash).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
      })

      it('should handle case-sensitive username correctly', async () => {
        req.body = { username: 'Admin', password: 'password123' }
        Admin.findByUsername.mockResolvedValue(null)

        await adminController.postLogin(req, res, next)

        expect(Admin.findByUsername).toHaveBeenCalledWith('Admin')
        expect(req.flash).toHaveBeenCalledWith('error', 'Username atau password salah.')
      })
    })
  })

  // Additional tests for other methods can be added here if needed
  describe('getLogin', () => {
    let req, res

    beforeEach(() => {
      req = {
        session: {}
      }
      res = {
        redirect: jest.fn(),
        render: jest.fn()
      }
    })

    it('should redirect to landing if already logged in', () => {
      req.session.adminId = 1

      adminController.getLogin(req, res)

      expect(res.redirect).toHaveBeenCalledWith('/admin/landing')
      expect(res.render).not.toHaveBeenCalled()
    })

    it('should render login form if not logged in', () => {
      adminController.getLogin(req, res)

      expect(res.render).toHaveBeenCalledWith('admin/login', { title: 'Login Admin ADTC' })
      expect(res.redirect).not.toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    let req, res

    beforeEach(() => {
      req = {
        session: {
          destroy: jest.fn()
        }
      }
      res = {
        redirect: jest.fn()
      }
    })

    it('should destroy session and redirect to login', () => {
      req.session.destroy.mockImplementation((callback) => callback())

      adminController.logout(req, res)

      expect(req.session.destroy).toHaveBeenCalled()
      expect(res.redirect).toHaveBeenCalledWith('/admin/login')
    })
  })

  describe('deleteRegistration', () => {
    let req, res, next, fsSpy

    beforeEach(() => {
      jest.clearAllMocks()
      req = {
        params: { id: '42' },
        body: {},
        flash: jest.fn()
      }
      res = {
        status: jest.fn().mockReturnThis(),
        render: jest.fn(),
        redirect: jest.fn()
      }
      next = jest.fn()
      fsSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {})
    })

    afterEach(() => {
      if (fsSpy) fsSpy.mockRestore()
    })

    it('renders 404 when registration not found', async () => {
      Registration.findById.mockResolvedValue(null)

      await adminController.deleteRegistration(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({ message: 'Pendaftaran tidak ditemukan' }))
      expect(Registration.removeById).not.toHaveBeenCalled()
      expect(res.redirect).not.toHaveBeenCalled()
    })

    it('flashes error and redirects without deleting when already rejected', async () => {
      Registration.findById.mockResolvedValue({
        id: 42,
        full_name: 'Budi Santoso',
        status: 'rejected',
        payment_proof: 'uploads/payment_proofs/x.png'
      })

      await adminController.deleteRegistration(req, res, next)

      expect(req.flash).toHaveBeenCalledWith('error', 'Pendaftaran ini sudah ditolak.')
      expect(res.redirect).toHaveBeenCalledWith('/admin/dashboard')
      expect(Registration.removeById).not.toHaveBeenCalled()
      expect(fsSpy).not.toHaveBeenCalled()
    })

    it('permanently deletes the record, removes proof files, and flashes success', async () => {
      Registration.findById.mockResolvedValue({
        id: 42,
        full_name: 'Budi Santoso',
        status: 'verified',
        payment_proof: 'uploads/payment_proofs/payment-proof-1.png',
        identity_card_proof: 'uploads/identity_cards/identity-card-proof-2.jpg'
      })
      Registration.removeById.mockResolvedValue(1)
      req.body = { rejection_reason: ' Peserta minta refund ' }

      await adminController.deleteRegistration(req, res, next)

      expect(Registration.removeById).toHaveBeenCalledWith('42')
      expect(Registration.updateStatusWithReason).not.toHaveBeenCalled()
      expect(fsSpy).toHaveBeenCalledWith(expect.stringContaining('uploads/payment_proofs/payment-proof-1.png'))
      expect(fsSpy).toHaveBeenCalledWith(expect.stringContaining('uploads/identity_cards/identity-card-proof-2.jpg'))
      expect(req.flash).toHaveBeenCalledWith('success', expect.stringContaining('Budi Santoso'))
      expect(req.flash).toHaveBeenCalledWith('success', expect.stringContaining('Peserta minta refund'))
      expect(res.redirect).toHaveBeenCalledWith('/admin/dashboard')
      expect(next).not.toHaveBeenCalled()
    })

    it('still succeeds and flashes when proof files are missing or fail to delete', async () => {
      Registration.findById.mockResolvedValue({
        id: 42,
        full_name: 'Budi Santoso',
        status: 'approved',
        payment_proof: 'uploads/payment_proofs/already-gone.png'
      })
      Registration.removeById.mockResolvedValue(1)
      fsSpy.mockImplementation(() => {
        throw new Error('ENOENT')
      })

      await adminController.deleteRegistration(req, res, next)

      // Kegagalan hapus file tidak boleh membatalkan penghapusan data
      expect(Registration.removeById).toHaveBeenCalledWith('42')
      expect(req.flash).toHaveBeenCalledWith('success', expect.stringContaining('berhasil dihapus'))
      expect(res.redirect).toHaveBeenCalledWith('/admin/dashboard')
      expect(next).not.toHaveBeenCalled()
    })

    it('renders 404 when record vanished between find and delete (affectedRows = 0)', async () => {
      Registration.findById.mockResolvedValue({
        id: 42,
        full_name: 'Budi Santoso',
        status: 'pending',
        payment_proof: null,
        identity_card_proof: null
      })
      Registration.removeById.mockResolvedValue(0)

      await adminController.deleteRegistration(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.render).toHaveBeenCalled()
      expect(res.redirect).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next with the error when removeById throws', async () => {
      Registration.findById.mockResolvedValue({
        id: 42,
        full_name: 'Budi Santoso',
        status: 'pending'
      })
      Registration.removeById.mockRejectedValue(new Error('DB down'))

      await adminController.deleteRegistration(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'DB down' }))
      expect(res.redirect).not.toHaveBeenCalled()
    })
  })
})
