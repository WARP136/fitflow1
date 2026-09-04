/*
 * BMI-driven diet plan. All local and deterministic - no free API hands you
 * a real meal plan, and one that did would be a black box we couldn't
 * explain. Citable equations for the numbers, Open Food Facts (via
 * services/food.js) for the food data.
 *
 *   BMI    = kg / m^2
 *   BMR    = Mifflin-St Jeor (1990)
 *   TDEE   = BMR x activity factor
 *   Target = TDEE +/- a gentle delta
 *
 * Two rules constrain this file and both matter more than the numbers:
 *
 * 1. No verdicts. BMI is a number and a neutral range, never a clinical
 *    label attached to a person. A no-guilt fitness app that greets you
 *    with "obese" has failed at the one thing it promised.
 *
 * 2. No aggressive deficits. Deficit capped at 400 kcal, target floored at
 *    1400 kcal or 1.05 x BMR, whichever is higher. It won't help someone
 *    starve even if they ask.
 */

export const DISCLAIMER =
  'These are estimates from standard equations, not medical advice. BMI ignores muscle and build, so treat it as one rough number rather than a verdict. If you’re under 18, pregnant, or managing a health condition, talk to a doctor before changing how you eat.'

export const ACTIVITY = [
  { id: 'rarely', label: 'Mostly sitting', factor: 1.2, hint: 'Desk day, not much walking' },
  { id: 'light', label: 'A bit of moving', factor: 1.375, hint: 'Light activity a few days' },
  { id: 'moderate', label: 'Fairly active', factor: 1.55, hint: 'Moving most days' },
  { id: 'high', label: 'Very active', factor: 1.725, hint: 'Hard activity most days' },
]

export const GOALS = [
  { id: 'lose', label: 'Ease down', delta: -400, blurb: 'A gentle deficit, not a crash' },
  { id: 'hold', label: 'Stay steady', delta: 0, blurb: 'Eat around where you are' },
  { id: 'gain', label: 'Build up', delta: 350, blurb: 'A small surplus for building' },
]

/** Mifflin-St Jeor needs a sex term. 'unspecified' uses the midpoint so
 *  nobody is forced to answer, and the estimate stays honest either way. */
export const BODY = [
  { id: 'female', label: 'Female', constant: -161 },
  { id: 'male', label: 'Male', constant: 5 },
  { id: 'unspecified', label: 'Rather not say', constant: -78 },
]

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const round5 = (g) => Math.max(5, Math.round(g / 5) * 5)

export function bmi(kg, cm) {
  const m = cm / 100
  if (!m) return 0
  return Number((kg / (m * m)).toFixed(1))
}

/** Neutral ranges. No clinical labels, no judgement, no colour-coded alarm. */
export function bmiBand(value) {
  if (value < 18.5) return { id: 'below', label: 'Below the typical range' }
  if (value < 25) return { id: 'typical', label: 'Within the typical range' }
  if (value < 30) return { id: 'above', label: 'Above the typical range' }
  return { id: 'high', label: 'Well above the typical range' }
}

export function bmr({ kg, cm, age, body = 'unspecified' }) {
  const c = BODY.find((b) => b.id === body)?.constant ?? -78
  return Math.round(10 * kg + 6.25 * cm - 5 * age + c)
}

