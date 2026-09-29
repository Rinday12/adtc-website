// tests/setup.js
// Global test setup untuk mocking environment variables dan dependencies

// Mock environment variables untuk testing
process.env.DB_HOST = 'localhost'
process.env.DB_USER = 'test_user'
process.env.DB_PASSWORD = 'test_password'
process.env.DB_NAME = 'test_database'
process.env.SESSION_SECRET = 'test_secret_key_for_testing_purposes_only'
process.env.WHATSAPP_ADMIN_NUMBER = '+6281234567890'
process.env.BANK_NAME = 'Test Bank'
process.env.BANK_ACCOUNT = '1234567890'
process.env.BANK_ACC_NAME = 'Test Account'

// Mock console.error untuk menghindari noise dalam test output
global.console = {
  ...console,
  error: jest.fn()
}