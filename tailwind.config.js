/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: '#6C3BFF',
        accent: '#00D4AA',
        dark: '#0D0D1A',
        midGray: '#4A4A6A',
      },
    },
  },
  plugins: [],
}
