/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        brand: {
          50:  '#f0f9f4',
          100: '#dcf1e6',
          200: '#bbe3ce',
          300: '#8acdb0',
          400: '#57b08d',
          500: '#349470',
          600: '#24785a',
          700: '#1d5f48',
          800: '#194c3a',
          900: '#163f31',
        }
      }
    },
  },
  plugins: [],
}
