import { motion } from 'framer-motion'
import { ENERGY } from '../data/energy.js'
import { useApp } from '../store/AppState.jsx'

/*
 * The one control the whole product hangs off. Same component on the dashboard
 * (a mood check-in) and inside the exercise timer (a pace choice), on purpose,
 * so it only has to be learned once.
 *
 * Picking a level rewrites the CSS accent variables, retimes every Framer
 * transition and sets the Lottie playback speed.
 */
export default function EnergyPicker({ showHint = true, compact = false }) {
  const { energy, dispatch, dur } = useApp()

  return (
    <div>
      <div
        className={`flex flex-wrap gap-2 ${compact ? '' : 'sm:flex-nowrap'}`}
        role="radiogroup"
        aria-label="How is your energy today"
      >
        {ENERGY.map((e) => {
          const active = e.id === energy
          return (
            <button
              key={e.id}
              role="radio"
              aria-checked={active}
              onClick={() => dispatch({ type: 'energy', id: e.id })}
              className={`relative flex-1 rounded-2xl border px-4 py-3 text-left transition-colors ${
                active
                  ? 'border-transparent'
                  : 'border-[#8b9a6e]/70 bg-[#eae2d6]'
              }`}
              style={active ? { background: `rgba(${e.rgb},.14)` } : undefined}
            >
              {active && (
                <motion.span
                  layoutId="energy-selected"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    border: `1.5px solid ${e.accent}`,
                    boxShadow: `0 6px 18px -8px rgba(${e.rgb},.6)`,
                  }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: e.accent, opacity: active ? 1 : 0.45 }}
                />
                <span
                  className={`text-[14px] font-medium ${active ? '' : 'text-[#2f3826]'}`}
                  style={active ? { color: e.accentInk } : undefined}
                >
                  {e.label}
                </span>
              </span>
              {!compact && (
                <span className="relative mt-1 block text-[12px] leading-snug text-muted">
                  {e.hint}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {showHint && (
        <motion.p
          key={energy}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur(0.35) }}
          className="mt-3 text-[13px] text-muted"
        >
          The app follows your lead - colour, pace and the coach all slow down
          or pick up with this.
        </motion.p>
      )}
    </div>
  )
}
