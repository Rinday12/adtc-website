/**
 * Unit tests untuk generateReferenceCode di Registration model
 */

jest.mock('../../config/db', () => ({
  execute: jest.fn(),
  promise: jest.fn()
}))

const Registration = require('../../models/Registration')

// Format: ADTC-YYYY-<base36 timestamp><4-digit random>
// Contoh: ADTC-2026-MV6ECND31994
const CODE_REGEX = /^ADTC-\d{4}-[A-Z0-9]{4,12}\d{4}$/

describe('Registration.generateReferenceCode', () => {
  it('should return a string matching the reference code pattern', () => {
    const code = Registration.generateReferenceCode()
    expect(code).toMatch(CODE_REGEX)
  })

  it('should use current year', () => {
    const code = Registration.generateReferenceCode()
    const year = new Date().getFullYear()
    expect(code).toContain(`-${year}-`)
  })

  it('should end with a 4-digit number', () => {
    for (let i = 0; i < 100; i++) {
      const code = Registration.generateReferenceCode()
      const lastSegment = code.split('-')[2]
      // suffix = base36 timestamp + 4-digit random; random part is last 4 chars
      const randomPart = lastSegment.slice(-4)
      const num = parseInt(randomPart, 10)
      expect(num).toBeGreaterThanOrEqual(1000)
      expect(num).toBeLessThanOrEqual(9999)
    }
  })

  it('should generate different codes across calls', () => {
    const codes = new Set()
    for (let i = 0; i < 50; i++) {
      codes.add(Registration.generateReferenceCode())
    }
    expect(codes.size).toBeGreaterThan(1)
  })
})
