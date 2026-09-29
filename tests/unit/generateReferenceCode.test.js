/**
 * Unit tests untuk generateReferenceCode di Registration model
 */

jest.mock('../../config/db', () => ({
  execute: jest.fn(),
  promise: jest.fn()
}))

const Registration = require('../../models/Registration')

describe('Registration.generateReferenceCode', () => {
  it('should return a string matching ADTC-YYYY-NNNN pattern', () => {
    const code = Registration.generateReferenceCode()
    expect(code).toMatch(/^ADTC-\d{4}-\d{4}$/)
  })

  it('should use current year', () => {
    const code = Registration.generateReferenceCode()
    const year = new Date().getFullYear()
    expect(code).toContain(`-${year}-`)
  })

  it('should return a 4-digit number after the year (1000-9999)', () => {
    for (let i = 0; i < 100; i++) {
      const code = Registration.generateReferenceCode()
      const suffix = code.split('-')[2]
      const num = parseInt(suffix, 10)
      expect(num).toBeGreaterThanOrEqual(1000)
      expect(num).toBeLessThanOrEqual(9999)
    }
  })

  it('should generate different codes across calls', () => {
    const codes = new Set()
    for (let i = 0; i < 50; i++) {
      codes.add(Registration.generateReferenceCode())
    }
    // Should have at least some variation
    expect(codes.size).toBeGreaterThan(1)
  })
})
