/*
 * Neha, the companion. Talks to Groq's OpenAI-compatible chat endpoint
 * straight from the browser - no backend of ours in the middle. Groq sends
 * CORS headers, which is the only reason a browser can call it directly.
 *
 * Missing key, dead network or a rate limit all degrade to a written
 * fallback rather than throwing. The demo shouldn't break on someone
 * else's server.
 */

const CHAT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const MODELS_ENDPOINT = 'https://api.groq.com/openai/v1/models'
const KEY = import.meta.env.VITE_GROQ_API_KEY
const PINNED = (import.meta.env.VITE_GROQ_MODEL || '').trim()

export const hasKey = Boolean(KEY && KEY.length > 10)

/* --- WHICH MODEL ---
 *
 * This file used to name one model: `llama-3.1-8b-instant`, hard-coded. The
 * day Groq decommissioned that id, Neha stopped working - the POST came back
 * `404 {"error":{"message":"The model ... does not exist or you do not have
 * access to it."}}`, askNeha swallowed it into the written fallback exactly as
 * designed, and the only sign anything was wrong was one grey line under the
 * composer. Every reply was still kind and on-brand, which is precisely what
 * made it hard to spot.
 *
 * Hard-coding a newer id would just reset the same clock, and providers retire
 * models faster than a hackathon project gets updated. So the model is
 * *discovered* instead:
 *
 *   1. VITE_GROQ_MODEL, if it is set. An explicit choice always wins.
 *   2. Otherwise ask Groq what this key can actually use - GET /openai/v1/models
 *      - and rank the answer. Asked once per page load, not once per message.
 *   3. If that request cannot be made at all, fall back to the list below.
 *   4. And if a chat call ever does come back "no such model", cross that id
 *      off and try the next one down the ranking.
 *
 * The point of step 4 is that no single retirement can ever mute her again: it
 * costs one wasted request, not a broken demo.
 */

/*
 * Only reached when /models itself is unavailable - offline, or a key so
 * broken it can't even list. Current as of August 2026, mixed across
 * families and sizes since the failure we're guarding against is "these
 * specific ids are gone".
 */
const KNOWN_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'gemma2-9b-it',
  'llama3-8b-8192',
]

/** Groq's catalogue also holds speech, safety and embedding models. */
const NOT_CHAT = /whisper|tts|embed|guard|moderat|rerank|ocr|transcrib/i

/**
 * Rank the usable ids for *this* job, which is 2-4 warm sentences, fast.
 *
 * The biggest model is the wrong answer here. Neha has to feel like someone
 * replying, so latency is a product feature, and a small instruct model writes
 * a kind three-line reply just as well as a 70B one. Reasoning models are
 * actively bad for this: they spend tokens thinking before they speak.
 */
function score(id) {
  const s = id.toLowerCase()
  let n = 0
  if (s.includes('instant')) n += 60 // Groq's own name for the fast tier
  if (/(^|[^0-9])([789]|1[02])b/.test(s)) n += 25 // small: 7b/8b/9b/10b/12b
  if (s.includes('versatile')) n += 18
  if (s.includes('llama')) n += 12
  if (s.includes('gemma')) n += 6
  if (/70b|120b|405b/.test(s)) n -= 10 // capable, slower than a chat needs
  if (/r1|think|reason|compound/.test(s)) n -= 40 // narrates its own thoughts
  if (/preview|beta|deprecat/.test(s)) n -= 15 // previews are what get retired
  return n
}

/** Resolved id, the in-flight /models promise, and anything found to be gone. */
let picked = null
let listing = null
const retired = new Set()

