import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Search, Loader2, Library, Wrench } from 'lucide-react'
import Page, { riseIn, stagger } from '../components/Page.jsx'
import LottieBox from '../components/LottieBox.jsx'
import ExerciseTimer from '../components/ExerciseTimer.jsx'
import { useApp } from '../store/AppState.jsx'
import { SESSION } from '../data/session.js'
import { EXERCISES, getExercise } from '../data/exercises.js'
import { EQUIPMENT, getEquipment, allows } from '../data/equipment.js'
import { getGoal } from '../data/goals.js'
import { searchExercises, LIBRARY } from '../services/wgerApi.js'

/*
 * Move: three pictures, three words.
 *
 * Each tile is the figure and the name. The cue, seconds, rounds and swap
 * all still exist, they just live in the timer where you're about to need
 * them. We own three good animations and the old layout hid them behind a
 * Start button.
 *
 * Hover behaviour, which took a few passes to get right:
 *   - Parked, not playing. Three looping figures side by side is a slot
 *     machine and makes choosing harder.
 *   - Slow bob while parked so tiles read as alive, not as broken images.
 *   - On hover the real animation plays at the current energy tempo. On
 *     leave it holds where it got to rather than snapping to frame 0 -
 *     LottieBox only rewinds when resetKey changes, same as the timer.
 */
