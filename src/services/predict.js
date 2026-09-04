import { ACTIVITY, bmi, bmr } from './dietPlan.js'

/*
 * The body predictor. Never returns a single date - it returns a window, or
 * it refuses. A date is a promise the maths can't keep, and the day it's
 * missed is the day the app becomes the thing that let you down.
 *
 * Two independent estimates, reported side by side:
 *
 * 1. The scale. Least-squares line through the weigh-ins, plus the standard
 *    error of the slope for a +/-1 SE band (roughly 2-in-3 confidence). It
 *    widens on its own with few weigh-ins or a lot of scatter, so thin
 *    evidence gives a wide answer with no hand-tuning. If the interval
 *    crosses zero the far end is genuinely unbounded and we say so rather
 *    than invent a number.
 *
 * 2. The food and movement logs. Mifflin-St Jeor maintenance x activity
 *    factor vs average logged intake; the gap becomes kg/week at 7700
 *    kcal/kg. Band is +/-20% of intake, which is about how far self-reported
 *    eating runs in the doubly-labelled-water literature. That band is often
 *    wider than the gap itself - a food diary can't pin down a rate, and a
 *    range wide enough to look humble is the honest way to show it.
 *
 * Exercise is not added on top of maintenance: the activity factor already
 * includes it, so adding logged burn double counts. Logged minutes pick the
 * factor instead, replacing the one guessed at signup. `basis` reports which
 * was used.
 *
 * All pure, no deps, takes `today` as an argument so scripts/verify.mjs can
 * pin it against known inputs including every refusal path.
 */

/** Energy in a kilogram of body tissue. The textbook figure, near enough. */
export const KCAL_PER_KG = 7700

/** Below this BMI the predictor stops predicting and says why. */
export const HEALTHY_BMI_MIN = 18.5

/** Two years. Past this a date is meaningless, so it reports a pace instead. */
export const HORIZON_WEEKS = 104

/** A weigh-in older than this makes the trend a guess about the past. */
export const STALE_DAYS = 10

/** Within half a kilo of the goal is at the goal. Scales are not finer. */
export const AT_GOAL_KG = 0.5

/** Rates slower than this produce absurd week counts. Treated as open-ended. */
const MIN_SPEED = 0.02

/** How far a self-reported food log is typically off, as a share of intake. */
const INTAKE_ERROR = 0.2

/*
 * Floor on residual scatter in the weigh-in log, in kg.
 *
 * A bathroom scale plus a normal day's water, food and clothing moves a reading
 * by about half a kilo, so three weigh-ins sitting on a straight line are luck
 * rather than precision. Without this floor the standard error of the slope
 * collapses toward zero and the page promises a two-week window off four
 * readings. With it the uncertainty is at least what the instrument deserves -
 * on four weigh-ins three weeks apart, about ±0.22 kg a week, which is honestly
 * how well anyone knows their own trend after three weeks.
 */
const SCALE_NOISE_KG = 0.5

/** Enough archived days that an average means something. */
const MIN_FOOD_DAYS = 3
const MIN_MOVE_DAYS = 4

/** A week of separation before a trend line is worth drawing. */
const MIN_SPAN_DAYS = 7

const DAY_MS = 86400000

/* Noon avoids the DST and timezone edges that bite date-only strings. */
const dayNum = (iso) => Math.round(Date.parse(`${iso}T12:00:00Z`) / DAY_MS)

const isoFrom = (iso, plusDays) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + plusDays * DAY_MS).toISOString().slice(0, 10)

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length
const round1 = (n) => Math.round(n * 10) / 10
const round2 = (n) => Math.round(n * 100) / 100
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

/** The lowest weight that keeps this height inside the typical BMI range. */
export function healthyMinKg(cm) {
  const m = (Number(cm) || 170) / 100
  return round1(HEALTHY_BMI_MIN * m * m)
}

/** Weigh-ins, cleaned and sorted. Anything malformed is dropped, not guessed. */
function points(weights) {
  return (weights || [])
    .filter(
      (w) =>
        w &&
        typeof w.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(w.date) &&
        Number.isFinite(Number(w.kg)) &&
        Number(w.kg) > 0
    )
    .map((w) => ({ t: dayNum(w.date), date: w.date, kg: Number(w.kg) }))
    .sort((a, b) => a.t - b.t)
}

