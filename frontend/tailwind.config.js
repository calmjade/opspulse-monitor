/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#040812',
          900: '#070d1c',
          800: '#0b1428',
          700: '#101d38',
        },
        cyanpulse: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
      },
      boxShadow: {
        'datav-glow': '0 0 24px -6px rgba(6, 182, 212, 0.35)',
        'datav-emerald': '0 0 20px -6px rgba(16, 185, 129, 0.35)',
        'datav-danger': '0 0 24px -6px rgba(244, 63, 94, 0.45)',
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'SFMono-Regular',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
