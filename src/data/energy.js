/*
 * The energy system. One choice drives four things:
 *   1. accent colour + glow (CSS vars, set in AppState)
 *   2. UI motion tempo (Framer Motion duration multiplier)
 *   3. Lottie playback speed of the exercise animation (setSpeed)
 *   4. colour and rotation speed of the WebGL aurora
 *
 * That's what "meets you where you are" means mechanically - on a quieter
 * day the product itself slows down and cools off.
 *
 * accentInk is the lighter variant, not a darker one: on dark backgrounds
 * emphasis reads as brighter, never as deeper.
 *
 * Three levels, not four. There was a "Low-key" rung below Steady with the
 * violet accent and a 1.35 tempo; the label wasn't doing us any favours.
 * Steady is the floor and the default now, so getEnergy falls back to
 * ENERGY[0]. If you add a level, put it at the end or fix that index, since
 * the fallback is where a corrupt saved value lands.
 */
export const ENERGY = [
  {
    id: 'steady',
    label: 'Steady',
    hint: 'Normal sort of day',
    accent: '#8B9A6E',
    accentInk: '#586344',
    accentFg: '#F7F2EB',
    rgb: '139, 154, 110',
    lottieSpeed: 1,
    tempo: 1,
  },
  {
    id: 'bright',
    label: 'Bright',
    hint: 'Got some spark today',
    accent: '#8B9A6E',
    accentInk: '#586344',
    accentFg: '#F7F2EB',
    rgb: '139, 154, 110',
    lottieSpeed: 1.25,
    tempo: 0.85,
  },
  {
    id: 'fullsend',
    label: 'Full-send',
    hint: 'Give me the hard one',
    accent: '#8B9A6E',
    accentInk: '#586344',
    accentFg: '#F7F2EB',
    rgb: '139, 154, 110',
    lottieSpeed: 1.5,
    tempo: 0.72,
  },
]

/** True for a level the app still ships. Used to migrate away a removed id. */
export const isEnergy = (id) => ENERGY.some((e) => e.id === id)

export const getEnergy = (id) => ENERGY.find((e) => e.id === id) || ENERGY[0]
