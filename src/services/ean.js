/*
 * EAN-13 / UPC-A / EAN-8 decoder. Pure JS, no dependency.
 *
 * The native BarcodeDetector is excellent but only backed on Android, macOS
 * and ChromeOS. On Chrome and Edge for Windows the constructor is absent,
 * so the camera half of the scanner was dead on the most common laptop in
 * the room. The usual fixes are a 300-600 KB WASM lib (zxing, quagga) or
 * telling people their browser is wrong. Hence this.
 *
 * How the symbol is built. An EAN-13 is exactly 95 modules wide, a module
 * being the width of the thinnest bar:
 *
 *   101 | 6 digits x 7 modules | 01010 | 6 digits x 7 modules | 101
 *   ^start                     ^middle                        ^end
 *
 * Every digit is four alternating runs summing to 7 modules (space,bar,
 * space,bar on the left half; the reverse on the right), so the symbol is
 * always 59 runs regardless of size on screen or distance from the lens.
 * That's what the whole file rests on - we never measure pixels against an
 * absolute, only runs against each other.
 *
 * The 13th digit isn't printed as bars. The six left-hand digits come from
 * set A ("odd") or set B ("even"), and which alphabet each uses spells out
 * the first digit. Set B is A reversed and set C (right half) is A inverted,
 * which is why one run-width table below covers all three.
 *
 * UPC-A is an EAN-13 whose first digit is 0, so it falls out for free.
 */

/** Set A bit patterns, digits 0-9. 0 = space, 1 = bar. */
const SET_A = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
]

/** '0001101' -> [3,2,1,1]. Every EAN digit is exactly four runs. */
function runLengths(bits) {
  const out = []
  for (let i = 0; i < bits.length; ) {
    let j = i
    while (j < bits.length && bits[j] === bits[i]) j++
    out.push(j - i)
    i = j
  }
  return out
}

const A_RUNS = SET_A.map(runLengths)                       // left odd  / right
const B_RUNS = A_RUNS.map((r) => [...r].reverse())         // left even

/**
 * Which alphabet each of the six left digits uses, indexed by the first digit.
 * A = set A, B = set B. This table *is* the thirteenth digit.
 */
const PARITY = [
  'AAAAAA', 'AABABB', 'AABBAB', 'AABBBA', 'ABAABB',
  'ABBAAB', 'ABBBAA', 'ABABAB', 'ABABBA', 'ABBABA',
]

const LEFT = [
  { runs: A_RUNS, set: 'A' },
  { runs: B_RUNS, set: 'B' },
]
const RIGHT = [{ runs: A_RUNS, set: 'C' }]

/**
 * Best digit for four measured run widths.
 *
 * The widths are first normalised to sum to 7, which is what makes this work at
 * any zoom level: a barcode filling the frame and one held at arm's length give
 * the same four numbers. Then it is nearest-neighbour against the alphabets,
 * with a ceiling on the error so noise gets rejected instead of guessed at.
 */
function matchDigit(quad, alphabets) {
  const sum = quad[0] + quad[1] + quad[2] + quad[3]
  if (sum <= 0) return null
  const w = [
    (quad[0] * 7) / sum,
    (quad[1] * 7) / sum,
    (quad[2] * 7) / sum,
    (quad[3] * 7) / sum,
  ]

  let best = null
  for (const { runs, set } of alphabets) {
    for (let d = 0; d < 10; d++) {
      const p = runs[d]
      let err = 0
      for (let i = 0; i < 4; i++) {
        const e = w[i] - p[i]
        err += e * e
      }
      if (!best || err < best.err) best = { err, digit: d, set }
    }
  }
  // ~0.5 of a module of slop per run, squared and summed. Looser than this and
  // random shelf edges start decoding as digits.
  return best && best.err <= 1.0 ? best : null
}

/** Mod-10 check digit, EAN-13 style: weights 1,3,1,3... from the left. */
function ean13Valid(d) {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += d[i] * (i % 2 ? 3 : 1)
  return (10 - (sum % 10)) % 10 === d[12]
}

/** EAN-8 weights the other way round: 3,1,3,1... from the left. */
function ean8Valid(d) {
  let sum = 0
  for (let i = 0; i < 7; i++) sum += d[i] * (i % 2 ? 1 : 3)
  return (10 - (sum % 10)) % 10 === d[7]
}

/**
 * Try to read a symbol starting at run index `s`.
 *
 * `wide` is the full run-width array for one scanline; `s` must be a dark run,
 * because every symbol opens with a bar.
 */
