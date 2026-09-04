/*
 * wger.de exercise database. Open source, free, no key.
 *
 * Turns Move from three hardcoded movements into a searchable library. The
 * three animated ones stay special - they have Lottie characters and a
 * synced timer - and this is the long tail behind them.
 *
 * We don't read difficulty out of this API. wger has categories (muscle
 * groups) and that's all we surface. There's nowhere for a difficulty to
 * live anyway since the effort plans were deleted (see data/session.js).
 */

const ENDPOINT = 'https://wger.de/api/v2/exercise/search/'

/**
 * Offline library, so the search box is never a dead end.
 *
 * `kit` is what the movement needs: 'none' for floor-only, 'some' for a
 * dumbbell / band / bench, 'gym' for a machine or a rack. The Move page
 * filters on this so nobody is shown a lat pulldown they have no access to.
 * Note the ordering is by muscle group, not by difficulty - there is no
 * difficulty here to sort by.
 */
export const LIBRARY = [
  { id: 'l1', name: 'Bodyweight squat', category: 'Legs', kit: 'none' },
  { id: 'l2', name: 'Wall pushup', category: 'Chest', kit: 'none' },
  { id: 'l3', name: 'Glute bridge', category: 'Glutes', kit: 'none' },
  { id: 'l4', name: 'Bird dog', category: 'Core', kit: 'none' },
  { id: 'l5', name: 'Dead bug', category: 'Core', kit: 'none' },
  { id: 'l6', name: 'Standing calf raise', category: 'Calves', kit: 'none' },
  { id: 'l7', name: 'Superman hold', category: 'Back', kit: 'none' },
  { id: 'l8', name: 'Incline pushup', category: 'Chest', kit: 'none' },
  { id: 'l9', name: 'Reverse lunge', category: 'Legs', kit: 'none' },
  { id: 'l10', name: 'Side plank', category: 'Core', kit: 'none' },
  { id: 'l11', name: 'Shoulder tap plank', category: 'Shoulders', kit: 'none' },
  { id: 'l12', name: 'Seated knee tuck', category: 'Core', kit: 'none' },
  { id: 'l13', name: 'Hip hinge', category: 'Back', kit: 'none' },
  { id: 'l14', name: 'Step-up', category: 'Legs', kit: 'none' },
  // A few things at home
  { id: 'l15', name: 'Dumbbell row', category: 'Back', kit: 'some' },
  { id: 'l16', name: 'Goblet squat', category: 'Legs', kit: 'some' },
  { id: 'l17', name: 'Band pull-apart', category: 'Shoulders', kit: 'some' },
  { id: 'l18', name: 'Dumbbell floor press', category: 'Chest', kit: 'some' },
  { id: 'l19', name: 'Overhead press', category: 'Shoulders', kit: 'some' },
  { id: 'l20', name: 'Romanian deadlift', category: 'Back', kit: 'some' },
  { id: 'l21', name: 'Band glute kickback', category: 'Glutes', kit: 'some' },
  { id: 'l22', name: 'Dumbbell curl', category: 'Arms', kit: 'some' },
  // Full gym
  { id: 'l23', name: 'Lat pulldown', category: 'Back', kit: 'gym' },
  { id: 'l24', name: 'Leg press', category: 'Legs', kit: 'gym' },
  { id: 'l25', name: 'Seated cable row', category: 'Back', kit: 'gym' },
  { id: 'l26', name: 'Bench press', category: 'Chest', kit: 'gym' },
  { id: 'l27', name: 'Leg curl', category: 'Legs', kit: 'gym' },
  { id: 'l28', name: 'Cable triceps pushdown', category: 'Arms', kit: 'gym' },
  { id: 'l29', name: 'Chest press machine', category: 'Chest', kit: 'gym' },
  { id: 'l30', name: 'Assisted pull-up', category: 'Back', kit: 'gym' },
]

const localSearch = (term) => {
  const t = term.trim().toLowerCase()
  return LIBRARY.filter(
    (e) =>
      e.name.toLowerCase().includes(t) || e.category.toLowerCase().includes(t)
  ).slice(0, 12)
}

/**
 * wger returns { suggestions: [{ value, data: {...} }] }. Older and
 * paginated endpoints return { results: [...] }. We accept either, and
 * throw away anything without a usable name rather than rendering blanks.
 */
function normalise(json) {
  const raw = json?.suggestions || json?.results || []
  const out = []
  for (const row of raw) {
    const d = row?.data || row || {}
    const name = d.name || row?.value
    if (!name) continue
    out.push({
      id: String(d.base_id ?? d.id ?? name),
      name: String(name),
      category: d.category?.name || d.category || 'General',
      image: d.image_thumbnail || d.image || null,
      // wger's search endpoint does not report equipment, so live results
      // are untagged. allows() treats an unknown tag as permitted, which is
      // the right call: better to show a movement somebody cannot do than to
      // silently hide most of the library.
      kit: null,
    })
  }
  // wger sometimes returns the same base exercise under several variations.
  const seen = new Set()
  return out.filter((e) => {
    const key = e.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchExercises(term) {
  const q = term.trim()
  if (q.length < 2) return { items: [], source: 'idle' }

  const url = `${ENDPOINT}?${new URLSearchParams({
    term: q,
    language: '2', // English
    format: 'json',
  })}`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)

  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`wger ${res.status}`)
    const items = normalise(await res.json())
    if (!items.length) throw new Error('no usable results')
    return { items: items.slice(0, 12), source: 'wger' }
  } catch (err) {
    return {
      items: localSearch(q),
      source: 'local',
      reason: err?.message || 'failed',
    }
  } finally {
    clearTimeout(timer)
  }
}