export function computeTargets({
  kg = 70,
  cm = 170,
  age = 25,
  body = 'unspecified',
  activity = 'light',
  goal = 'hold',
}) {
  const w = clamp(Number(kg) || 70, 30, 250)
  const h = clamp(Number(cm) || 170, 120, 220)
  const a = clamp(Number(age) || 25, 16, 90)

  const factor = ACTIVITY.find((x) => x.id === activity)?.factor ?? 1.375
  const delta = GOALS.find((g) => g.id === goal)?.delta ?? 0

  const base = bmr({ kg: w, cm: h, age: a, body })
  const tdee = Math.round(base * factor)

  // The floor: never below 1400 kcal, and never below BMR + 5%.
  const floor = Math.max(1400, Math.round(base * 1.05))
  const raw = tdee + delta
  const kcal = Math.max(floor, raw)

  // Protein at 1.4 g/kg - a well-supported figure for people who are
  // active, and reachable from normal food - then capped so it can never
  // eat more than 30% of the calorie budget.
  const proteinCap = Math.round((kcal * 0.3) / 4)
  const protein = Math.min(Math.round(w * 1.4), proteinCap)
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))

  const value = bmi(w, h)

  return {
    bmi: value,
    band: bmiBand(value),
    bmr: base,
    tdee,
    kcal,
    protein,
    carbs,
    fat,
    floored: kcal > raw,
    inputs: { kg: w, cm: h, age: a, body, activity, goal },
  }
}

/* --- Food table, per 100 g, with sane portion bounds in grams.
      Values match services/food.js PANTRY so a generated plan and a
      manually logged meal never disagree. The min/max bounds are what
      stop the solver from prescribing 255 g of paneer or five eggs. --- */
const F = {
  oats: { name: 'Rolled oats', kcal: 379, protein: 13, carbs: 68, fat: 7, min: 30, max: 90 },
  milk: { name: 'Toned milk', kcal: 58, protein: 3.2, carbs: 5, fat: 3, min: 100, max: 400 },
  egg: { name: 'Boiled egg', kcal: 155, protein: 13, carbs: 1, fat: 11, min: 50, max: 150 },
  chapati: { name: 'Chapati', kcal: 297, protein: 11, carbs: 58, fat: 3, min: 35, max: 150 },
  rice: { name: 'Cooked rice', kcal: 130, protein: 3, carbs: 28, fat: 0, min: 80, max: 330 },
  dal: { name: 'Dal tadka', kcal: 116, protein: 6, carbs: 16, fat: 3, min: 120, max: 400 },
  rajma: { name: 'Rajma curry', kcal: 140, protein: 8, carbs: 21, fat: 3, min: 120, max: 350 },
  paneer: { name: 'Paneer', kcal: 265, protein: 18, carbs: 6, fat: 20, min: 50, max: 120 },
  chicken: { name: 'Chicken breast', kcal: 165, protein: 31, carbs: 0, fat: 4, min: 80, max: 200 },
  yoghurt: { name: 'Greek yoghurt', kcal: 97, protein: 9, carbs: 4, fat: 5, min: 100, max: 250 },
  banana: { name: 'Banana', kcal: 89, protein: 1, carbs: 23, fat: 0, min: 60, max: 240 },
  pb: { name: 'Peanut butter', kcal: 588, protein: 25, carbs: 20, fat: 50, min: 10, max: 30 },
  apple: { name: 'Apple', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, min: 80, max: 300 },
  nuts: { name: 'Mixed nuts', kcal: 607, protein: 20, carbs: 21, fat: 54, min: 15, max: 40 },
  poha: { name: 'Poha', kcal: 130, protein: 2.6, carbs: 28, fat: 1.5, min: 100, max: 330 },
  sabzi: { name: 'Mixed veg sabzi', kcal: 95, protein: 3, carbs: 11, fat: 5, min: 120, max: 350 },
  khichdi: { name: 'Khichdi', kcal: 120, protein: 5, carbs: 19, fat: 2, min: 120, max: 400 },
  tofu: { name: 'Tofu', kcal: 144, protein: 16, carbs: 3, fat: 8, min: 80, max: 200 },
  sprouts: { name: 'Moong sprouts', kcal: 98, protein: 8, carbs: 16, fat: 1, min: 80, max: 250 },
  curd: { name: 'Curd', kcal: 61, protein: 3.5, carbs: 5, fat: 3, min: 100, max: 300 },
}

/* Each pair is [protein-led item, carb-led item], curated so the pair can
   actually reach a normal meal's calories and protein together. High-fat
   items (nuts, peanut butter, paneer) are kept out of the scalable slots
   where possible - a solver asked to hit a protein number with nuts will
   happily prescribe 600 calories of nuts. */
