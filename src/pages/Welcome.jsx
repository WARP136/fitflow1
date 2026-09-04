import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import GradientMesh from '../components/GradientMesh.jsx'
import LottieBox from '../components/LottieBox.jsx'
import { useApp } from '../store/AppState.jsx'

/*
 * Landing screen: the pitch and one button, no onboarding form.
 *
 * Everything the old wizard asked for now has a default and lives next to
 * the thing it affects - name on /you, equipment on /move, energy at the
 * top of /today, water goal on /water, Neha's tone on /neha.
 *
 * finishOnboarding sets the flag that keeps this screen from coming back.
 * "Forget everything" on /you clears it, which is how we reset for a demo.
 */

const PROMISES = [
  'No streaks. Anywhere. By design.',
  'One focus a day, not a wall of numbers.',
  'A companion that adapts to your mood.',
  'Nothing leaves your browser.',
]

export default function Welcome() {
  const { dispatch, dur } = useApp()
  const navigate = useNavigate()

  const open = () => {
    dispatch({ type: 'finishOnboarding', patch: {} })
    navigate('/today')
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GradientMesh tone="/today" />

      {/* Hero figure, bled off the right edge so it doesn't read as a picture
          in a box. -z-10 keeps it behind the text column below. */}
      <div className="pointer-events-none absolute inset-y-0 right-[-6%] -z-10 hidden w-[56vw] max-w-[880px] items-center lg:flex">
        <div
          className="absolute left-1/2 top-1/2 h-[86%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--accent-rgb),.30) 0%, rgba(var(--accent-rgb),.09) 52%, transparent 76%)',
          }}
        />
        <LottieBox
          src="/lottie/meditate.json"
          playing
          loop
          className="relative h-auto w-full opacity-[0.92]"
          fallback={
            <div className="animate-bob relative grid aspect-square w-full place-items-center">
              <div
                className="h-2/3 w-2/3 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 34% 28%, rgba(var(--accent-rgb),.5), rgba(var(--accent-rgb),.12))',
                }}
              />
            </div>
          }
        />
      </div>

      {/* Below lg the text needs full width, so the figure drops behind it at
          low opacity instead of disappearing. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[92vw] -translate-x-1/2 -translate-y-1/2 lg:hidden">
        <LottieBox
          src="/lottie/meditate.json"
          playing
          loop
          className="h-auto w-full opacity-[0.16]"
          fallback={<div className="animate-breathe aspect-square w-full opacity-25" />}
        />
      </div>

      {/* Scrim over the figure, under the words. Keeps the headline readable
          on narrow laptops where the column and figure overlap. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(96deg, rgba(5,16,11,.94) 0%, rgba(5,16,11,.82) 34%, rgba(5,16,11,.3) 62%, transparent 82%)',
        }}
      />

      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-10 py-14 xl:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur(0.7), ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[640px]"
        >
          <span className="pill">Team Solfinders</span>

          <h1 className="mt-7 font-display text-[clamp(2.7rem,5.2vw,4.5rem)] font-semibold leading-[0.98]">
            Fitness that meets you
            <br />
            <span className="accent-text">where you are</span>,
            <br />
            not where you think
            <br />
            you should be.
          </h1>

          <p className="mt-7 max-w-[47ch] text-[16.5px] leading-relaxed text-muted">
            Most fitness apps are built for people who already work out. This one
            is built for the rest of us: no streaks to break, no guilt for a
            missed day, one thing to focus on at a time.
          </p>

          <ul className="mt-8 grid max-w-[560px] gap-x-8 gap-y-3 sm:grid-cols-2">
            {PROMISES.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
                <span className="text-[14.5px] leading-snug text-ink/75">{p}</span>
              </li>
            ))}
          </ul>

          <button onClick={open} className="btn-primary mt-10 px-7 py-3.5 text-[15px]">
            Open FitFlow
            <ArrowRight size={17} />
          </button>
        </motion.div>
      </div>
    </div>
  )
}
