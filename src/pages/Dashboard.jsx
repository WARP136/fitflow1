import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Plus,
  Apple,
  Salad,
  Telescope,
  CloudSun,
  Droplets,
  RefreshCw,
} from 'lucide-react'
import Page from '../components/Page.jsx'
import ProgressRing from '../components/ProgressRing.jsx'
import EnergyPicker from '../components/EnergyPicker.jsx'
import { useApp } from '../store/AppState.jsx'
import { SESSION } from '../data/session.js'
import { QUOTES } from '../data/quotes.js'
import { greeting } from '../services/neha.js'
import { useWeather, useQuote, refreshQuote } from '../hooks/useLive.js'

/*
 * Today. One big thing, three small ones.
 *
 * This page used to hold nine competing elements and read like a control
 * panel. It now answers one question - "what do I do right now?" - with a
 * hierarchy steep enough that you can't get it wrong.
 *
 * The figure in the big card is the first movement of your actual session,
 * so the picture is what the button does. The background figure is blurred
 * and parked on frame one: a person doing yoga behind your buttons pulls
 * the eye off the buttons, and CSS blur on a live SVG repaints every frame.
 */

const partOfDay = () => {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const longDate = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

/*
 * One of the small tiles. Icon-led rather than a wide row: a full-width row
 * is mostly empty space and reads as a list item to scan past, a tile with a
 * 52px symbol reads as a thing to press. Labels stay - an unlabelled apple
 * is a guessing game.
 */
function IconTile({ to, icon: Icon, label, hint }) {
  return (
    <Link
      to={to}
      className="card-flat group flex flex-col gap-4 border-[#8b9a6e] bg-[#eeeeee] px-5 py-5"
    >
      <span
        className="grid h-[52px] w-[52px] place-items-center rounded-2xl transition-transform group-hover:scale-105"
        style={{
          background: 'rgba(var(--accent-rgb),.15)',
          color: 'var(--accent-ink)',
        }}
      >
        <Icon size={26} strokeWidth={1.9} />
      </span>
      <span className="block">
        <span className="block font-display text-[17.5px] leading-tight">
          {label}
        </span>
        <span className="mt-1 block text-[12.5px] leading-snug text-muted">
          {hint}
        </span>
      </span>
    </Link>
  )
}

export default function Dashboard() {
  const {
    name,
    energy,
    foods,
    kcal,
    goalWeightKg,
    waterMl,
    goalMl,
    waterPct,
    missedDays,
    dispatch,
  } = useApp()

  const weather = useWeather()
  const live = useQuote()
  const [pulled, setPulled] = useState(null)
  const line = pulled || live || QUOTES[0]

  return (
    <Page>
      {/* --- Who and when --- */}
      <div>
        <p className="eyebrow">
          {longDate()}
        </p>
        <h1 className="mt-3 font-display text-[clamp(2.4rem,4.2vw,3.4rem)] font-semibold leading-[1.02]">
          {partOfDay()}
          {name ? `, ${name}` : ''}.
        </h1>
        <p className="mt-3 max-w-[46ch] text-[16px] leading-relaxed text-muted">
          {greeting({ name, energy, missedDays })}
        </p>
      </div>

      {/* --- The one control, kept above the tiles --- */}
      <section className="mt-8">
        <p className="eyebrow">How is today going?</p>
        <div className="mt-3 max-w-[640px]">
          <EnergyPicker showHint={false} />
        </div>
      </section>

      {/* --- One big thing, three small ones --- */}
      <div className="mt-7 grid gap-5 lg:grid-cols-[1.28fr_1fr]">
        {/* The big one: twice the area of anything else, twice the type
            size, and the only filled button in view. */}
        <div>
          <div className="glass relative flex min-h-[544px] flex-col overflow-hidden p-9">
            <div className="relative">
              <p className="eyebrow">Start here</p>
              <h2 className="mt-2.5 font-display text-[clamp(2rem,3vw,2.7rem)] font-semibold leading-[1.04]">
                Today’s movement
              </h2>
              <p className="mt-3.5 max-w-[30ch] text-[15.5px] leading-relaxed text-muted">
                {SESSION.blurb}
              </p>
            </div>

            <div className="flex-1" />

            <div className="relative flex flex-wrap items-center gap-3">
              <Link to="/move" className="btn-primary">
                Start moving
                <ArrowRight size={17} />
              </Link>
              <span className="pill">
                {SESSION.rounds} rounds · about {SESSION.minutes} min
              </span>
              {weather && (
                <span className="pill" title={`${weather.place} · ${weather.source}`}>
                  <CloudSun size={13} />
                  {weather.tempC === null
                    ? weather.line
                    : `${Math.round(weather.tempC)}° · ${weather.label}`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-3.5">
            <IconTile
              to="/food"
              icon={Apple}
              label="Food"
              hint={foods.length ? `${foods.length} today · ${kcal} kcal` : 'Log what you ate'}
            />
            <IconTile
              to="/plan"
              icon={Salad}
              label="Meal plan"
              hint="A day built around you"
            />
            {/* Third tile, not a fourth row. The big card on the left sets
                this column's height and three across keeps them level. */}
            <IconTile
              to="/predict"
              icon={Telescope}
              label="Looking ahead"
              hint={
                goalWeightKg
                  ? `Toward ${goalWeightKg} kg`
                  : 'How long to your target'
              }
            />
          </div>

          {/* A plain shortcut without the animated portrait. */}
          <Link
            to="/neha"
            className="card-flat flex h-[212px] flex-col justify-end"
            aria-label="Talk to Neha"
          >
            <p className="font-display text-[19px] leading-tight">Talk to Neha</p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted">
              Ask her anything. She keeps no score.
            </p>
          </Link>

          {/* Water sits here, not behind a tile. It's the one thing you can
              finish without leaving the page. */}
          <div className="card flex flex-1 items-center gap-6">
            <ProgressRing value={waterPct} size={100} stroke={10}>
              <div>
                <p className="num font-display text-[19px] leading-none">
                  {waterPct}%
                </p>
              </div>
            </ProgressRing>
            <div className="flex-1">
              <p className="eyebrow">Water</p>
              <p className="num mt-1.5 font-display text-[22px] leading-none">
                {(waterMl / 1000).toFixed(2)}
                <span className="text-[13px] text-muted">
                  {' '}
                  / {(goalMl / 1000).toFixed(1)} L
                </span>
              </p>
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={() => dispatch({ type: 'logWater', ml: 250 })}
                  className="btn-ghost px-4 py-2 text-[13.5px]"
                >
                  <Plus size={14} />
                  250 ml
                </button>
                <Link to="/water" className="btn-ghost px-4 py-2 text-[13.5px]">
                  <Droplets size={14} />
                  Open
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* All that's left of the quote panel. Keeps the live Quotable call
          in the demo without spending a card on it. */}
      {line?.text && (
        <div className="mt-8 flex flex-wrap items-baseline gap-3">
          <p className="text-[13.5px] italic leading-relaxed text-muted">
            “{line.text}”{line.by ? ` — ${line.by}` : ''}
          </p>
          <button
            onClick={async () => setPulled(await refreshQuote())}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-muted/70 transition hover:text-ink"
          >
            <RefreshCw size={11} />
            Another
          </button>
        </div>
      )}
    </Page>
  )
}
