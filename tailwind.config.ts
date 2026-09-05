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
        // ---------------------------------------------------------------
        // Semantic tokens. Every value resolves to a CSS variable defined in
        // app/globals.css, so a component names the ROLE it wants and both
        // themes follow automatically. See that file for the palette itself.
        //
        // The literal `ink`/`paper`/`studio` names below are kept because the
        // AI-generated prototype markup and a few brand-specific surfaces
        // legitimately want a fixed colour regardless of theme.
        // ---------------------------------------------------------------
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          subtle: 'var(--surface-subtle)',
          raised: 'var(--surface-raised)',
          strong: 'var(--surface-strong)',
        },
        elevated: 'var(--elevated)',
        chrome: {
          DEFAULT: 'var(--chrome)',
          translucent: 'var(--chrome-translucent)',
        },
        edge: {
          DEFAULT: 'var(--edge)',
          strong: 'var(--edge-strong)',
        },
        fg: {
          DEFAULT: 'var(--fg)',
          secondary: 'var(--fg-secondary)',
          muted: 'var(--fg-muted)',
          faint: 'var(--fg-faint)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          ink: 'var(--brand-ink)',
          text: 'var(--brand-text)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          alt: 'var(--accent-alt)',
          'alt-text': 'var(--accent-alt-text)',
          text: 'var(--accent-text)',
        },

        // Fixed brand colours — theme-independent by design.
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
        line: 'var(--edge)',

        status: {
          success: 'var(--success)',
          warning: 'var(--warning)',
          error: 'var(--error)',
          info: 'var(--info)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        panel: 'var(--radius-xl)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      transitionDuration: {
        // The spec's motion tiers, so a component picks an intent rather than
        // inventing a duration: micro (press/hover), standard (cards/tabs),
        // overlay (modal/drawer), reveal (section entrance).
        micro: 'var(--motion-micro)',
        standard: 'var(--motion-standard)',
        overlay: 'var(--motion-overlay)',
        reveal: 'var(--motion-reveal)',
      },
      boxShadow: {
        lift: '0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(212,255,79,0.4), 0 8px 24px rgba(212,255,79,0.12)',
        palette: '0 24px 64px rgba(0,0,0,0.45)',
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(var(--grid-dot) 1px, transparent 1px)',
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
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        scan: 'scan 6s linear infinite',
        marquee: 'marquee 1.2s linear infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both',
        blink: 'count-blink 1.4s ease-in-out infinite',
        float: 'float 5s ease-in-out infinite',
        'fade-in': 'fade-in 0.18s ease-out both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16,1,0.3,1) both',
        'slide-in-right': 'slide-in-right 0.28s cubic-bezier(0.16,1,0.3,1) both',
      },
      transitionTimingFunction: {
        snap: 'var(--ease-snap)',
        soft: 'var(--ease-out)',
      },
    },
  },
  plugins: [],
};

export default config;