export default function Workouts() {
  const { dispatch, completed, energyMeta, equipment, moveGoal } = useApp()
  const [activeId, setActiveId] = useState(null)
  const [lit, setLit] = useState(null)
  const active = activeId ? getExercise(activeId) : null
  const kit = getEquipment(equipment)
  const goal = getGoal(moveGoal)

  /* --- The long tail of movements, from wger.de ---
     Debounced, and it falls back to a local library so the search box is
     never a dead end on bad wifi. */
  const [query, setQuery] = useState('')
  const [raw, setRaw] = useState(LIBRARY)
  const [source, setSource] = useState('local')
  const [busy, setBusy] = useState(false)
  const debounce = useRef(null)

  useEffect(() => {
    clearTimeout(debounce.current)
    const q = query.trim()
    if (q.length < 2) {
      setRaw(LIBRARY)
      setSource('local')
      setBusy(false)
      return
    }
    setBusy(true)
    debounce.current = setTimeout(async () => {
      const res = await searchExercises(q)
      setRaw(res.items)
      setSource(res.source)
      setBusy(false)
    }, 420)
    return () => clearTimeout(debounce.current)
  }, [query])

  /* Filtered by what they actually own. Untagged live results from wger are
     always kept - see allows(). The default view is capped at 9 so the
     section does not push the timer off the screen. */
  const found = useMemo(() => {
    const ok = raw.filter((e) => allows(equipment, e.kit))
    return query.trim().length < 2 ? ok.slice(0, 9) : ok.slice(0, 12)
  }, [raw, equipment, query])

  const hiddenCount = useMemo(
    () => raw.filter((e) => !allows(equipment, e.kit)).length,
    [raw, equipment]
  )

  return (
    <Page className="move-page">
      <div className="grid items-center gap-8 lg:grid-cols-[7fr_5fr]">
        <div>
          <p className="eyebrow">Move</p>
          <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
            Pick a movement. Any of them counts.
          </h1>
          <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-muted">
            Three to choose from and no levels to choose between. Nothing here
            is labelled beginner or advanced, because you aren’t. Point at one
            to watch it, press it to start the clock.
          </p>

          {/* A standing line about how this app treats training, phrased as
              the reason most people actually open it. Since the welcome screen
              stopped asking, moveGoal sits at its default and this reads the
              same every time - which is fine: it is encouragement, not data.
              Wire a picker to `moveGoal` here if it should ever vary. */}
          <p className="mt-4 max-w-[52ch] text-[14.5px] leading-relaxed accent-text">
            {goal.line}
          </p>

          {/* Equipment. Changeable right here rather than buried in a settings
              page, because what somebody has access to changes day to day -
              at home on Monday, at a gym on Saturday. */}
          <div className="mt-6">
            <p className="eyebrow mb-2.5">What have you got today?</p>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map((eq) => {
                const on = eq.id === equipment
                return (
                  <button
                    key={eq.id}
                    onClick={() => dispatch({ type: 'profile', patch: { equipment: eq.id } })}
                    aria-pressed={on}
                    title={eq.hint}
                    className={`rounded-full border px-4 py-2 text-[13px] transition ${
                      on
                        ? 'border-transparent font-medium'
                        : 'border-edge bg-white/[0.05] text-muted hover:bg-white/[0.11] hover:text-ink'
                    }`}
                    style={
                      on
                        ? {
                            background: 'rgba(var(--accent-rgb),.16)',
                            color: 'var(--accent-ink)',
                            borderColor: 'var(--accent)',
                          }
                        : undefined
                    }
                  >
                    {eq.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2.5 max-w-[48ch] text-[13px] leading-relaxed text-muted">
              {kit.blurb}
            </p>
          </div>

          {completed.length > 0 && (
            <span
              className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-medium"
              style={{
                background: 'rgba(var(--accent-rgb),.16)',
                color: 'var(--accent-ink)',
              }}
            >
              <Check size={15} />
              {completed.length} done today
            </span>
          )}
        </div>

      </div>

      {/* --- Timer, or the movement chooser --- */}
      {active ? (
        <div className="mt-8">
          <ExerciseTimer exercise={active} onClose={() => setActiveId(null)} />
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <span className="eyebrow mr-1">Switch to</span>
            {EXERCISES.filter((e) => e.id !== active.id).map((e) => (
              <button
                key={e.id}
                onClick={() => setActiveId(e.id)}
                className="btn-ghost px-5 py-2.5 text-[13.5px]"
              >
                {e.name}
                {completed.includes(e.id) && <Check size={13} />}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-9">
          <div className="mb-4 flex items-baseline gap-3">
            <p className="eyebrow">Today’s session</p>
            <span className="text-[13px] text-muted">
              {SESSION.exercises.length} movements · {SESSION.rounds} rounds each
              · about {SESSION.minutes} min
            </span>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {EXERCISES.map((e) => {
              const done = completed.includes(e.id)
              const playing = lit === e.id
              return (
                <motion.button
                  key={e.id}
                  variants={riseIn}
                  /* setLit(null) matters. Pressing a tile swaps the whole grid
                     out for the timer, so the tile unmounts and its
                     onMouseLeave / onBlur never fire - browsers do not send a
                     blur for an element that was removed. Without this, closing
                     the timer brings the grid back with one tile already
                     looping, which is precisely the thing this page promises
                     not to do. */
                  onClick={() => {
                    setLit(null)
                    setActiveId(e.id)
                  }}
                  onMouseEnter={() => setLit(e.id)}
                  onMouseLeave={() => setLit(null)}
                  /* Focus mirrors hover, so a keyboard gets the same preview
                     a mouse does rather than a still frame and a guess. */
                  onFocus={() => setLit(e.id)}
                  onBlur={() => setLit(null)}
                  className="card-flat group relative flex h-[260px] w-full flex-col justify-end overflow-hidden border-[#8b9a6e] bg-[#eeeeee] text-left"
                >
                  {/* Lit from behind, and brighter while it is moving. */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-[42%] h-[76%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition-opacity duration-500"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(var(--accent-rgb),.34) 0%, rgba(var(--accent-rgb),.1) 52%, transparent 76%)',
                      opacity: playing ? 1 : 0.5,
                    }}
                  />

                  {/* The bob lives on this wrapper rather than on the Lottie
                      so the two motions never compete: it stops the moment the
                      animation itself takes over. */}
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-[58%] ${
                      playing ? '' : 'animate-bob'
                    }`}
                  >
                    <LottieBox
                      src={e.lottie}
                      playing={playing}
                      loop
                      speed={energyMeta.lottieSpeed}
                      className="move-exercise-art h-full w-full object-contain"
                      fallback={
                        <div className="grid h-full w-full place-items-center">
                          <div
                            className="h-28 w-28 rounded-[2.5rem]"
                            style={{
                              background:
                                'radial-gradient(circle at 35% 28%, rgba(var(--accent-rgb),.55), rgba(var(--accent-rgb),.14))',
                            }}
                          />
                        </div>
                      }
                    />
                  </div>

                  {/* Scrim, so the name stays readable over whatever the
                      figure happens to be doing at that frame. */}
                  <div
                    className="relative z-10 flex items-center gap-3 border-t border-[#8b9a6e]/60 bg-[#eeeeee] px-6 py-5"
                    style={{
                      background:
                        'linear-gradient(to top, rgba(5,16,11,.95) 0%, rgba(5,16,11,.7) 46%, transparent 100%)',
                    }}
                  >
                    <span className="min-w-0 flex-1 font-display text-[24px] leading-tight">
                      {e.name}
                    </span>
                    {done && (
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                        style={{
                          background: 'rgba(var(--accent-rgb),.2)',
                          color: 'var(--accent-ink)',
                        }}
                        title="You did this one today"
                      >
                        <Check size={14} />
                      </span>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </motion.div>

          <p className="mt-7 max-w-[64ch] text-[13.5px] leading-relaxed text-muted">
            Every figure is parked on its first frame until you point at it, then
            it moves at the pace your energy is set to. Take the pointer away and
            it holds wherever it got to rather than snapping back. Press one and
            the timer opens with the countdown, a cue, and an easier version of
            the same movement if you want it.
          </p>

          {/* --- Movement library --- */}
          <section className="glass mt-12 p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Look something up</p>
                <h2 className="mt-2 font-display text-[24px] leading-tight">
                  Thousands of movements, none of them ranked.
                </h2>
                <p className="mt-2 max-w-[58ch] text-[13.5px] leading-relaxed text-muted">
                  Search the open wger database. We show you the muscle group
                  and what it needs, and nothing else. No movement in here
                  carries a difficulty, because nothing in this app does.
                </p>
              </div>
              <span className="pill">
                <Library size={13} />
                {source === 'wger' ? 'wger.de' : 'Built-in library'}
              </span>
            </div>

            {/* Honest about the filter. A list that quietly hides things is
                worse than one that tells you why. */}
            {hiddenCount > 0 && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-edge/60 bg-white/[0.04] px-4 py-2.5 text-[13px] text-muted">
                <Wrench size={13} className="shrink-0" />
                {hiddenCount} more need equipment you haven’t got. Change what
                you have above and they appear.
              </p>
            )}

            <div className="relative mt-6">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search plank, lunge, shoulders, core..."
                aria-label="Search the movement library"
                className="field pl-11"
              />
              {busy && (
                <Loader2
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted"
                />
              )}
            </div>

            {found.length === 0 && !busy ? (
              <p className="mt-5 text-[14px] text-muted">
                Nothing matched that. Try a muscle group instead, like "core".
              </p>
            ) : (
              <motion.ul
                variants={stagger}
                initial="hidden"
                animate="show"
                className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
              >
                {found.map((e) => (
                  <motion.li
                    key={e.id}
                    variants={riseIn}
                    className="flex items-center gap-3 rounded-2xl border border-edge/60 bg-white/[0.05] px-4 py-3 transition hover:bg-white/[0.11]"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: 'var(--accent)' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px]">
                      {e.name}
                    </span>
                    {e.kit && e.kit !== 'none' && (
                      <span
                        className="shrink-0 rounded-full border border-edge/70 px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-muted"
                        title={
                          e.kit === 'gym'
                            ? 'Needs a machine or a rack'
                            : 'Needs a dumbbell, band or bench'
                        }
                      >
                        {e.kit === 'gym' ? 'gym' : 'kit'}
                      </span>
                    )}
                    <span className="shrink-0 text-[12px] text-muted">
                      {e.category}
                    </span>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </section>
        </div>
      )}
    </Page>
  )
}
