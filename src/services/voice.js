/*
 * Voice. Browser-native via window.speechSynthesis, no API, no key, works
 * offline. Voices come from the OS, so what you get differs between a
 * Windows laptop, a Mac and Chrome on Linux. We ask for an American woman by
 * name and degrade from there - see AMERICAN_WOMEN for why matching on the
 * name is the only option.
 *
 * Same voice reads Neha's replies and coaches the timer and the jog, at a
 * rate that follows the energy choice. One coach script for everything:
 * four lines at fixed fractions of the session.
 */

export const COACH_SCRIPT = {
  start: "Hi there, let's get moving.",
  mid: "Halfway. You're doing fine, keep the rhythm.",
  near: 'Almost done. Stay with it.',
  done: "That's it, you're done. Nice work.",
}

/** Fractions of elapsed time at which each line fires. */
export const CUE_POINTS = [
  { at: 0, key: 'start' },
  { at: 0.5, key: 'mid' },
  { at: 0.85, key: 'near' },
  { at: 1, key: 'done' },
]

export const voiceAvailable = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window

let cachedVoice = null

/**
 * Named American female voices, best first.
 *
 * Windows ships Zira and Hazel; Edge adds the far better "Online (Natural)"
 * voices - Aria, Jenny and Michelle - which are the ones worth demoing.
 * Chrome contributes "Google US English", which is female. macOS has Samantha
 * and Ava. We match on name because the Web Speech API exposes no gender
 * field at all, so a name list is the only reliable way to ask for a woman.
 */
const AMERICAN_WOMEN = [
  'microsoft aria',
  'microsoft jenny',
  'microsoft michelle',
  'microsoft ana',
  'microsoft zira',
  'google us english',
  'samantha',
  'ava',
  'allison',
  'susan',
  'zira',
]

/** Names that are audibly male, so a generic "en-US" fallback never lands on one. */
const MEN = /david|mark|guy|eric|christopher|roger|steffan|alex|fred|daniel|james|george|ravi|prabhat/i

/**
 * Chrome loads the voice list asynchronously, so the first call to
 * getVoices() often returns []. Calling this once on app start warms it.
 */
export function primeVoices() {
  if (!voiceAvailable()) return
  const pick = () => {
    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return

    const us = voices.filter((v) => /^en[-_]US/i.test(v.lang))
    const named = (list) =>
      AMERICAN_WOMEN.reduce(
        (found, want) =>
          found || list.find((v) => v.name.toLowerCase().includes(want)) || null,
        null
      )

    cachedVoice =
      // An American woman by name, US first, then the same names in any locale.
      named(us) ||
      named(voices) ||
      // Any American voice that is not obviously a man.
      us.find((v) => !MEN.test(v.name)) ||
      us[0] ||
      // No US voice installed at all - take any English one and say so.
      voices.find((v) => /^en/i.test(v.lang) && !MEN.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0]
  }
  pick()
  window.speechSynthesis.onvoiceschanged = pick
}

/** Which voice is actually being used, for the UI to state honestly. */
export const currentVoice = () =>
  cachedVoice ? { name: cachedVoice.name, lang: cachedVoice.lang } : null

/**
 * @param {string} text
 * @param {{enabled?:boolean, rate?:number}} opts - rate is scaled by the
 *   user's energy level, so a steady session is coached more slowly than a
 *   full-send one.
 */
export function speak(text, { enabled = true, rate = 1 } = {}) {
  if (!enabled || !voiceAvailable() || !text) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = cachedVoice?.lang || 'en-US'
    if (cachedVoice) u.voice = cachedVoice
    u.rate = Math.min(1.4, Math.max(0.6, rate))
    u.pitch = 1.02
    u.volume = 1
    window.speechSynthesis.speak(u)
  } catch {
    /* speech is a nice-to-have, never break the session over it */
  }
}

export function stopSpeaking() {
  if (voiceAvailable()) window.speechSynthesis.cancel()
}

/**
 * Tidy a chat reply for the speech engine.
 *
 * A language model writes for the eye: asterisks for emphasis, dashes for
 * pauses, the odd bullet. Left alone, speechSynthesis reads "star star" out
 * loud in some browsers and swallows the punctuation in others. This keeps
 * the sentence and drops the typography.
 */
export function forSpeech(text) {
  return String(text || '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s*[–—]\s*/g, ', ') // em/en dash reads better as a comma pause
    .replace(/^\s*[-•]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Neha reading a chat reply aloud.
 *
 * Separate from speak() only because it cancels first: tapping replay on an
 * older line should interrupt the current one, not queue behind it, and
 * queued speech synthesis is how you end up with two Nehas talking over
 * each other for a minute.
 */
export function say(text, { enabled = true, rate = 1 } = {}) {
  if (!enabled) return
  stopSpeaking()
  speak(forSpeech(text), { enabled, rate })
}
