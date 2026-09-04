/*
 * Open-Meteo. Free, no key, no signup, CORS-enabled.
 *
 * Weather is here because "meets you where you are" includes "it's 38
 * degrees" and "it's pouring". Suggesting a walk is worse than useless if
 * the weather makes it a bad idea, so Today's focus card and Neha both read
 * this.
 *
 * No navigator.geolocation on purpose - on a laptop it throws a permission
 * dialog over the page and resolves to wifi-triangulated coordinates anyway.
 * Fixed coordinates, caller can override.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const DEFAULT = { lat: 28.5931, lon: 77.2197, place: 'New Delhi' } // Lodhi Garden

// WMO weather interpretation codes, collapsed into what a person cares about.
function describe(code) {
  if (code === 0) return { label: 'Clear', outdoor: 'good' }
  if (code <= 2) return { label: 'Mostly clear', outdoor: 'good' }
  if (code === 3) return { label: 'Overcast', outdoor: 'good' }
  if (code === 45 || code === 48) return { label: 'Foggy', outdoor: 'ok' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', outdoor: 'ok' }
  if (code >= 61 && code <= 67) return { label: 'Raining', outdoor: 'indoor' }
  if (code >= 71 && code <= 77) return { label: 'Snow', outdoor: 'indoor' }
  if (code >= 80 && code <= 82) return { label: 'Showers', outdoor: 'indoor' }
  if (code === 85 || code === 86) return { label: 'Snow showers', outdoor: 'indoor' }
  if (code >= 95) return { label: 'Thunderstorm', outdoor: 'indoor' }
  return { label: 'Mixed', outdoor: 'ok' }
}

/**
 * One short sentence in the product voice. Never bossy, never a warning -
 * it offers a read on the day and leaves the choice with the user.
 */
function line(tempC, d, isDay) {
  const t = Math.round(tempC)
  if (d.outdoor === 'indoor') return `${d.label.toLowerCase()} out - good day to stay in`
  if (t >= 36) return `${t} degrees out - go early or go indoors`
  if (t <= 6) return `${t} degrees and ${d.label.toLowerCase()} - layer up if you head out`
  if (!isDay) return `${t} degrees, ${d.label.toLowerCase()} - nice evening for a walk`
  return `${t} degrees and ${d.label.toLowerCase()} - good weather for a walk`
}

const OFFLINE = {
  tempC: null,
  label: 'Weather unavailable',
  outdoor: 'ok',
  isDay: true,
  line: 'No weather right now - go by how you feel',
  place: DEFAULT.place,
  source: 'offline',
}

export async function getWeather({ lat, lon, place } = {}) {
  const q = new URLSearchParams({
    latitude: String(lat ?? DEFAULT.lat),
    longitude: String(lon ?? DEFAULT.lon),
    current: 'temperature_2m,weather_code,is_day',
    timezone: 'auto',
  })

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 7000)

  try {
    const res = await fetch(`${ENDPOINT}?${q}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`open-meteo ${res.status}`)
    const json = await res.json()
    const cur = json?.current
    if (!cur || typeof cur.temperature_2m !== 'number') {
      throw new Error('unexpected shape')
    }
    const d = describe(cur.weather_code)
    const isDay = cur.is_day !== 0
    return {
      tempC: cur.temperature_2m,
      label: d.label,
      outdoor: d.outdoor,
      isDay,
      line: line(cur.temperature_2m, d, isDay),
      place: place ?? DEFAULT.place,
      source: 'open-meteo',
    }
  } catch (err) {
    return { ...OFFLINE, reason: err?.message || 'failed' }
  } finally {
    clearTimeout(timer)
  }
}