function readEan13(wide, s) {
  if (s + 59 > wide.length) return null
  const win = wide.slice(s, s + 59)

  let total = 0
  for (const v of win) total += v
  const mod = total / 95
  // Below about one pixel per module the run widths are all 1 and 2 and
  // everything decodes as a 1. Make the user move closer instead of lying.
  if (mod < 0.85) return null

  const guard = (i) => win[i] > mod * 0.45 && win[i] < mod * 1.85
  if (!(guard(0) && guard(1) && guard(2))) return null
  for (let i = 27; i <= 31; i++) if (!guard(i)) return null
  if (!(guard(56) && guard(57) && guard(58))) return null

  const digits = []
  let parity = ''
  for (let k = 0; k < 6; k++) {
    const m = matchDigit(win.slice(3 + k * 4, 7 + k * 4), LEFT)
    if (!m) return null
    digits.push(m.digit)
    parity += m.set
  }
  const first = PARITY.indexOf(parity)
  if (first < 0) return null

  for (let k = 0; k < 6; k++) {
    const m = matchDigit(win.slice(32 + k * 4, 36 + k * 4), RIGHT)
    if (!m) return null
    digits.push(m.digit)
  }

  const all = [first, ...digits]
  return ean13Valid(all) ? all.join('') : null
}

/** Same shape, 43 runs, no parity trick: 3 + 4x4 + 5 + 4x4 + 3. */
function readEan8(wide, s) {
  if (s + 43 > wide.length) return null
  const win = wide.slice(s, s + 43)

  let total = 0
  for (const v of win) total += v
  const mod = total / 67
  if (mod < 0.85) return null

  const guard = (i) => win[i] > mod * 0.45 && win[i] < mod * 1.85
  if (!(guard(0) && guard(1) && guard(2))) return null
  for (let i = 19; i <= 23; i++) if (!guard(i)) return null
  if (!(guard(40) && guard(41) && guard(42))) return null

  const digits = []
  // Left half of an EAN-8 is set A only - no alphabet switching, so no
  // first-digit recovery either.
  for (let k = 0; k < 4; k++) {
    const m = matchDigit(win.slice(3 + k * 4, 7 + k * 4), RIGHT)
    if (!m) return null
    digits.push(m.digit)
  }
  for (let k = 0; k < 4; k++) {
    const m = matchDigit(win.slice(24 + k * 4, 28 + k * 4), RIGHT)
    if (!m) return null
    digits.push(m.digit)
  }
  return ean8Valid(digits) ? digits.join('') : null
}

/*
 * Per-pixel threshold, interpolated between block midpoints. One threshold for
 * the whole line fails as soon as an end of the packet catches the window light,
 * which on a webcam is always. Blocks of ~64px with their own midpoint handle
 * the gradient, and interpolating between block centres rather than switching at
 * block edges stops a seam inventing an edge.
 *
 * A block with almost no contrast is table, hand or shelf, so it borrows the
 * nearest real threshold - flat regions then land wholly on one side of it.
 */
function thresholds(vals) {
  const n = vals.length
  const size = Math.max(24, Math.ceil(n / 12))
  const at = []
  const mid = []
  for (let s = 0; s < n; s += size) {
    const e = Math.min(n, s + size)
    let min = 255
    let max = 0
    for (let i = s; i < e; i++) {
      const v = vals[i]
      if (v < min) min = v
      if (v > max) max = v
    }
    at.push((s + e - 1) / 2)
    mid.push(max - min < 24 ? NaN : (min + max) / 2)
  }
  if (mid.every(Number.isNaN)) return null // nothing on this line has an edge

  for (let i = 0; i < mid.length; i++) {
    if (!Number.isNaN(mid[i])) continue
    let l = i - 1
    let r = i + 1
    while (l >= 0 && Number.isNaN(mid[l])) l--
    while (r < mid.length && Number.isNaN(mid[r])) r++
    mid[i] = l >= 0 && (r >= mid.length || i - l <= r - i) ? mid[l] : mid[r]
  }

  const out = new Float32Array(n)
  if (at.length === 1) {
    out.fill(mid[0])
    return out
  }
  let b = 0
  for (let i = 0; i < n; i++) {
    while (b < at.length - 2 && i > at[b + 1]) b++
    const k = (i - at[b]) / (at[b + 1] - at[b])
    out[i] = mid[b] + (mid[b + 1] - mid[b]) * Math.max(0, Math.min(1, k))
  }
  return out
}

