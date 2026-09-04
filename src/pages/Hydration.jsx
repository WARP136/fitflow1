import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Undo2 } from 'lucide-react'
import Page from '../components/Page.jsx'
import ProgressRing from '../components/ProgressRing.jsx'
import LottieBox from '../components/LottieBox.jsx'
import { useApp } from '../store/AppState.jsx'

const AMOUNTS = [200, 250, 350, 500]
const GOALS = [1.5, 2, 2.5, 3, 3.5]

const clockTime = (ts) =>
  new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export default function Hydration() {
  const { waterLog, waterMl, goalMl, waterPct, goalLiters, dispatch, dur } = useApp()

  // Each log replays the water animation from frame 0 - the point is the
  // small celebratory moment, not the number going up.
  const [splash, setSplash] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const log = (ml) => {
    dispatch({ type: 'logWater', ml })
    setSplash((s) => s + 1)
    setPlaying(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPlaying(false), 2600)
  }

  const remaining = Math.max(0, goalMl - waterMl)

  return (
    <Page>
      <p className="eyebrow">Water</p>
      <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
        {waterPct >= 100 ? 'Goal met. Nicely done.' : 'One glass at a time.'}
      </h1>
      <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-muted">
        Your goal, set by you, changeable whenever. Nothing here resets or
        punishes you for yesterday.
      </p>

      <div className="mt-9 grid gap-6 lg:grid-cols-[6fr_6fr]">
        {/* --- Ring + logging --- */}
        <div className="glass p-9">
          <div className="flex flex-wrap items-center gap-9">
            <ProgressRing value={waterPct} size={224} stroke={17}>
              <div>
                <p className="num font-display text-[42px] leading-none">
                  {(waterMl / 1000).toFixed(2)}
                </p>
                <p className="mt-1.5 text-[12px] uppercase tracking-[0.14em] text-muted">
                  of {(goalMl / 1000).toFixed(1)} litres
                </p>
              </div>
            </ProgressRing>

            <div className="min-w-[190px] flex-1">
              <p className="eyebrow">Log a drink</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {AMOUNTS.map((ml) => (
                  <button
                    key={ml}
                    onClick={() => log(ml)}
                    className="btn-ghost num justify-center px-4 py-3"
                  >
                    <Plus size={14} />
                    {ml} ml
                  </button>
                ))}
              </div>
              <button
                onClick={() => dispatch({ type: 'undoWater' })}
                disabled={!waterLog.length}
                className="btn-ghost mt-2.5 w-full justify-center px-4 py-2.5 text-[13.5px] disabled:opacity-40"
              >
                <Undo2 size={14} />
                Undo last
              </button>
            </div>
          </div>

          <div className="mt-8 border-t border-edge/70 pt-6">
            <p className="eyebrow">Daily goal</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {GOALS.map((g) => {
                const active = goalLiters === g
                return (
                  <button
                    key={g}
                    onClick={() => dispatch({ type: 'goalLiters', liters: g })}
                    className={`num rounded-xl border px-4 py-2 text-[13.5px] transition ${
                      active ? 'border-transparent font-medium' : 'border-edge bg-white/[0.05] hover:bg-white/[0.11]'
                    }`}
                    style={
                      active
                        ? {
                            background: 'rgba(var(--accent-rgb),.16)',
                            color: 'var(--accent-ink)',
                            borderColor: 'var(--accent)',
                          }
                        : undefined
                    }
                  >
                    {g} L
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* --- Animation + today's log --- */}
        <div className="flex flex-col gap-6">
          <div className="glass relative flex min-h-[268px] items-center justify-center overflow-hidden p-7">
            <div
              className="pointer-events-none absolute inset-x-8 bottom-0 h-40 rounded-t-full blur-2xl transition-opacity duration-500"
              style={{
                background: 'radial-gradient(circle at 50% 100%, rgba(var(--accent-rgb),.34), transparent 70%)',
                opacity: playing ? 1 : 0.45,
              }}
            />
            <LottieBox
              src="/lottie/water.json"
              playing={playing}
              loop
              resetKey={splash}
              className="relative z-10 h-[210px]"
              fallback={
                <div className="relative z-10 grid place-items-center">
                  <motion.div
                    key={splash}
                    initial={{ scale: 0.85, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="h-32 w-32 rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle at 38% 30%, rgba(var(--accent-rgb),.6), rgba(var(--accent-rgb),.14))',
                    }}
                  />
                  <p className="mt-5 text-[12.5px] text-muted">
                    Add water.json to public/lottie
                  </p>
                </div>
              }
            />
            <AnimatePresence>
              {playing && (
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: dur(0.3) }}
                  className="pill absolute bottom-6 left-1/2 -translate-x-1/2"
                >
                  {remaining > 0
                    ? `${(remaining / 1000).toFixed(2)} L to go`
                    : 'That’s your goal met'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="card flex-1">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Logged today</p>
              <span className="num text-[12.5px] text-muted">
                {waterLog.length} {waterLog.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {waterLog.length === 0 ? (
              <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
                Nothing logged yet. The first glass counts as much as the last one.
              </p>
            ) : (
              <ul className="mt-4 max-h-[200px] space-y-2 overflow-y-auto no-scrollbar">
                <AnimatePresence initial={false}>
                  {[...waterLog].reverse().map((w) => (
                    <motion.li
                      key={w.at}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: dur(0.28) }}
                      className="flex items-center justify-between rounded-xl border border-edge/60 bg-white/[0.05] px-4 py-2.5"
                    >
                      <span className="num text-[14px]">{w.ml} ml</span>
                      <span className="num text-[12.5px] text-muted">
                        {clockTime(w.at)}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}
