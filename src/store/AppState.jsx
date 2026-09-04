import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { getEnergy, isEnergy } from '../data/energy.js'
import { dataKeyFor } from '../services/accounts.js'

/*
 * Single source of truth. No server - every page reads and writes this one
 * object through useApp(), and the whole thing is mirrored to localStorage
 * on every change, so a refresh mid-demo loses nothing.
 *
 * How memory works, since it's the question everyone asks: the object is
 * JSON.stringify'd into localStorage under a key belonging to whoever is
 * signed in (`fitflow.v2::<id>`, id from services/accounts.js). That's
 * per-browser and per-machine, survives closing the tab and rebooting, and
 * has no expiry. It is not synced, so a different browser is a different
 * person as far as the app is concerned, and "clear browsing data" wipes it.
 *
 * The account separates two people on one laptop and keeps passwords out of
 * storage in plain text. It is not a security boundary - anyone at the
 * keyboard with dev tools can read any account's blob. Nothing is
 * transmitted, and /you exports the whole object to a file.
 *
 * `scope` is the signed-in account id, handed down by src/Root.jsx. null
 * gives the original un-namespaced key, where pre-accounts saves still live.
 */

/*
 * Bump this when the shape of freshState changes incompatibly, or when saved
 * data would otherwise be actively wrong. A mismatch throws the save away and
 * starts clean, replaying onboarding once.
 *
 * 4 dropped the seeded fake week. Up to 3 we shipped seven days of invented
 * history and six invented weigh-ins so the charts had something to draw on
 * first load, which put logs on the constellation nobody earned and made every
 * other number on the page suspect. Empty until it's real now.
 *
 * Adding a key does NOT need a bump: sanitize() walks freshState's keys and
 * skips any the save is missing, so goalWeightKg landed in older saves as its
 * default. Bumping for that would wipe a real week for no reason.
 */
const VERSION = 4

const todayKey = () => new Date().toISOString().slice(0, 10)

const dayLabel = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })

/** Minutes of movement in a day, from the two things that produce them. */
const minutesFrom = (completed, jogs) =>
  (completed || []).length * 6 +
  Math.round((jogs || []).reduce((s, j) => s + (j.seconds || 0), 0) / 60)

const freshState = () => ({
  version: VERSION,
  day: todayKey(),
  onboarded: false,
  name: '',
  tone: 'warm', // warm | grounding | playful
  goalLiters: 2.5,
  waterLog: [], // today only: [{ ml, at }]
  energy: 'steady',
  foods: [], // today only
  kcalTarget: 1900,
  completed: [], // exercise ids finished today
  jogs: [],

  // Both start empty and are only ever added to by the person using the app.
  // weights fills up one entry per check-in; history gains one archived row
  // per calendar day, written by load() at the overnight rollover.
  weights: [],
  history: [],

  voiceOn: true,
  messages: [], // Neha chat thread

  // Body inputs for the BMI-driven diet plan. Weight is NOT stored here -
  // it is read from the weights log, so there is only ever one source for it.
  heightCm: 170,
  age: 24,
  body: 'unspecified', // female | male | unspecified
  activity: 'light',
  goal: 'hold',
  planSeed: 0, // rotates the generated meals; the Shuffle button moves this

  // The one number /predict needs, and 0 means "not set" rather than "0 kg".
  //
  // Deliberately opt-in: everything else in the app works without it, and a
  // person who does not want a target weight anywhere near them should not have
  // to look at one. /predict says so on the page.
  goalWeightKg: 0,

  // Movement context.
  //
  // equipment filters WHICH movements are offered - never how hard they are,
  // and there is no longer any "how hard" to filter by: the three effort plans
  // are gone. This only stops the app from suggesting a dumbbell row to
  // somebody standing in a bedroom with no dumbbells. Editable on /move.
  //
  // moveGoal only feeds one line of encouragement on /move. Nothing sets it
  // since the welcome screen stopped asking, so it stays on 'feel-better';
  // wire a picker to it if it should ever vary again.
  equipment: 'none', // none | some | gym
  moveGoal: 'feel-better', // feel-better | stronger | calmer | moving-more

  // Neha reading her replies aloud. Defaults off: audio that starts without
  // being asked for is startling, and on a shared screen it is worse.
  nehaVoice: false,
})

/**
 * Keep only keys freshState knows about, and only where the type matches.
 *
 * Used on every load and on every import. Without it, one hand-edited export
 * file could put a string where the app expects an array and take down a page
 * on mount, which is a miserable way to lose a demo.
 */
