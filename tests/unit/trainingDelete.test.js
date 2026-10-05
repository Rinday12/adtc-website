// tests/unit/trainingDelete.test.js
/**
 * Unit tests untuk adminTrainingController.postDelete
 * Fix #30 — bug destructuring `const { db } = require('../config/db')`
 * (db.js mengeksport promise pool, bukan objek { db }) menyebabkan
 * "Cannot read properties of undefined (reading 'execute')" → 500
 * saat admin menghapus pelatihan.
 */

jest.mock('../../config/db', () => ({
  execute: jest.fn(),
  promise: jest.fn()
}))

const db = require('../../config/db')
const adminTrainingController = require('../../controllers/adminTrainingController')

describe('adminTrainingController.postDelete', () => {
  let req, res, next

  beforeEach(() => {
    jest.clearAllMocks()
    db.execute.mockReset()
    req = { params: { id: '3' }, flash: jest.fn() }
    res = { redirect: jest.fn() }
    next = jest.fn()
  })

  it('should delete registrations first, then the training itself', async () => {
    db.execute.mockResolvedValue([{ affectedRows: 5 }, []])

    await adminTrainingController.postDelete(req, res, next)

    expect(db.execute).toHaveBeenCalledTimes(2)
    expect(db.execute).toHaveBeenNthCalledWith(1, 'DELETE FROM registrations WHERE training_id = ?', ['3'])
    expect(db.execute).toHaveBeenNthCalledWith(2, 'DELETE FROM trainings WHERE id = ?', ['3'])
    expect(req.flash).toHaveBeenCalledWith('success', 'Pelatihan berhasil dihapus.')
    expect(res.redirect).toHaveBeenCalledWith('/admin/trainings')
    expect(next).not.toHaveBeenCalled()
  })

  it('should call next(err) without deleting the training when the first DELETE fails', async () => {
    const error = new Error('ER_TABLE_NOT_FOUND')
    db.execute.mockRejectedValueOnce(error)

    await adminTrainingController.postDelete(req, res, next)

    expect(db.execute).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(error)
    expect(res.redirect).not.toHaveBeenCalled()
    expect(req.flash).not.toHaveBeenCalled()
  })

  it('should call next(err) when the training DELETE fails', async () => {
    const error = new Error('ER_LOCK_DEADLOCK')
    db.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []])
    db.execute.mockRejectedValueOnce(error)

    await adminTrainingController.postDelete(req, res, next)

    expect(db.execute).toHaveBeenCalledTimes(2)
    expect(next).toHaveBeenCalledWith(error)
    expect(res.redirect).not.toHaveBeenCalled()
  })
})
