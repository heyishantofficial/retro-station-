/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"Cinzel"', '"Cormorant Garamond"', 'serif'],
      },
      colors: {
        a24: {
          bg: '#e9e9e8',
          card: '#dedede',
          dark: '#141414',
          line: 'rgba(0, 0, 0, 0.12)',
          sub: '#555555',
        }
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
      }
    },
  },
  plugins: [],
}