/*
 * Run widths, to a fraction of a pixel.
 *
 * Labelling each pixel dark or light and counting them falls apart on the case
 * that matters: a barcode filling a third of a webcam frame is about two pixels
 * per module, a lens blurs the edge across a pixel or two, so one pixel on the
 * wrong side of the threshold is a 50% error in that run. Interpolating where
 * the signal actually crosses the threshold recovers the edge to well under a
 * pixel, which is the difference between "sometimes scans" and scans.
 *
 * Only complete runs come back. The stub before the first crossing has an
 * unknown width because the frame cut it off, and a truncated guard bar is
 * worse than no guard bar.
 */
function runsFromLine(vals) {
  const t = thresholds(vals)
  if (!t) return null

  const n = vals.length
  const d = new Float32Array(n)
  for (let i = 0; i < n; i++) d[i] = vals[i] - t[i] // negative = dark

  const cross = []
  for (let i = 1; i < n; i++) {
    const a = d[i - 1]
    const b = d[i]
    if (a < 0 === b < 0) continue
    const k = a / (a - b) // where between the two samples zero falls
    cross.push(i - 1 + (Number.isFinite(k) ? Math.max(0, Math.min(1, k)) : 0.5))
  }
  if (cross.length < 44) return null // fewer edges than the shortest symbol has

  const widths = new Array(cross.length - 1)
  for (let i = 1; i < cross.length; i++) widths[i - 1] = cross[i] - cross[i - 1]

  const after = Math.min(n - 1, Math.ceil(cross[0] + 0.5))
  return { widths, firstDark: d[after] < 0 }
}

/** Gentle 1-2-1 smooth. Noise makes false edges; this costs nothing. */
function smooth(vals) {
  const n = vals.length
  const v = new Float32Array(n)
  v[0] = vals[0]
  v[n - 1] = vals[n - 1]
  for (let i = 1; i < n - 1; i++) v[i] = (vals[i - 1] + 2 * vals[i] + vals[i + 1]) / 4
  return v
}

/*
 * Run widths from the gradient, as a second opinion.
 *
 * The threshold method has one common blind spot: a lens blurs a narrow bar more
 * than a wide one, so a narrow bar's grey never gets as dark, and any single
 * threshold cuts the narrow bars in the wrong place while getting the wide ones
 * right.
 *
 * An edge is still an edge no matter how deep the trough behind it goes - it's
 * the point of steepest change. So take the peaks of the first derivative and
 * interpolate each with a parabola through its neighbours, which lands the edge
 * to a fraction of a pixel without referring to absolute brightness. Edges have
 * to alternate dark-going and light-going; where two peaks point the same way
 * one is ringing, and the weaker goes.
 *
 * On synthetic scanlines with blur, noise, uneven light and printing jitter (see
 * scripts/verify.mjs) the two methods read 71% and 66% of lines, and 81% between
 * them. They fail on different lines, which is why both are here.
 */
function edgeRuns(vals) {
  const n = vals.length
  if (n < 60) return null
  const v = smooth(vals)

  let lo = 255
  let hi = 0
  for (let i = 0; i < n; i++) {
    if (v[i] < lo) lo = v[i]
    if (v[i] > hi) hi = v[i]
  }
  if (hi - lo < 20) return null

  const g = new Float32Array(n)
  for (let i = 1; i < n - 1; i++) g[i] = v[i + 1] - v[i - 1]
  // A tenth of the line's own contrast. Relative, so a grey-on-grey label and a
  // crisp black-on-white one both work without a magic number for brightness.
  const floor = Math.max(6, (hi - lo) * 0.1)

  const pos = []
  const sign = []
  const strength = []
  for (let i = 2; i < n - 2; i++) {
    const a = Math.abs(g[i])
    if (a < floor) continue
    if (a < Math.abs(g[i - 1]) || a < Math.abs(g[i + 1])) continue // must be a peak

    const y0 = Math.abs(g[i - 1])
    const y2 = Math.abs(g[i + 1])
    const den = y0 - 2 * a + y2
    const dx = den === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den))
    const s = g[i] < 0 ? -1 : 1 // -1 = getting darker, so a light-to-dark edge

    if (sign.length && sign[sign.length - 1] === s) {
      if (a > strength[strength.length - 1]) {
        pos[pos.length - 1] = i + dx
        strength[strength.length - 1] = a
      }
      continue
    }
    pos.push(i + dx)
    sign.push(s)
    strength.push(a)
  }
  if (pos.length < 44) return null

  const widths = new Array(pos.length - 1)
  for (let i = 1; i < pos.length; i++) widths[i - 1] = pos[i] - pos[i - 1]
  return { widths, firstDark: sign[0] === -1 }
}

