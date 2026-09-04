import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import Page, { riseIn, stagger } from '../components/Page.jsx'
import { useApp } from '../store/AppState.jsx'
import { buildSky, skyLines, KINDS } from '../data/constellation.js'

/*
 * The reward page.
 *
 * No counters, no totals, no progress bar, no "X away from Y", nothing that
 * implies a state you could fall out of. A reward you can lose is a
 * punishment waiting to happen. See data/constellation.js.
 */
export default function Sky() {
  const state = useApp()
  const { dur, name, dispatch } = state
  const [activeKey, setActiveKey] = useState(null)

  const stars = useMemo(() => buildSky(state), [state])
  const lines = useMemo(() => skyLines(stars), [stars])
  const active = stars.find((s) => s.key === activeKey) || null

  return (
    <Page>
      <div className="max-w-[62ch]">
        <p className="eyebrow">Your sky</p>
        <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
          Everything you’ve done{' '}
          <span className="grad-text">is still up there</span>.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          Every glass of water, every session, every check-in put a star up
          here. They don’t fade, they don’t expire, and there’s no number
          attached to them. Take a fortnight off and this page looks exactly
          the way you left it. That’s the whole point.
        </p>
      </div>

      {/* --- The sky ---
          Darker than the rest of the app on purpose: the page around it is
          lit by the aurora, and this panel is the one place that goes quiet
          so small points of light actually read. */}
      <div
        className="relative mt-9 h-[68vh] min-h-[540px] overflow-hidden rounded-card border border-white/[0.07]"
        style={{
          background:
            'radial-gradient(120% 100% at 20% 0%, rgba(139,92,246,.14), transparent 55%),' +
            'radial-gradient(110% 90% at 88% 12%, rgba(34,211,238,.12), transparent 52%),' +
            'radial-gradient(140% 120% at 50% 108%, rgba(52,211,153,.1), transparent 60%),' +
            'linear-gradient(180deg, #030A07 0%, #04100B 58%, #020806 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,.07), inset 0 0 120px 40px rgba(0,0,0,.55)',
        }}
        onMouseLeave={() => setActiveKey(null)}
      >
        {/* A faint band across the middle, so the field has depth without
            inventing decorative stars that could be mistaken for real ones. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'linear-gradient(104deg, transparent 18%, rgba(233,247,239,.045) 43%, rgba(167,243,208,.05) 52%, transparent 78%)',
            filter: 'blur(18px)',
          }}
        />

        {/* Joining lines. preserveAspectRatio is off so the 0-100 viewBox maps
            straight onto the star percentages; non-scaling-stroke keeps the
            hairline a hairline instead of stretching it with the box. */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {lines.map((l) => (
            <polyline
              key={l.kind}
              points={l.points}
              fill="none"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              style={{ stroke: `rgba(${KINDS[l.kind].rgb}, .13)` }}
              strokeLinejoin="round"
            />
          ))}
        </svg>

        {/* The stars themselves. The button is a generous 36px target; the
            glowing dot inside is 7-15px, which is far too small to click. */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="absolute inset-0"
        >
          {stars.map((s) => {
            const on = s.key === activeKey
            const rgb = KINDS[s.kind].rgb
            return (
              <motion.button
                key={s.key}
                variants={riseIn}
                type="button"
                onMouseEnter={() => setActiveKey(s.key)}
                onFocus={() => setActiveKey(s.key)}
                onBlur={() => setActiveKey(null)}
                aria-label={`${s.title}. ${s.note}.`}
                className="group absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
              >
                {/* Halo, sized off the star. Sits behind and never animates
                    scale, so it cannot fight the twinkle transform. */}
                <span
                  className="pointer-events-none absolute rounded-full transition-opacity duration-500"
                  style={{
                    height: s.size * 4.2,
                    width: s.size * 4.2,
                    opacity: on ? 0.95 : 0.5,
                    background: `radial-gradient(circle, rgba(${rgb},.5) 0%, rgba(${rgb},.14) 42%, transparent 70%)`,
                  }}
                />
                <span
                  className="pointer-events-none relative animate-twinkle rounded-full"
                  style={{
                    height: s.size,
                    width: s.size,
                    animationDelay: `${s.delay}s`,
                    animationDuration: `${s.period}s`,
                    background: `radial-gradient(circle at 40% 35%, #FFFFFF 0%, rgb(${rgb}) 58%, rgba(${rgb},.35) 100%)`,
                    boxShadow: `0 0 ${s.size * 1.6}px rgba(${rgb},.85)`,
                  }}
                />
                {on && (
                  <span
                    className="pointer-events-none absolute rounded-full"
                    style={{
                      height: s.size + 16,
                      width: s.size + 16,
                      border: `1px solid rgba(${rgb},.55)`,
                    }}
                  />
                )}
              </motion.button>
            )
          })}
        </motion.div>

        {/* The first-run state, and it matters more than it looks.
            The app ships with zero invented logs, so this is the very first
            thing a new person sees on this page - it has to read as an
            invitation rather than as a page that failed to load. The button
            logs real water into real state, which means the first star fades
            in behind this panel about a second later, while they are still
            looking at it. That is the whole reward loop in one click. */}
        {stars.length === 0 && (
          <div className="absolute inset-0 grid place-items-center px-10 pb-28 text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur(0.6), ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[44ch]"
            >
              <Sparkles
                size={22}
                className="mx-auto animate-breathe"
                style={{ color: 'var(--accent-ink)' }}
              />
              <p className="mt-4 font-display text-[24px] leading-tight">
                An empty sky, which is exactly right for day one.
              </p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
                Nothing is pre-filled here: no sample week, no borrowed
                progress. Every star on this page will be something you
                actually did. Put the first one up now:
              </p>
              <button
                onClick={() => dispatch({ type: 'logWater', ml: 250 })}
                className="btn-primary mt-6"
              >
                Log a glass of water
                <ArrowRight size={16} />
              </button>
              <p className="mt-3.5 text-[12.5px] text-muted">
                It appears immediately, and it stays.
              </p>
            </motion.div>
          </div>
        )}

        {/* Readout. Fixed height so nothing shifts when you move between
            stars, and it holds the last star you looked at rather than
            blanking the moment your cursor drifts off a 9px target. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-7">
          <div className="min-h-[64px] max-w-[46ch] rounded-2xl border border-white/[0.09] bg-black/45 px-5 py-4 backdrop-blur-md">
            <AnimatePresence mode="wait">
              <motion.div
                key={active ? active.key : 'idle'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: dur(0.22) }}
              >
                {active ? (
                  <>
                    <p className="text-[15px] font-medium leading-snug">
                      {active.title}
                    </p>
                    <p className="mt-1 text-[13px] text-muted">
                      {active.note} · {KINDS[active.kind].label}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[15px] leading-snug">
                      {name ? `${name}, hover` : 'Hover'} any star to see what
                      it was.
                    </p>
                    <p className="mt-1 text-[13px] text-muted">
                      Bigger stars were bigger efforts. That’s the only thing
                      size means.
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Legend, without a single figure on it. */}
          <div className="flex flex-wrap gap-2.5 rounded-2xl border border-white/[0.09] bg-black/45 px-5 py-4 backdrop-blur-md">
            {Object.values(KINDS).map((k) => (
              <span
                key={k.id}
                className="inline-flex items-center gap-2 text-[12.5px] text-muted"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: `rgb(${k.rgb})`,
                    boxShadow: `0 0 8px rgba(${k.rgb},.9)`,
                  }}
                />
                {k.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* --- What this replaces --- */}
      <div className="mt-9 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass p-8">
          <p className="eyebrow">Why it works like this</p>
          <h2 className="mt-2.5 font-display text-[23px] leading-tight">
            A reward you can lose is a punishment on a timer.
          </h2>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
            Streaks, rings and levels all work the same way: they create
            something you have to keep alive, and the day you can’t keep it
            alive is usually the day you delete the app. So this sky only ever
            gains stars. There’s no total on this page, no rank, and no
            comparison to last week. Those are scores, and scores are the
            thing you came here to get away from.
          </p>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
            Come back after a month away and every star is exactly where you
            left it, still lit.
          </p>
        </div>

        <div className="card-grad p-8">
          <Sparkles size={19} style={{ color: 'var(--accent-ink)' }} />
          <p className="mt-3.5 font-display text-[21px] leading-tight">
            Put another one up
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Anything you log adds a star. A glass of water counts as much as a
            session, because on some days it’s more.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link to="/water" className="btn-primary">
              Log water
              <ArrowRight size={16} />
            </Link>
            <Link to="/move" className="btn-ghost">
              Move
            </Link>
            <Link to="/jog" className="btn-ghost">
              Go outside
            </Link>
          </div>
        </div>
      </div>
    </Page>
  )
}
