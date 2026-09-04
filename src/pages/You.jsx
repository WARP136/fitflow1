import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Download,
  Upload,
  RotateCcw,
  HardDrive,
  ShieldCheck,
  Check,
  AlertTriangle,
  ArrowRight,
  Laptop,
} from 'lucide-react'
import Page, { riseIn, stagger } from '../components/Page.jsx'
import { useApp, PERSISTED_KEYS } from '../store/AppState.jsx'
import { useAccount } from '../store/Account.jsx'
import Scene from '../three/Scene.jsx'
import Particles from '../three/Particles.jsx'

/*
 * The memory page.
 *
 * "How does the site remember me?" is the first question anybody asks, and a
 * paragraph in a README is a bad answer. This page shows the exact object we
 * save, the key it's under, its size in bytes, and hands you a copy as a file.
 *
 * Nothing here reads localStorage directly. The object is rebuilt from live
 * state via PERSISTED_KEYS: a child's effects run before the provider's
 * storage-mirror effect, so a direct read would be one change behind. Bad
 * bug to have on the page whose whole job is being accurate.
 */

/** One fact, label left, value right. Plain, because this is a data readout. */
function Row({ label, value, muted = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.055] py-2.5 last:border-0">
      <span className="text-[13.5px] text-muted">{label}</span>
      <span
        className={`num text-right text-[13.5px] ${muted ? 'text-muted' : 'text-ink'}`}
      >
        {value}
      </span>
    </div>
  )
}

