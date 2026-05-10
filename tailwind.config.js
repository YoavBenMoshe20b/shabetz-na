/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // Tighter scale tuned for Hebrew rendering + operational UIs
        'xxs':    ['0.6875rem', { lineHeight: '1rem' }],         // 11/16 — metadata
        'tiny':   ['0.75rem',   { lineHeight: '1.1rem' }],        // 12/18 — labels
        'metric': ['2.25rem',   { lineHeight: '2.5rem', letterSpacing: '-0.02em' }], // 36 — big numbers
        'hero':   ['1.75rem',   { lineHeight: '2rem',   letterSpacing: '-0.01em' }], // 28 — hero titles
      },
      boxShadow: {
        // Soft warm shadows (warm olive tint, not gray)
        'card':       '0 1px 2px 0 rgba(74, 112, 40, 0.04)',
        'card-hover': '0 2px 8px -1px rgba(74, 112, 40, 0.08)',
        'hero':       '0 4px 16px -4px rgba(74, 112, 40, 0.12), 0 2px 4px -1px rgba(74, 112, 40, 0.06)',
      },
      colors: {
        mil: {
          // ── Page backgrounds ─────────────────────────────────
          bg:             '#f7f3ea',   // warm cream parchment
          'bg-alt':       '#f0ebe0',

          // ── Header / nav (medium olive — much lighter & brighter) ──
          surface:        '#4a7028',
          'surface-hover':'#5a8a34',

          // ── Cards ────────────────────────────────────────────
          card:           '#ffffff',
          'card-warm':    '#fdfaf3',
          'card-hover':   '#f5f0e4',

          // ── Borders ──────────────────────────────────────────
          border:         '#ddd5be',
          'border-strong':'#c8bc98',

          // ── Olive accent (lighter, brighter, more natural) ───
          olive:          '#5a8a3c',
          'olive-light':  '#72a84a',
          'olive-dim':    '#2e5018',
          'olive-bg':     '#e8f5d4',   // light tint for selected states

          // ── Sand / gold ──────────────────────────────────────
          sand:           '#c8a855',
          'sand-light':   '#e2cc88',
          'sand-bg':      '#fdf8e8',

          // ── Text ─────────────────────────────────────────────
          text:           '#2a3a18',   // dark green (not black) for light bgs
          'text-inv':     '#f3f0e4',   // warm light text for surface backgrounds
          muted:          '#6b7c58',
          ghost:          '#9aaa7e',

          // ── Status ───────────────────────────────────────────
          alert:          '#cc2020',
          'alert-bg':     '#fff0f0',
          'alert-border': '#f8a8a8',

          warn:           '#b06418',
          'warn-bg':      '#fef8e8',
          'warn-border':  '#f0c060',

          success:        '#3a7a3c',
          'success-bg':   '#f0faf0',
          'success-border':'#90c898',
        },
      },
    },
  },
  plugins: [],
};