function sanitize(saved) {
  const base = freshState()
  if (!saved || typeof saved !== 'object') return base
  const out = { ...base }
  for (const k of Object.keys(base)) {
    const v = saved[k]
    if (v === undefined || v === null) continue
    if (Array.isArray(base[k]) !== Array.isArray(v)) continue
    if (!Array.isArray(base[k]) && typeof base[k] !== typeof v) continue
    out[k] = v
  }
  // A level that no longer ships would leave the picker with nothing selected
  // and the accent stuck on the fallback. Migrate rather than wipe: losing a
  // whole profile over one stale string would be a rude trade.
  if (!isEnergy(out.energy)) out.energy = base.energy
  out.version = VERSION
  return out
}

/**
 * Read one account's save.
 *
 * @param {{ key: string, hintName?: string }} where - the storage key to read,
 *   and a name to seed a brand-new profile with (the account's own name), so a
 *   person who has just signed up is greeted by name instead of by nothing.
 */
function load({ key, hintName = '' }) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { ...freshState(), name: hintName }
    const saved = JSON.parse(raw)
    if (saved.version !== VERSION) return { ...freshState(), name: hintName }
    const clean = sanitize(saved)

    // New calendar day? Archive yesterday, then start clean.
    if (clean.day !== todayKey()) {
      const waterMl = clean.waterLog.reduce((s, w) => s + w.ml, 0)
      const kcal = clean.foods.reduce((s, f) => s + f.kcal, 0)
      const minutes = minutesFrom(clean.completed, clean.jogs)
      const archived = {
        date: clean.day,
        label: dayLabel(clean.day),
        waterMl,
        kcal,
        minutes,
        moved: minutes > 0,
      }
      // An untouched day is not archived at all. Writing a row of zeros for a
      // day nobody opened the app would put a flat line on the week chart and
      // a "quiet day" in the copy, which is scorekeeping by accident.
      const worth = waterMl > 0 || kcal > 0 || minutes > 0
      return {
        ...clean,
        day: todayKey(),
        waterLog: [],
        foods: [],
        completed: [],
        jogs: [],
        history: worth ? [...clean.history, archived].slice(-7) : clean.history,
      }
    }
    return clean
  } catch {
    return freshState()
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'profile':
      return { ...state, ...action.patch }
    case 'finishOnboarding':
      return { ...state, ...action.patch, onboarded: true }
    case 'energy':
      return { ...state, energy: action.id }
    case 'logWater':
      return { ...state, waterLog: [...state.waterLog, { ml: action.ml, at: Date.now() }] }
    case 'undoWater':
      return { ...state, waterLog: state.waterLog.slice(0, -1) }
    case 'goalLiters':
      return { ...state, goalLiters: action.liters }
    case 'addFood':
      return { ...state, foods: [...state.foods, action.food] }
    case 'removeFood':
      return { ...state, foods: state.foods.filter((f) => f.uid !== action.uid) }
    case 'kcalTarget':
      return { ...state, kcalTarget: action.kcal }
    case 'body':
      return { ...state, ...action.patch }
    case 'shufflePlan':
      return { ...state, planSeed: state.planSeed + 1 }
    case 'logWeight':
      return {
        ...state,
        weights: [
          ...state.weights.filter((w) => w.date !== todayKey()),
          { date: todayKey(), kg: action.kg },
        ].sort((a, b) => a.date.localeCompare(b.date)),
      }
    case 'goalWeight':
      // 0 clears it. /predict treats that as "no target" and says nothing about
      // dates at all, which is the point of letting it be cleared.
      return { ...state, goalWeightKg: action.kg }
    case 'completeExercise':
      return state.completed.includes(action.id)
        ? state
        : { ...state, completed: [...state.completed, action.id] }
    case 'addJog':
      return { ...state, jogs: [...state.jogs, action.jog] }
    case 'tone':
      return { ...state, tone: action.tone }
    case 'voice':
      return { ...state, voiceOn: action.on }
    case 'nehaVoice':
      return { ...state, nehaVoice: action.on }
    case 'messages':
      return { ...state, messages: action.messages }
    // Restore a profile from an exported file. Sanitised, and onboarding is
    // forced on so a file saved before the first run cannot strand somebody on
    // a dashboard with no name.
    case 'restore':
      return { ...sanitize(action.state), day: todayKey(), onboarded: true }
    case 'reset':
      // Pure on purpose. This used to removeItem() the key as well, which was
      // theatre: the mirror effect below writes the fresh object straight back
      // over it on the very next commit. Deleting an account's data for real is
      // forgetAccount() in services/accounts.js, which is a different question
      // with a different confirm dialog.
      //
      // The name survives, because the account it belongs to does. Blanking it
      // would drop somebody who is still signed in as "Adrika" onto a welcome
      // screen asking who they are, which is not a fresh start, just amnesia.
      return { ...freshState(), name: state.name }
    default:
      return state
  }
}