/** Walk one set of measured runs, both ways round, and try to read a symbol. */
function readRuns(runs) {
  if (!runs) return null
  const { widths, firstDark } = runs
  const lastDark = (widths.length - 1) % 2 === 0 === firstDark

  // A barcode read right-to-left is a valid barcode upside down, and people
  // hold packets whichever way the packet is already facing.
  const passes = [
    { wide: widths, dark: firstDark },
    { wide: [...widths].reverse(), dark: lastDark },
  ]

  for (const { wide, dark } of passes) {
    const isDark = (i) => (i % 2 === 0) === dark
    for (let s = 0; s + 59 <= wide.length; s++) {
      if (!isDark(s)) continue
      const code = readEan13(wide, s)
      if (code) return code
    }
    for (let s = 0; s + 43 <= wide.length; s++) {
      if (!isDark(s)) continue
      const code = readEan8(wide, s)
      if (code) return code
    }
  }
  return null
}

/** Read one line of pixels: threshold crossings first, then gradient edges. */
function decodeLine(vals) {
  return readRuns(runsFromLine(vals)) || readRuns(edgeRuns(vals))
}

/** Rec. 601 luma, integer-only. Called a few hundred thousand times a second. */
const luma = (d, p) => (d[p] * 77 + d[p + 1] * 151 + d[p + 2] * 28) >> 8

/*
 * A reusable frame decoder.
 *
 * `maxWidth` is a cap for absurdly large frames, not a target: a 1280 or 1920
 * frame gets read at its own resolution. This matters more than it sounds. We
 * used to scale every frame to 640 wide first, and that one line was why the
 * camera never found anything. An EAN-13 is 95 modules wide and the decoder
 * wants about 2.7 px per module; a barcode at the closest distance a fixed-focus
 * laptop camera still focuses fills maybe a fifth of the frame:
 *
 *   1280 x 0.20 / 95  =  2.7 px per module   -> readable, just
 *    640 x 0.20 / 95  =  1.3 px per module   -> readable by nothing
 *
 * So the frame arrived legible and got averaged into mush before anybody read
 * it. Over 75 synthetic scanlines with blur, noise and light falloff at that
 * framing: 32% readable at native 1280, 0% after the downscale. barcode.js now
 * also asks for 1920 rather than taking what it's offered, which puts the same
 * framing at 4 px per module.
 *
 * Not downscaling leaves the full frame at 8 MB of RGBA, and pulling that off
 * the GPU 8 times a second is real work for pixels we never read. A 1D barcode
 * only needs lines, so each scanline is its own one-pixel-tall (or -wide)
 * getImageData: 19 rows plus 5 columns is about 150 KB a frame.
 *
 * Lines go middle-outwards, so the common case costs a couple of reads rather
 * than all 24. Rows before columns, so a bottle on its side still scans without
 * anybody being told to rotate it.
 *
 * @param {{ maxWidth?: number }} opts - upper bound on working width.
 * @returns {{ decode: (video: HTMLVideoElement) => string|null, frames: number, size: string }}
 */
export function createDecoder({ maxWidth = 1920 } = {}) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  /** Evenly spaced, then reordered centre-first. */
  const spread = (from, to, count) =>
    Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1)).sort(
      (a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5)
    )

  // 19 rows about 4% of the frame apart. A barcode only a sixth of the frame
  // tall still gets crossed by three or four of them, which is what stopped
  // the old seven-row version from missing symbols between its lines.
  const ROWS = spread(0.14, 0.86, 19)
  const COLS = spread(0.2, 0.8, 5)

  const api = {
    frames: 0,
    size: '',

    decode(video) {
      const vw = video?.videoWidth || 0
      const vh = video?.videoHeight || 0
      if (!vw || !vh || !ctx) return null

      const w = Math.min(maxWidth, vw)
      const h = Math.max(1, Math.round((vh / vw) * w))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.drawImage(video, 0, 0, w, h)
      api.frames++
      api.size = `${vw}×${vh}`

      const line = (x, y, lw, lh, n) => {
        let data
        try {
          data = ctx.getImageData(x, y, lw, lh).data
        } catch {
          return null // tainted canvas; nothing to be done about it here
        }
        const out = new Uint8Array(n)
        for (let i = 0; i < n; i++) out[i] = luma(data, i * 4)
        return decodeLine(out)
      }

      for (const f of ROWS) {
        const code = line(0, Math.min(h - 1, Math.round(h * f)), w, 1, w)
        if (code) return code
      }
      for (const f of COLS) {
        const code = line(Math.min(w - 1, Math.round(w * f)), 0, 1, h, h)
        if (code) return code
      }

      return null
    },
  }

  return api
}

/** Exported for the check script and for anyone wanting to unit-test a line. */
export const __internals = {
  decodeLine, runsFromLine, edgeRuns, readRuns, thresholds, readEan13, readEan8, PARITY, A_RUNS,
}
