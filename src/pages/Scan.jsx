import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ScanLine,
  Camera,
  CameraOff,
  Loader2,
  Plus,
  Check,
  Info,
  ArrowRight,
} from 'lucide-react'
import Page, { riseIn, stagger } from '../components/Page.jsx'
import { useApp } from '../store/AppState.jsx'
import { scanSupport, startScan, cleanCode, isLikelyCode } from '../services/barcode.js'
import { lookupBarcode, readLabel, portion, DEMO_CODES } from '../services/food.js'

/** Pull "15 g" or "330 ml" down to a number we can portion with. */
function servingGrams(item) {
  const n = parseFloat(item?.servingSize || '')
  if (Number.isFinite(n) && n >= 5 && n <= 500) return Math.round(n)
  return 100
}

const Row = ({ label, value, unit, strong }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-2.5 last:border-0">
    <span className={`text-[13.5px] ${strong ? 'text-ink' : 'text-muted'}`}>{label}</span>
    <span
      className={`num text-[14px] ${strong ? 'font-medium' : ''}`}
      style={strong ? { color: 'var(--accent-ink)' } : undefined}
    >
      {value}
      <span className="ml-1 text-[11.5px] text-muted">{unit}</span>
    </span>
  </div>
)

/*
 * Label scanner.
 *
 * Two decoders behind this (see services/barcode.js): the native Barcode
 * Detection API where it exists, our own EAN-13 reader in services/ean.js
 * everywhere else. That "everywhere else" includes Chrome and Edge on
 * Windows, where the native one is just missing. No npm dep on either path.
 *
 * Lookup is Open Food Facts, no key needed. The typed field is on screen
 * from the start rather than appearing after a failure - on a laptop,
 * reading the digits off the box is often faster than aiming a webcam.
 */
