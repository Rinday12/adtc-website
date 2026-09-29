/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs',
    './public/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        // Navy (warna utama logo ADTC)
        navy: {
          50:  '#eef2f9',
          100: '#d5e0f0',
          200: '#afc4e2',
          300: '#7fa0d0',
          400: '#4f7cbe',
          500: '#2f5fa8',
          600: '#1e4a8e',
          700: '#1B3A6B',   // warna navy utama logo
          800: '#152d54',
          900: '#0e1f3a',
        },
        // Oranye (aksen logo ADTC)
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',   // oranye logo
          600: '#ea580c',   // oranye hover
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        }
      }
    }
  },
  plugins: []
}
