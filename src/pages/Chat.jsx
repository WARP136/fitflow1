import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Loader2,
  Sparkles,
  ShieldCheck,
  Volume2,
  VolumeX,
  Play,
} from 'lucide-react'
import Page from '../components/Page.jsx'
import LottieBox from '../components/LottieBox.jsx'
import { useApp } from '../store/AppState.jsx'
import { askNeha, greeting, hasKey, warmModel, TONES } from '../services/neha.js'
import { say, stopSpeaking, voiceAvailable, currentVoice } from '../services/voice.js'
import { useWeather } from '../hooks/useLive.js'

const OPENERS = [
  'I haven’t worked out in weeks',
  'I’m tired but I want to do something',
  'Where do I even start?',
  'I skipped yesterday',
]

export default function Chat() {
  const app = useApp()
  const {
    messages,
    dispatch,
    tone,
    name,
    energy,
    energyMeta,
    waterMl,
    goalMl,
    missedDays,
    movedToday,
    nehaVoice,
    dur,
  } = app

  const weather = useWeather()

  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [lastSource, setLastSource] = useState(null)
  const [model, setModel] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, pending])

  /* Ask Groq which models this key can use while the page is still being read,
     so the first reply is not delayed by a catalogue request. Neha no longer
     names a model in code - see the long note in services/neha.js about the
     morning a decommissioned id turned every reply into a written fallback. */
  useEffect(() => {
    warmModel()
  }, [])

  /* --- Neha's voice ---
     Browser speech synthesis, so no API, no key, and it works on a plane.
     Two rules: it never starts on its own - the toggle is off until asked,
     and the greeting is never spoken - and it stops dead when you leave the
     page. Audio that follows you around a site is the fastest way to make
     somebody close the tab. */
  const canSpeak = voiceAvailable()

  // Slower on a steady day, quicker on full-send. It is the same tempo
  // value that scales every animation, inverted: long tempo, slow voice.
  const rate = Number((1 / (energyMeta?.tempo || 1)).toFixed(2))

  useEffect(() => () => stopSpeaking(), [])

  /* Which OS voice she ended up with. The list arrives asynchronously - on a
     cold start Chrome returns an empty array for the first second or so - so
     poll briefly rather than assume it is ready on the first render. */
  const [voice, setVoice] = useState(currentVoice)
  useEffect(() => {
    if (!canSpeak || voice) return
    let tries = 0
    const id = setInterval(() => {
      const v = currentVoice()
      if (v) setVoice(v)
      if (v || ++tries > 12) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [canSpeak, voice])

  const toggleVoice = () => {
    const on = !nehaVoice
    dispatch({ type: 'nehaVoice', on })
    if (!on) stopSpeaking()
  }

  const send = async (text) => {
    const body = (text ?? draft).trim()
    if (!body || pending) return

    const mine = { id: Date.now(), role: 'user', text: body }
    const thread = [...messages, mine]
    dispatch({ type: 'messages', messages: thread })
    setDraft('')
    setPending(true)

    const { text: reply, source, reason, model: served } = await askNeha({
      history: messages,
      userText: body,
      tone,
      ctx: {
        name,
        energy,
        waterMl,
        goalMl,
        missedDays,
        movedToday,
        weather: weather && weather.tempC !== null
          ? `${Math.round(weather.tempC)} degrees, ${weather.label.toLowerCase()}`
          : null,
      },
    })

    setLastSource({ source, reason })
    if (served) setModel(served)
    dispatch({
      type: 'messages',
      messages: [...thread, { id: Date.now() + 1, role: 'neha', text: reply, source }],
    })
    setPending(false)

    // Spoken here rather than from an effect on `messages`, which would also
    // fire when the thread is restored from localStorage - being read
    // yesterday's reply the moment a page opens is unnerving.
    if (nehaVoice) say(reply, { enabled: canSpeak, rate })
  }

  return (
    <Page>
      <p className="eyebrow">Neha</p>
      <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
        Say what is actually going on.
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-[7fr_4fr]">
        {/* --- Thread --- */}
        <div className="glass flex h-[620px] flex-col p-0">
          <div className="flex items-center gap-3 border-b border-white/[0.08] px-7 py-5">
            <span
              className="animate-breathe grid h-9 w-9 place-items-center rounded-full"
              style={{ background: 'rgba(var(--accent-rgb),.2)', color: 'var(--accent-ink)' }}
            >
              <Sparkles size={16} />
            </span>
            <div className="flex-1">
              <p className="text-[14.5px] font-medium leading-none">Neha</p>
              <p className="mt-1 text-[12px] leading-none text-muted">
                {TONES.find((t) => t.id === tone)?.label}
              </p>
            </div>
            {/* Her voice. Off by default, and it says which state it is in
                rather than making you guess from an icon. */}
            <button
              onClick={toggleVoice}
              disabled={!canSpeak}
              aria-pressed={nehaVoice}
              title={
                canSpeak
                  ? nehaVoice
                    ? 'Neha reads her replies aloud'
                    : 'Neha isn’t speaking'
                  : 'This browser has no speech synthesis'
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] transition disabled:opacity-40 ${
                nehaVoice
                  ? 'border-transparent font-medium'
                  : 'border-edge bg-white/[0.05] text-muted hover:bg-white/[0.11] hover:text-ink'
              }`}
              style={
                nehaVoice
                  ? {
                      background: 'rgba(var(--accent-rgb),.16)',
                      color: 'var(--accent-ink)',
                      borderColor: 'var(--accent)',
                    }
                  : undefined
              }
            >
              {nehaVoice ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {nehaVoice ? 'Reading aloud' : 'Voice off'}
            </button>

            {/* Names the model that actually answered, rather than claiming
                "Live model" and leaving you to guess. A wrong or retired id
                shows up here as the label never changing, which is the exact
                symptom that went unnoticed for a day. */}
            <span
              className="pill"
              title={
                hasKey
                  ? model
                    ? `Answered by ${model}, running on Groq`
                    : 'Groq key found. The model gets chosen on the first message.'
                  : 'No VITE_GROQ_API_KEY in .env, so the replies are written ones from inside the app'
              }
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: hasKey ? 'var(--accent)' : '#3F5B4C' }}
              />
              {hasKey
                ? model
                  ? model.split('/').pop()
                  : 'Live model'
                : 'No key - written replies'}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-7 py-6 no-scrollbar">
            <div className="max-w-[80%] rounded-3xl rounded-tl-lg border border-edge/70 bg-white/[0.05] px-5 py-3.5">
              <p className="text-[14.5px] leading-relaxed">
                {greeting({ name, energy, missedDays })}
              </p>
            </div>

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur(0.32), ease: [0.22, 1, 0.36, 1] }}
                  className={m.role === 'user' ? 'flex justify-end' : 'group'}
                >
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[80%] rounded-3xl rounded-br-lg px-5 py-3.5'
                        : 'max-w-[80%] rounded-3xl rounded-tl-lg border border-edge/70 bg-white/[0.05] px-5 py-3.5'
                    }
                    style={
                      m.role === 'user'
                        ? { background: 'rgba(var(--accent-rgb),.17)' }
                        : undefined
                    }
                  >
                    <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">
                      {m.text}
                    </p>
                    {/* Replay, per line. Hidden until you go looking for it,
                        because a button on every message is visual noise. */}
                    {m.role === 'neha' && canSpeak && (
                      <button
                        onClick={() => say(m.text, { enabled: true, rate })}
                        aria-label="Read this reply aloud"
                        className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-muted opacity-0 transition hover:text-ink focus:opacity-100 group-hover:opacity-100"
                      >
                        <Play size={10} />
                        Read it out
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {pending && (
              <div className="flex items-center gap-2.5 text-[13.5px] text-muted">
                <Loader2 size={14} className="animate-spin" />
                Neha is thinking
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 px-7 pb-3">
              {OPENERS.map((o) => (
                <button
                  key={o}
                  onClick={() => send(o)}
                  className="rounded-full border border-edge bg-white/[0.05] px-4 py-2 text-[13px] text-muted transition hover:border-ink/25 hover:text-ink"
                >
                  {o}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-white/[0.08] px-7 py-5">
            <div className="flex items-center gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="However you want to say it"
                aria-label="Message Neha"
                className="field"
              />
              <button
                onClick={() => send()}
                disabled={!draft.trim() || pending}
                className="btn-primary shrink-0 px-5"
                aria-label="Send"
              >
                <Send size={17} />
              </button>
            </div>
            {lastSource?.source === 'fallback' && (
              <p className="mt-2.5 text-[12px] text-muted">
                Answered offline: {lastSource.reason}
              </p>
            )}
          </div>
        </div>

        {/* --- Context panel: what she is and what she can see --- */}
        <div className="flex flex-col gap-6">
          {/* Neha, with an actual face.
              She was a Sparkles glyph in a circle until now, which is a
              perfectly good icon and a terrible companion - you cannot feel
              talked to by an icon. The JSON ships with a muddy grey disc
              behind her that LottieBox strips out (see BG_NAMES in that file),
              which is what lets the disc be redrawn here in CSS so it tracks
              the accent colour instead of fighting it. */}
          <div className="card-grad overflow-hidden">
            <div className="relative -mx-7 -mt-7 h-[208px]">
              <div
                className="absolute left-1/2 top-1/2 h-[186px] w-[186px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 50% 42%, rgba(var(--accent-rgb),.34) 0%, rgba(var(--accent-rgb),.13) 56%, transparent 76%)',
                }}
              />
              <LottieBox
                src="/lottie/neha.json"
                playing
                loop
                speed={energyMeta.lottieSpeed}
                className="relative h-full w-full"
                fallback={
                  <div className="grid h-full place-items-center">
                    <span
                      className="animate-breathe grid h-20 w-20 place-items-center rounded-full"
                      style={{
                        background: 'rgba(var(--accent-rgb),.2)',
                        color: 'var(--accent-ink)',
                      }}
                    >
                      <Sparkles size={26} />
                    </span>
                  </div>
                }
              />
            </div>
            <p className="eyebrow mt-5">Your companion</p>
            <p className="mt-1.5 font-display text-[23px] leading-tight">
              Neha
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Not a coach, and she keeps no score. Tell her how the day is
              actually going, including that it’s going badly, and she works
              from there.
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">How she talks</p>
            <div className="mt-3 space-y-2">
              {TONES.map((t) => {
                const active = tone === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => dispatch({ type: 'tone', tone: t.id })}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active ? 'border-transparent' : 'border-edge bg-white/[0.05] hover:bg-white/[0.11]'
                    }`}
                    style={
                      active
                        ? {
                            background: 'rgba(var(--accent-rgb),.13)',
                            borderColor: 'var(--accent)',
                          }
                        : undefined
                    }
                  >
                    <p className="text-[14px] font-medium">{t.label}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">{t.note}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card">
            <p className="eyebrow">What she can see</p>
            <ul className="num mt-3 space-y-2 text-[13.5px] text-muted">
              <li className="flex justify-between">
                <span>Energy today</span>
                <span className="text-ink">{energy}</span>
              </li>
              <li className="flex justify-between">
                <span>Water</span>
                <span className="text-ink">
                  {waterMl} / {goalMl} ml
                </span>
              </li>
              <li className="flex justify-between">
                <span>Moved today</span>
                <span className="text-ink">{movedToday ? 'yes' : 'not yet'}</span>
              </li>
              <li className="flex justify-between">
                <span>Quiet days this week</span>
                <span className="text-ink">{missedDays}</span>
              </li>
              <li className="flex justify-between">
                <span>Weather</span>
                <span className="text-ink">
                  {weather && weather.tempC !== null
                    ? `${Math.round(weather.tempC)}° ${weather.label.toLowerCase()}`
                    : 'unknown'}
                </span>
              </li>
            </ul>
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              This is the whole context she gets. She’s told never to read your
              numbers back at you, and never to mention streaks, because there are none.
            </p>
          </div>

          <div className="card-flat">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="accent-text" />
              <p className="text-[14px] font-medium">Stays on your machine</p>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Your logs live in this browser. Only the words you type are sent to
              the model to get a reply.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {canSpeak
                ? 'Her voice is your own operating system speaking. Nothing is uploaded to read a reply out.'
                : 'This browser has no speech synthesis, so the voice toggle is off. Everything else works.'}
            </p>
            {/* Named, so you can hear it and know exactly which voice to
                install if you would rather have a different one. */}
            {canSpeak && voice && (
              <p className="mt-1.5 text-[12px] text-muted/80">
                Using {voice.name} ({voice.lang})
              </p>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}
