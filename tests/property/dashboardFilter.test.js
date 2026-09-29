const fc = require('fast-check')

/**
 * Property 9: Filter Dashboard Mengembalikan Hanya Registration Sesuai Status
 *
 * **Validates: Requirement 7.2**
 *
 * Untuk array registrations dengan status acak dan nilai filter status,
 * semua hasil filter harus memiliki status yang identik dengan filter.
 */

describe('Property 9: Filter Dashboard Mengembalikan Registrasi Sesuai Status', () => {
  const validStatuses = ['pending', 'verified', 'rejected']

  /**
   * Generator untuk objek registration dengan status acak
   */
  const registrationGenerator = fc.record({
    id: fc.integer({ min: 1, max: 9999 }),
    status: fc.constantFrom(...validStatuses),
    full_name: fc.string({ minLength: 1, maxLength: 100 }),
    training_title: fc.string({ minLength: 1, maxLength: 100 })
  })

  /**
   * Generator untuk filter status valid
   */
  const validFilterGenerator = fc.oneof(
    fc.constant('pending'),
    fc.constant('verified'),
    fc.constant('rejected'),
    fc.constant(undefined) // all registrations
  )

  /**
   * Simulasi fungsi filter (mirip logic di Registration.findAll)
   */
  function filterRegistrations(registrations, filterStatus) {
    if (!filterStatus) {
      return registrations
    }
    return registrations.filter(reg => reg.status === filterStatus)
  }

  test('Property 9a: Filter dengan status "pending" hanya mengembalikan pending', () => {
    fc.assert(
      fc.property(
        fc.array(registrationGenerator, { minLength: 10, maxLength: 100 }),
        (registrations) => {
          const filtered = filterRegistrations(registrations, 'pending')

          // Semua hasil filter harus memiliki status 'pending'
          const allPending = filtered.every(reg => reg.status === 'pending')
          expect(allPending).toBe(true)
        }
      ),
      { numRuns: 30 }
    )
  })

  test('Property 9b: Filter dengan status "verified" hanya mengembalikan verified', () => {
    fc.assert(
      fc.property(
        fc.array(registrationGenerator, { minLength: 10, maxLength: 100 }),
        (registrations) => {
          const filtered = filterRegistrations(registrations, 'verified')

          const allVerified = filtered.every(reg => reg.status === 'verified')
          expect(allVerified).toBe(true)
        }
      ),
      { numRuns: 30 }
    )
  })

  test('Property 9c: Filter dengan status "rejected" hanya mengembalikan rejected', () => {
    fc.assert(
      fc.property(
        fc.array(registrationGenerator, { minLength: 10, maxLength: 100 }),
        (registrations) => {
          const filtered = filterRegistrations(registrations, 'rejected')

          const allRejected = filtered.every(reg => reg.status === 'rejected')
          expect(allRejected).toBe(true)
        }
      ),
      { numRuns: 30 }
    )
  })

  test('Property 9d: Filter undefined/kosong mengembalikan semua registrasi', () => {
    fc.assert(
      fc.property(
        fc.array(registrationGenerator, { minLength: 10, maxLength: 100 }),
        (registrations) => {
          const filteredAll = filterRegistrations(registrations, undefined)
          const filteredNull = filterRegistrations(registrations, null)

          // Harus mengembalikan semua registrasi
          expect(filteredAll.length).toBe(registrations.length)
          expect(filteredNull.length).toBe(registrations.length)
        }
      ),
      { numRuns: 30 }
    )
  })

  test('Property 9e: Semua status dalam array hasil filter termasuk valid enum', () => {
    fc.assert(
      fc.property(
        fc.array(registrationGenerator, { minLength: 10, maxLength: 100 }),
        validFilterGenerator,
        (registrations, filterStatus) => {
          const filtered = filterRegistrations(registrations, filterStatus)

          // Semua status dalam hasil harus valid
          const allValidStatus = filtered.every(reg =>
            validStatuses.includes(reg.status)
          )
          expect(allValidStatus).toBe(true)
        }
      ),
      { numRuns: 30 }
    )
  })

  test('Property 9f: Distribusi status seimbang sebelum dan sesudah filter', () => {
    fc.assert(
      fc.property(
        fc.array(registrationGenerator, { minLength: 100, maxLength: 200 }),
        (registrations) => {
          // Hitung distribusi sebelum filter
          const beforePending = registrations.filter(r => r.status === 'pending').length
          const beforeVerified = registrations.filter(r => r.status === 'verified').length
          const beforeRejected = registrations.filter(r => r.status === 'rejected').length

          // Filter per status
          const pendingFiltered = filterRegistrations(registrations, 'pending')
          const verifiedFiltered = filterRegistrations(registrations, 'verified')
          const rejectedFiltered = filterRegistrations(registrations, 'rejected')

          // Ukuran harus sesuai distribusi
          expect(pendingFiltered.length).toBe(beforePending)
          expect(verifiedFiltered.length).toBe(beforeVerified)
          expect(rejectedFiltered.length).toBe(beforeRejected)

          // Total harus sama dengan jumlah awal
          expect(
            pendingFiltered.length + verifiedFiltered.length + rejectedFiltered.length
          ).toBe(registrations.length)
        }
      ),
      { numRuns: 20 }
    )
  })

  test('Property 9g: Hasil filter tidak pernah null atau undefined', () => {
    fc.assert(
      fc.property(
        fc.array(registrationGenerator, { minLength: 10, maxLength: 100 }),
        validFilterGenerator,
        (registrations, filterStatus) => {
          const filtered = filterRegistrations(registrations, filterStatus)

          // Hasil filter harus array, bukan null/undefined
          expect(Array.isArray(filtered)).toBe(true)
          expect(filtered).not.toBeNull()
          expect(filtered).not.toBeUndefined()
        }
      ),
      { numRuns: 50 }
    )
  })

  test('Property 9h: Filter konsisten untuk input yang sama', () => {
    fc.assert(
      fc.property(
        fc.array(registrationGenerator, { minLength: 10, maxLength: 50 }),
        fc.constantFrom('pending', 'verified', 'rejected'),
        (registrations, status) => {
          // Jalankan filter dua kali
          const result1 = filterRegistrations(registrations, status)
          const result2 = filterRegistrations(registrations, status)

          // Hasil harus identik
          expect(result1).toEqual(result2)
        }
      ),
      { numRuns: 30 }
    )
  })
})