const Ctx = createContext(null)

/**
 * @param {{ children: any, scope?: string|null, hintName?: string }} props
 *   `scope` is the signed-in account's id; see the note at the top of the file
 *   for why the provider is remounted rather than re-keyed in place.
 */
export function AppProvider({ children, scope = null, hintName = '' }) {
  const storageKey = dataKeyFor(scope)
  const [state, dispatch] = useReducer(reducer, { key: storageKey, hintName }, load)

  // Mirror state to localStorage. This is the whole "persistence layer".
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      /* private browsing / quota - not worth breaking the app over */
    }
  }, [state, storageKey])

  // Push the chosen energy into CSS custom properties. Everything styled
  // with var(--accent) updates instantly, with no re-render needed.
  useEffect(() => {
    const e = getEnergy(state.energy)
    const root = document.documentElement.style
    root.setProperty('--accent', e.accent)
    root.setProperty('--accent-ink', e.accentInk)
    root.setProperty('--accent-fg', e.accentFg)
    root.setProperty('--accent-rgb', e.rgb)
    root.setProperty('--tempo', String(e.tempo))
  }, [state.energy])

  const value = useMemo(() => {
    const energy = getEnergy(state.energy)
    const waterMl = state.waterLog.reduce((s, w) => s + w.ml, 0)
    const goalMl = Math.round(state.goalLiters * 1000)
    const kcal = state.foods.reduce((s, f) => s + f.kcal, 0)
    const protein = state.foods.reduce((s, f) => s + (f.protein || 0), 0)
    const kg = state.weights.length ? state.weights[state.weights.length - 1].kg : null
    const lastMoved = [...state.history].reverse().find((d) => d.moved)
    const movedToday = state.completed.length > 0 || state.jogs.length > 0

    /**
     * Today, in the same shape as an archived day, appended to the week.
     *
     * This is what makes the charts and the ticker respond while you are
     * standing in front of them: log a glass of water and today's bar grows
     * immediately, instead of nothing moving until tomorrow. `today: true`
     * lets a page label it rather than pretending it is finished.
     */
    const todayRow = {
      date: state.day,
      label: 'Today',
      waterMl,
      kcal,
      minutes: minutesFrom(state.completed, state.jogs),
      moved: movedToday,
      today: true,
    }

    return {
      ...state,
      dispatch,
      /** The exact localStorage key this account's data is written under. */
      storageKey,
      energyMeta: energy,
      /** Scale any animation duration by the current energy tempo. */
      dur: (base) => Number((base * energy.tempo).toFixed(3)),
      waterMl,
      goalMl,
      waterPct: goalMl ? Math.min(100, Math.round((waterMl / goalMl) * 100)) : 0,
      kcal,
      protein,
      kcalPct: state.kcalTarget
        ? Math.min(100, Math.round((kcal / state.kcalTarget) * 100))
        : 0,
      // Archived days only. Today is deliberately NOT counted as missed: the
      // day is not over, and telling somebody at 9am that they have missed
      // today is precisely the nagging this product exists to not do.
      missedDays: state.history.filter((d) => !d.moved).length,
      kg,
      /** Something numeric for the diet maths before anyone has weighed in. */
      kgOrDefault: kg ?? 70,
      lastMovedLabel: lastMoved ? lastMoved.label : null,
      movedToday,
      week: [...state.history, todayRow],
      /** True once there is any logged thing at all, anywhere. */
      hasAnyData:
        state.history.length > 0 ||
        state.weights.length > 0 ||
        state.waterLog.length > 0 ||
        state.foods.length > 0 ||
        state.completed.length > 0 ||
        state.jogs.length > 0,
    }
  }, [state, storageKey])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/*
 * Exactly the keys written to localStorage, so /you can show and export the real
 * saved object rather than a hand-maintained description of it. The key it's
 * written under isn't a constant any more (it depends on who's signed in), so
 * that arrives through the context as `storageKey`.
 *
 * This is deliberately not a second read of localStorage. /you rebuilds the
 * saved object from live state using this list, because React runs a child's
 * effects before its parent's: a page reading the storage key directly would
 * render the state from one change ago and report the wrong size.
 */
export const PERSISTED_KEYS = Object.keys(freshState())
