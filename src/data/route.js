/*
 * Scripted jog route rather than live GPS. Desktop browsers expose the same
 * navigator.geolocation API as phones, but a laptop has no GPS chip - the
 * position comes from wifi triangulation or IP, accurate to tens or hundreds
 * of metres, and it doesn't update smoothly as you move. On stage that's a
 * frozen dot, or a dot that teleports. Animating a pre-set path shows the
 * feature honestly instead.
 *
 * Closed loop around Lodhi Garden, New Delhi, about 2.4 km. Generated
 * parametrically with a deterministic wobble so it curves like a real route
 * instead of tracing a perfect ellipse.
 */
const CENTER = [28.5931, 77.2197]
const M_PER_DEG_LAT = 111320
const M_PER_DEG_LNG = 97800 // 111320 * cos(28.6 degrees)

function buildLoop(points = 90) {
  const out = []
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2
    // base ellipse + two harmonics = an organic, non-circular loop
    const wobble = 1 + 0.16 * Math.sin(3 * t + 0.6) + 0.08 * Math.sin(5 * t + 1.9)
    const rx = 470 * wobble
    const ry = 330 * wobble
    const lat = CENTER[0] + (ry * Math.sin(t)) / M_PER_DEG_LAT
    const lng = CENTER[1] + (rx * Math.cos(t)) / M_PER_DEG_LNG
    out.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))])
  }
  out.push(out[0]) // close the loop
  return out
}

export const ROUTE = buildLoop()
export const ROUTE_CENTER = CENTER

// Great-circle distance between two [lat,lng] pairs, in metres.
export function haversine(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Cumulative distance in metres along the whole route.
export const ROUTE_LENGTH = ROUTE.reduce(
  (sum, pt, i) => (i === 0 ? 0 : sum + haversine(ROUTE[i - 1], pt)),
  0
)
