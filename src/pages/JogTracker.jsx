import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Info, Footprints, CloudSun } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import Page from '../components/Page.jsx'
import StatCard from '../components/StatCard.jsx'
import LottieBox from '../components/LottieBox.jsx'
import { useApp } from '../store/AppState.jsx'
import { ROUTE, ROUTE_LENGTH, haversine } from '../data/route.js'
import { COACH_SCRIPT, CUE_POINTS, speak, stopSpeaking } from '../services/voice.js'
import { useWeather } from '../hooks/useLive.js'

/** Assumed jogging pace used to convert simulated time into distance. */
const PACE_S_PER_KM = 390 // 6:30 per km
const SPEEDS = [1, 8, 16]

const mmss = (s) => {
  const t = Math.floor(s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/** Frames the whole route once, so the map never jitters mid-run. */
function FitRoute() {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(ROUTE, { padding: [34, 34] })
  }, [map])
  return null
}

export default function JogTracker() {
  const { voiceOn, energyMeta, dispatch, jogs, dur } = useApp()
  const weather = useWeather()

  const [status, setStatus] = useState('idle') // idle | running | paused | done
  const [sim, setSim] = useState(0) // simulated elapsed seconds
  const [speed, setSpeed] = useState(8) // demo time compression
  const fired = useRef(new Set())
  const raf = useRef(0)
  const last = useRef(0)

  /** Cumulative distance at each route vertex, computed once. */
  const cum = useMemo(() => {
    const c = [0]
    for (let i = 1; i < ROUTE.length; i++) c.push(c[i - 1] + haversine(ROUTE[i - 1], ROUTE[i]))
    return c
  }, [])

  const distance = Math.min(ROUTE_LENGTH, (sim / PACE_S_PER_KM) * 1000)
  const progress = distance / ROUTE_LENGTH

  /** Interpolate a position between vertices so the dot glides. */
  const { pos, index } = useMemo(() => {
    if (distance <= 0) return { pos: ROUTE[0], index: 0 }
    if (distance >= ROUTE_LENGTH)
      return { pos: ROUTE[ROUTE.length - 1], index: ROUTE.length - 1 }
    let i = 1
    while (i < cum.length && cum[i] < distance) i++
    const span = cum[i] - cum[i - 1] || 1
    const t = (distance - cum[i - 1]) / span
    return {
      pos: [
        ROUTE[i - 1][0] + (ROUTE[i][0] - ROUTE[i - 1][0]) * t,
        ROUTE[i - 1][1] + (ROUTE[i][1] - ROUTE[i - 1][1]) * t,
      ],
      index: i,
    }
  }, [distance, cum])

  const travelled = useMemo(() => [...ROUTE.slice(0, index), pos], [index, pos])

  // The clock, on requestAnimationFrame so the dot moves smoothly.
  useEffect(() => {
    if (status !== 'running') return
    last.current = performance.now()
    const loop = (t) => {
      const dt = (t - last.current) / 1000
      last.current = t
      setSim((s) => s + dt * speed)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [status, speed])

  useEffect(() => () => stopSpeaking(), [])

  // Coach lines and completion, both keyed off route progress.
  useEffect(() => {
    if (status !== 'running') return
    const rate = 0.95 / energyMeta.tempo

    for (const cue of CUE_POINTS) {
      if (cue.at >= 1) continue
      if (progress >= cue.at && !fired.current.has(cue.key)) {
        fired.current.add(cue.key)
        speak(COACH_SCRIPT[cue.key], { enabled: voiceOn, rate })
      }
    }

    if (progress >= 1) {
      setStatus('done')
      if (!fired.current.has('done')) {
        fired.current.add('done')
        speak(COACH_SCRIPT.done, { enabled: voiceOn, rate })
      }
      // Guarded by the same Set as the coach lines: addJog is not
      // idempotent, and the animation frame loop can outlive one render.
      if (!fired.current.has('saved')) {
        fired.current.add('saved')
        dispatch({
          type: 'addJog',
          jog: {
            km: Number((ROUTE_LENGTH / 1000).toFixed(2)),
            seconds: Math.round(sim),
            at: Date.now(),
          },
        })
      }
    }
  }, [progress, status, voiceOn, energyMeta.tempo, dispatch, sim])

  const reset = () => {
    setStatus('idle')
    setSim(0)
    fired.current.clear()
    stopSpeaking()
  }

  const paceLabel =
    distance > 40 ? `${mmss((sim / (distance / 1000)) )} /km` : '—'

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Jog & walk</p>
          <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
            {status === 'done' ? 'Route finished.' : 'Out for a loop.'}
          </h1>
          <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-muted">
            A 2.8 km loop with the coach along for company. Walking it counts
            exactly the same as running it.
          </p>
          {weather && (
            <span className="pill mt-4" title={`${weather.place} · ${weather.source}`}>
              <CloudSun size={13} />
              {weather.line}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="eyebrow mr-1">Demo speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`num rounded-lg border px-3 py-1.5 text-[12.5px] transition ${
                speed === s ? 'border-transparent font-medium' : 'border-edge bg-white/[0.05] hover:bg-white/[0.11]'
              }`}
              style={
                speed === s
                  ? {
                      background: 'rgba(var(--accent-rgb),.16)',
                      color: 'var(--accent-ink)',
                      borderColor: 'var(--accent)',
                    }
                  : undefined
              }
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[7fr_5fr]">
        {/* --- Map --- */}
        <div className="glass relative overflow-hidden p-0">
          <div className="map-soft h-[520px] w-full">
            <MapContainer
              center={ROUTE[0]}
              zoom={15}
              scrollWheelZoom={false}
              zoomControl={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitRoute />
              {/* The full route, faint */}
              <Polyline positions={ROUTE} pathOptions={{ color: '#FFFFFF', opacity: 0.17, weight: 5 }} />
              {/* The part covered so far, in the live accent colour */}
              <Polyline
                positions={travelled}
                pathOptions={{ color: energyMeta.accent, weight: 5, opacity: 0.95 }}
              />
              <CircleMarker
                center={pos}
                radius={9}
                pathOptions={{
                  color: '#FFFFFF',
                  weight: 3,
                  fillColor: energyMeta.accent,
                  fillOpacity: 1,
                }}
              />
            </MapContainer>
          </div>

          <span className="pill absolute left-5 top-5 z-[400]">
            <Info size={12} />
            Simulated route
          </span>

          {/* Pre-start state: an invitation, not an empty screen. */}
          <AnimatePresence>
            {status === 'idle' && sim === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur(0.4) }}
                className="absolute inset-0 z-[401] grid place-items-center bg-paper/55 backdrop-blur-[3px]"
              >
                <div className="glass max-w-[340px] p-8 text-center">
                  <LottieBox
                    src="/lottie/jogging.json"
                    playing
                    loop
                    className="mx-auto h-[132px]"
                    fallback={
                      <div className="animate-bob mx-auto grid h-[132px] place-items-center">
                        <span
                          className="grid h-20 w-20 place-items-center rounded-full"
                          style={{
                            background: 'rgba(var(--accent-rgb),.2)',
                            color: 'var(--accent-ink)',
                          }}
                        >
                          <Footprints size={30} />
                        </span>
                      </div>
                    }
                  />
                  <h2 className="mt-4 font-display text-[22px] leading-tight">
                    Ready when you are
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                    Press start and the route plays out with pace, distance and the
                    voice coach.
                  </p>
                  <button onClick={() => setStatus('running')} className="btn-primary mt-5 w-full">
                    <Play size={16} />
                    Start the loop
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- Stats and controls --- */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Distance"
              value={(distance / 1000).toFixed(2)}
              unit="km"
              sub={`of ${(ROUTE_LENGTH / 1000).toFixed(2)} km`}
            />
            <StatCard label="Time" value={mmss(sim)} sub={`${speed}x demo speed`} />
            <StatCard label="Pace" value={paceLabel} sub="minutes per km" />
            <StatCard
              label="Done"
              value={`${Math.round(progress * 100)}%`}
              sub={status === 'done' ? 'loop complete' : 'of the loop'}
            />
          </div>

          <div className="glass p-7">
            <div className="flex flex-wrap items-center gap-3">
              {status !== 'done' ? (
                <>
                  <button
                    onClick={() => setStatus(status === 'running' ? 'paused' : 'running')}
                    className="btn-primary min-w-[142px]"
                  >
                    {status === 'running' ? <Pause size={17} /> : <Play size={17} />}
                    {status === 'running' ? 'Pause' : sim > 0 ? 'Resume' : 'Start'}
                  </button>
                  <button onClick={reset} className="btn-ghost" disabled={sim === 0}>
                    <RotateCcw size={16} />
                    Reset
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium"
                    style={{
                      background: 'rgba(var(--accent-rgb),.16)',
                      color: 'var(--accent-ink)',
                    }}
                  >
                    Saved to your week
                  </span>
                  <button onClick={reset} className="btn-ghost">
                    <RotateCcw size={16} />
                    Run it again
                  </button>
                </>
              )}
            </div>

            <p className="mt-5 text-[12.5px] leading-relaxed text-muted">
              <span className="font-medium text-ink/75">Why the route is scripted: </span>
              a laptop has no GPS chip, so browser location comes from wifi or IP
              and is accurate to tens or hundreds of metres. On a projector that
              reads as a frozen or teleporting dot. This animates a real 2.8 km
              path instead, so the feature can be judged on what it does.
            </p>
          </div>

          {jogs.length > 0 && (
            <div className="card">
              <p className="eyebrow">Logged today</p>
              <ul className="num mt-3 space-y-1.5 text-[13.5px] text-muted">
                {jogs.map((j) => (
                  <li key={j.at} className="flex justify-between">
                    <span className="text-ink">{j.km} km</span>
                    <span>{mmss(j.seconds)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