/*
 * Least-squares line through the weigh-ins, with the standard error of the slope.
 *
 * se = sqrt( max(Σresid²/(n−2), noise²) / Σ(t−t̄)² ), the textbook standard error
 * of a regression slope, floored by SCALE_NOISE_KG so a small tidy set of
 * readings can't claim a precision no bathroom scale has. The floor also covers
 * n=2: two points have no degrees of freedom left for a residual variance, so
 * rather than invent one the noise term does the work and the band comes out
 * honestly wide.
 *
 * @returns {null | { n, slope, intercept, se, kgPerWeek, seWeek, spanDays,
 *   firstDate, lastDate, lastKg, smoothedLast, thinEvidence }}
 */
export function fitWeights(weights) {
  const pts = points(weights)
  const n = pts.length
  if (n < 2) return null

  const mt = mean(pts.map((p) => p.t))
  const mk = mean(pts.map((p) => p.kg))
  let stt = 0
  let stk = 0
  for (const p of pts) {
    stt += (p.t - mt) * (p.t - mt)
    stk += (p.t - mt) * (p.kg - mk)
  }
  // Every weigh-in on the same day: a vertical scatter, no line through it.
  if (stt <= 0) return null

  const slope = stk / stt
  const intercept = mk - slope * mt

  let ss = 0
  for (const p of pts) {
    const resid = p.kg - (intercept + slope * p.t)
    ss += resid * resid
  }
  const variance = n > 2 ? ss / (n - 2) : 0
  const se = Math.sqrt(Math.max(variance, SCALE_NOISE_KG * SCALE_NOISE_KG) / stt)

  const last = pts[n - 1]
  return {
    n,
    slope,
    intercept,
    se,
    kgPerWeek: slope * 7,
    seWeek: se * 7,
    spanDays: last.t - pts[0].t,
    firstDate: pts[0].date,
    lastDate: last.date,
    lastKg: last.kg,
    smoothedLast: round1(intercept + slope * last.t),
    thinEvidence: n < 3,
  }
}

/**
 * Which ACTIVITY factor a given amount of daily movement actually describes.
 *
 * The four factors ship with labels - "Desk day", "a few days", "most days",
 * "hard activity most days" - so this is not an invented curve, it is those same
 * four rungs written as minutes and joined up straight. Clamped at both ends:
 * two hours of logged movement a day is not evidence for a factor beyond 1.725.
 */
export function factorFromMinutes(minutesPerDay) {
  const ladder = [
    [0, ACTIVITY[0].factor],
    [15, ACTIVITY[1].factor],
    [35, ACTIVITY[2].factor],
    [60, ACTIVITY[3].factor],
  ]
  const m = clamp(Number(minutesPerDay) || 0, 0, 60)
  for (let i = 1; i < ladder.length; i++) {
    const [x0, y0] = ladder[i - 1]
    const [x1, y1] = ladder[i]
    if (m <= x1) return round2(y0 + ((m - x0) / (x1 - x0)) * (y1 - y0))
  }
  return ladder[ladder.length - 1][1]
}

/**
 * What the archived days actually say. Today is deliberately excluded - it is
 * half over, and a partial day would drag every average down.
 *
 * Intake averages only days where food was logged at all. A day with no food
 * entries is a day nobody opened the food page, not a day of fasting, and
 * averaging those zeros in would manufacture an enormous fake deficit.
 */
export function habitWindow(history) {
  const days = (history || []).filter((d) => d && typeof d === 'object' && !d.today)
  const fed = days.filter((d) => Number(d.kcal) > 0)
  const minutes = days.map((d) => Number(d.minutes) || 0)
  return {
    archivedDays: days.length,
    foodDays: fed.length,
    intake: fed.length ? Math.round(mean(fed.map((d) => Number(d.kcal)))) : null,
    minutesPerDay: days.length ? Math.round(mean(minutes)) : null,
    movedDays: days.filter((d) => d.moved).length,
  }
}

