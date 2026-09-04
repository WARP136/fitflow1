import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import {
  Telescope,
  Target,
  Scale,
  CalendarClock,
  Gauge,
  AlertTriangle,
  ArrowRight,
  Apple,
  Check,
} from 'lucide-react'
import Page, { riseIn, stagger } from '../components/Page.jsx'
import LottieBox from '../components/LottieBox.jsx'
import { useApp } from '../store/AppState.jsx'
import { predict } from '../services/predict.js'

/*
 * Looking ahead. Shows a window, never a date - see services/predict.js for
 * why. When the evidence is too thin to bound one, it says so rather than
 * narrowing the range to look competent.
 *
 * Three rules the layout follows:
 *
 * 1. Refusals are the design, not an error state. "No target set", "not
 *    enough logged yet", "that target is below the healthy range" all render
 *    as the main card, same type, with something useful to do next. Never a
 *    red toast.
 *
 * 2. Both estimates stay visible side by side with their own ranges and a
 *    line on where each came from. The scale drives the window since it
 *    measures the outcome; the food log corroborates. Showing both lets you
 *    decide how much to trust it, rather than hiding the disagreement in one
 *    averaged number.
 *
 * 3. The chart draws the uncertainty instead of describing it: solid line
 *    for actual weigh-ins, two dashed lines fanning to the target for the
 *    fast and slow edges. The gap between them is the honesty, to scale.
 */

const tooltipStyle = {
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(9,20,14,.92)',
  color: '#E9F7EF',
  backdropFilter: 'blur(10px)',
  fontSize: 12.5,
  fontFamily: 'Inter, sans-serif',
  boxShadow: '0 18px 44px -16px rgba(0,0,0,.85)',
}

const DAY_MS = 86400000

const prettyDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const shortDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })

const shiftIso = (iso, days) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

const dayGap = (a, b) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS)

/** Label above a number, number, unit. Used for the three facts under the window. */
function Fact({ label, value, unit, sub }) {
  return (
    <div className="card-flat px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className="num mt-2 font-display text-[24px] leading-none">
        {value}
        {unit && <span className="ml-1 text-[13px] font-normal text-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-2 text-[12.5px] leading-snug text-muted">{sub}</p>}
    </div>
  )
}

