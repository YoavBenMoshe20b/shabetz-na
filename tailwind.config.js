/** @type {import('tailwindcss').Config} */
//
// ─── Design system: premium operational light ──────────────────────────────
//
// Reference points: Linear (light), Stripe Dashboard, Notion, Mantine.
// Calm warm-neutral substrate with a confident deep-indigo / blurple
// primary. Operational accents stay in jewel-tone family but on a light
// canvas: mint/teal for active+base, coral/peach for home/leave, soft
// blue for readiness, restrained warm-amber for warnings.
//
// Token names stay under the `mil-*` namespace for compatibility with
// every consumer (`bg-mil-card`, `text-mil-text`, ...), but values are
// completely re-tuned. There is no "olive" pigment anywhere — the
// `mil-olive-*` keys now resolve to the deep-indigo primary, and
// `mil-sand-*` to the coral/peach secondary, so existing JSX reads as
// modern with zero rename churn.
//
// Surface ladder:
//   bg          warm off-white substrate
//   bg-alt      slightly warmer (split panes, secondary surfaces)
//   card        clean white card (primary container)
//   card-warm   barely-tinted white (hero / emphasised band)
//   card-hover  hover interaction state
//
// Type ladder:
//   text   primary ink (near-black with a hint of blue)
//   muted  secondary (date / metadata)
//   ghost  tertiary (separators, very faint hint)

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Heebo', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'xxs':     ['0.6875rem', { lineHeight: '1rem' }],
        'tiny':    ['0.75rem',   { lineHeight: '1.1rem' }],
        'metric':  ['2.25rem',   { lineHeight: '2.5rem', letterSpacing: '-0.025em' }],
        'hero':    ['1.875rem',  { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        'display': ['2.75rem',   { lineHeight: '2.9rem',  letterSpacing: '-0.03em' }],
      },
      letterSpacing: {
        'tightish': '-0.012em',
      },
      borderRadius: {
        'xl-soft': '14px',
        '2xl-soft':'18px',
      },
      // Light-mode shadow ladder. Subtle — premium reads as discipline,
      // not as drop-shadow heavy. Hero earns one strong long-cast shadow;
      // everything else stays close to the surface.
      boxShadow: {
        'card':       '0 1px 2px 0 rgba(28, 27, 33, 0.04), 0 1px 1px 0 rgba(28, 27, 33, 0.02)',
        'card-hover': '0 4px 12px -2px rgba(28, 27, 33, 0.08), 0 2px 4px -1px rgba(28, 27, 33, 0.04)',
        'hero':       '0 24px 40px -16px rgba(28, 27, 33, 0.12), 0 8px 16px -8px rgba(28, 27, 33, 0.06), 0 1px 2px 0 rgba(28, 27, 33, 0.04)',
        'pop':        '0 32px 64px -24px rgba(28, 27, 33, 0.25), 0 12px 24px -12px rgba(28, 27, 33, 0.12), 0 4px 8px -2px rgba(28, 27, 33, 0.06)',
        'inner-line': 'inset 0 0 0 1px rgba(28, 27, 33, 0.04)',
        'focus':      '0 0 0 4px rgba(91, 95, 207, 0.18)',
        'sticky':     '0 1px 0 0 rgba(28, 27, 33, 0.06), 0 2px 8px -2px rgba(28, 27, 33, 0.04)',
      },
      backdropBlur: {
        'glass': '12px',
        'glass-strong': '20px',
      },
      colors: {
        // ── Raw neutral scale (warm-cast) ───────────────────────────
        ink: {
          950: '#1c1b21',
          900: '#252329',
          800: '#363339',
          700: '#4a464d',
          600: '#605c66',
          500: '#7d7986',
          400: '#a09ca8',
          300: '#c4c0cb',
          200: '#dad6df',
          150: '#e8e5dd',
          100: '#efece5',
          50:  '#f7f5f0',
          25:  '#fafaf7',
        },

        mil: {
          // ── Page substrate (warm off-white, not harsh) ───────────
          bg:             '#fafaf7',
          'bg-alt':       '#f4f3ee',

          // ── Header / floating chrome ─────────────────────────────
          surface:        '#ffffff',
          'surface-hover':'#fafaf7',

          // ── Cards ────────────────────────────────────────────────
          card:           '#ffffff',
          'card-warm':    '#fdfcf9',
          'card-hover':   '#f7f6f1',

          // ── Borders ──────────────────────────────────────────────
          border:         '#e8e5dd',
          'border-strong':'#d6d2c5',

          // ── Primary accent (deep indigo / blurple) ───────────────
          // Used for primary actions, focus rings, active navigation.
          // Linear-style confidence. Sits under the legacy "olive"
          // keys so existing JSX adopts it automatically.
          olive:          '#5b5fcf',   // primary
          'olive-light':  '#7e82e8',
          'olive-dim':    '#4045a8',
          'olive-bg':     '#eef0fd',   // very light tint for active

          // ── Secondary accent (coral / peach for home & leave) ────
          // Operationally: "soldier is at home / on leave / off-base".
          // Warm but restrained — not a vacation orange, more like
          // late-afternoon-light coral.
          sand:           '#dc7b58',
          'sand-light':   '#f0a283',
          'sand-bg':      '#fbece4',

          // ── Text ─────────────────────────────────────────────────
          text:           '#1c1b21',
          'text-inv':     '#ffffff',
          muted:          '#605c66',
          ghost:          '#8e8a96',

          // ── Status palette ───────────────────────────────────────
          // Mint/teal — active, in-base, healthy (the GOOD state)
          success:        '#1a9b6f',
          'success-bg':   '#e7f6ef',
          'success-border':'#a6dec5',

          // Restrained warm amber — warning
          warn:           '#b67632',
          'warn-bg':      '#fbf2e6',
          'warn-border':  '#e6c89b',

          // Coral red — alert (live operational issue)
          alert:          '#d44a5f',
          'alert-bg':     '#fdeaee',
          'alert-border': '#f1b9c0',

          // Soft blue — info / readiness (calm signal, not warning)
          info:           '#3f7ee8',
          'info-bg':      '#eaf1fd',
          'info-border':  '#bdd1f4',

          // Muted purple — rest / recovery (less common state)
          rest:           '#7c6ad1',
          'rest-bg':      '#efebfa',
          'rest-border':  '#c8bdec',
        },
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out-soft': 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in': {
          '0%':   { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.55' },
        },
      },
      animation: {
        'fade-in':    'fade-in 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'sheet-in':   'sheet-in 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
