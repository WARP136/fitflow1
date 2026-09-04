/*
 * Nutrition search, Open Food Facts.
 *
 * Worth being precise: this doesn't generate meal plans. It's a free
 * crowd-sourced nutrition database, ~3M products with per-100g values. What
 * it buys us is that food the user adds is real and editable rather than a
 * hardcoded card reading "Oats - 320 kcal" forever.
 *
 * No key, no account, no rate limit at this volume. Plain GET from the
 * browser, permissive CORS headers.
 */

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'

/**
 * Offline pantry. Used when the network is down, the API is slow, or a
 * query returns nothing usable - so the search box always gives a result.
 * Values are per 100 g.
 */
export const PANTRY = [
  { name: 'Paneer', brand: 'Generic', kcal: 265, protein: 18, carbs: 6, fat: 20 },
  { name: 'Rolled oats', brand: 'Generic', kcal: 379, protein: 13, carbs: 68, fat: 7 },
  { name: 'Boiled egg', brand: 'Generic', kcal: 155, protein: 13, carbs: 1, fat: 11 },
  { name: 'Chapati', brand: 'Generic', kcal: 297, protein: 11, carbs: 58, fat: 3 },
  { name: 'Cooked rice', brand: 'Generic', kcal: 130, protein: 3, carbs: 28, fat: 0 },
  { name: 'Rajma curry', brand: 'Generic', kcal: 140, protein: 8, carbs: 21, fat: 3 },
  { name: 'Greek yoghurt', brand: 'Generic', kcal: 97, protein: 9, carbs: 4, fat: 5 },
  { name: 'Banana', brand: 'Generic', kcal: 89, protein: 1, carbs: 23, fat: 0 },
  { name: 'Chicken breast', brand: 'Generic', kcal: 165, protein: 31, carbs: 0, fat: 4 },
  { name: 'Peanut butter', brand: 'Generic', kcal: 588, protein: 25, carbs: 20, fat: 50 },
  { name: 'Dal tadka', brand: 'Generic', kcal: 116, protein: 6, carbs: 16, fat: 3 },
  { name: 'Almonds', brand: 'Generic', kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { name: 'Idli', brand: 'Generic', kcal: 132, protein: 4, carbs: 26, fat: 1 },
  { name: 'Poha', brand: 'Generic', kcal: 158, protein: 3, carbs: 32, fat: 2 },
].map((f, i) => ({ ...f, id: 'pantry-' + i, image: null, offline: true }))

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

/**
 * Open Food Facts is crowd-sourced, so records are inconsistent: some
 * have energy in kJ, some in kcal, some have no name. Normalise hard and
 * drop anything unusable rather than rendering a card that says "undefined".
 */
function normalise(p) {
  const n = p?.nutriments || {}
  let kcal = num(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? n['energy-kcal_value'])
  if (!kcal) {
    const kj = num(n['energy_100g'] ?? n['energy'])
    if (kj) kcal = Math.round(kj / 4.184) // kJ -> kcal
  }
  const name = (p?.product_name || '').trim()
  if (!name || !kcal) return null
  return {
    id: p.code || name,
    name: name.length > 46 ? name.slice(0, 46) + '...' : name,
    brand: (p.brands || '').split(',')[0].trim() || 'Unbranded',
    kcal,
    protein: num(n['proteins_100g']),
    carbs: num(n['carbohydrates_100g']),
    fat: num(n['fat_100g']),
    image: p.image_small_url || null,
    offline: false,
  }
}

const localMatches = (q) => {
  const t = q.trim().toLowerCase()
  return PANTRY.filter((f) => f.name.toLowerCase().includes(t)).slice(0, 8)
}

/**
 * @param {string} query
 * @returns {Promise<{items:Array, source:'openfoodfacts'|'pantry', reason?:string}>}
 */
export async function searchFoods(query) {
  const q = (query || '').trim()
  if (q.length < 2) return { items: [], source: 'pantry' }

  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '14',
    fields: 'code,product_name,brands,nutriments,image_small_url',
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${SEARCH_URL}?${params}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`)
    const data = await res.json()
    const items = (data?.products || []).map(normalise).filter(Boolean).slice(0, 8)
    if (!items.length) {
      const local = localMatches(q)
      return {
        items: local,
        source: 'pantry',
        reason: 'No usable matches online, showing the built-in list',
      }
    }
    return { items, source: 'openfoodfacts' }
  } catch (err) {
    return {
      items: localMatches(q),
      source: 'pantry',
      reason: err.name === 'AbortError' ? 'Search timed out' : err.message,
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Scale a per-100g record to the serving the user actually picked. */
export function portion(food, grams) {
  const k = grams / 100
  return {
    uid: `${food.id}-${Date.now()}`,
    name: food.name,
    brand: food.brand,
    grams,
    kcal: Math.round(food.kcal * k),
    protein: Math.round(food.protein * k),
    carbs: Math.round(food.carbs * k),
    fat: Math.round(food.fat * k),
  }
}

/*
 * Barcode lookup: the label scanner's half of Open Food Facts. Same database,
 * different endpoint - v2 takes a barcode and returns the one product, so
 * there's nothing to rank or guess at. Still keyless.
 *
 * The scanner needs more than the four macros the search box shows, since sugar,
 * salt, saturated fat and fibre are what people squint at on a packet, so this
 * normalises a wider record.
 *
 * One field we deliberately don't read: nutriscore_grade. Open Food Facts hands
 * out a letter grade per product and displaying it would be one line. A letter
 * grade is a score, and once food has a grade so does the person eating it.
 * Numbers inform, grades judge.
 */

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/'

const LABEL_FIELDS = [
  'code',
  'product_name',
  'brands',
  'quantity',
  'serving_size',
  'nutriments',
  'image_small_url',
  'ingredients_text',
].join(',')

/** Like num(), but keeps one decimal - salt and sugar live below 1 g. */
const dec = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0
}

function normaliseLabel(p) {
  const base = normalise(p)
  if (!base) return null
  const n = p?.nutriments || {}
  return {
    ...base,
    // Long product names are usually "Brand, flavour, 400 g, pack of 2".
    // The scanner has room, so it keeps more of the name than search does.
    name: (p.product_name || '').trim().slice(0, 72),
    sugars: dec(n['sugars_100g']),
    fibre: dec(n['fiber_100g']),
    satFat: dec(n['saturated-fat_100g']),
    salt: dec(n['salt_100g'] ?? (n['sodium_100g'] ? n['sodium_100g'] * 2.5 : 0)),
    servingSize: (p.serving_size || '').trim() || null,
    quantity: (p.quantity || '').trim() || null,
    ingredients: (p.ingredients_text || '').trim() || null,
    barcode: p.code || null,
  }
}

/**
 * Two products almost certainly in the database, for the very likely case of
 * demoing this with no packet within reach. The offline copies exist so the
 * page still does something on conference wifi; they are marked offline and
 * the UI says so rather than passing them off as a live read.
 */
export const DEMO_CODES = [
  {
    code: '3017620422003',
    label: 'Nutella',
    offline: {
      id: '3017620422003',
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      kcal: 539,
      protein: 6,
      carbs: 57,
      fat: 31,
      sugars: 56.3,
      fibre: 0,
      satFat: 10.6,
      salt: 0.1,
      servingSize: '15 g',
      quantity: '400 g',
      ingredients: null,
      image: null,
      offline: true,
    },
  },
  {
    code: '5449000000996',
    label: 'Coca-Cola',
    offline: {
      id: '5449000000996',
      barcode: '5449000000996',
      name: 'Coca-Cola',
      brand: 'Coca-Cola',
      kcal: 42,
      protein: 0,
      carbs: 10.6,
      fat: 0,
      sugars: 10.6,
      fibre: 0,
      satFat: 0,
      salt: 0,
      servingSize: '330 ml',
      quantity: '330 ml',
      ingredients: null,
      image: null,
      offline: true,
    },
  },
]

/**
 * @param {string} code A barcode, digits only.
 * @returns {Promise<{item:object|null, source:'openfoodfacts'|'offline'|'none', reason?:string}>}
 */
export async function lookupBarcode(code) {
  const c = String(code || '').replace(/\D+/g, '')
  if (!c) return { item: null, source: 'none', reason: 'That’s not a barcode.' }

  const offline = DEMO_CODES.find((d) => d.code === c)?.offline || null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${PRODUCT_URL}${c}.json?fields=${LABEL_FIELDS}`, {
      signal: controller.signal,
    })
    // v2 answers 404 with a real body for a code nobody has added yet. That
    // is not a failure of ours, and it deserves its own message.
    if (res.status === 404) {
      return offline
        ? { item: offline, source: 'offline' }
        : {
            item: null,
            source: 'none',
            reason:
              'Nobody has added that barcode yet. Open Food Facts is crowd-sourced, so gaps are normal, and you can still add the food by name.',
          }
    }
    if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`)
    const data = await res.json()
    const item = data?.status === 1 ? normaliseLabel(data.product) : null
    if (!item) {
      return offline
        ? { item: offline, source: 'offline' }
        : {
            item: null,
            source: 'none',
            reason:
              'That barcode is in the database but has no usable nutrition on it yet.',
          }
    }
    return { item, source: 'openfoodfacts' }
  } catch (err) {
    if (offline) return { item: offline, source: 'offline' }
    return {
      item: null,
      source: 'none',
      reason:
        err.name === 'AbortError'
          ? 'The lookup timed out. Worth one more try.'
          : 'Couldn’t reach Open Food Facts just now.',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Turn the panel into a couple of sentences a human would say.
 *
 * Thresholds are the UK FSA front-of-pack bands, which are per 100 g and
 * about as neutral a reference as exists. The wording matters as much as the
 * maths: nothing in here calls a food bad, nothing says "avoid", and none of
 * it is coloured red. A packet is information, not a verdict on the person
 * holding it.
 */
export function readLabel(item) {
  if (!item) return []
  const out = []

  if (item.sugars > 22.5)
    out.push({ good: false, text: `High in sugar at ${item.sugars} g per 100 g. Worth knowing, not worth worrying about.` })
  else if (item.sugars > 5)
    out.push({ good: false, text: `Middling on sugar: ${item.sugars} g per 100 g.` })
  else out.push({ good: true, text: 'Barely any sugar in it.' })

  if (item.satFat > 5)
    out.push({ good: false, text: `Rich in saturated fat, ${item.satFat} g per 100 g.` })
  if (item.salt > 1.5)
    out.push({ good: false, text: `Salty: ${item.salt} g of salt per 100 g.` })

  if (item.fibre >= 6)
    out.push({ good: true, text: `${item.fibre} g of fibre per 100 g, which is a lot. Most of us are short on it.` })
  else if (item.fibre >= 3)
    out.push({ good: true, text: `A decent source of fibre at ${item.fibre} g per 100 g.` })

  if (item.protein >= 20)
    out.push({ good: true, text: `${item.protein} g of protein per 100 g, plenty for its size.` })
  else if (item.protein >= 12)
    out.push({ good: true, text: `A solid ${item.protein} g of protein per 100 g.` })

  if (out.length === 1 && out[0].good)
    out.push({ good: true, text: 'Nothing else here stands out either way. It’s just food.' })

  return out
}
