import { QUOTES, quoteOfNow } from '../data/quotes.js'

/*
 * Live rotating quote, filtered to protect the product's voice.
 *
 * 1. ZenQuotes sends no CORS headers so a browser fetch to it fails no
 *    matter what. Quotable does, so that's the primary. If both are down we
 *    fall back to the eight lines in data/quotes.js, which isn't a downgrade
 *    - those were written in FitFlow's voice on purpose.
 *
 * 2. Generic motivational quotes are mostly about discipline, pain and not
 *    making excuses, which is the tone this product exists to avoid. Anything
 *    matching BLOCKED gets rejected and we try the next one.
 */

const ENDPOINT = 'https://api.quotable.io/quotes/random?limit=6&maxLength=120'

const BLOCKED = [
  'no excuse', 'excuses', 'pain', 'sweat', 'harder', 'discipline',
  'weak', 'lazy', 'suffer', 'sacrifice', 'grind', 'beast', 'crush',
  'quit', 'failure', 'punish', 'earn it', 'deserve',
]

const clean = (text) => {
  const t = String(text || '').toLowerCase()
  return t.length > 12 && !BLOCKED.some((b) => t.includes(b))
}

export async function getQuote() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)

  try {
    const res = await fetch(ENDPOINT, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`quotable ${res.status}`)
    const json = await res.json()
    const list = Array.isArray(json) ? json : json?.results || []
    const hit = list.find((q) => clean(q?.content))
    if (!hit) throw new Error('nothing passed the tone filter')
    return { text: hit.content, by: hit.author || 'Unknown', source: 'quotable' }
  } catch (err) {
    return { ...quoteOfNow(), source: 'local', reason: err?.message || 'failed' }
  } finally {
    clearTimeout(timer)
  }
}

/** Every local line, for the offline carousel on the weekly wrap. */
export const localQuotes = QUOTES
