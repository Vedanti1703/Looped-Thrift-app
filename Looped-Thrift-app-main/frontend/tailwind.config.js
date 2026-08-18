/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pink: {
          50:  '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
        },
        rose: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          400: '#fb7185',
          500: '#f43f5e',
        }
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: { xl: '1rem', '2xl': '1.5rem', '3xl': '2rem' },
    },
  },
  plugins: [],
}
