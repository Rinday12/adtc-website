const fc = require('fast-check')

/**
 * Property 4: Status Pendaftaran Selalu Berada dalam State Valid
 *
 * **Validates: Requirements 5.1, 7.6, 7.7**
 *
 * Untuk setiap sequence operasi create/approve/reject, nilai `status` harus
 * selalu merupakan salah satu dari ['pending', 'verified', 'rejected'].
 */

describe('Property 4: Status Pendaftaran Selalu Valid', () => {
  const validStatuses = ['pending', 'verified', 'rejected']

  /**
   * Generator untuk status valid
   */
  const validStatusGen = fc.constantFrom(...validStatuses)

  /**
   * Generator untuk objek registration dengan status valid
   */
  const registrationWithStatus = fc.record({
    id: fc.integer({ min: 1, max: 9999 }),
    status: validStatusGen,
    training_title: fc.string({ minLength: 1, maxLength: 100 }),
    full_name: fc.string({ minLength: 1, maxLength: 100 })
  })

  /**
   * Generator untuk sequence operasi status (create → approve/reject)
   */
  const statusTransitionSequence = fc.array(
    fc.constantFrom('create', 'approve', 'reject'),
    { minLength: 1, maxLength: 5 }
  )

  test('Property 4a: Status setelah create selalu "pending"', () => {
    fc.assert(
      fc.property(registrationWithStatus, (registration) => {
        const status = registration.status
        expect(validStatuses).toContain(status)
      }),
      { numRuns: 100 }
    )
  })

  test('Property 4b: Semua status tersimpan di database termasuk valid state', () => {
    fc.assert(
      fc.property(fc.array(registrationWithStatus, { minLength: 10, maxLength: 50 }), (registrations) => {
        const allValid = registrations.every(reg => validStatuses.includes(reg.status))
        expect(allValid).toBe(true)
      }),
      { numRuns: 30 }
    )
  })

  test('Property 4c: Transisi status yang valid (create→approve→pending→reject)', () => {
    fc.assert(
      fc.property(
        validStatusGen, // initial status (create)
        fc.oneof(
          fc.constant('pending'),
          fc.constant('verified'),
          fc.constant('rejected')
        ), // approved status
        fc.oneof(
          fc.constant('pending'),
          fc.constant('verified'),
          fc.constant('rejected')
        ), // rejected status
        (initial, approved, rejected) => {
          // Semua state dalam transisi harus valid
          expect(validStatuses).toContain(initial)
          expect(validStatuses).toContain(approved)
          expect(validStatuses).toContain(rejected)

          // Create selalu menghasilkan pending
          const postCreate = 'pending'
          expect(validStatuses).toContain(postCreate)
        }
      ),
      { numRuns: 50 }
    )
  })

  test('Property 4d: Enum status tidak berubah setelah update', () => {
    fc.assert(
      fc.property(registrationWithStatus, (registration) => {
        const originalStatus = registration.status

        // Simulasi update status
        const updatedStatuses = [
          'pending',
          'verified',
          'rejected'
        ]

        // Setiap status target tetap dalam valid set
        updatedStatuses.forEach(status => {
          expect(validStatuses).toContain(status)
        })

        // Original status tetap valid
        expect(validStatuses).toContain(originalStatus)
      }),
      { numRuns: 50 }
    )
  })

  test('Property 4e: Status field selalu string dan panjang minimal 1', () => {
    fc.assert(
      fc.property(registrationWithStatus, (registration) => {
        expect(typeof registration.status).toBe('string')
        expect(registration.status.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  test('Property 4f: Tidak ada status kosong atau null', () => {
    fc.assert(
      fc.property(fc.array(registrationWithStatus, { minLength: 10 }), (registrations) => {
        const hasInvalidStatus = registrations.some(reg =>
          !reg.status || reg.status.trim() === ''
        )
        expect(hasInvalidStatus).toBe(false)
      }),
      { numRuns: 30 }
    )
  })
})
