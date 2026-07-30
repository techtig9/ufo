import type { Config } from 'tailwindcss';

// ---------------------------------------------------------------------------
// STUDIO GRID — ufo's design system.
// Grounded in the product itself: ufo is a design tool, so its own chrome
// borrows the vocabulary of a design tool — dot-grid canvas, crop-mark
// registration corners, ruler ticks, a monospace "coordinates" label face —
// instead of a generic gradient-blob/glass look. Applies to builder chrome
// only (landing, dashboard, editor frame); AI-generated screens keep
// whatever palette the user picked.
// ---------------------------------------------------------------------------
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#101114',
          soft: '#17181D',
        },
        paper: '#EFEDE6',
        studio: {
          citron: '#D4FF4F',
          coral: '#FF5A3C',
          indigo: '#6E7BFF',
        },
        line: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        panel: '14px',
      },
      boxShadow: {
        lift: '0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(212,255,79,0.4), 0 8px 24px rgba(212,255,79,0.12)',
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '22px 22px',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        marquee: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '28px 0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'count-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        scan: 'scan 6s linear infinite',
        marquee: 'marquee 1.2s linear infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both',
        blink: 'count-blink 1.4s ease-in-out infinite',
        float: 'float 5s ease-in-out infinite',
      },
      transitionTimingFunction: {
        snap: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
