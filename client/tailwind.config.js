/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary brand blue (pulled from qualitymetalcarportsca.com).
        brand: {
          DEFAULT: '#2ea3f2',
          dark: '#2785d8',
          light: '#5bb8f5',
        },
        // Brand red (from the QMC logo) — used for primary actions and highlights.
        accent: {
          DEFAULT: '#eb2528',
          dark: '#c81d20',
          light: '#f5453f',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '60px 60px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(6px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease forwards',
        bounce: 'bounce 1.5s infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
}
