import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shuffle, Plus, Info, Check, Utensils, Sparkles } from 'lucide-react'
import Page, { stagger, riseIn } from '../components/Page.jsx'
import { useApp } from '../store/AppState.jsx'
import {
  ACTIVITY,
  BODY,
  GOALS,
  DISCLAIMER,
  computeTargets,
  buildPlan,
  planToFoods,
} from '../services/dietPlan.js'

/* --- Small local controls. Kept in this file because they only make sense
      here and nothing else in the app needs a slider. --- */

function Slider({ label, value, min, max, step = 1, unit, onChange }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="num text-[15px] font-medium">
          {value}
          <span className="text-[12px] text-muted"> {unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="rng mt-3.5 w-full"
        style={{
          background: `linear-gradient(to right, #8b9a6e 0%, #8b9a6e ${pct}%, #eae2d6 ${pct}%, #eae2d6 100%)`,
        }}
      />
    </label>
  )
}

function Chips({ label, options, value, onChange }) {
  return (
    <div>
      <span className="eyebrow">{label}</span>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.id === value
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              title={o.hint || o.blurb || ''}
              aria-pressed={on}
              className={`rounded-xl border px-3.5 py-2 text-[13px] transition ${
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
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MacroBar({ protein, carbs, fat }) {
  // Grams converted to calories, because a gram of fat is not a gram of rice.
  const p = protein * 4
  const c = carbs * 4
  const f = fat * 9
  const total = Math.max(1, p + c + f)
  const parts = [
    { key: 'protein', pct: (p / total) * 100, alpha: 1 },
    { key: 'carbs', pct: (c / total) * 100, alpha: 0.55 },
    { key: 'fat', pct: (f / total) * 100, alpha: 0.26 },
  ]
  return (
    <div className="mt-5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-mist">
        {parts.map((s) => (
          <motion.div
            key={s.key}
            initial={{ width: 0 }}
            animate={{ width: `${s.pct}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: `rgba(var(--accent-rgb),${s.alpha})` }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
        {parts.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <i
              className="h-2 w-2 rounded-full"
              style={{ background: `rgba(var(--accent-rgb),${s.alpha})` }}
            />
            <span className="num">{Math.round(s.pct)}%</span> {s.key}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function DietPlan() {
  const {
    // kgOrDefault, not kg: kg is null until somebody actually weighs in, and a
    // null would break both the slider and the Mifflin-St Jeor maths. Dragging
    // the slider writes a real weigh-in, so the placeholder only ever shows
    // once. The app no longer ships invented weight history to avoid this.
    kgOrDefault: kg,
    weights,
    heightCm,
    age,
    body,
    activity,
    goal,
    planSeed,
    kcalTarget,
    dispatch,
    dur,
  } = useApp()

  const [added, setAdded] = useState([]) // meal names already sent to Today

  const patch = (p) => dispatch({ type: 'body', patch: p })

  const targets = useMemo(
    () => computeTargets({ kg, cm: heightCm, age, body, activity, goal }),
    [kg, heightCm, age, body, activity, goal]
  )

  const plan = useMemo(() => buildPlan(targets, planSeed), [targets, planSeed])

  const addMeal = (meal) => {
    planToFoods({ meals: [meal] }).forEach((food) =>
      dispatch({ type: 'addFood', food })
    )
    setAdded((a) => [...a, meal.name])
  }

  const addDay = () => {
    planToFoods(plan).forEach((food) => dispatch({ type: 'addFood', food }))
    setAdded(plan.meals.map((m) => m.name))
  }

  const shuffle = () => {
    dispatch({ type: 'shufflePlan' })
    setAdded([])
  }

  const off = plan.totals.kcal - targets.kcal

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Eat</p>
          <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
            A day of food that <span className="grad-text">fits your body</span>.
          </h1>
          <p className="mt-3 max-w-[56ch] text-balance text-[16px] leading-relaxed text-muted">
            Move the sliders and the numbers follow. No verdicts, no red
            warnings, just a starting point you can shuffle, edit, or ignore.
          </p>
        </div>
        <button onClick={shuffle} className="btn-ghost px-5 py-2.5 text-[13.5px]">
          <Shuffle size={14} />
          Shuffle the day
        </button>
      </div>

      <div className="mt-9 grid gap-6 lg:grid-cols-[5fr_7fr]">
        {/* --- About you --- */}
        <div className="glass p-8">
          <p className="eyebrow">About you</p>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Nothing here is saved anywhere but your own browser.
            {weights.length === 0 && ' Weight starts at a placeholder; move it once and it becomes yours.'}
          </p>

          <div className="mt-7 space-y-6">
            <Slider
              label="Weight"
              value={kg}
              min={35}
              max={160}
              step={0.5}
              unit="kg"
              onChange={(v) => dispatch({ type: 'logWeight', kg: v })}
            />
            <Slider
              label="Height"
              value={heightCm}
              min={130}
              max={215}
              unit="cm"
              onChange={(v) => patch({ heightCm: v })}
            />
            <Slider
              label="Age"
              value={age}
              min={16}
              max={90}
              unit="years"
              onChange={(v) => patch({ age: v })}
            />
            <Chips
              label="Body"
              options={BODY}
              value={body}
              onChange={(v) => patch({ body: v })}
            />
            <Chips
              label="How much you move"
              options={ACTIVITY}
              value={activity}
              onChange={(v) => patch({ activity: v })}
            />
            <Chips
              label="What you’re after"
              options={GOALS}
              value={goal}
              onChange={(v) => patch({ goal: v })}
            />
          </div>
        </div>

        {/* --- Numbers --- */}
        <div className="flex flex-col gap-6">
          <div className="card-grad p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="eyebrow">BMI</p>
                <p className="num mt-2 font-display text-[52px] leading-none">
                  {targets.bmi}
                </p>
                <span className="pill mt-3">{targets.band.label}</span>
              </div>
              <div className="text-right">
                <p className="eyebrow">A day at this weight</p>
                <p className="num mt-2 font-display text-[52px] leading-none accent-text">
                  {targets.kcal}
                </p>
                <p className="num mt-2 text-[12.5px] text-muted">
                  resting {targets.bmr} · moving {targets.tdee} kcal
                </p>
              </div>
            </div>

            <MacroBar
              protein={targets.protein}
              carbs={targets.carbs}
              fat={targets.fat}
            />

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                ['Protein', targets.protein],
                ['Carbs', targets.carbs],
                ['Fat', targets.fat],
              ].map(([label, g]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-edge/60 bg-white/[0.05] px-4 py-3"
                >
                  <p className="eyebrow">{label}</p>
                  <p className="num mt-1.5 text-[22px] leading-none">
                    {g}
                    <span className="text-[12px] text-muted"> g</span>
                  </p>
                </div>
              ))}
            </div>

            {targets.floored && (
              <p className="mt-5 text-[13px] leading-relaxed text-muted">
                We nudged this up a little. Going lower than this would be eating
                less than your body uses at rest, and that’s not a trade worth
                making.
              </p>
            )}

            <button
              onClick={() => dispatch({ type: 'kcalTarget', kcal: targets.kcal })}
              disabled={kcalTarget === targets.kcal}
              className="btn-primary mt-6 w-full justify-center py-3 text-[14px] disabled:cursor-default disabled:opacity-50"
            >
              {kcalTarget === targets.kcal ? (
                <>
                  <Check size={15} />
                  This is your Food target
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Use {targets.kcal} as my Food target
                </>
              )}
            </button>
          </div>

          <div className="card flex items-start gap-3.5">
            <Info size={16} className="mt-0.5 shrink-0 text-muted" />
            <p className="text-[13px] leading-relaxed text-muted">{DISCLAIMER}</p>
          </div>
        </div>
      </div>

      {/* --- The day --- */}
      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">One way to eat it</p>
          <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight">
            Four meals, ordinary food.
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="num text-[13px] text-muted">
            {plan.totals.kcal} kcal · P {plan.totals.protein}g · C{' '}
            {plan.totals.carbs}g · F {plan.totals.fat}g
            {Math.abs(off) > 60 && (
              <span className="text-muted">
                {' '}
                ({off > 0 ? '+' : ''}
                {off} vs target)
              </span>
            )}
          </span>
          <button onClick={addDay} className="btn-ghost px-5 py-2.5 text-[13.5px]">
            <Plus size={14} />
            Add the whole day
          </button>
        </div>
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {plan.meals.map((meal) => {
          const done = added.includes(meal.name)
          return (
            <motion.div
              key={meal.name}
              variants={riseIn}
              className="card flex flex-col"
            >
              <div className="flex items-baseline justify-between">
                <p className="text-[15px] font-medium">{meal.name}</p>
                <span className="num text-[12.5px] text-muted">
                  {meal.kcal} kcal
                </span>
              </div>

              <div className="grad-rule my-4" />

              <ul className="flex-1 space-y-2.5">
                <AnimatePresence initial={false}>
                  {meal.items.map((i) => (
                    <motion.li
                      key={i.uid}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: dur(0.26) }}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-[14px] leading-snug">{i.name}</span>
                      <span className="num shrink-0 text-[12.5px] text-muted">
                        {i.grams}g
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>

              <p className="num mt-4 text-[12px] text-muted">
                P {meal.protein}g
              </p>

              <button
                onClick={() => addMeal(meal)}
                className="btn-ghost mt-4 w-full justify-center py-2.5 text-[13px]"
              >
                {done ? (
                  <>
                    <Check size={13} />
                    Added - add again
                  </>
                ) : (
                  <>
                    <Utensils size={13} />
                    Add to today
                  </>
                )}
              </button>
            </motion.div>
          )
        })}
      </motion.div>

      <p className="mt-8 max-w-[64ch] text-[13.5px] leading-relaxed text-muted">
        Swap anything you don’t like. The plan is a suggestion, and the Food
        page lets you search and log whatever you actually ate instead.
      </p>
    </Page>
  )
}
