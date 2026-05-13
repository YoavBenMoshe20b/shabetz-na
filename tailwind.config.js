/** @type {import('tailwindcss').Config} */
//
// ─── Design system: premium operational dark ────────────────────────────────
//
// Reference points: Linear, modern airline ops, calm SaaS. Not military,
// not gaming, not ERP. The substrate is a deep slate with a confident
// indigo accent used sparingly — colour is information, not decoration.
//
// Token names are kept under the `mil-*` namespace for compatibility with
// the rest of the codebase (every page consumes `bg-mil-card`, `text-mil-
// text`, etc.), but the values have been completely re-tuned. There is no
// longer any "olive" / "sand" — those keys remain as aliases that point
// into the new accent + neutral scales so existing JSX keeps working
// while reading as modern.
//
// Surface ladder:
//   bg          deepest — page substrate
//   surface     elevated panels behind cards (e.g. sticky headers)
//   card        the primary content container
//   card-warm   a one-step-up surface used for emphasis (hero band)
//   card-hover  interactive hover state
//
// Type ladder:
//   text   high-contrast (titles, body)
//   muted  secondary (metadata, labels)
//   ghost  tertiary (separators, faint hint)
//
// Status colours are desaturated jewel tones so they read as signal not
// noise. Every status has matching {-bg, -border} pairs for soft chips.

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'xxs':    ['0.6875rem', { lineHeight: '1rem' }],
        'tiny':   ['0.75rem',   { lineHeight: '1.1rem' }],
        'metric': ['2.25rem',   { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        'hero':   ['1.75rem',   { lineHeight: '2rem',   letterSpacing: '-0.015em' }],
        'display':['2.75rem',   { lineHeight: '2.9rem', letterSpacing: '-0.025em' }],
      },
      letterSpacing: {
        'tightish': '-0.01em',
      },
      borderRadius: {
        // 14px feels softer than 12 and more modern than 16 for card
        // chrome. We expose it as `xl-soft` so existing rounded-2xl
        // usages (16px) continue to look intentional.
        'xl-soft': '14px',
      },
      boxShadow: {
        // Shadows used on dark — very subtle, mostly inner highlights.
        'card':       '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 1px 2px 0 rgba(0,0,0,0.32)',
        'card-hover': '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 4px 16px -2px rgba(0,0,0,0.45)',
        'hero':       '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -8px rgba(0,0,0,0.55), 0 2px 6px -1px rgba(0,0,0,0.35)',
        'pop':        '0 16px 40px -12px rgba(0,0,0,0.65), 0 4px 10px -2px rgba(0,0,0,0.4)',
        'glow-accent':'0 0 0 1px rgba(125,140,224,0.35), 0 6px 24px -6px rgba(125,140,224,0.35)',
      },
      backdropBlur: {
        'glass': '14px',
      },
      colors: {
        // ── Semantic neutral scale (raw access) ────────────────────
        // Available as `bg-slate-deep`, `text-slate-200`, etc., when
        // a primitive needs to step outside the `mil-*` semantic names.
        ink: {
          950: '#070a14',
          900: '#0b1020',
          850: '#10162a',
          800: '#161d36',
          700: '#1e2542',
          600: '#2a3252',
          500: '#3a4368',
          400: '#5b6485',
          300: '#8089a8',
          200: '#a8b0c8',
          100: '#d6dae8',
          50:  '#eef0f8',
        },

        mil: {
          // ── Page substrate ───────────────────────────────────
          bg:             '#070a14',   // deep slate — almost black with blue cast
          'bg-alt':       '#0b1020',   // a step up for split panes

          // ── Header / floating chrome ─────────────────────────
          surface:        '#0b1020',
          'surface-hover':'#10162a',

          // ── Cards ────────────────────────────────────────────
          card:           '#10162a',   // primary container
          'card-warm':    '#141b34',   // hero / emphasised band
          'card-hover':   '#161d36',

          // ── Borders ──────────────────────────────────────────
          border:         '#1e2542',
          'border-strong':'#2a3252',

          // ── Accent (calm indigo — not military, not gaming) ──
          // Used sparingly: primary actions, focus rings, active
          // navigation, the "this is the live thing" signal.
          olive:          '#7d8ce0',   // primary accent (kept under olive-* keys for compat)
          'olive-light':  '#a4afea',
          'olive-dim':    '#5d6dba',
          'olive-bg':     '#1a2042',   // tinted background for selected/active states

          // ── Secondary accent (warm gold for "approved/sealed") ─
          // Replaces the old "sand" — used VERY rarely, only for the
          // single highest-priority sealed/published signal so it
          // reads against the cool indigo as deliberate emphasis.
          sand:           '#d4b572',
          'sand-light':   '#e8ce96',
          'sand-bg':      '#221c0e',

          // ── Text ─────────────────────────────────────────────
          text:           '#eef0f8',   // primary — off-white, never pure white
          'text-inv':     '#070a14',   // for use on light surfaces (rare)
          muted:          '#8089a8',
          ghost:          '#5b6485',

          // ── Status — desaturated jewel tones ──────────────────
          alert:          '#e07a8c',
          'alert-bg':     '#2a1a22',
          'alert-border': '#5a2a38',

          warn:           '#e0b572',
          'warn-bg':      '#2a2118',
          'warn-border':  '#5a4528',

          success:        '#6cc59a',
          'success-bg':   '#152a22',
          'success-border':'#2a5a45',

          info:           '#7dc0e0',
          'info-bg':      '#152332',
          'info-border':  '#2a4d68',
        },
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