export default function You() {
  const app = useApp()
  const {
    dispatch,
    name,
    storageKey,
    energyMeta,
    equipment,
    moveGoal,
    goalLiters,
    tone,
    waterLog,
    foods,
    completed,
    jogs,
    weights,
    history,
    messages,
    heightCm,
    age,
  } = app
  const { account } = useAccount()

  const fileRef = useRef(null)
  const [note, setNote] = useState(null) // { ok: boolean, text: string }

  /* The exact object that goes into localStorage, rebuilt from live state. */
  const saved = useMemo(
    () => Object.fromEntries(PERSISTED_KEYS.map((k) => [k, app[k]])),
    [app]
  )
  const json = useMemo(() => JSON.stringify(saved, null, 2), [saved])
  const kb = useMemo(() => (new Blob([json]).size / 1024).toFixed(1), [json])

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `fitflow-${(name || 'you')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'you'}-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoked late on purpose: releasing the URL in the same tick cancels the
    // download in some browsers before they have finished reading from it.
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    setNote({ ok: true, text: 'Saved to your downloads folder.' })
  }

  const importFile = async (file) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('That file doesn’t look like a FitFlow profile.')
      // `restore` runs the same sanitiser as first load, so a hand-edited or
      // truncated file cannot put a string where a page expects an array.
      dispatch({ type: 'restore', state: parsed })
      setNote({
        ok: true,
        text: 'Loaded. Everything in the app now comes from that file.',
      })
    } catch (err) {
      setNote({ ok: false, text: err.message || 'That file couldn’t be read.' })
    }
  }

  const wipe = () => {
    if (
      window.confirm(
        'Empty every log and go back to the welcome page? Your account stays. Export first if you want to keep any of it.'
      )
    )
      dispatch({ type: 'reset' })
  }

  const waterToday = waterLog.reduce((s, w) => s + w.ml, 0)

  return (
    <Page>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] opacity-70">
        <Scene camera={{ position: [0, 0, 6], fov: 55 }} fallback={null}>
          <Particles color={energyMeta.accent} speed={1 / energyMeta.tempo} />
        </Scene>
      </div>

      <div className="max-w-[64ch]">
        <p className="eyebrow">You</p>
        <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
          Everything the app knows{' '}
          <span className="grad-text">is on this page</span>.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          There’s no server. FitFlow remembers you by writing one block of text
          into this browser's own storage, and that block is printed below in
          full, not summarised, not paraphrased. You can take a copy of it, load
          it somewhere else, or delete it.
        </p>
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-9 grid gap-6 lg:grid-cols-[5fr_7fr]"
      >
        {/* Editable details. */}
        <motion.div variants={riseIn} className="glass p-8">
          <p className="eyebrow">Your details</p>
          <h2 className="mt-1.5 font-display text-[22px] leading-tight">
            Change any of it, any time.
          </h2>

          <label className="mt-6 block">
            <span className="eyebrow">What Neha calls you</span>
            <input
              value={name}
              onChange={(e) =>
                dispatch({ type: 'profile', patch: { name: e.target.value } })
              }
              placeholder="Your name"
              aria-label="Your name"
              className="field mt-2.5"
            />
          </label>

          {/* Everything else already has a page where changing it makes sense
              next to the thing it affects. Sending people there beats building
              a second set of controls that can drift out of step. */}
          <p className="eyebrow mt-8">The rest lives where it’s used</p>
          <div className="mt-2.5 space-y-1.5">
            {[
              ['Water goal', `${goalLiters} L a day`, '/water'],
              ['How Neha sounds', tone, '/neha'],
              ['Equipment you have', equipment, '/move'],
              ['Body and food targets', `${heightCm} cm · ${age} years`, '/plan'],
              ['Today’s energy', energyMeta.label, '/today'],
            ].map(([label, value, to]) => (
              <Link
                key={label}
                to={to}
                className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.06]"
              >
                <span className="text-[13.5px] text-muted group-hover:text-ink">
                  {label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[13px]">{value}</span>
                  <ArrowRight
                    size={13}
                    className="text-muted transition group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* What is actually stored, verbatim. */}
        <motion.div variants={riseIn} className="glass p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Kept in this browser</p>
              <h2 className="mt-1.5 font-display text-[22px] leading-tight">
                {kb} KB, under one key.
              </h2>
            </div>
            <span className="pill max-w-full break-all text-left">
              <HardDrive size={13} className="shrink-0" />
              <span className="num">{storageKey}</span>
            </span>
          </div>

          <div className="mt-5">
            <Row
              label="Signed in as"
              value={account ? account.name : 'nobody'}
              muted={!account}
            />
            <Row label="Name" value={name || 'not set'} muted={!name} />
            <Row label="Energy today" value={energyMeta.label} />
            <Row label="Why you came" value={moveGoal} />
            <Row
              label="Water logged today"
              value={`${waterLog.length} × — ${waterToday} ml`}
            />
            <Row label="Food logged today" value={`${foods.length} items`} />
            <Row
              label="Movements finished today"
              value={`${completed.length}`}
            />
            <Row label="Jogs today" value={`${jogs.length}`} />
            <Row label="Weigh-ins, all time" value={`${weights.length}`} />
            <Row label="Days archived" value={`${history.length} of 7`} />
            <Row label="Messages to Neha" value={`${messages.length}`} />
          </div>

          {/* Show, don’t tell. The whole trick of the page. */}
          <details className="group mt-6">
            <summary className="cursor-pointer list-none text-[13px] text-muted underline decoration-edge underline-offset-4 transition hover:text-ink">
              Show the exact text that’s saved
            </summary>
            <pre className="num mt-3 max-h-[240px] overflow-auto rounded-2xl border border-edge/70 bg-black/40 p-4 text-[11.5px] leading-relaxed text-muted no-scrollbar">
              {json}
            </pre>
          </details>
        </motion.div>
      </motion.div>

      {/* The honest explanation. */}
      <section className="glass mt-6 p-8">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={17} className="accent-text" />
          <p className="eyebrow">How the memory actually works</p>
        </div>
        <div className="mt-4 grid gap-7 lg:grid-cols-2">
          <div className="space-y-3.5 text-[14.5px] leading-relaxed text-muted">
            <p>
              Every time anything changes, the whole object above is written into
              this browser's localStorage under the key in that pill. The bit
              after the colons is your account's id, which is the only thing the
              sign-in page buys you: it keeps two people on one laptop from
              writing over each other. That’s the whole persistence layer:
              there’s no database and no sync service, so nothing is ever
              transmitted anywhere.
            </p>
            <p>
              It survives closing the tab, quitting the browser and restarting
              the machine, and it has no expiry date. Opening FitFlow tomorrow
              picks up exactly where you left off, including a rollover that
              files yesterday into your week and hands you a clean day.
            </p>
          </div>
          <div className="space-y-3.5 text-[14.5px] leading-relaxed text-muted">
            <p>
              The honest limits, stated plainly: your password is stored only as
              a salted PBKDF2 digest, but the data itself isn’t encrypted, so
              anybody sitting here with the developer tools open can read any
              account on this browser. There’s also no password reset, because
              there’s nobody to ask. It’s tied to this browser on this machine,
              clearing your browsing data erases it, and private windows forget
              everything on close.
            </p>
            <p>
              Which is exactly why the export button exists. It’s the same
              trade a paper notebook makes, and the file below is how you carry
              the notebook.
            </p>
          </div>
        </div>
      </section>

      {/* Portability. */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[7fr_5fr]">
        <div className="card-grad p-8">
          <div className="flex items-center gap-2.5">
            <Laptop size={17} style={{ color: 'var(--accent-ink)' }} />
            <p className="eyebrow">Take it with you</p>
          </div>
          <h2 className="mt-2.5 font-display text-[23px] leading-tight">
            One file, and it moves.
          </h2>
          <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
            Export writes a plain, readable JSON file. Import replaces
            everything in the app with the contents of one. It’s run through
            the same check as a normal load, so a truncated or hand-edited file
            gets cleaned up rather than crashing a page.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={download} className="btn-primary">
              <Download size={16} />
              Export my profile
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-ghost"
            >
              <Upload size={15} />
              Import from a file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                importFile(e.target.files?.[0])
                // Cleared so choosing the same file twice fires onChange again.
                e.target.value = ''
              }}
            />
          </div>

          {note && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 inline-flex items-start gap-2 text-[13.5px] leading-relaxed"
              style={{ color: note.ok ? 'var(--accent-ink)' : '#FCA5A5' }}
            >
              {note.ok ? (
                <Check size={15} className="mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              )}
              {note.text}
            </motion.p>
          )}
        </div>

        <div className="card-flat">
          <p className="eyebrow">Start over</p>
          <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
            Empties every log, empties the sky and drops you back on the welcome
            page. Your account and its name stay, so you aren’t signed out.
            There’s no undo, so export first if any of it matters.
          </p>
          <button
            onClick={wipe}
            className="btn-ghost mt-5 border-white/[0.12] text-[13.5px]"
          >
            <RotateCcw size={14} />
            Forget everything
          </button>
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            Your sky is rebuilt from these logs rather than stored separately,
            so it comes back intact when you import a file. To remove the account
            itself, sign out and use the × on its name.
          </p>
        </div>
      </section>
    </Page>
  )
}
