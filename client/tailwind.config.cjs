module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: false,
  theme: {
    extend: {
      boxShadow: {
        soft: '0 18px 40px -15px rgba(0, 0, 0, 0.45)'
      },
      animation: {
        'pulse-soft': 'pulseSoft 18s ease-in-out infinite'
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: 0.7 },
          '50%': { opacity: 1 }
        }
      }
    }
  },
  plugins: []
};
