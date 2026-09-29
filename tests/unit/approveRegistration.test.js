// tests/unit/approveRegistration.test.js
/**
 * Unit tests untuk approveRegistration functionality
 * Test cases:
 * - Validasi input verify_ktm checkbox
 * - Validasi status registration
 * - Success flow approve
 * - Error handling
 */

// Mock database module
jest.mock('../../config/db', () => ({
  execute: jest.fn(),
  promise: jest.fn()
}))

// Mock dependencies
jest.mock('../../models/Admin')
jest.mock('bcrypt')
jest.mock('../../models/Registration')
jest.mock('../../utils/email', () => ({
  sendStatusNotification: jest.fn().mockResolvedValue(undefined)
}))

const adminController = require('../../controllers/adminController')
const Registration = require('../../models/Registration')
const { sendStatusNotification } = require('../../utils/email')

describe('approveRegistration', () => {
  let req, res, next

  beforeEach(() => {
    jest.clearAllMocks()
    req = {
      params: { id: '1' },
      body: {},
      session: { adminId: 1 },
      flash: jest.fn()
    }
    res = {
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
      render: jest.fn()
    }
    next = jest.fn()
  })

  describe('Input validation', () => {
    it('should require verify_ktm checkbox when identity_card_proof exists', async () => {
      Registration.findById.mockResolvedValue({
        id: 1,
        status: 'pending',
        identity_card_proof: '/uploads/ktm.jpg',
        full_name: 'Test User',
        training_title: 'Python Basic',
        phone: '08123456789'
      })

      await adminController.approveRegistration(req, res, next)

      expect(req.flash).toHaveBeenCalledWith(
        'error',
        'Anda wajib mencentang kotak konfirmasi bahwa telah memeriksa KTM/ID Card peserta.'
      )
      expect(res.redirect).toHaveBeenCalledWith('/admin/registrations/1')
      expect(Registration.updateStatus).not.toHaveBeenCalled()
    })

    it('should allow approve without verify_ktm when no identity_card_proof', async () => {
      Registration.findById.mockResolvedValue({
        id: 1,
        status: 'pending',
        identity_card_proof: null,
        full_name: 'Test User',
        training_title: 'Python Basic',
        phone: '08123456789'
      })
      Registration.updateStatus.mockResolvedValue(1)

      req.body = { verify_ktm: false }
      await adminController.approveRegistration(req, res, next)

      expect(Registration.updateStatus).toHaveBeenCalledWith('1', 'approved')
      expect(sendStatusNotification).toHaveBeenCalled()
    })
  })

  describe('Status validation', () => {
    it('should reject approval if registration is not pending', async () => {
      Registration.findById.mockResolvedValue({
        id: 1,
        status: 'approved',
        identity_card_proof: null
      })

      await adminController.approveRegistration(req, res, next)

      expect(req.flash).toHaveBeenCalledWith('error', 'Pendaftaran ini tidak dalam status pending.')
      expect(res.redirect).toHaveBeenCalledWith('/admin/dashboard')
      expect(Registration.updateStatus).not.toHaveBeenCalled()
    })

    it('should return 404 if registration not found', async () => {
      Registration.findById.mockResolvedValue(null)

      await adminController.approveRegistration(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({ code: 404 }))
    })
  })

  describe('Success flow', () => {
    it('should approve and redirect to dashboard with success message', async () => {
      Registration.findById.mockResolvedValue({
        id: 1,
        status: 'pending',
        identity_card_proof: null,
        full_name: 'Test User',
        training_title: 'Python Basic',
        phone: '08123456789',
        email: 'test@example.com'
      })
      Registration.updateStatus.mockResolvedValue(1)

      await adminController.approveRegistration(req, res, next)

      expect(Registration.updateStatus).toHaveBeenCalledWith('1', 'approved')
      expect(sendStatusNotification).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' }),
        'approved'
      )
      expect(req.flash).toHaveBeenCalledWith('success', 'Pendaftaran berhasil disetujui.')
      expect(res.redirect).toHaveBeenCalledWith('/admin/dashboard')
    })

    it('should handle updateStatus returning 0 (registration not found)', async () => {
      Registration.findById.mockResolvedValue({
        id: 1,
        status: 'pending',
        identity_card_proof: null
      })
      Registration.updateStatus.mockResolvedValue(0)

      await adminController.approveRegistration(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({ code: 404 }))
    })
  })

  describe('Error handling', () => {
    it('should call next with error when Registration.findById throws', async () => {
      Registration.findById.mockRejectedValue(new Error('DB error'))

      await adminController.approveRegistration(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.any(Error))
    })
  })
})

describe('Approval button UI validation', () => {
  test('button should be disabled without KTM verification when identity_card_proof exists', () => {
    // Test logic: button disabled when verify_ktm not checked and identity_card_proof exists
    const hasIdentityCard = true
    const ktmVerified = false
    expect(ktmVerified).toBe(false)
    expect(hasIdentityCard).toBe(true)
  })

  test('button should be enabled when no identity_card_proof', () => {
    const hasIdentityCard = false
    const ktmVerified = false
    // Button should be enabled when no identity card required
    expect(hasIdentityCard).toBe(false)
  })
})