async function fetchModelIds() {
  const res = await fetch(MODELS_ENDPOINT, {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) throw new Error(`models ${res.status}`)
  const data = await res.json()
  return (data?.data || [])
    .filter((m) => m?.id && m.active !== false && !NOT_CHAT.test(m.id))
    .map((m) => m.id)
}

async function candidates() {
  // Cache the promise, not the result: ten quick messages must not become ten
  // catalogue requests, and the second message must not race the first.
  if (!listing) listing = fetchModelIds().catch(() => null)
  const live = await listing
  const ids = live && live.length ? live : KNOWN_MODELS
  return [...ids].sort((a, b) => score(b) - score(a))
}

async function nextModel() {
  if (PINNED && !retired.has(PINNED)) return PINNED
  if (picked && !retired.has(picked)) return picked
  const ranked = await candidates()
  picked = ranked.find((id) => !retired.has(id)) || null
  return picked
}

/**
 * Ask for the catalogue before the first message is typed, so the reply is not
 * slowed down by a round trip nobody asked for. Safe to call repeatedly.
 */
export function warmModel() {
  if (hasKey) nextModel().catch(() => {})
}

/**
 * Is this failure "that model is gone" rather than "your key is wrong"?
 *
 * Worth being precise about: retrying on a 401 walks the whole catalogue
 * failing identically, and retrying on a 429 makes a rate limit worse.
 */
function modelGone(status, body) {
  if (status === 404) return true
  if (status !== 400 && status !== 403) return false
  return /model_not_found|does not exist|decommission|deprecat|no longer (available|supported)/i.test(
    body
  )
}

export const TONES = [
  { id: 'warm', label: 'Warm & practical', note: 'Kind, but gives you a next step' },
  { id: 'grounding', label: 'Quiet & grounding', note: 'Slower, calmer, fewer words' },
  { id: 'playful', label: 'Bright & playful', note: 'Light, a bit cheeky, never pushy' },
]

const TONE_RULES = {
  warm:
    'Warm and practical. Kind first, then one concrete, small next step. Plain language.',
  grounding:
    'Quiet and grounding. Short sentences, unhurried, more space than advice. Never chirpy.',
  playful:
    'Bright and playful. Light humour, a bit of cheek, still genuinely kind. Never sarcastic about the user.',
}

function buildSystemPrompt({ tone, ctx }) {
  return [
    'You’re Neha, the companion inside a fitness app called FitFlow.',
    'The people you talk to are beginners and people who have quit other fitness apps because those apps made them feel bad.',
    '',
    'Hard rules, never break these:',
    '- Never guilt, shame, scold or nag. Not even gently, not even as a joke.',
    '- Never mention streaks, broken streaks, or days in a row. The product has no streaks by design.',
    '- Never imply the user is behind, lazy, or has fallen off.',
    '- If they missed days, treat re-entry as completely normal and offer one very small option (a ten minute walk, or just logging a meal).',
    '- Don’t give medical, injury, or diagnostic advice. Suggest a doctor or physio for pain, and move on warmly.',
    '- No calorie policing. Don’t tell anyone to eat less.',
    '',
    'Style: ' + (TONE_RULES[tone] || TONE_RULES.warm),
    'Length: 2 to 4 short sentences. Conversational. No bullet points, no headings, no emoji unless they use one first.',
    '',
    'What you can see right now about this person:',
    '- Name: ' + (ctx.name || 'not given yet'),
    '- Energy they logged today: ' + ctx.energy,
    '- Water so far: ' + ctx.waterMl + ' ml of a ' + ctx.goalMl + ' ml goal',
    '- Movement logged today: ' + (ctx.movedToday ? 'yes' : 'not yet'),
    '- Days in the last week with no movement logged: ' + ctx.missedDays,
    ctx.weather ? '- Weather where they are: ' + ctx.weather : '- Weather: unknown',
    'Use this only if it’s relevant. Don’t read their stats back at them like a report.',
    'If the weather makes an outdoor suggestion a bad idea, suggest something indoors instead without making a fuss about it.',
  ].join('\n')
}

/** Written replies used when the API is unavailable. Never a dead end. */
function fallbackReply(text, ctx) {
  const t = (text || '').toLowerCase()
  const name = ctx.name ? ', ' + ctx.name : ''
  if (/tired|exhaust|drained|no energy|sleepy/.test(t))
    return `Tired is real information, not an excuse${name}. Today might just be a water-and-a-short-walk day, and that still counts. What sounds doable right now?`
  if (/miss|skip|hav(en|e not)|behind|fell off|quit/.test(t))
    return `Nothing to make up for - you can just pick it back up. Want to start with something small, like ten minutes of walking or logging what you’ve eaten today?`
  if (/start|begin|new|first/.test(t))
    return `Good place to start${name}: open Move, point at whichever movement looks least annoying, and do one round of it. One round is genuinely a first session, and we can build from there whenever you feel like it.`
  if (/water|drink|hydrat/.test(t))
    return `You’re at ${ctx.waterMl} ml today. One glass now would move that along nicely - the hydration page logs it in a tap.`
  if (/sore|pain|hurt|injur/.test(t))
    return `If something actually hurts rather than just aches, please get it looked at by a doctor or physio - I’m not the right one for that. In the meantime, resting it is a completely valid choice.`
  if (/thank|thanks|nice|love/.test(t))
    return `Any time. I’m here whenever you want to talk it through.`
  return `I hear you${name}. Tell me a bit more about how today is going, and we can figure out the smallest useful next thing together.`
}

/**
 * One attempt, at one named model.
 *
 * Returns a verdict rather than throwing, because the caller needs to tell
 * "try the next model" apart from "give up and answer from the written
 * replies", and an exception cannot carry that distinction cleanly.
 */
async function post({ model, messages }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.85,
        max_tokens: 220,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      const retry = modelGone(res.status, detail)
      return {
        ok: false,
        retry,
        reason: retry
          ? `${model} is no longer available, trying another`
          : `Groq responded ${res.status}. ${detail.slice(0, 120)}`,
      }
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    if (!text) return { ok: false, retry: false, reason: 'Empty response from model' }
    // Groq echoes the model that served the request; prefer its answer over our
    // assumption, since an alias can resolve to something else.
    return { ok: true, text, model: data.model || model }
  } catch (err) {
    return {
      ok: false,
      retry: false,
      reason: err.name === 'AbortError' ? 'Request timed out' : err.message,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {{history: Array<{role:string,text:string}>, userText: string, tone: string, ctx: object}} args
 * @returns {Promise<{text:string, source:'groq'|'fallback', model?:string, reason?:string}>}
 */
export async function askNeha({ history = [], userText, tone = 'warm', ctx = {} }) {
  if (!hasKey) {
    return { text: fallbackReply(userText, ctx), source: 'fallback', reason: 'No API key set' }
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt({ tone, ctx }) },
    ...history.slice(-8).map((m) => ({
      role: m.role === 'neha' ? 'assistant' : 'user',
      content: m.text,
    })),
    { role: 'user', content: userText },
  ]

  let reason = 'Couldn’t reach the model'

  /* Three attempts at most, each on a different model. Bounded deliberately:
     a genuinely wrong key returns the same error for every id in the
     catalogue, and walking all of them would turn one typo into a thirty
     second wait. Three is enough to survive a retirement or two. */
  for (let attempt = 0; attempt < 3; attempt++) {
    const model = await nextModel()
    if (!model) {
      reason = 'No usable model found for this key'
      break
    }

    const out = await post({ model, messages })
    if (out.ok) return { text: out.text, source: 'groq', model: out.model }

    reason = out.reason
    if (!out.retry) break
    retired.add(model)
    picked = null
  }

  return { text: fallbackReply(userText, ctx), source: 'fallback', reason }
}

/** First thing Neha says on the dashboard and at the top of the thread. */
export function greeting({ name, energy, missedDays }) {
  const who = name ? name : 'there'
  if (missedDays >= 3)
    return `Hi ${who}. However long it has been, today is a fine place to pick things up again.`
  if (energy === 'bright') return `Hi ${who}. Sounds like there’s some spark today - let's use it.`
  if (energy === 'fullsend') return `Hi ${who}. You came in hot today - let's use it.`
  return `Hi ${who}. Good to see you. What are we doing today?`
}