export default function Scan() {
  const { dispatch, dur } = useApp()
  const videoRef = useRef(null)
  const stopRef = useRef(null)

  const support = useMemo(() => scanSupport(), [])
  const [live, setLive] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [item, setItem] = useState(null)
  const [source, setSource] = useState('openfoodfacts')
  const [grams, setGrams] = useState(100)
  const [added, setAdded] = useState(false)
  /* Frames examined and the resolution the camera actually agreed to. Both are
     on screen while scanning, because a live picture and nothing else gives you
     no way to tell "looking and not finding" from "not looking" - and those two
     have completely different fixes. A camera stuck at 640x480 will never read
     a barcode, and this is where you find that out. */
  const [status, setStatus] = useState(null)

  // A camera left running because somebody clicked away is the single worst
  // bug this page could have. One cleanup, covers unmount and navigation.
  useEffect(() => () => stopRef.current?.(), [])

  const look = async (raw) => {
    const code = cleanCode(raw)
    if (!isLikelyCode(code)) {
      setErr('A barcode is 8, 12 or 13 digits. Worth a re-count?')
      setItem(null)
      return
    }
    setBusy(true)
    setErr('')
    setAdded(false)
    const res = await lookupBarcode(code)
    setBusy(false)
    if (!res.item) {
      setItem(null)
      setErr(res.reason || 'Nothing came back for that one.')
      return
    }
    setItem(res.item)
    setSource(res.source)
    setGrams(servingGrams(res.item))
  }

  const start = async () => {
    setErr('')
    setStatus(null)
    setLive(true)
    stopRef.current = await startScan({
      video: videoRef.current,
      onFound: (code) => {
        setLive(false)
        setTyped(code)
        look(code)
      },
      onStatus: setStatus,
      onError: (msg) => {
        setErr(msg)
        setLive(false)
      },
    })
  }

  const stop = () => {
    stopRef.current?.()
    setLive(false)
  }

  /* Roughly eight seconds of looking with nothing to show for it. Almost always
     the same cause - the packet is too far away for the bars to resolve - so say
     that, rather than leaving somebody to keep doing the thing that is not
     working. 140ms a frame, so 55 frames is about eight seconds. */
  const struggling = live && (status?.frames || 0) > 55
  const lowRes =
    status?.size && Number(String(status.size).split('×')[0] || 0) < 1000

  const portions = useMemo(() => {
    const base = [servingGrams(item), 30, 50, 100, 150]
    return [...new Set(base.filter((g) => g > 0))].sort((a, b) => a - b)
  }, [item])

  const notes = useMemo(() => readLabel(item), [item])

  return (
    <Page>
      <div className="max-w-[64ch]">
        <p className="eyebrow">Scan a label</p>
        <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
          Point the camera at a packet.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          The barcode goes to Open Food Facts (three million products,
          crowd-sourced, no account and no key) and comes back as the numbers
          that are actually on the back of the box. Add it to today in one tap,
          or just read it and put the box down.
        </p>
      </div>

      <div className="mt-9 grid gap-6 lg:grid-cols-2">
        {/* --- Camera and the number --- */}
        <div className="glass flex flex-col p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">The barcode</p>
              <h2 className="mt-2 font-display text-[22px] leading-tight">
                Camera, or type it in
              </h2>
            </div>
            <span className="pill" title={
              support.ok
                ? support.native
                  ? "Your browser's own decoder"
                  : "FitFlow's own EAN-13 reader, running in this tab"
                : support.reason
            }>
              <ScanLine size={13} />
              {support.ok
                ? support.native
                  ? 'Browser decoder'
                  : 'Built-in decoder'
                : 'Typed entry'}
            </span>
          </div>

          {/* The video is always mounted, hidden when idle. Rendering it only
              while scanning means the ref is still null the instant the
              button is clicked, and the stream has nowhere to go. */}
          <div
            className="relative mt-6 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/[0.08]"
            style={{ background: 'linear-gradient(180deg,#04100B,#020806)' }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
              style={{ opacity: live ? 1 : 0 }}
            />

            {live ? (
              <>
                {/* Reticle. Four brackets rather than a full box: the bars do
                    not have to be squared up, they just have to cross the
                    middle of the frame, and a full box reads as "line this up
                    exactly" when the decoder also reads it upside down. */}
                <div className="pointer-events-none absolute inset-[14%]">
                  {[
                    'left-0 top-0 border-l-2 border-t-2 rounded-tl-lg',
                    'right-0 top-0 border-r-2 border-t-2 rounded-tr-lg',
                    'left-0 bottom-0 border-l-2 border-b-2 rounded-bl-lg',
                    'right-0 bottom-0 border-r-2 border-b-2 rounded-br-lg',
                  ].map((c) => (
                    <span
                      key={c}
                      className={`absolute h-9 w-9 ${c}`}
                      style={{ borderColor: 'var(--accent)' }}
                    />
                  ))}
                  <span
                    className="animate-scanline absolute left-0 right-0 top-1/2 h-[2px]"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, var(--accent), transparent)',
                      boxShadow: '0 0 14px rgba(var(--accent-rgb),.9)',
                    }}
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-black/55 px-4 py-2.5 text-center backdrop-blur-sm">
                  <p className="text-[12.5px] leading-snug text-ink/80">
                    {struggling
                      ? 'Still looking. Bring it closer (the bars want to fill about a third of the width) and give the camera a second to focus.'
                      : support.native
                        ? "Hold it steady, about a hand's width away."
                        : 'Fill the bracket with the barcode and hold steady. Closer is better than further.'}
                  </p>
                  {/* Proof of life. Without this the page is a live video feed
                      and nothing else, and "the camera isn't searching the
                      barcode" is the only conclusion available - there is no
                      way to tell looking-and-not-finding from not-looking, and
                      the two have completely different fixes. The resolution is
                      here for the same reason: a webcam that came back at
                      640x480 cannot resolve an EAN-13 at any sane distance, and
                      that is worth knowing rather than guessing at. */}
                  <p className="num mt-1 text-[11px] text-ink/45">
                    {status
                      ? `${status.frames} frame${status.frames === 1 ? '' : 's'} checked · ${status.size}`
                      : 'waking the camera up'}
                    {lowRes ? ' · low resolution, hold it very close' : ''}
                  </p>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 grid place-items-center px-8 text-center">
                <div>
                  <div
                    className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
                    style={{
                      background: 'rgba(var(--accent-rgb),.14)',
                      color: 'var(--accent-ink)',
                    }}
                  >
                    <Camera size={22} />
                  </div>
                  <p className="mt-4 text-[14px] text-muted">
                    {support.ok
                      ? 'The camera stops itself the moment it reads a code.'
                      : support.reason}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {live ? (
              <button onClick={stop} className="btn-ghost">
                <CameraOff size={16} />
                Stop the camera
              </button>
            ) : (
              <button onClick={start} disabled={!support.ok} className="btn-primary">
                <Camera size={16} />
                Use my camera
              </button>
            )}
          </div>

          {/* Typed entry. Full-size, above the fold, not framed as a fallback. */}
          <div className="mt-7">
            <p className="eyebrow mb-2.5">Or read the number off the packet</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                look(typed)
              }}
              className="flex gap-2.5"
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                inputMode="numeric"
                placeholder="3017620422003"
                aria-label="Barcode number"
                className="field num"
              />
              <button type="submit" disabled={busy} className="btn-primary shrink-0">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
                Look it up
              </button>
            </form>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] text-muted">No packet to hand?</span>
              {DEMO_CODES.map((d) => (
                <button
                  key={d.code}
                  onClick={() => {
                    setTyped(d.code)
                    look(d.code)
                  }}
                  className="rounded-full border border-edge bg-white/[0.05] px-3.5 py-1.5 text-[12.5px] text-muted transition hover:bg-white/[0.11] hover:text-ink"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* --- What came back --- */}
        <div className="glass flex min-h-[520px] flex-col p-8">
          <AnimatePresence mode="wait">
            {busy ? (
              <motion.div
                key="busy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid flex-1 place-items-center"
              >
                <div className="text-center">
                  <Loader2
                    size={26}
                    className="mx-auto animate-spin"
                    style={{ color: 'var(--accent-ink)' }}
                  />
                  <p className="mt-4 text-[14px] text-muted">Reading the label…</p>
                </div>
              </motion.div>
            ) : err ? (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid flex-1 place-items-center"
              >
                <div className="max-w-[42ch] text-center">
                  <Info size={22} className="mx-auto text-muted" />
                  <p className="mt-4 text-[14.5px] leading-relaxed text-ink/85">{err}</p>
                  <Link to="/food" className="btn-ghost mt-6">
                    Add it by name instead
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </motion.div>
            ) : !item ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid flex-1 place-items-center"
              >
                <div className="max-w-[40ch] text-center">
                  <p className="text-[15px] leading-relaxed text-muted">
                    Nothing scanned yet. What comes back is the panel per 100 g,
                    in plain language.
                  </p>
                  <p className="mt-4 text-[13px] leading-relaxed text-muted/80">
                    You won’t see a letter grade here. Open Food Facts
                    publishes one and we leave it out on purpose: numbers
                    inform, grades judge.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: dur(0.3), ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col"
              >
                <div className="flex items-start gap-4">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.06] object-contain p-1"
                    />
                  ) : (
                    <div
                      className="grid h-16 w-16 shrink-0 place-items-center rounded-xl"
                      style={{
                        background: 'rgba(var(--accent-rgb),.14)',
                        color: 'var(--accent-ink)',
                      }}
                    >
                      <ScanLine size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="font-display text-[22px] leading-tight">{item.name}</h2>
                    <p className="mt-1 text-[13px] text-muted">
                      {item.brand}
                      {item.quantity ? ` · ${item.quantity}` : ''}
                    </p>
                    <span className="pill mt-2.5">
                      {source === 'offline' ? 'Offline copy' : 'Open Food Facts'}
                    </span>
                  </div>
                </div>

                {/* Per 100 g, always, and labelled as such. A packet that says
                    "per serving" is how people accidentally eat three of them. */}
                <p className="eyebrow mt-7">Per 100 g</p>
                <div className="mt-2">
                  <Row label="Energy" value={item.kcal} unit="kcal" strong />
                  <Row label="Protein" value={item.protein} unit="g" />
                  <Row label="Carbohydrate" value={item.carbs} unit="g" />
                  <Row label="of which sugars" value={item.sugars} unit="g" />
                  <Row label="Fat" value={item.fat} unit="g" />
                  <Row label="of which saturates" value={item.satFat} unit="g" />
                  <Row label="Fibre" value={item.fibre} unit="g" />
                  <Row label="Salt" value={item.salt} unit="g" />
                </div>

                {notes.length > 0 && (
                  <motion.ul
                    variants={stagger}
                    initial="hidden"
                    animate="show"
                    className="mt-5 space-y-2"
                  >
                    {notes.map((n) => (
                      <motion.li
                        key={n.text}
                        variants={riseIn}
                        className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted"
                      >
                        {/* Colour marks what is worth knowing, never what is
                            "bad" - nothing on this page is printed in red. */}
                        <span
                          className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: n.good
                              ? 'var(--accent)'
                              : 'rgba(255,255,255,.28)',
                          }}
                        />
                        {n.text}
                      </motion.li>
                    ))}
                  </motion.ul>
                )}

                <div className="mt-auto pt-7">
                  <p className="eyebrow mb-2.5">
                    How much did you have?
                    {item.servingSize ? ` Pack says ${item.servingSize}.` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {portions.map((g) => {
                      const on = g === grams
                      return (
                        <button
                          key={g}
                          onClick={() => setGrams(g)}
                          aria-pressed={on}
                          className={`num rounded-full border px-4 py-2 text-[13px] transition ${
                            on
                              ? 'border-transparent font-medium'
                              : 'border-edge bg-white/[0.05] text-muted hover:bg-white/[0.11] hover:text-ink'
                          }`}
                          style={
                            on
                              ? {
                                  background: 'rgba(var(--accent-rgb),.16)',
                                  color: 'var(--accent-ink)',
                                  borderColor: 'var(--accent)',
                                }
                              : undefined
                          }
                        >
                          {g} g
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => {
                        dispatch({ type: 'addFood', food: portion(item, grams) })
                        setAdded(true)
                      }}
                      className="btn-primary"
                    >
                      {added ? <Check size={16} /> : <Plus size={16} />}
                      {added ? 'On today’s plate' : `Add ${grams} g to today`}
                    </button>
                    <span className="num text-[13px] text-muted">
                      {Math.round((item.kcal * grams) / 100)} kcal ·{' '}
                      {Math.round((item.protein * grams) / 100)} g protein
                    </span>
                  </div>
                  {added && (
                    <Link
                      to="/food"
                      className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted transition hover:text-ink"
                    >
                      See today's plate
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className="mt-7 max-w-[78ch] text-[13.5px] leading-relaxed text-muted">
        Open Food Facts is edited by volunteers, so a barcode can be missing or
        a number can be wrong, so if something looks off it probably is, and the
        packet in your hand wins. None of this is medical advice, and nothing
        here is a reason to put food back on the shelf.
      </p>
    </Page>
  )
}
