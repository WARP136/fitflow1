/*
 * Accounts. No server, and we're not adding one for a hackathon - but two
 * people sharing a laptop were sharing one weight log, which is worse than
 * having no login at all.
 *
 * A list of people in localStorage under `fitflow.accounts`, one app-data
 * blob each under `fitflow.v2::<id>`. Signing in means "show me that
 * person's blob". Nothing is transmitted and there's no password reset,
 * because there's nobody to ask.
 *
 * This is NOT a security boundary and the sign-in copy says so. Anyone with
 * dev tools can read every account straight out of localStorage. The password
 * stops your flatmate clicking into your log; it doesn't stop an attacker
 * who has the machine.
 *
 * The password itself is never stored either way: 16 random salt bytes and
 * PBKDF2-SHA256 at 120k iterations through WebCrypto, derived bytes only.
 * People reuse passwords and that part costs nothing to do properly.
 *
 * http caveat, which will come up at the demo: crypto.subtle only exists in
 * a secure context (localhost, https). Hit the dev server over the LAN at
 * http://192.168.x.x:5173 and it's absent. We fall back to a clearly
 * labelled non-crypto scramble and record `algo` on the account so the two
 * can't be confused. Accounts made under real crypto refuse to unlock
 * without it rather than failing mysteriously; weak ones get upgraded to
 * PBKDF2 the first time you sign in somewhere that has it.
 */

const BOOK_KEY = 'fitflow.accounts'
const BOOK_VERSION = 1

/** App data lived here before accounts existed, and still does for account #1. */
const DATA_BASE = 'fitflow.v2'
export const LEGACY_DATA_KEY = DATA_BASE

/** Where one account's app data is kept. No id (no accounts yet) = the old key. */
export const dataKeyFor = (id) => (id ? `${DATA_BASE}::${id}` : DATA_BASE)

export const PBKDF2_ROUNDS = 120000
export const STRONG = 'pbkdf2-sha256'
export const WEAK = 'scrambled-v1'
export const MIN_PASSWORD = 4
export const MAX_NAME = 24

const enc = new TextEncoder()
const web = () => globalThis.crypto

/** True only where WebCrypto is actually reachable: localhost, or https. */
export function hasRealCrypto() {
  const c = web()
  return !!(c && c.subtle && typeof c.subtle.deriveBits === 'function')
}

const norm = (s) => String(s || '').trim().toLowerCase()

const toHex = (bytes) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

