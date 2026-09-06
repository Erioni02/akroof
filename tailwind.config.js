/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // pulled off the footage itself
        ink: '#06080B',
        night: '#0A0E14',
        slate: '#161D27',
        steel: '#2A3542',
        storm: '#71818F',
        fog: '#A3AFBA',
        bone: '#F3F0E9',
        brass: '#C4A264',
        ember: '#E7A868',
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      letterSpacing: {
        eyebrow: '0.34em',
        tightest: '-0.045em',
      },
      screens: {
        xs: '420px',
      },
    },
  },
  plugins: [],
}
