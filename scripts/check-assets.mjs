/**
 * Checks that the Lottie files listed in ASSETS.json are actually sitting in
 * public/lottie with the exact filenames the app requests.
 *
 * Run it with:  npm run assets
 *
 * Catches the three things that always go wrong: a space left in the
 * filename, a .lottie file instead of .json, and Windows hiding a trailing
 * .txt extension.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'public/lottie'
const manifest = JSON.parse(readFileSync('ASSETS.json', 'utf8'))
const wanted = manifest.lottie.files

if (!existsSync(DIR)) {
  console.log(`\n  The folder ${DIR} does not exist. Create it and put your .json files there.\n`)
  process.exit(1)
}

const present = readdirSync(DIR)
const lower = new Map(present.map((f) => [f.toLowerCase(), f]))

const rows = []
let missingRequired = 0

for (const f of wanted) {
  const exact = present.includes(f.file)
  const loose = lower.get(f.file.toLowerCase())
  let state
  let note = ''

  if (exact) {
    const bytes = statSync(join(DIR, f.file)).size
    let valid = true
    try {
      const json = JSON.parse(readFileSync(join(DIR, f.file), 'utf8'))
      valid = Boolean(json && (json.layers || json.assets))
    } catch {
      valid = false
    }
    if (!valid) {
      state = 'BROKEN'
      note = 'file is not readable Lottie JSON - it may be a .lottie renamed to .json'
    } else {
      state = 'ok'
      note = `${Math.round(bytes / 1024)} KB`
    }
  } else if (loose) {
    state = 'RENAME'
    note = `found "${loose}" - rename it to "${f.file}"`
  } else {
    state = f.required ? 'MISSING' : 'optional'
    note = f.required ? `search LottieFiles for: ${f.search}` : 'not required'
    if (f.required) missingRequired++
  }

  rows.push({ state, file: f.file, note })
}

const width = Math.max(...wanted.map((f) => f.file.length))
console.log('')
for (const r of rows) {
  console.log(`  ${r.state.padEnd(9)} ${r.file.padEnd(width)}  ${r.note}`)
}

// Anything in the folder the app will never ask for.
const known = new Set(wanted.map((f) => f.file))
const stray = present.filter((f) => !known.has(f) && f !== 'PUT_YOUR_LOTTIE_FILES_HERE.txt')
if (stray.length) {
  console.log(`\n  Not used by the app: ${stray.join(', ')}`)
}

const required = wanted.filter((f) => f.required).length
console.log(
  missingRequired
    ? `\n  ${missingRequired} of ${required} required animation(s) still missing. The app runs anyway - each one falls back to a soft pulsing shape.\n`
    : `\n  All ${required} required animations are in place.\n`
)
