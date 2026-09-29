require('dotenv').config({ path: '.env.development' })

describe('Email Configuration', () => {
  test('SMTP config is properly set', () => {
    expect(process.env.EMAIL_HOST).toBe('smtp.gmail.com')
    expect(process.env.EMAIL_PORT).toBe('587')
    expect(process.env.EMAIL_USER).toBeTruthy()
    expect(process.env.EMAIL_USER).toContain('@')
    expect(process.env.EMAIL_PASSWORD).toBeTruthy()
    expect(process.env.EMAIL_FROM_NAME).toBe('ADTC Ahmad Dahlan Training Center')
  })

  test('email.js module loads', () => {
    const emailModule = require('../../utils/email')
    expect(emailModule.sendStatusNotification).toBeDefined()
    expect(emailModule.sendPaymentInfoEmail).toBeDefined()
  })
})