const fromHex = (hex) => {
  const out = new Uint8Array(Math.floor(hex.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/**
 * Random bytes. getRandomValues is available even in an insecure context -
 * it is only `subtle` that disappears - so this stays a real CSPRNG on a LAN
 * address even when the hashing has had to fall back.
 */
function randomHex(n) {
  const c = web()
  const bytes = new Uint8Array(n)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256)
  return toHex(bytes)
}

/** The real thing: PBKDF2-SHA256, 120k iterations, 256 bits out. */
async function strongHash(password, saltHex) {
  const key = await web().subtle.importKey(
    'raw',
    enc.encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await web().subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
    key,
    256
  )
  return toHex(new Uint8Array(bits))
}

/*
 * Fallback for a plain-http LAN address with no `crypto.subtle`. Two 32-bit
 * FNV-style mixers over salt + password, 4096 passes.
 *
 * Deliberately never called a hash in the UI: 64 bits of state is
 * brute-forceable and this isn't a password-hashing construction. It exists so
 * the login still works on a phone at a demo, it's labelled 'scrambled-v1' on
 * the account record, and the sign-in page says when you're getting it. The one
 * thing it honestly achieves is that the password isn't sitting in localStorage
 * in plain text.
 */
function weakHash(password, saltHex) {
  const s = `${saltHex}\u0000${String(password)}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let r = 0; r < 4096; r++) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      h1 = (Math.imul(h1 ^ c, 16777619) + r) >>> 0
      h2 = (Math.imul(h2 + c, 2246822519) ^ (h1 >>> 13)) >>> 0
    }
  }
  return `weak.${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

async function hashFor(password, salt) {
  return hasRealCrypto()
    ? { hash: await strongHash(password, salt), algo: STRONG }
    : { hash: weakHash(password, salt), algo: WEAK }
}

/**
 * Compare without an early exit, so the loop's duration does not depend on
 * how many leading characters matched. The length comparison does leak the
 * length, which for a fixed-width hex digest is not a secret.
 */
function sameDigest(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const EMPTY = { version: BOOK_VERSION, users: [], activeId: null }

const wellFormed = (u) =>
  u &&
  typeof u === 'object' &&
  typeof u.id === 'string' &&
  typeof u.name === 'string' &&
  typeof u.salt === 'string' &&
  typeof u.hash === 'string'

/** Never hand the rest of the app a salt or a digest it has no use for. */
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  createdAt: u.createdAt || null,
  algo: u.algo === STRONG ? STRONG : WEAK,
})

/** Read the account list, defensively. A corrupt book reads as no accounts. */
export function readBook() {
  try {
    const raw = localStorage.getItem(BOOK_KEY)
    if (!raw) return { ...EMPTY }
    const b = JSON.parse(raw)
    const users = (Array.isArray(b?.users) ? b.users : []).filter(wellFormed)
    const activeId = users.some((u) => u.id === b?.activeId) ? b.activeId : null
    return { version: BOOK_VERSION, users, activeId }
  } catch {
    return { ...EMPTY }
  }
}

function writeBook(book) {
  try {
    localStorage.setItem(BOOK_KEY, JSON.stringify({ ...book, version: BOOK_VERSION }))
    return true
  } catch {
    return false // private browsing, or the quota is full
  }
}

export function listUsers() {
  return readBook().users.map(publicUser)
}

export function activeUser() {
  const book = readBook()
  const u = book.users.find((x) => x.id === book.activeId)
  return u ? publicUser(u) : null
}

export function setActive(id) {
  const book = readBook()
  if (!book.users.some((u) => u.id === id)) return false
  return writeBook({ ...book, activeId: id })
}

export function clearActive() {
  return writeBook({ ...readBook(), activeId: null })
}

/**
 * Move a pre-accounts save into the first account created.
 *
 * Without this, the moment accounts landed everybody's existing weight log and
 * archived week became unreachable - technically still on disk under the old
 * key, which is no comfort. Copied rather than moved, because a copy that turns
 * out to be wrong is recoverable and a move is not.
 */
function adoptLegacyData(id) {
  try {
    const old = localStorage.getItem(LEGACY_DATA_KEY)
    if (!old) return false
    const target = dataKeyFor(id)
    if (localStorage.getItem(target)) return false
    localStorage.setItem(target, old)
    return true
  } catch {
    return false
  }
}

const newId = () => `u${Date.now().toString(36)}${randomHex(4)}`

/**
 * Create an account and sign into it.
 * @returns {Promise<{ok:true,user:object,adopted:boolean}|{ok:false,error:string}>}
 */
export async function createAccount(rawName, password) {
  const name = String(rawName || '').trim()
  const pass = String(password || '')

  if (!name)
    return { ok: false, error: 'Pick a name first - anything you’ll recognise next time.' }
  if (name.length > MAX_NAME)
    return { ok: false, error: `That’s longer than ${MAX_NAME} characters. Something shorter is kinder to type.` }
  if (pass.length < MIN_PASSWORD)
    return {
      ok: false,
      error: `A password of at least ${MIN_PASSWORD} characters. It never leaves this browser, so it doesn’t need to be clever.`,
    }

  const book = readBook()
  if (book.users.some((u) => norm(u.name) === norm(name)))
    return {
      ok: false,
      error: `There’s already an account called ${name} in this browser. Sign in to it, or pick another name.`,
    }

  const salt = randomHex(16)
  const { hash, algo } = await hashFor(pass, salt)
  const user = { id: newId(), name, salt, hash, algo, createdAt: new Date().toISOString() }
  const firstEver = book.users.length === 0

  if (!writeBook({ ...book, users: [...book.users, user], activeId: user.id }))
    return {
      ok: false,
      error: 'This browser wouldn’t let anything be saved. A private window usually causes that.',
    }

  return { ok: true, user: publicUser(user), adopted: firstEver ? adoptLegacyData(user.id) : false }
}

/**
 * Check a name and password, and sign in on success.
 * @returns {Promise<{ok:true,user:object,upgraded:boolean}|{ok:false,error:string}>}
 */
export async function authenticate(rawName, password) {
  const name = String(rawName || '').trim()
  const book = readBook()
  const u = book.users.find((x) => norm(x.name) === norm(name))

  if (!u)
    return {
      ok: false,
      error: `No account called ${name || 'that'} in this browser. Create one - it’s a name and a password.`,
    }

  // An account locked with real crypto cannot be opened where there is none.
  // Saying which address to use beats "wrong password", which would be a lie.
  if (u.algo === STRONG && !hasRealCrypto())
    return {
      ok: false,
      error:
        'This account was locked using your browser’s crypto, which isn’t available on a plain http address. Open FitFlow on localhost or an https link and it will work.',
    }

  const attempt =
    u.algo === STRONG ? await strongHash(password, u.salt) : weakHash(password, u.salt)

  if (!sameDigest(attempt, u.hash))
    return {
      ok: false,
      error: 'That password doesn’t match. Nothing is locked and nothing is counting, so try again.',
    }

  // Signed in on a LAN address once, on localhost now: quietly move the
  // account up to PBKDF2 rather than leaving it on the fallback forever.
  let upgraded = false
  let next = u
  if (u.algo !== STRONG && hasRealCrypto()) {
    const salt = randomHex(16)
    next = { ...u, salt, hash: await strongHash(password, salt), algo: STRONG }
    upgraded = true
  }

  writeBook({
    ...book,
    users: book.users.map((x) => (x.id === u.id ? next : x)),
    activeId: u.id,
  })
  return { ok: true, user: publicUser(next), upgraded }
}

/**
 * Remove an account and its data. There is no undo and no server copy, so the
 * caller is expected to have asked first.
 */
export function forgetAccount(id) {
  const book = readBook()
  if (!book.users.some((u) => u.id === id)) return false
  try {
    localStorage.removeItem(dataKeyFor(id))
  } catch {
    /* nothing sensible to do; the account record still goes */
  }
  return writeBook({
    users: book.users.filter((u) => u.id !== id),
    activeId: book.activeId === id ? null : book.activeId,
  })
}

/** Exported for scripts/verify.mjs, which checks that no password is stored. */
export const __internals = { weakHash, strongHash, sameDigest, BOOK_KEY, publicUser }
