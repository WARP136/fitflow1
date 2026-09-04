/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Structural: near-black canvas with a faint green cast.
        //    Surfaces are built from translucent white over this, not
        //    from flat greys, so the aurora behind them shows through. ──
        paper: '#F7F2EB', // page canvas
        mist: '#EEEEEE', // lifted panel
        veil: '#EAE2D6', // inset / input well
        edge: '#8B9A6E', // hairline border
        ink: '#E9F7EF', // primary text — light now, the app is dark
        muted: '#6E7663', // secondary text

        // ── The aurora. Four hues that light the whole product.
        //    Accent-coloured things read these through CSS variables
        //    rather than these classes, so the energy choice still wins. ──
        mint: '#8B9A6E', // olive
        aqua: '#EAE2D6', // warm beige
        iris: '#EEEEEE', // soft grey
        amber: '#F7F2EB', // cream
        rose: '#FB7185', // used only for genuine warnings

        // Kept so existing utility classes keep resolving.
        glow: '#EAE2D6',
        fern: '#8B9A6E',
        emerald: '#8B9A6E',
        pine: '#F7F2EB',
        lime: '#8B9A6E',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '26px',
        xl2: '34px',
      },
      boxShadow: {
        // On a dark canvas a grey shadow is invisible, so depth comes from
        // a true black drop plus a 1px top highlight that reads as an edge
        // catching the light.
        lift: 'inset 0 1px 0 rgba(255,255,255,.06), 0 2px 6px rgba(0,0,0,.5), 0 18px 40px -18px rgba(0,0,0,.75)',
        hover:
          'inset 0 1px 0 rgba(255,255,255,.09), 0 4px 12px rgba(0,0,0,.55), 0 30px 60px -22px rgba(0,0,0,.85)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.07)',
        ring: 'inset 0 1px 0 rgba(255,255,255,.07), 0 0 0 1px rgba(52,211,153,.10), 0 24px 50px -24px rgba(0,0,0,.8)',
        // Coloured glows, for the one element on a page that should feel lit.
        glow: '0 0 40px -6px rgba(var(--accent-rgb),.45)',
        glowsm: '0 0 22px -4px rgba(var(--accent-rgb),.5)',
      },
      keyframes: {
        drift1: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%,-8%,0) scale(1.12)' },
          '66%': { transform: 'translate3d(-5%,6%,0) scale(.94)' },
        },
        drift2: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1.05)' },
          '40%': { transform: 'translate3d(-8%,7%,0) scale(.92)' },
          '75%': { transform: 'translate3d(7%,5%,0) scale(1.15)' },
        },
        drift3: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(.96)' },
          '50%': { transform: 'translate3d(5%,9%,0) scale(1.18)' },
        },
        drift4: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1.02)' },
          '45%': { transform: 'translate3d(-6%,-7%,0) scale(1.14)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        bob: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        breathe: {
          '0%,100%': { opacity: '.55', transform: 'scale(1)' },
          '50%': { opacity: '.9', transform: 'scale(1.04)' },
        },
        sheen: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        // Stars on the constellation page.
        twinkle: {
          '0%,100%': { opacity: '.35', transform: 'scale(.9)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
        // The scanner's sweeping read-line.
        scanline: {
          '0%,100%': { transform: 'translateY(-42%)', opacity: '.15' },
          '50%': { transform: 'translateY(42%)', opacity: '.85' },
        },
      },
      animation: {
        drift1: 'drift1 24s ease-in-out infinite',
        drift2: 'drift2 31s ease-in-out infinite',
        drift3: 'drift3 27s ease-in-out infinite',
        drift4: 'drift4 35s ease-in-out infinite',
        marquee: 'marquee 32s linear infinite',
        bob: 'bob 4.5s ease-in-out infinite',
        breathe: 'breathe 5s ease-in-out infinite',
        sheen: 'sheen 14s ease-in-out infinite',
        twinkle: 'twinkle 4s ease-in-out infinite',
        scanline: 'scanline 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
