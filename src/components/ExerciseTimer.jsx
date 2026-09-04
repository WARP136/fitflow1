import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Check, X, Volume2, VolumeX } from 'lucide-react'
import LottieBox from './LottieBox.jsx'
import ProgressRing from './ProgressRing.jsx'
import EnergyPicker from './EnergyPicker.jsx'
import { useApp } from '../store/AppState.jsx'
import { COACH_SCRIPT, CUE_POINTS, speak, stopSpeaking, voiceAvailable } from '../services/voice.js'

const TICK_MS = 100

const mmss = (s) => {
  const total = Math.ceil(s)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

/*
 * Countdown and Lottie character kept in lockstep:
 *   - the animation is parked on frame 0 until Start is pressed
 *   - pausing the timer pauses the animation in place (it does not rewind)
 *   - the chosen energy level sets the animation's playback speed via
 *     setSpeed(), and also the speaking rate of the voice coach
 *   - four coach lines fire at fixed fractions of elapsed time (0, 50%,
 *     85%, 100%), tracked in a Set so each line only ever plays once
 *
 * The timer runs on a 100 ms interval rather than 1 s so the progress ring
 * moves smoothly instead of stepping.
 */
export default function ExerciseTimer({ exercise, onClose }) {
  const { energyMeta, voiceOn, dispatch, dur, completed } = useApp()
  const total = exercise.seconds

  const [remaining, setRemaining] = useState(total)
  const [status, setStatus] = useState('idle') // idle | running | paused | done
  const [resetKey, setResetKey] = useState(0)
  const fired = useRef(new Set())

  const progress = 1 - remaining / total
  const isRunning = status === 'running'
  const alreadyDone = completed.includes(exercise.id)

  // Switching exercise inside the panel starts everything over cleanly.
  useEffect(() => {
    setRemaining(exercise.seconds)
    setStatus('idle')
    fired.current.clear()
    setResetKey((k) => k + 1)
    stopSpeaking()
  }, [exercise.id, exercise.seconds])

  // Stop any queued speech if the panel unmounts mid-session.
  useEffect(() => () => stopSpeaking(), [])

  // The clock.
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, Number((r - TICK_MS / 1000).toFixed(2))))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [isRunning])

  // Coach lines + completion, both derived from elapsed progress.
  useEffect(() => {
    if (status !== 'running') return

    // Energy tempo is a "slowness" multiplier, so invert it for speech rate.
    const rate = 0.95 / energyMeta.tempo

    for (const cue of CUE_POINTS) {
      if (cue.at >= 1) continue
      if (progress >= cue.at && !fired.current.has(cue.key)) {
        fired.current.add(cue.key)
        speak(COACH_SCRIPT[cue.key], { enabled: voiceOn, rate })
      }
    }

    if (remaining <= 0) {
      setStatus('done')
      if (!fired.current.has('done')) {
        fired.current.add('done')
        speak(COACH_SCRIPT.done, { enabled: voiceOn, rate })
      }
      dispatch({ type: 'completeExercise', id: exercise.id })
    }
  }, [progress, remaining, status, voiceOn, energyMeta.tempo, dispatch, exercise.id])

  const start = () => {
    if (status === 'done') return
    setStatus('running')
  }
  const pause = () => {
    setStatus('paused')
    stopSpeaking()
  }
  const reset = () => {
    setRemaining(total)
    setStatus('idle')
    fired.current.clear()
    setResetKey((k) => k + 1)
    stopSpeaking()
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur(0.45), ease: [0.22, 1, 0.36, 1] }}
      className="glass overflow-hidden p-0"
    >
      <div className="grid gap-0 lg:grid-cols-[1.05fr_1fr]">
        {/* --- Animation side --- */}
        <div className="relative flex min-h-[440px] items-center justify-center border-b border-white/[0.08] p-8 lg:border-b-0 lg:border-r">
          <div
            className="absolute inset-10 rounded-full blur-3xl transition-opacity duration-700"
            style={{
              background: `radial-gradient(circle at 50% 55%, rgba(var(--accent-rgb),${
                isRunning ? 0.3 : 0.14
              }), transparent 70%)`,
            }}
          />
          <LottieBox
            src={exercise.lottie}
            playing={isRunning}
            speed={energyMeta.lottieSpeed}
            resetKey={resetKey}
            className="relative z-10 h-[360px] w-full"
            fallback={
              <div className="relative z-10 grid h-[360px] w-full place-items-center">
                <div
                  className={`h-40 w-40 rounded-[3rem] ${isRunning ? 'animate-bob' : ''}`}
                  style={{
                    background:
                      'radial-gradient(circle at 35% 28%, rgba(var(--accent-rgb),.55), rgba(var(--accent-rgb),.14))',
                  }}
                />
                <p className="mt-6 max-w-[16rem] text-center text-[12.5px] leading-relaxed text-muted">
                  Drop {exercise.lottie.split('/').pop()} into public/lottie to see
                  the animation here.
                </p>
              </div>
            }
          />
          <span className="pill absolute left-6 top-6">
            {isRunning ? 'Playing' : status === 'paused' ? 'Paused' : 'Ready'}
            <span className="num ml-1 text-ink/70">
              {energyMeta.lottieSpeed.toFixed(2)}x
            </span>
          </span>
        </div>

        {/* --- Controls side --- */}
        <div className="flex flex-col p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Now doing</p>
              <h2 className="mt-1.5 font-display text-[38px] leading-[1.05]">
                {exercise.name}
              </h2>
              <p className="mt-2 max-w-[26ch] text-[14px] leading-relaxed text-muted">
                {exercise.cue}
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close the timer"
                className="rounded-full border border-edge bg-white/[0.05] p-2 text-muted transition hover:text-ink"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mt-7 flex items-center gap-7">
            <ProgressRing value={progress * 100} size={168} stroke={13} duration={0.25}>
              <div>
                <p className="num font-display text-[40px] leading-none">
                  {mmss(remaining)}
                </p>
                <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted">
                  {status === 'done' ? 'finished' : 'remaining'}
                </p>
              </div>
            </ProgressRing>

            <div className="flex-1">
              <p className="eyebrow mb-2.5">Pace</p>
              <EnergyPicker compact showHint={false} />
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                Sets the animation speed and how fast the coach talks. Change it
                mid-set if you want.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {status !== 'done' ? (
              <>
                <button onClick={isRunning ? pause : start} className="btn-primary min-w-[148px]">
                  {isRunning ? <Pause size={17} /> : <Play size={17} />}
                  {isRunning ? 'Pause' : status === 'paused' ? 'Resume' : 'Start'}
                </button>
                <button onClick={reset} className="btn-ghost">
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
                  <Check size={17} />
                  Logged for today
                </span>
                <button onClick={reset} className="btn-ghost">
                  <RotateCcw size={16} />
                  Go again
                </button>
              </>
            )}

            <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-muted">
              {voiceOn && voiceAvailable() ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {voiceAvailable()
                ? voiceOn
                  ? 'Coach on'
                  : 'Coach muted'
                : 'No voice on this browser'}
            </span>
          </div>

          <AnimatePresence>
            {status === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur(0.4) }}
                className="mt-6 rounded-2xl border border-edge/70 bg-mist/40 p-5"
              >
                <p className="text-[14.5px] font-medium">That’s one done.</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                  Stop here and it still counted. Pick another movement if you
                  have more in you.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-auto pt-6">
            <p className="text-[12.5px] leading-relaxed text-muted">
              <span className="font-medium text-ink/75">Too much today? </span>
              {exercise.swap}
            </p>
            {alreadyDone && status !== 'done' && (
              <p className="mt-2 text-[12.5px] accent-text">
                You already logged this one today.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
