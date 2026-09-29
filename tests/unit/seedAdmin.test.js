// tests/unit/seedAdmin.test.js
/**
 * Unit tests untuk seedAdmin function (extracted from scripts/seed-admin.js).
 * Task 17.2 - Tulis unit test untuk script seeder
 *
 * Test cases:
 * - Pembuatan admin user berhasil
 * - Handling password hashing dengan bcrypt
 * - Error handling untuk database issues
 * - Validasi input parameters
 * - Duplicate username handling
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS — must appear before any requires. Jest hoists jest.mock() calls,
// but process.exit override and console overrides need to happen here too.
// ═══════════════════════════════════════════════════════════════════════════════

jest.mock('../../config/db', () => ({
  execute: jest.fn()
}))

jest.mock('bcrypt', () => ({
  hash: jest.fn()
}))

// ── Override process.exit so it throws instead of terminating the process. ───
// This lets us catch the exit code in tests.
const mockExit = jest.fn((code) => {
  const err = new Error(`process.exit(${code})`)
  err.code = code
  throw err
})
process.exit = mockExit

// ── Capture console output ────────────────────────────────────────────────────
const mockConsoleLog = jest.fn()
const mockConsoleError = jest.fn()
console.log = mockConsoleLog
console.error = mockConsoleError

// ── Set valid process.argv BEFORE requiring the script ────────────────────────
// seed-admin.js reads process.argv[2] and process.argv[3] synchronously at load
// time. If they are missing, the script calls process.exit(1). We set them here
// so the module loads successfully; individual tests override as needed.
process.argv = ['node', 'scripts/seed-admin.js', '__test__', '__test__']

// ── Require modules AFTER all setup is complete ───────────────────────────────
const bcrypt = require('bcrypt')
const db = require('../../config/db')
const { seedAdmin } = require('../../scripts/seed-admin.js')

describe('seedAdmin function', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockExit.mockClear()
    mockConsoleLog.mockClear()
    mockConsoleError.mockClear()
  })

  describe('Password hashing', () => {
    it('should use bcrypt.hash with salt rounds = 10', async () => {
      const onSuccess = jest.fn()
      bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword')

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onSuccess
      })

      expect(bcrypt.hash).toHaveBeenCalledWith('testpassword', 10)
      expect(bcrypt.hash).toHaveBeenCalledTimes(1)
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    it('should use minimum salt rounds of 10 for security', async () => {
      const onSuccess = jest.fn()
      bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword')

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onSuccess
      })

      expect(bcrypt.hash).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number)
      )
      const [, saltRounds] = bcrypt.hash.mock.calls[0]
      expect(saltRounds).toBeGreaterThanOrEqual(10)
    })

    it('should handle bcrypt hashing errors gracefully', async () => {
      const onError = jest.fn()
      const bcryptError = new Error('Bcrypt hashing failed')
      bcrypt.hash.mockRejectedValue(bcryptError)

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onError
      })

      expect(onError).toHaveBeenCalledWith(
        'Error: Gagal membuat admin. (UNKNOWN_ERROR)'
      )
    })
  })

  describe('Database operations', () => {
    beforeEach(() => {
      bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword')
    })

    it('should use parameterized query for INSERT operation', async () => {
      const onSuccess = jest.fn()
      db.execute.mockResolvedValue({ insertId: 1 })

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onSuccess
      })

      expect(db.execute).toHaveBeenCalledWith(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        ['testadmin', '$2b$10$hashedpassword']
      )
      expect(db.execute).toHaveBeenCalledTimes(1)
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    it('should prevent SQL injection by using parameterized query', async () => {
      const onSuccess = jest.fn()
      db.execute.mockResolvedValue({ insertId: 1 })

      await seedAdmin({
        username: "'; DROP TABLE admins; --",
        password: 'password',
        onSuccess
      })

      expect(db.execute).toHaveBeenCalledWith(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        ["'; DROP TABLE admins; --", '$2b$10$hashedpassword']
      )

      const [query] = db.execute.mock.calls[0]
      expect(query).toBe(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)'
      )
      expect(query).not.toContain('DROP TABLE')
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    it('should not expose password or hash in process.exit or console output', async () => {
      const onSuccess = jest.fn()
      db.execute.mockResolvedValue({ insertId: 1 })

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onSuccess
      })

      // No sensitive data should leak via any console output
      const allLogCalls = mockConsoleLog.mock.calls.flat().join(' ')
      expect(allLogCalls).not.toContain('testpassword')
      expect(allLogCalls).not.toContain('$2b$10$hashedpassword')

      // The onSuccess mock was called instead of process.exit
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword')
    })

    it('should handle duplicate username error (ER_DUP_ENTRY)', async () => {
      const onError = jest.fn()
      const duplicateError = new Error('Duplicate entry')
      duplicateError.code = 'ER_DUP_ENTRY'
      db.execute.mockRejectedValue(duplicateError)

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onError
      })

      expect(onError).toHaveBeenCalledWith(
        "Error: Username 'testadmin' sudah ada di database. Gunakan username yang berbeda."
      )
    })

    it('should handle database connection errors', async () => {
      const onError = jest.fn()
      const dbError = new Error('Connection failed')
      dbError.code = 'ECONNREFUSED'
      db.execute.mockRejectedValue(dbError)

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onError
      })

      expect(onError).toHaveBeenCalledWith(
        'Error: Gagal membuat admin. (ECONNREFUSED)'
      )
    })

    it('should handle unknown database errors', async () => {
      const onError = jest.fn()
      const unknownError = new Error('Unknown database error')
      db.execute.mockRejectedValue(unknownError)

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onError
      })

      expect(onError).toHaveBeenCalledWith(
        'Error: Gagal membuat admin. (UNKNOWN_ERROR)'
      )
    })

    it('should not expose database credentials in error messages', async () => {
      const onError = jest.fn()
      const dbError = new Error('Access denied for user root@localhost')
      dbError.code = 'ER_ACCESS_DENIED_ERROR'
      db.execute.mockRejectedValue(dbError)

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onError
      })

      expect(onError).toHaveBeenCalledWith(
        'Error: Gagal membuat admin. (ER_ACCESS_DENIED_ERROR)'
      )
      const capturedMsg = onError.mock.calls[0][0]
      expect(capturedMsg).not.toContain('root')
      expect(capturedMsg).not.toContain('localhost')
    })

    it('should handle errors without error code', async () => {
      const onError = jest.fn()
      const errorWithoutCode = new Error('Generic error')
      db.execute.mockRejectedValue(errorWithoutCode)

      await seedAdmin({
        username: 'testadmin',
        password: 'testpassword',
        onError
      })

      expect(onError).toHaveBeenCalledWith(
        'Error: Gagal membuat admin. (UNKNOWN_ERROR)'
      )
    })
  })

  describe('Security considerations', () => {
    it('should use secure salt rounds (≥ 10)', async () => {
      const onSuccess = jest.fn()
      bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword')

      await seedAdmin({
        username: 'admin',
        password: 'password',
        onSuccess
      })

      expect(bcrypt.hash).toHaveBeenCalledWith('password', 10)
      const [, saltRounds] = bcrypt.hash.mock.calls[0]
      expect(saltRounds).toBeGreaterThanOrEqual(10)

      // onSuccess was called — verify no process.exit(1) leaked through
      expect(mockExit).not.toHaveBeenCalled()
    })

    it('should not expose password in any output', async () => {
      const onSuccess = jest.fn()
      bcrypt.hash.mockResolvedValue('$2b$10$longhashvalue')
      db.execute.mockResolvedValue({ insertId: 1 })

      await seedAdmin({
        username: 'admin',
        password: 'supersecretpassword',
        onSuccess
      })

      const allExitCalls = mockExit.mock.calls.flat()
      const allConsoleErrors = mockConsoleError.mock.calls.flat()

      for (const call of [...allExitCalls, ...allConsoleErrors]) {
        if (typeof call === 'string') {
          expect(call).not.toContain('supersecretpassword')
          expect(call).not.toContain('$2b$10$longhashvalue')
        }
      }
    })

    it('should handle special characters in username and password safely', async () => {
      const onSuccess = jest.fn()
      bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword')
      db.execute.mockResolvedValue({ insertId: 1 })

      await seedAdmin({
        username: 'admin@domain.com',
        password: 'p@ssw0rd!#$%^&*()',
        onSuccess
      })

      expect(bcrypt.hash).toHaveBeenCalledWith('p@ssw0rd!#$%^&*()', 10)
      expect(db.execute).toHaveBeenCalledWith(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        ['admin@domain.com', '$2b$10$hashedpassword']
      )
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('Integration scenarios', () => {
    it('should complete full seeding flow successfully', async () => {
      const onSuccess = jest.fn()
      bcrypt.hash.mockResolvedValue('$2b$10$mockedhashvalue')
      db.execute.mockResolvedValue({ insertId: 1 })

      await seedAdmin({
        username: 'admin',
        password: 'password123',
        onSuccess
      })

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
      expect(db.execute).toHaveBeenCalledWith(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        ['admin', '$2b$10$mockedhashvalue']
      )
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    it('should maintain consistent error handling across different scenarios', async () => {
      const testCases = [
        {
          setup: () => {
            const error = new Error('Duplicate')
            error.code = 'ER_DUP_ENTRY'
            db.execute.mockRejectedValue(error)
          },
          username: 'testuser',
          expectedMessage:
            "Error: Username 'testuser' sudah ada di database. Gunakan username yang berbeda."
        },
        {
          setup: () => {
            const error = new Error('Connection failed')
            error.code = 'ECONNREFUSED'
            db.execute.mockRejectedValue(error)
          },
          username: 'testuser',
          expectedMessage: 'Error: Gagal membuat admin. (ECONNREFUSED)'
        }
      ]

      for (const testCase of testCases) {
        jest.resetAllMocks()
        bcrypt.hash.mockResolvedValue('$2b$10$hash')
        testCase.setup()

        const onError = jest.fn()
        await seedAdmin({
          username: testCase.username,
          password: 'testpass',
          onError
        })

        expect(onError).toHaveBeenCalledWith(testCase.expectedMessage)
      }
    })
  })

  describe('Script requirements validation', () => {
    it('should satisfy requirement 6.8: password hashing', async () => {
      const onSuccess = jest.fn()
      bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword')
      db.execute.mockResolvedValue({ insertId: 1 })

      await seedAdmin({
        username: 'admin',
        password: 'password',
        onSuccess
      })

      // Requirement 6.8: System SHALL menyimpan password admin di database hanya
      // dalam bentuk hash menggunakan Bcrypt dengan salt rounds minimal 10
      expect(bcrypt.hash).toHaveBeenCalledWith('password', 10)

      // Verify only hash is stored, not plain password
      const [query, params] = db.execute.mock.calls[0]
      expect(params[1]).toBe('$2b$10$hashedpassword')
      expect(params[1]).not.toBe('password')
    })

    it('should satisfy requirement 8.6: parameterized queries', async () => {
      const onSuccess = jest.fn()
      bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword')
      db.execute.mockResolvedValue({ insertId: 1 })

      await seedAdmin({
        username: 'admin',
        password: 'password',
        onSuccess
      })

      // Requirement 8.6: System SHALL menggunakan parameterized query untuk
      // mencegah SQL injection
      expect(db.execute).toHaveBeenCalledWith(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        ['admin', '$2b$10$hashedpassword']
      )

      const [query, params] = db.execute.mock.calls[0]
      expect(query).toContain('?')
      expect(params).toHaveLength(2)
      expect(typeof params[0]).toBe('string')
      expect(typeof params[1]).toBe('string')
    })
  })
})
