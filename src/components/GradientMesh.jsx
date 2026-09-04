/*
 * Four oversized, heavily blurred radial gradients drifting on offset loops
 * (24s / 31s / 27s / 35s) so the background never visibly repeats. One blob
 * always carries var(--accent-rgb), so the page atmosphere shifts with the
 * energy choice.
 *
 * `tone` picks which of the four aurora hues the other three use, keyed by
 * route: Today is emerald into violet, Move runs warm on amber, Jog goes cold.
 * Same four colours everywhere, no two pages the same.
 *
 * Pure CSS, no canvas, effectively free - and the reason the app still looks
 * designed with WebGL off.
 */

// [outer blob, lower blob, corner blob] as raw rgb triples.
const TONES = {
  '/today': ['var(--a-mint)', 'var(--a-iris)', 'var(--a-aqua)'],
  '/move': ['var(--a-amber)', 'var(--a-mint)', 'var(--a-aqua)'],
  '/water': ['var(--a-aqua)', 'var(--a-iris)', 'var(--a-mint)'],
  '/food': ['var(--a-mint)', 'var(--a-amber)', 'var(--a-aqua)'],
  '/plan': ['var(--a-aqua)', 'var(--a-mint)', 'var(--a-amber)'],
  '/scan': ['var(--a-aqua)', 'var(--a-mint)', 'var(--a-iris)'],
  '/jog': ['var(--a-iris)', 'var(--a-aqua)', 'var(--a-mint)'],
  '/neha': ['var(--a-iris)', 'var(--a-mint)', 'var(--a-aqua)'],
  '/week': ['var(--a-mint)', 'var(--a-iris)', 'var(--a-amber)'],
  '/predict': ['var(--a-iris)', 'var(--a-amber)', 'var(--a-aqua)'],
  '/sky': ['var(--a-iris)', 'var(--a-aqua)', 'var(--a-mint)'],
}

const DEFAULT_TONE = ['var(--a-mint)', 'var(--a-iris)', 'var(--a-aqua)']

export default function GradientMesh({ intensity = 1, tone, className = '' }) {
  // Kept as a component so pages can retain their composition while the
  // product uses a clean, flat visual system.
  return null
}