/**
 * Maintenance calories, and an honest note about where the activity multiplier
 * came from. `basis: 'logged'` means the app derived it from real movement;
 * 'stated' means it is still the answer given on the plan page.
 */
export function maintenanceFor({
  kg,
  heightCm,
  age,
  body,
  activity,
  minutesPerDay = null,
  archivedDays = 0,
}) {
  const base = bmr({ kg, cm: heightCm, age, body })
  const stated = ACTIVITY.find((a) => a.id === activity)?.factor ?? ACTIVITY[1].factor
  const enough = Number.isFinite(Number(minutesPerDay)) && archivedDays >= MIN_MOVE_DAYS
  const factor = enough ? factorFromMinutes(minutesPerDay) : stated
  return {
    bmr: base,
    factor,
    stated,
    basis: enough ? 'logged' : 'stated',
    kcal: Math.round(base * factor),
  }
}

/** "about 0.4 kg a week" / "under 100 g a week", for copy that reads aloud. */
export function describeSpeed(kgPerWeek) {
  const a = Math.abs(kgPerWeek)
  if (a < 0.05) return 'under 50 g a week'
  if (a < 0.1) return 'under 100 g a week'
  return `about ${round1(a)} kg a week`
}

/**
 * Turn a speed toward the goal into a week window.
 *
 * The band is applied to the RATE, not to the answer, which is why a slow trend
 * with a wide band comes back open-ended instead of coming back with a big
 * number: if the low end of the plausible rate is zero or negative, there is no
 * "by then", and saying so is the only truthful option.
 */
function windowFor(need, speed, band) {
  const fast = speed + band
  const slow = speed - band
  return {
    weeksLow: need / fast,
    weeksHigh: slow > MIN_SPEED ? need / slow : null,
  }
}

/**
 * @param {object} input
 * @param {Array<{date:string,kg:number}>} input.weights
 * @param {Array<object>} input.history archived days, today excluded by habitWindow
 * @param {number} input.goalWeightKg 0 means no target set
 * @param {string} [input.today] ISO date, injectable so this is testable
 * @returns {object} always the same shape; `status` says how to read it
 */
