import { getExercise } from './exercises.js'

/*
 * The reward system. Read this before changing /sky.
 *
 * Streaks, points, levels, badges and rings are all one mechanic in
 * different clothes: they set up a state you can fall out of, and the fall
 * is what makes people quit. So the reward is a night sky whose only verb
 * is add. Log a glass of water, a star appears. Skip a week, the sky is
 * exactly as bright as you left it. Nothing to break, nothing to maintain,
 * and no total anywhere in the UI - a count is a score even going up.
 *
 * Every star is derived from data we already keep, never stored. No
 * migration, no way for sky and logs to disagree, no way to lose the sky by
 * clearing one key.
 */

/**
 * The four things that put a star up, and the hue each one burns.
 *
 * `rgb` is a CSS variable holding a bare "r, g, b" triplet, so it drops
 * straight into `rgb(...)` or `rgba(..., .4)` in an inline style and stays in
 * step with the palette instead of hardcoding four more hex values.
 */
export const KINDS = {
  water: { id: 'water', label: 'Water', rgb: 'var(--a-aqua)' },
  move: { id: 'move', label: 'Movement', rgb: 'var(--a-mint)' },
  jog: { id: 'jog', label: 'Outdoors', rgb: 'var(--a-amber)' },
  weigh: { id: 'weigh', label: 'Check-ins', rgb: 'var(--a-iris)' },
}

/** Deterministic 32-bit string hash (FNV-1a). Same key, same star, forever. */
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Hash to a float in [0,1), varied by salt so one key yields many values. */
const rand = (key, salt) => (hash(key + '|' + salt) % 100000) / 100000

/*
 * Placement. Position comes from an additive-recurrence (R2) low-discrepancy
 * sequence on the star's index, nudged by a hash of its key. The sequence stops
 * forty stars clumping into three blobs the way pure random placement would;
 * the nudge stops the result looking like a grid.
 *
 * Indices go oldest-first, so logging something new appends and every star
 * already on screen keeps its spot.
 */
const P1 = 0.7548776662466927 // 1/phi2
const P2 = 0.5698402909980532 // 1/phi2^2

function place(i, key) {
  const u = (0.5 + P1 * (i + 1)) % 1
  const v = (0.5 + P2 * (i + 1)) % 1
  // Inset from the edges so no star is half-clipped, and biased slightly
  // upward: the lower band of the sky is where the legend and the readout sit.
  const x = 6 + u * 88 + (rand(key, 'x') - 0.5) * 5
  const y = 5 + v * 80 + (rand(key, 'y') - 0.5) * 5
  return { x: Math.min(97, Math.max(3, x)), y: Math.min(93, Math.max(3, y)) }
}

const time = (ms) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

const dayName = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

/**
 * Turn the whole store into a list of stars.
 *
 * Note the archived days: a day where nobody moved still puts a water star
 * up, because on that day water is what happened, and that counts. Nothing
 * in this function can ever return fewer stars for more logged activity.
 */
export function buildSky(state) {
  const rows = []

  // --- Archived days, oldest first ---
  for (const d of state.history || []) {
    if (d.waterMl > 0) {
      rows.push({
        key: `h-w-${d.date}`,
        kind: 'water',
        title: `${(d.waterMl / 1000).toFixed(1)} L of water`,
        note: dayName(d.date),
        weight: d.waterMl / 3000,
      })
    }
    if (d.minutes > 0) {
      rows.push({
        key: `h-m-${d.date}`,
        kind: 'move',
        title: `${d.minutes} minutes of movement`,
        note: dayName(d.date),
        weight: d.minutes / 30,
      })
    }
  }

  // --- Weigh-ins ---
  for (const w of state.weights || []) {
    rows.push({
      key: `kg-${w.date}`,
      kind: 'weigh',
      title: 'You checked in',
      note: dayName(w.date),
      weight: 0.35,
    })
  }

  // --- Today ---
  for (const g of state.waterLog || []) {
    rows.push({
      key: `w-${g.at}`,
      kind: 'water',
      title: `${g.ml} ml of water`,
      note: `Today, ${time(g.at)}`,
      weight: g.ml / 900,
    })
  }

  for (const id of state.completed || []) {
    const ex = getExercise(id)
    rows.push({
      key: `c-${id}`,
      kind: 'move',
      title: ex ? ex.name : 'A movement',
      note: 'Today',
      weight: 0.8,
    })
  }

  for (const j of state.jogs || []) {
    rows.push({
      key: `j-${j.at}`,
      kind: 'jog',
      title: `${j.km} km outside`,
      note: `Today, ${time(j.at)}`,
      weight: 0.95,
    })
  }

  // Positions and twinkle timings last, once the order is settled.
  return rows.map((r, i) => {
    const { x, y } = place(i, r.key)
    return {
      ...r,
      x,
      y,
      // 7px to 15px. Bigger means a bigger effort, never a better person.
      size: 7 + Math.min(1, Math.max(0.2, r.weight || 0.5)) * 8,
      // Spread the blink out so the sky never pulses in unison. A negative
      // delay starts each star mid-cycle instead of all of them at zero.
      delay: -Number((rand(r.key, 'd') * 6).toFixed(2)),
      period: Number((3.4 + rand(r.key, 'p') * 3.6).toFixed(2)),
    }
  })
}

/**
 * Faint joining lines, one polyline per kind, in the order the stars were
 * earned. This is what makes the page read as constellations rather than
 * scattered confetti - you can trace the shape your own weeks drew.
 */
export function skyLines(stars) {
  return Object.keys(KINDS)
    .map((kind) => ({
      kind,
      points: stars
        .filter((s) => s.kind === kind)
        .map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)}`)
        .join(' '),
    }))
    .filter((l) => l.points.includes(' ')) // needs 2+ points to be a line
}