const POOLS = {
  Breakfast: [
    ['egg', 'oats'],
    ['yoghurt', 'oats'],
    ['milk', 'poha'],
    ['curd', 'chapati'],
  ],
  Lunch: [
    ['dal', 'rice'],
    ['rajma', 'chapati'],
    ['chicken', 'rice'],
    ['tofu', 'rice'],
  ],
  Snack: [
    ['yoghurt', 'banana'],
    ['curd', 'apple'],
    ['milk', 'banana'],
    ['sprouts', 'apple'],
  ],
  Dinner: [
    ['chicken', 'sabzi'],
    ['tofu', 'khichdi'],
    ['dal', 'chapati'],
    ['paneer', 'sabzi'],
  ],
}

const SHARES = [
  { name: 'Breakfast', share: 0.25 },
  { name: 'Lunch', share: 0.35 },
  { name: 'Snack', share: 0.15 },
  { name: 'Dinner', share: 0.25 },
]

function item(food, grams, tag) {
  const k = grams / 100
  return {
    uid: `${tag}-${food.name.replace(/\s+/g, '')}-${grams}`,
    name: food.name,
    brand: 'Plan',
    grams,
    kcal: Math.round(food.kcal * k),
    protein: Math.round(food.protein * k),
    carbs: Math.round(food.carbs * k),
    fat: Math.round(food.fat * k),
  }
}

/* The portion bounds above were written against a ~2100 kcal day. Somebody
   eating 2900 kcal genuinely does eat bigger plates, so the upper bound
   scales with the calorie budget instead of being fixed. Without this, a
   high target is simply unreachable and every plan comes out 25% short. */
const DAY_REF = 2100
const capMax = (food, dayKcal) =>
  Math.round(food.max * clamp(dayKcal / DAY_REF, 0.85, 1.5))

/*
 * Solve two foods against two targets at once.
 *
 *   ga*(ap) + gb*(bp) = protein
 *   ga*(ak) + gb*(bk) = kcal
 *
 * A 2x2 system, closed form by Cramer's rule. Where the pair can't reach both
 * targets - degenerate determinant, or a negative solution - fall back to
 * filling calories with the carb item and let the clamps decide. Both grams get
 * clamped to that food's plausible portion range either way, so the worst case
 * is a plate that misses the target slightly rather than one nobody would eat.
 */
function solvePair(a, b, kcal, protein, dayKcal) {
  const ap = a.protein / 100
  const ak = a.kcal / 100
  const bp = b.protein / 100
  const bk = b.kcal / 100

  const det = ap * bk - ak * bp
  let ga
  let gb

  if (Math.abs(det) > 1e-6) {
    ga = (protein * bk - kcal * bp) / det
    gb = (kcal * ap - protein * ak) / det
  }

  if (!Number.isFinite(ga) || !Number.isFinite(gb) || ga <= 0 || gb <= 0) {
    ga = a.protein > 0 ? (protein / a.protein) * 100 : a.min
    gb = b.kcal > 0 ? ((kcal - (a.kcal * ga) / 100) / b.kcal) * 100 : b.min
  }

  return [
    round5(clamp(ga, a.min, capMax(a, dayKcal))),
    round5(clamp(gb, b.min, capMax(b, dayKcal))),
  ]
}

const mealTotals = (name, carbKey, items) => ({
  name,
  carbKey,
  items,
  kcal: items.reduce((s, i) => s + i.kcal, 0),
  protein: items.reduce((s, i) => s + i.protein, 0),
})

/**
 * Pick a pairing for one meal. Walks forward through the pool from the seed
 * position until it finds a protein source the day has not already used, so
 * you never get dal for lunch and dal again for dinner. If the whole pool is
 * exhausted it accepts the repeat rather than failing.
 */