export default function Predict() {
  const {
    weights,
    history,
    goalWeightKg,
    heightCm,
    age,
    body,
    activity,
    kg,
    name,
    dispatch,
    energyMeta,
  } = useApp()

  const today = new Date().toISOString().slice(0, 10)

  const out = useMemo(
    () =>
      predict({
        weights,
        history,
        goalWeightKg,
        heightCm,
        age,
        body,
        activity,
        today,
      }),
    [weights, history, goalWeightKg, heightCm, age, body, activity, today]
  )

  /* Both inputs are staged in local state and committed on a button or Enter.
     Dispatching on every keystroke would send "7" to the store on the way to
     typing "72", and the page would flash a refusal about underweight targets
     at somebody who is mid-word. */
  const [goalDraft, setGoalDraft] = useState(goalWeightKg ? String(goalWeightKg) : '')
  const [weighDraft, setWeighDraft] = useState('')
  const [saved, setSaved] = useState(null)

  const commitGoal = () => {
    const n = Number(goalDraft)
    if (!goalDraft.trim()) {
      dispatch({ type: 'goalWeight', kg: 0 })
      setSaved('Target cleared.')
      return
    }
    if (!Number.isFinite(n) || n <= 0) return
    dispatch({ type: 'goalWeight', kg: Math.round(n * 10) / 10 })
    setSaved('Target saved.')
  }

  const commitWeighIn = () => {
    const n = Number(weighDraft)
    if (!Number.isFinite(n) || n <= 0) return
    dispatch({ type: 'logWeight', kg: Math.round(n * 10) / 10 })
    setWeighDraft('')
    setSaved('Weight logged. Every reading narrows the window.')
  }

  const { evidence, flags, estimates } = out

  /**
   * The chart data: actual weigh-ins, then two straight runs out to the target.
   *
   * One shared numeric x axis in days since the first weigh-in, because a
   * category axis cannot hold "three real readings and two imaginary futures"
   * in any sensible order. The projection series get connectNulls so their two
   * endpoints join across the gap.
   */
  const chart = useMemo(() => {
    if (!weights.length) return null
    const first = weights[0].date
    const rows = new Map()
    const put = (t, patch) => rows.set(t, { ...(rows.get(t) || { t }), ...patch })

    for (const w of weights) put(dayGap(first, w.date), { kg: w.kg })

    let far = null
    if (out.status === 'ok' && out.from) {
      const tNow = dayGap(first, today)
      const nowKg = out.now
      put(tNow, { fast: nowKg, slow: nowKg })
      put(dayGap(first, out.from), { fast: out.goal })
      far = out.to || shiftIso(today, out.weeksLow * 7 * 2)
      put(dayGap(first, far), { slow: out.goal })
    }

    return {
      first,
      rows: [...rows.values()].sort((a, b) => a.t - b.t),
      openEnded: out.status === 'ok' && !out.to,
    }
  }, [weights, out, today])

  const kgDomain = useMemo(() => {
    const vals = weights.map((w) => w.kg)
    if (out.goal) vals.push(out.goal)
    if (!vals.length) return [0, 1]
    return [Math.floor(Math.min(...vals) - 1), Math.ceil(Math.max(...vals) + 1)]
  }, [weights, out.goal])

  /* One headline per status. The refusals get the same size type as an answer,
     because a refusal IS the answer in those cases. */
  const headline = {
    ok: out.weeksHigh
      ? `${out.weeksLow}–${out.weeksHigh} weeks`
      : `${out.weeksLow}+ weeks`,
    'beyond-horizon': 'Further than two years',
    'need-weighins': 'Not yet',
    'need-data': 'Not yet',
    'no-goal': 'No target set',
    'goal-too-low': 'Not going to answer that one',
    'at-goal': 'You’re there',
    'wrong-way': 'Pointing the other way',
    holding: 'Holding steady',
  }[out.status]

  const answered = out.status === 'ok'

  return (
    <Page>
      {/* Atmosphere only - blurred, still, and behind everything, like the rest
          of the app. See the note in Dashboard.jsx about why she is frozen. */}
      <div
        className="pointer-events-none absolute right-[-6%] top-[10%] -z-10 hidden w-[40vw] max-w-[600px] lg:block"
        style={{ filter: 'blur(24px)' }}
        aria-hidden="true"
      >
        <div
          className="absolute left-1/2 top-1/2 h-[112%] w-[112%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--accent-rgb),.16) 0%, rgba(var(--accent-rgb),.05) 52%, transparent 74%)',
          }}
        />
        <LottieBox
          src="/lottie/meditate.json"
          playing={false}
          loop
          className="relative h-auto w-full opacity-[0.12]"
          fallback={<div className="aspect-square w-full opacity-20" />}
        />
      </div>

      <div className="max-w-[62ch]">
        <p className="eyebrow">Looking ahead</p>
        <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
          A window, <span className="grad-text">never a deadline</span>.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          This reads your weigh-ins and what you’ve logged eating and moving,
          and estimates how long a target weight is away. It answers in a range,
          because that’s the only shape the maths honestly has. When there
          isn’t enough logged to say anything, it says so instead of guessing.
        </p>
      </div>

      {/* --- The answer --- */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8"
      >
        <div className="card-grad relative overflow-hidden p-9">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <Telescope size={17} style={{ color: 'var(--accent-ink)' }} />
                <p className="eyebrow">
                  {answered
                    ? out.direction === 'down'
                      ? `Down to ${out.goal} kg`
                      : `Up to ${out.goal} kg`
                    : 'What this can tell you'}
                </p>
              </div>

              <p className="num mt-4 font-display text-[clamp(2.4rem,5vw,3.9rem)] font-semibold leading-[0.98]">
                {headline}
              </p>

              {answered && (
                <p className="mt-3 inline-flex items-center gap-2 text-[14px] text-muted">
                  <CalendarClock size={15} />
                  {out.to ? (
                    <span>
                      between{' '}
                      <span className="text-ink">{prettyDate(out.from)}</span> and{' '}
                      <span className="text-ink">{prettyDate(out.to)}</span>
                    </span>
                  ) : (
                    <span>
                      not before{' '}
                      <span className="text-ink">{prettyDate(out.from)}</span>, and the
                      far end is genuinely open
                    </span>
                  )}
                </p>
              )}

              <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted">
                {out.message}
              </p>

              {/* Every dead end gets a way out of it. */}
              <div className="mt-6 flex flex-wrap gap-3">
                {out.status === 'need-data' || out.status === 'need-weighins' ? (
                  <>
                    <Link to="/food" className="btn-primary">
                      <Apple size={16} />
                      Log what you ate
                    </Link>
                    <Link to="/plan" className="btn-ghost">
                      Check your body details
                      <ArrowRight size={15} />
                    </Link>
                  </>
                ) : null}
                {out.status === 'wrong-way' || out.status === 'holding' ? (
                  <Link to="/plan" className="btn-ghost">
                    Look at your food targets
                    <ArrowRight size={15} />
                  </Link>
                ) : null}
              </div>
            </div>

            {/* The three numbers underneath, which are the same three
                whatever the status is - including "-" where a number does
                not exist yet. A box that disappears is harder to read than
                a box with a dash in it. */}
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Fact
                label="Now"
                value={out.now === null ? '—' : out.now}
                unit={out.now === null ? '' : 'kg'}
                sub={
                  evidence.lastWeighIn
                    ? `weighed ${
                        evidence.daysSinceWeighIn === 0
                          ? 'today'
                          : `${evidence.daysSinceWeighIn}d ago`
                      }`
                    : 'no weigh-ins yet'
                }
              />
              <Fact
                label="Target"
                value={out.goal ?? '—'}
                unit={out.goal ? 'kg' : ''}
                sub={
                  out.delta === null
                    ? out.goal
                      ? 'weigh in to compare'
                      : 'set one below'
                    : `${out.delta > 0 ? '−' : '+'}${Math.abs(out.delta)} kg from here`
                }
              />
              <Fact
                label="Pace"
                value={
                  evidence.trendKgPerWeek === null
                    ? '—'
                    : `${evidence.trendKgPerWeek > 0 ? '+' : ''}${
                        evidence.trendKgPerWeek
                      }`
                }
                unit={evidence.trendKgPerWeek === null ? '' : 'kg/wk'}
                sub={
                  evidence.trendBandKgPerWeek === null
                    ? 'from your weigh-ins'
                    : `give or take ${evidence.trendBandKgPerWeek}`
                }
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* --- Flags: said once, quietly, never in red --- */}
      {(flags.fast || flags.disagree || evidence.stale) && (
        <div className="mt-4 flex flex-wrap gap-3">
          {flags.fast && (
            <span className="pill">
              <Gauge size={13} />
              That pace is over 1% of your bodyweight a week, which is quick if it holds
            </span>
          )}
          {flags.disagree && (
            <span className="pill">
              <AlertTriangle size={13} />
              Your scale and your food log disagree by more than double
            </span>
          )}
          {evidence.stale && (
            <span className="pill">
              <Scale size={13} />
              Last weigh-in was {evidence.daysSinceWeighIn} days ago
            </span>
          )}
        </div>
      )}

      {/* --- Inputs --- */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-6 grid gap-6 lg:grid-cols-2"
      >
        <motion.div variants={riseIn} className="glass p-8">
          <div className="flex items-center gap-2.5">
            <Target size={16} className="accent-text" />
            <p className="eyebrow">Your target</p>
          </div>
          <h2 className="mt-1.5 font-display text-[21px] leading-tight">
            One number, and you can delete it.
          </h2>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
            Leave it empty and this page says nothing about dates. Nothing else in
            FitFlow needs it, and there’s no nudge anywhere asking you to fill it
            in{name ? `, ${name}` : ''}.
          </p>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="flex-1">
              <span className="eyebrow">Goal weight, kg</span>
              <input
                value={goalDraft}
                onChange={(e) => {
                  setGoalDraft(e.target.value)
                  setSaved(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && commitGoal()}
                inputMode="decimal"
                placeholder="e.g. 68"
                aria-label="Goal weight in kilograms"
                className="field num mt-2.5"
              />
            </label>
            <button onClick={commitGoal} className="btn-primary">
              Save
            </button>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            For {Math.round(heightCm)} cm, the typical healthy range starts around{' '}
            <span className="num">{out.healthyMin} kg</span>. Below that this page
            won’t put a date on anything.
          </p>
        </motion.div>

        <motion.div variants={riseIn} className="glass p-8">
          <div className="flex items-center gap-2.5">
            <Scale size={16} className="accent-text" />
            <p className="eyebrow">Weigh in</p>
          </div>
          <h2 className="mt-1.5 font-display text-[21px] leading-tight">
            {evidence.weighIns === 0
              ? 'The first reading starts the line.'
              : `${evidence.weighIns} so far. Each one narrows the range.`}
          </h2>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
            Optional, and never asked for twice. Two readings a week apart is
            enough to draw a trend; more than that is what makes the window
            tighten instead of widen.
          </p>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="flex-1">
              <span className="eyebrow">Today, kg</span>
              <input
                value={weighDraft}
                onChange={(e) => {
                  setWeighDraft(e.target.value)
                  setSaved(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && commitWeighIn()}
                inputMode="decimal"
                placeholder={kg ? String(kg) : 'e.g. 72.4'}
                aria-label="Today's weight in kilograms"
                className="field num mt-2.5"
              />
            </label>
            <button onClick={commitWeighIn} className="btn-primary">
              Log it
            </button>
          </div>
          {saved && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 inline-flex items-center gap-2 text-[13px]"
              style={{ color: 'var(--accent-ink)' }}
            >
              <Check size={14} />
              {saved}
            </motion.p>
          )}
        </motion.div>
      </motion.div>

      {/* --- The chart --- */}
      {chart && (
        <section className="glass mt-6 p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Where the line goes</p>
              <h2 className="mt-1.5 font-display text-[22px] leading-tight">
                {answered
                  ? 'Solid is what you weighed. Dashed is the range.'
                  : 'What you’ve weighed so far.'}
              </h2>
            </div>
            {answered && (
              <p className="max-w-[34ch] text-[12.5px] leading-relaxed text-muted">
                The gap between the two dashed lines is the uncertainty, drawn to
                scale. It closes as you log more.
              </p>
            )}
          </div>

          <div className="mt-6 h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart.rows} margin={{ top: 8, right: 14, bottom: 0, left: -16 }}>
                <CartesianGrid
                  stroke="rgba(255,255,255,.09)"
                  strokeDasharray="3 5"
                  vertical={false}
                />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8CA89A', fontSize: 11.5 }}
                  tickFormatter={(t) => shortDate(shiftIso(chart.first, t))}
                />
                <YAxis
                  domain={kgDomain}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8CA89A', fontSize: 11.5 }}
                  width={44}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(t) => prettyDate(shiftIso(chart.first, t))}
                  formatter={(v, key) => [
                    `${v} kg`,
                    key === 'kg' ? 'Weighed' : key === 'fast' ? 'Faster edge' : 'Slower edge',
                  ]}
                />
                {out.goal && (
                  <ReferenceLine
                    y={out.goal}
                    stroke="rgba(255,255,255,.28)"
                    strokeDasharray="5 5"
                    label={{
                      value: `target ${out.goal} kg`,
                      position: 'insideBottomRight',
                      fill: '#8CA89A',
                      fontSize: 11.5,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: 'var(--accent)', strokeWidth: 0 }}
                  activeDot={{ r: 5.5 }}
                  connectNulls
                  animationDuration={1000}
                />
                {answered && (
                  <Line
                    type="linear"
                    dataKey="fast"
                    stroke="var(--accent-ink)"
                    strokeWidth={1.8}
                    strokeDasharray="6 6"
                    dot={false}
                    connectNulls
                    animationDuration={1200}
                  />
                )}
                {answered && (
                  <Line
                    type="linear"
                    dataKey="slow"
                    stroke="#8CA89A"
                    strokeWidth={1.8}
                    strokeDasharray="6 6"
                    dot={false}
                    connectNulls
                    animationDuration={1400}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {chart.openEnded && (
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              The slower dashed line is drawn to the edge of the chart rather than
              to a date, because on this evidence there’s no far end to draw.
            </p>
          )}
        </section>
      )}

      {/* --- The two estimates, in full --- */}
      {estimates.length > 0 && (
        <section className="mt-6">
          <p className="eyebrow">Where the number comes from</p>
          <div className="mt-3 grid gap-6 lg:grid-cols-2">
            {estimates.map((e) => (
              <div
                key={e.id}
                className={`p-8 ${
                  e.id === out.primary ? 'card-grad' : 'glass'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="eyebrow">{e.label}</p>
                  {e.id === out.primary && (
                    <span className="pill">this one set the window</span>
                  )}
                </div>
                <h3 className="num mt-2 font-display text-[26px] leading-none">
                  {e.speed > 0 ? '' : '−'}
                  {Math.abs(e.speed)}
                  <span className="ml-1 text-[13px] font-normal text-muted">
                    kg a week {e.speed > 0 ? 'toward it' : 'away from it'}
                  </span>
                </h3>
                <p className="mt-2 text-[13px] text-muted">
                  give or take <span className="num">{e.band}</span> kg a week
                  {e.weeksLow !== null && (
                    <>
                      {' · '}
                      {Math.round(e.weeksLow)}
                      {e.weeksHigh === null ? '+ weeks' : `–${Math.round(e.weeksHigh)} weeks`}
                    </>
                  )}
                </p>
                <p className="mt-4 text-[13.5px] leading-relaxed text-muted">{e.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- What it actually read --- */}
      <section className="glass mt-6 p-8">
        <p className="eyebrow">Everything it read to get there</p>
        <div className="mt-4 grid gap-x-10 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Weigh-ins', `${evidence.weighIns}`],
            [
              'Spread over',
              evidence.spanDays ? `${evidence.spanDays} days` : 'one reading',
            ],
            [
              'Days archived',
              `${evidence.archivedDays} of 7`,
            ],
            [
              'Days with food logged',
              `${evidence.foodDays}`,
            ],
            [
              'Average intake',
              evidence.intake ? `${evidence.intake} kcal` : 'not enough logged',
            ],
            [
              'Estimated maintenance',
              evidence.maintenance ? `${evidence.maintenance} kcal` : '—',
            ],
            [
              'Movement',
              evidence.minutesPerDay === null
                ? '—'
                : `${evidence.minutesPerDay} min a day`,
            ],
            [
              'Activity multiplier',
              evidence.factor
                ? `${evidence.factor} · ${
                    evidence.basis === 'logged' ? 'from your logs' : 'as you told us'
                  }`
                : '—',
            ],
            ['BMI now', evidence.bmiNow ?? '—'],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 border-b border-white/[0.055] py-2"
            >
              <span className="text-[13px] text-muted">{label}</span>
              <span className="num text-right text-[13px]">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-7 lg:grid-cols-2">
          <p className="text-[13.5px] leading-relaxed text-muted">
            The activity multiplier is worked out from your logged minutes when
            there are enough days of them, and it replaces the one you picked on
            the plan page rather than being added to it. Adding exercise on top of
            an activity factor counts it twice, which is the single most common way
            a calculator like this ends up promising something impossible.
          </p>
          <p className="text-[13.5px] leading-relaxed text-muted">
            One limit worth knowing: a day you never opened FitFlow isn’t archived
            at all, so these averages describe the days you logged, not every day
            you lived. That biases the movement number upward. Nothing here is a
            medical estimate, and 7700 kcal per kilogram is a textbook average, not
            a law about your body.
          </p>
        </div>
      </section>

      <p className="mt-8 text-[12.5px] leading-relaxed text-muted">
        Energy: {energyMeta.label}. This page keeps no score, has no deadline and
        will never tell you that you’re behind.
      </p>
    </Page>
  )
}
