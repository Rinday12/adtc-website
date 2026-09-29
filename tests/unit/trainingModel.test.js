const Training = require('../../models/Training')

describe('Training model: validateTrainingRow', () => {
  it('should return valid=true for a complete row', () => {
    const result = Training.validateTrainingRow({
      title: 'Python Basic',
      category: 'BNSP',
      price_general: 500000,
      price_student_uad: 400000,
      price_employee_uad: 450000,
      quota: 30
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should return valid=false when title is empty', () => {
    const result = Training.validateTrainingRow({
      title: '',
      category: 'BNSP',
      price_general: 500000,
      price_student_uad: 400000,
      price_employee_uad: 450000,
      quota: 30
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Kolom "title" kosong.')
  })

  it('should return valid=false when category is empty', () => {
    const result = Training.validateTrainingRow({
      title: 'Python',
      category: '',
      price_general: 500000,
      price_student_uad: 400000,
      price_employee_uad: 450000,
      quota: 30
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Kolom "category" kosong.')
  })

  it('should return valid=false when price_general is negative', () => {
    const result = Training.validateTrainingRow({
      title: 'Python',
      category: 'BNSP',
      price_general: -1000,
      price_student_uad: 400000,
      price_employee_uad: 450000,
      quota: 30
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Kolom "price_general" harus angka >= 0.')
  })

  it('should return valid=false when quota is zero', () => {
    const result = Training.validateTrainingRow({
      title: 'Python',
      category: 'BNSP',
      price_general: 500000,
      price_student_uad: 400000,
      price_employee_uad: 450000,
      quota: 0
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Kolom "quota" harus angka bulat >= 1.')
  })

  it('should return valid=false for multiple errors at once', () => {
    const result = Training.validateTrainingRow({
      title: '',
      category: '',
      price_general: -1,
      price_student_uad: -1,
      price_employee_uad: -1,
      quota: 0
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })

  it('should handle whitespace-only title as invalid', () => {
    const result = Training.validateTrainingRow({
      title: '   ',
      category: 'BNSP',
      price_general: 500000,
      price_student_uad: 400000,
      price_employee_uad: 450000,
      quota: 30
    })
    expect(result.valid).toBe(false)
  })

  it('should accept zero prices', () => {
    const result = Training.validateTrainingRow({
      title: 'Free Course',
      category: 'BNSP',
      price_general: 0,
      price_student_uad: 0,
      price_employee_uad: 0,
      quota: 1
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe('Training model: parseTrainingRow', () => {
  it('should parse a standard row correctly', () => {
    const result = Training.parseTrainingRow({
      title: 'Python Basic',
      category: 'BNSP',
      description: 'Belajar Python dari nol',
      price_general: 500000,
      price_student_uad: 400000,
      price_employee_uad: 450000,
      quota: 30,
      start_date: '2026-10-01',
      category_order: 10,
      whatsapp_group_link: 'https://chat.whatsapp.com/abc'
    })
    expect(result.title).toBe('Python Basic')
    expect(result.category).toBe('BNSP')
    expect(result.description).toBe('Belajar Python dari nol')
    expect(result.price_general).toBe(500000)
    expect(result.start_date).toBe('2026-10-01')
    expect(result.category_order).toBe(10)
    expect(result.whatsapp_group_link).toBe('https://chat.whatsapp.com/abc')
  })

  it('should handle missing optional fields gracefully', () => {
    const result = Training.parseTrainingRow({
      title: 'Python',
      category: 'BNSP'
    })
    expect(result.description).toBeNull()
    expect(result.price_general).toBe(0)
    expect(result.start_date).toBeNull()
    expect(result.quota).toBe(30)
    expect(result.whatsapp_group_link).toBeNull()
  })

  it('should strip whitespace from string fields', () => {
    const result = Training.parseTrainingRow({
      title: '  Python Basic  ',
      category: '  BNSP  ',
      description: '  Test  '
    })
    expect(result.title).toBe('Python Basic')
    expect(result.category).toBe('BNSP')
    expect(result.description).toBe('Test')
  })

  it('should set null for missing optional fields', () => {
    const result = Training.parseTrainingRow({
      title: 'Python',
      category: 'BNSP',
      price_general: 500000,
      price_student_uad: 400000,
      price_employee_uad: 450000,
      quota: 20
    })
    expect(result.description).toBeNull()
    expect(result.start_date).toBeNull()
    expect(result.whatsapp_group_link).toBeNull()
  })
})