export function predict(input = {}) {
  const {
    weights = [],
    history = [],
    goalWeightKg = 0,
    heightCm = 170,
    age = 24,
    body = 'unspecified',
    activity = 'light',
    today = new Date().toISOString().slice(0, 10),
  } = input

  const pts = points(weights)
  const fit = fitWeights(weights)
  const habits = habitWindow(history)
  const goal = Number(goalWeightKg) || 0
  const healthyMin = healthyMinKg(heightCm)
  const now = pts.length ? pts[pts.length - 1].kg : null
  const daysSinceWeighIn = pts.length ? dayNum(today) - pts[pts.length - 1].t : null

  const maint =
    now === null
      ? null
      : maintenanceFor({
          kg: now,
          heightCm,
          age,
          body,
          activity,
          minutesPerDay: habits.minutesPerDay,
          archivedDays: habits.archivedDays,
        })

  /* Evidence is filled in for every status, including the refusals, because the
     page shows "here is what this is based on" even when it declines to answer -
     that panel is how somebody works out what to log next. */
  const evidence = {
    ...habits,
    weighIns: pts.length,
    spanDays: fit ? fit.spanDays : 0,
    firstWeighIn: pts.length ? pts[0].date : null,
    lastWeighIn: pts.length ? pts[pts.length - 1].date : null,
    daysSinceWeighIn,
    stale: daysSinceWeighIn !== null && daysSinceWeighIn > STALE_DAYS,
    smoothedNow: fit ? fit.smoothedLast : null,
    trendKgPerWeek: fit ? round2(fit.kgPerWeek) : null,
    trendBandKgPerWeek: fit ? round2(fit.seWeek) : null,
    trendIsThin: fit ? fit.thinEvidence : false,
    maintenance: maint ? maint.kcal : null,
    factor: maint ? maint.factor : null,
    statedFactor: maint ? maint.stated : null,
    basis: maint ? maint.basis : 'stated',
    bmr: maint ? maint.bmr : null,
    bmiNow: now === null ? null : bmi(now, heightCm),
    bmiGoal: goal ? bmi(goal, heightCm) : null,
  }

  const base = {
    now,
    goal: goal || null,
    healthyMin,
    delta: now !== null && goal ? round1(now - goal) : null,
    direction: null,
    evidence,
    estimates: [],
    /** Which estimate set the window, once there is one. */
    primary: null,
    weeksLow: null,
    weeksHigh: null,
    from: null,
    to: null,
    flags: { fast: false, disagree: false, openEnded: false, beyondHorizon: false },
  }

  if (!pts.length) {
    return {
      ...base,
      status: 'need-weighins',
      message:
        'Nothing to work from yet. One weight now and another in a week or so is enough to start; the gap between two readings is the whole ingredient.',
    }
  }

  if (!goal) {
    return {
      ...base,
      status: 'no-goal',
      message:
        'No target weight set, so there’s nothing to count down to. Add one if it helps, leave it out if it doesn’t - the rest of FitFlow works either way.',
    }
  }

  // A refusal, not a warning. Sizing a plan toward an underweight target is the
  // one thing a fitness app can do that causes actual harm, so the number is
  // simply not calculated, and the healthy floor for this height is named so the
  // answer is useful rather than preachy.
  if (goal < healthyMin - 0.05) {
    return {
      ...base,
      status: 'goal-too-low',
      message: `${goal} kg sits below the typical healthy range for ${Math.round(
        heightCm
      )} cm, which starts around ${healthyMin} kg. This page won’t put a date on getting there. If that target came from somewhere that’s worth talking to a doctor or a dietitian about, please do.`,
    }
  }

  const delta = now - goal
  const direction = delta > 0 ? 'down' : 'up'

  if (Math.abs(delta) <= AT_GOAL_KG) {
    return {
      ...base,
      direction,
      status: 'at-goal',
      message: `You’re at ${now} kg against a target of ${goal} kg. There’s no countdown left to run. The useful question from here is what keeps it comfortable, not what gets it lower.`,
    }
  }

  const need = round1(Math.abs(delta))
  const toward = delta > 0 ? 1 : -1 // sign of "moving the right way"
  const estimates = []

  /* --- 1. The scale --- */
  if (fit && fit.spanDays >= MIN_SPAN_DAYS) {
    const speed = -fit.kgPerWeek * toward
    const w = windowFor(need, speed, fit.seWeek)
    estimates.push({
      id: 'scale',
      label: 'From your weigh-ins',
      speed: round2(speed),
      band: round2(fit.seWeek),
      weeksLow: speed + fit.seWeek > MIN_SPEED ? w.weeksLow : null,
      weeksHigh: w.weeksHigh,
      note: fit.thinEvidence
        ? `Two weigh-ins, ${fit.spanDays} days apart. A line through two dots, so the range around it is wide on purpose, and a third reading is what narrows it.`
        : `${fit.n} weigh-ins over ${fit.spanDays} days, with the scatter between them setting how wide the range is.`,
    })
  }

  /* --- 2. The food and movement logs --- */
  if (habits.foodDays >= MIN_FOOD_DAYS && maint) {
    const gap = habits.intake - maint.kcal
    const kgPerWeek = (gap * 7) / KCAL_PER_KG
    const bandKg = (INTAKE_ERROR * habits.intake * 7) / KCAL_PER_KG
    const speed = -kgPerWeek * toward
    const w = windowFor(need, speed, bandKg)
    estimates.push({
      id: 'intake',
      label: 'From what you’ve logged eating',
      speed: round2(speed),
      band: round2(bandKg),
      weeksLow: speed + bandKg > MIN_SPEED ? w.weeksLow : null,
      weeksHigh: w.weeksHigh,
      note: `${habits.intake} kcal a day averaged over ${habits.foodDays} logged ${
        habits.foodDays === 1 ? 'day' : 'days'
      }, against an estimated ${maint.kcal} kcal to hold steady. The range is wide because food diaries usually undercount by a fifth or so, without anybody intending it.`,
    })
  }

  if (!estimates.length) {
    const wants = []
    if (!fit || fit.spanDays < MIN_SPAN_DAYS)
      wants.push('two weigh-ins at least a week apart')
    if (habits.foodDays < MIN_FOOD_DAYS)
      wants.push(`${MIN_FOOD_DAYS} days of food logged`)
    return {
      ...base,
      direction,
      status: 'need-data',
      message: `${need} kg to go, but not enough logged yet to say anything about when. Either of these would unlock it: ${wants.join(
        ', or '
      )}.`,
    }
  }

  const usable = estimates.filter((e) => e.weeksLow !== null)

  if (!usable.length) {
    const drifting = Math.max(...estimates.map((e) => Math.abs(e.speed))) < 0.05
    return {
      ...base,
      direction,
      status: drifting ? 'holding' : 'wrong-way',
      estimates,
      message: drifting
        ? `Everything logged so far points at holding roughly where you are, which is a real answer, not a failure. Nothing here can put a date on ${goal} kg while the numbers are flat.`
        : `What’s logged so far points away from ${goal} kg rather than toward it, so there’s no date to give. That’s information about the last couple of weeks, not a verdict on you, and a fortnight is a short look at anything.`,
    }
  }

  /*
   * One estimate sets the window, and it's the scale whenever the scale has
   * anything to say.
   *
   * Taking the earliest low and the latest high across both estimates is the
   * tempting alternative, and it's what we did first. It turned a tight,
   * well-evidenced answer from the weigh-in log into a vague one the moment a
   * food diary with its ±20% band appeared. Widening a range with a worse
   * measurement isn't caution, it's discarding information.
   *
   * The scale wins because it measures the outcome directly where the food log
   * infers it from a cause: a wrong assumption about maintenance moves the
   * intake estimate by weeks, and the scale can't be wrong about what the scale
   * said. The other estimate stays in `estimates` and the page prints it
   * alongside, so a reader can see the two agree or disagree - more useful than
   * an average that hides both.
   */
  const primary = usable.find((e) => e.id === 'scale') || usable[0]
  const speeds = usable.map((e) => e.speed)
  const fastest = Math.max(...speeds)
  const slowest = Math.min(...speeds)

  const beyondHorizon = primary.weeksLow > HORIZON_WEEKS
  const flags = {
    // More than 1% of bodyweight a week. Worth naming, gently, once.
    fast: fastest > 0.01 * now,
    // Two estimates more than a factor of two apart are not one answer, and the
    // page should say so rather than quietly showing the prettier number.
    disagree: usable.length > 1 && slowest > 0 && fastest / slowest > 2,
    openEnded: primary.weeksHigh === null || primary.weeksHigh > HORIZON_WEEKS,
    beyondHorizon,
  }

  if (beyondHorizon) {
    return {
      ...base,
      direction,
      status: 'beyond-horizon',
      estimates,
      primary: primary.id,
      flags,
      message: `At ${describeSpeed(
        primary.speed
      )}, ${need} kg is more than two years out, and a date that far ahead isn’t worth printing. The pace is the useful number here, not the finish line.`,
    }
  }

  // Rounded outward, always: a floor on the near end and a ceiling on the far
  // one, so the window can only ever be honest-to-generous, never optimistic.
  const lowWeeks = Math.max(1, Math.floor(primary.weeksLow))
  const highWeeks = flags.openEnded ? null : Math.ceil(primary.weeksHigh)

  return {
    ...base,
    direction,
    status: 'ok',
    estimates,
    primary: primary.id,
    flags,
    weeksLow: lowWeeks,
    weeksHigh: highWeeks,
    from: isoFrom(today, lowWeeks * 7),
    to: highWeeks === null ? null : isoFrom(today, highWeeks * 7),
    message: highWeeks
      ? `On what you’ve logged, ${goal} kg lands somewhere between ${lowWeeks} and ${highWeeks} weeks from now.`
      : `On what you’ve logged, ${goal} kg is at least ${lowWeeks} weeks away. The far end is open, because the trend isn’t steady enough yet to bound it.`,
  }
}