function composeMeal(name, kcalTarget, proteinTarget, seed, used, dayKcal) {
  const pool = POOLS[name]
  let pick = null
  for (let k = 0; k < pool.length; k++) {
    const cand = pool[(Math.abs(seed) + k) % pool.length]
    if (!used.has(cand[0])) {
      pick = cand
      break
    }
  }
  if (!pick) pick = pool[Math.abs(seed) % pool.length]
  used.add(pick[0])

  const a = F[pick[0]]
  const b = F[pick[1]]
  const [ga, gb] = solvePair(a, b, kcalTarget, proteinTarget, dayKcal)
  return mealTotals(name, pick[1], [item(a, ga, name), item(b, gb, name)])
}

/* Calorie-dense extras, used only to close a remaining gap on a high
   target. These are the foods a solver must never be allowed to scale
   freely - ask it to hit a protein number with mixed nuts and it will
   cheerfully prescribe 600 calories of them - so they appear last, in
   small portions, and only when there is room left to fill. */
const TOPPERS = [
  { meal: 'Snack', key: 'nuts' },
  { meal: 'Breakfast', key: 'pb' },
  { meal: 'Snack', key: 'banana' },
  { meal: 'Breakfast', key: 'banana' },
]

/*
 * Build a day of food against a calorie and protein target. `seed` rotates the
 * pairings, which is what Shuffle moves.
 *
 * Three passes: compose each meal on its own, nudge every meal's carb item by
 * one shared factor to close whatever the clamps left behind, then add dense
 * toppers if the day is still short. Only the carb item moves in pass two,
 * because stretching the protein item would change the macro split already
 * shown.
 */
export function buildPlan(targets, seed = 0) {
  const day = targets.kcal
  const used = new Set()

  let meals = SHARES.map((m, i) =>
    composeMeal(
      m.name,
      Math.round(day * m.share),
      Math.round(targets.protein * m.share),
      seed + i * 5 + 1,
      used,
      day
    )
  )

  const total = () => meals.reduce((s, m) => s + m.kcal, 0)

  // Pass 2: proportional nudge of the carb items.
  let gap = day - total()
  if (Math.abs(gap) > day * 0.04) {
    const carbKcal = meals.reduce((s, m) => s + m.items[1].kcal, 0)
    if (carbKcal > 0) {
      const factor = clamp(1 + gap / carbKcal, 0.55, 1.9)
      meals = meals.map((m) => {
        const food = F[m.carbKey]
        const grams = round5(
          clamp(m.items[1].grams * factor, food.min, capMax(food, day))
        )
        return mealTotals(m.name, m.carbKey, [
          m.items[0],
          item(food, grams, m.name),
        ])
      })
    }
  }

  // Pass 3: dense toppers, only while the day is still meaningfully short.
  gap = day - total()
  for (const t of TOPPERS) {
    if (gap < 110) break
    const food = F[t.key]
    const target = meals.find((m) => m.name === t.meal)
    // Never let one meal collect four items - a 1100 kcal "snack" is silly.
    if (!target || target.items.length >= 3) continue
    if (target.items.some((i) => i.name === food.name)) continue

    const grams = round5(
      clamp((gap / food.kcal) * 100, food.min, capMax(food, day))
    )
    const added = item(food, grams, t.meal)
    meals = meals.map((m) =>
      m.name === t.meal
        ? mealTotals(m.name, m.carbKey, [...m.items, added])
        : m
    )
    gap -= added.kcal
  }

  const all = meals.flatMap((m) => m.items)
  const sum = (key) => all.reduce((s, i) => s + i[key], 0)

  return {
    meals,
    totals: {
      kcal: sum('kcal'),
      protein: sum('protein'),
      carbs: sum('carbs'),
      fat: sum('fat'),
    },
  }
}

/** Flatten a plan into the shape the store's `addFood` action expects. */
export function planToFoods(plan) {
  return plan.meals.flatMap((m) =>
    m.items.map((i) => ({ ...i, uid: `${i.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }))
  )
}
