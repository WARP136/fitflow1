import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Footprints, Apple, ArrowRight } from 'lucide-react'
import Page, { riseIn, stagger } from '../components/Page.jsx'
import StatCard from '../components/StatCard.jsx'
import LottieBox from '../components/LottieBox.jsx'
import Marquee from '../components/Marquee.jsx'
import { useApp } from '../store/AppState.jsx'
import Scene from '../three/Scene.jsx'
import Particles from '../three/Particles.jsx'

const tooltipStyle = {
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(9,20,14,.92)', color: '#E9F7EF', backdropFilter: 'blur(10px)',
  fontSize: 12.5,
  fontFamily: 'Inter, sans-serif',
  boxShadow: '0 18px 44px -16px rgba(0,0,0,.85)',
}

/*
 * What replaced streaks. Same week, no score: what happened, the trend, and
 * one small way back in if there were quiet days.
 *
 * Reads `week`, not `history` - `week` is archived days plus a live row for
 * today, so logging water with this page open grows today's bar right away.
 * Previously everything here was yesterday-or-older and the charts sat still
 * through the entire demo.
 *
 * quietDays counts archived days only. Today can't be quiet while it's still
 * going on.
 */
export default function WeeklyWrap() {
  const { week, history, weights, dur, name, energyMeta, hasAnyData } = useApp()

  const water = useMemo(
    () => week.map((d) => ({ day: d.label, litres: Number((d.waterMl / 1000).toFixed(2)) })),
    [week]
  )
  const weightSeries = useMemo(
    () =>
      weights.map((w) => ({
        day: new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
        }),
        kg: w.kg,
      })),
    [weights]
  )

  const minutes = week.reduce((s, d) => s + d.minutes, 0)
  const daysMoved = week.filter((d) => d.moved).length
  const quietDays = history.filter((d) => !d.moved).length
  const logged = week.filter((d) => d.waterMl > 0 || d.kcal > 0 || d.minutes > 0)
  const avgWater = logged.length
    ? (logged.reduce((s, d) => s + d.waterMl, 0) / logged.length / 1000).toFixed(1)
    : '0'
  const avgKcal = logged.length
    ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length)
    : 0
  const weightDelta = weights.length > 1 ? (weights.at(-1).kg - weights[0].kg).toFixed(1) : null
  const milestone = daysMoved >= 4

  const wins = useMemo(() => {
    const out = week.filter((d) => d.moved).map((d) => `${d.label}, ${d.minutes} min`)
    if (minutes > 0) out.push(`${minutes} minutes so far this week`)
    if (avgWater !== '0') out.push(`${avgWater} L of water a day, on average`)
    out.push('Nothing here is a streak')
    out.push('A quiet day costs you nothing')
    return out.length > 5 ? out : [...out, ...out]
  }, [week, minutes, avgWater])

  return (
    <Page>
      {/* Seven hundred points drifting behind the header. Slow, quiet, and
          it moves at whatever tempo the energy choice is running at. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] opacity-80">
        <Scene camera={{ position: [0, 0, 6], fov: 55 }} fallback={null}>
          <Particles color={energyMeta.accent} speed={1 / energyMeta.tempo} />
        </Scene>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Last seven days</p>
          <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
            Your week, without a score.
          </h1>
          <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-muted">
            {hasAnyData ? (
              <>
                No streak to keep alive and nothing to break. Just what happened,
                {name ? ` ${name}` : ''}. Read it and take what’s useful.
              </>
            ) : (
              <>
                This page fills itself in as you use the app{name ? `, ${name}` : ''}, and
                nothing here is a sample week. Log one thing today and today's bar
                appears while you’re still looking at it.
              </>
            )}
          </p>
        </div>
        {milestone && (
          // Neha, pleased. Deliberately a person rather than a trophy or a
          // confetti burst: a trophy is an award you could fail to earn next
          // week, and someone being glad for you is not.
          <div className="flex items-center gap-4">
            <LottieBox
              src="/lottie/neha.json"
              playing
              loop
              className="h-[112px] w-[150px] shrink-0"
              fallback={
                <span
                  className="animate-breathe inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-medium"
                  style={{
                    background: 'rgba(var(--accent-rgb),.16)',
                    color: 'var(--accent-ink)',
                  }}
                >
                  {daysMoved} days you moved
                </span>
              }
            />
            <p className="max-w-[19ch] text-[13.5px] leading-snug text-muted">
              You moved on {daysMoved} days. Neha noticed, and nothing is riding on
              it.
            </p>
          </div>
        )}
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={riseIn}>
          <StatCard label="Minutes moved" value={minutes} sub={`across ${daysMoved} days`} />
        </motion.div>
        <motion.div variants={riseIn}>
          <StatCard label="Water a day" value={avgWater} unit="L" sub="average" />
        </motion.div>
        <motion.div variants={riseIn}>
          <StatCard label="Food a day" value={avgKcal} unit="kcal" sub="average logged" />
        </motion.div>
        <motion.div variants={riseIn}>
          <StatCard
            label="Weight trend"
            value={weightDelta === null ? '—' : `${weightDelta > 0 ? '+' : ''}${weightDelta}`}
            unit={weightDelta === null ? '' : 'kg'}
            sub={weightDelta === null ? 'after two check-ins' : 'since your first check-in'}
          />
        </motion.div>
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[7fr_5fr]">
        <div className="glass p-8">
          <p className="eyebrow">Water, day by day</p>
          <h2 className="mt-1.5 font-display text-[22px]">
            {avgWater} litres a day on average
          </h2>
          <div className="mt-6 h-[236px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={water} margin={{ top: 4, right: 6, bottom: 0, left: -22 }}>
                <defs>
                  <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.09)" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8CA89A', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8CA89A', fontSize: 12 }}
                  width={44}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`${v} L`, 'Water']}
                />
                <Area
                  type="monotone"
                  dataKey="litres"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  fill="url(#waterFill)"
                  animationDuration={1100}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-8">
          <p className="eyebrow">Weight, gently</p>
          <h2 className="mt-1.5 font-display text-[22px]">
            {weightDelta === null
              ? 'Nothing plotted yet'
              : `${weightDelta > 0 ? 'Up' : 'Down'} ${Math.abs(weightDelta)} kg since you started`}
          </h2>
          {/* Two points make a line; one makes a dot and none makes an empty
              axis, so say so plainly rather than drawing an empty grid and
              hoping nobody looks. */}
          {weights.length < 2 ? (
            <div className="mt-6 grid h-[236px] place-items-center rounded-2xl border border-dashed border-white/[0.1] px-8 text-center">
              <div>
                <p className="text-[14.5px] leading-relaxed text-muted">
                  A line needs two check-ins. There{' '}
                  {weights.length === 1 ? 'is one so far' : 'are none yet'}, and
                  weighing in is optional here, not homework.
                </p>
                <Link to="/plan" className="btn-ghost mt-5">
                  Check in on the Eat page
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 h-[236px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightSeries} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid
                    stroke="rgba(255,255,255,.09)"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#8CA89A', fontSize: 11.5 }}
                  />
                  <YAxis
                    domain={['dataMin - 0.6', 'dataMax + 0.6']}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#8CA89A', fontSize: 11.5 }}
                    width={44}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} kg`, 'Weight']} />
                  <Line
                    type="monotone"
                    dataKey="kg"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: 'var(--accent)', strokeWidth: 0 }}
                    activeDot={{ r: 5.5 }}
                    animationDuration={1100}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Re-entry, not punishment. */}
      {quietDays > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur(0.5), ease: [0.22, 1, 0.36, 1] }}
          className="glass mt-6 p-8"
        >
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="eyebrow">
                {quietDays} quiet {quietDays === 1 ? 'day' : 'days'} this week
              </p>
              <h2 className="mt-2 font-display text-[26px] leading-snug">
                Which is completely fine. Here is the smallest way back in.
              </h2>
              <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
                Pick either one. Both count as picking things up again, and
                neither of them asks you to make up for anything.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/jog" className="btn-primary">
                <Footprints size={17} />
                A ten minute walk
              </Link>
              <Link to="/food" className="btn-ghost">
                <Apple size={16} />
                Just log a meal
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </motion.section>
      )}

      <section className="mt-9">
        <p className="eyebrow mb-3">Worth noticing</p>
        <Marquee items={wins} speedSeconds={34} />
      </section>
    </Page>
  )
}
