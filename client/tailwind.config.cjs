module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        body: ['Inter', '"Helvetica Neue"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        ts: {
          charcoal: '#1C1410',
          'charcoal-light': '#2E1F18',
          crimson: '#9B2335',
          scarlet: '#C41E3A',
          garnet: '#6B1528',
          gold: '#BFA882',
          'gold-light': '#D4C1A0',
          cream: '#FAF7F4',
          linen: '#F0EBE4',
          stone: '#D9D0C5',
          muted: '#7D6E63',
          'dark-text': '#2A2420',
          'light-text': '#F5F0EB',
        },
      },
      boxShadow: {
        soft: '0 18px 40px -15px rgba(0, 0, 0, 0.45)',
        card: '0 4px 24px rgba(28, 20, 16, 0.08)',
        'card-hover': '0 12px 40px rgba(28, 20, 16, 0.16)',
        crimson: '0 8px 30px rgba(155, 35, 53, 0.30)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out both',
        'pulse-soft': 'pulseSoft 18s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 0.7 },
          '50%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
