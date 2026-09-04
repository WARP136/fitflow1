import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Trash2, Loader2, Database, Salad } from 'lucide-react'
import Page from '../components/Page.jsx'
import { useApp } from '../store/AppState.jsx'
import { searchFoods, portion, PANTRY } from '../services/food.js'

const SERVINGS = [50, 100, 150, 200]
const TARGETS = [1600, 1800, 1900, 2100, 2400]

export default function Nutrition() {
  const { foods, kcal, protein, kcalTarget, kcalPct, dispatch, dur } = useApp()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(PANTRY.slice(0, 6))
  const [source, setSource] = useState('pantry')
  const [note, setNote] = useState('Common foods to get you started')
  const [loading, setLoading] = useState(false)
  const [grams, setGrams] = useState(100)
  const debounce = useRef(null)

  // Debounced search so we do not fire a request per keystroke.
  useEffect(() => {
    clearTimeout(debounce.current)
    const q = query.trim()
    if (q.length < 2) {
      setResults(PANTRY.slice(0, 6))
      setSource('pantry')
      setNote('Common foods to get you started')
      setLoading(false)
      return
    }
    setLoading(true)
    debounce.current = setTimeout(async () => {
      const res = await searchFoods(q)
      setResults(res.items)
      setSource(res.source)
      setNote(
        res.source === 'openfoodfacts'
          ? `${res.items.length} matches from Open Food Facts`
          : res.reason || 'Showing the built-in list'
      )
      setLoading(false)
    }, 420)
    return () => clearTimeout(debounce.current)
  }, [query])

  const macros = useMemo(() => {
    const carbs = foods.reduce((s, f) => s + (f.carbs || 0), 0)
    const fat = foods.reduce((s, f) => s + (f.fat || 0), 0)
    return { carbs, fat }
  }, [foods])

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Food</p>
          <h1 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.1rem)] font-semibold leading-[1.03]">
            Your food, not a preset plan.
          </h1>
          <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-muted">
            Search a real nutrition database, add what you actually ate, swap
            anything out. The target below is a guide, not a limit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="pill">
            <Database size={13} />
            {source === 'openfoodfacts' ? 'Open Food Facts' : 'Built-in list'}
          </span>
          <Link to="/plan" className="btn-ghost px-5 py-2.5 text-[13.5px]">
            <Salad size={14} />
            Not sure what to eat? Build a day
          </Link>
        </div>
      </div>

      <div className="mt-9 grid gap-6 lg:grid-cols-[6fr_6fr]">
        {/* --- Search and add --- */}
        <div className="glass p-8">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search paneer, oats, dal, a brand name..."
              aria-label="Search for a food"
              className="field pl-11"
            />
            {loading && (
              <Loader2
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted"
              />
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12.5px] text-muted">{note}</p>
            <div className="flex gap-1.5">
              {SERVINGS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrams(g)}
                  className={`num rounded-lg border px-2.5 py-1 text-[12px] transition ${
                    grams === g
                      ? 'border-transparent font-medium'
                      : 'border-edge bg-white/[0.05] hover:bg-white/[0.11]'
                  }`}
                  style={
                    grams === g
                      ? {
                          background: 'rgba(var(--accent-rgb),.16)',
                          color: 'var(--accent-ink)',
                          borderColor: 'var(--accent)',
                        }
                      : undefined
                  }
                >
                  {g}g
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-4 max-h-[386px] space-y-2 overflow-y-auto no-scrollbar">
            {results.length === 0 && !loading && (
              <li className="rounded-2xl border border-edge/60 bg-white/[0.05] px-5 py-6 text-center text-[14px] text-muted">
                Nothing matched that. Try a simpler word, like "rice".
              </li>
            )}
            {results.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-4 rounded-2xl border border-edge/60 bg-white/[0.05] px-4 py-3 transition hover:bg-white/[0.11]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium">{f.name}</p>
                  <p className="num mt-0.5 truncate text-[12.5px] text-muted">
                    {f.brand} · {f.kcal} kcal / 100g · P {f.protein}g
                  </p>
                </div>
                <button
                  onClick={() => dispatch({ type: 'addFood', food: portion(f, grams) })}
                  className="btn-ghost shrink-0 px-4 py-2 text-[13px]"
                >
                  <Plus size={13} />
                  {grams}g
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* --- Today's plate --- */}
        <div className="flex flex-col gap-6">
          <div className="glass p-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow">Today</p>
                <p className="num mt-2 font-display text-[40px] leading-none">
                  {kcal}
                  <span className="text-[15px] font-medium text-muted">
                    {' '}
                    / {kcalTarget} kcal
                  </span>
                </p>
              </div>
              <div className="num text-right text-[12.5px] text-muted">
                <p>protein {protein}g</p>
                <p>carbs {macros.carbs}g</p>
                <p>fat {macros.fat}g</p>
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-mist">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--accent)' }}
                initial={{ width: 0 }}
                animate={{ width: `${kcalPct}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="eyebrow mr-1">Target</span>
              {TARGETS.map((t) => (
                <button
                  key={t}
                  onClick={() => dispatch({ type: 'kcalTarget', kcal: t })}
                  className={`num rounded-lg border px-3 py-1.5 text-[12.5px] transition ${
                    kcalTarget === t
                      ? 'border-transparent font-medium'
                      : 'border-edge bg-white/[0.05] hover:bg-white/[0.11]'
                  }`}
                  style={
                    kcalTarget === t
                      ? {
                          background: 'rgba(var(--accent-rgb),.16)',
                          color: 'var(--accent-ink)',
                          borderColor: 'var(--accent)',
                        }
                      : undefined
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="card flex-1">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">On your plate</p>
              <span className="num text-[12.5px] text-muted">
                {foods.length} {foods.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {foods.length === 0 ? (
              <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
                Nothing added yet. Search something you ate today. Even one item
                is useful.
              </p>
            ) : (
              <ul className="mt-4 max-h-[260px] space-y-2 overflow-y-auto no-scrollbar">
                <AnimatePresence initial={false}>
                  {[...foods].reverse().map((f) => (
                    <motion.li
                      key={f.uid}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: dur(0.28) }}
                      className="flex items-center gap-3 rounded-xl border border-edge/60 bg-white/[0.05] px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px]">{f.name}</p>
                        <p className="num mt-0.5 text-[12px] text-muted">
                          {f.grams}g · {f.kcal} kcal
                        </p>
                      </div>
                      <button
                        onClick={() => dispatch({ type: 'removeFood', uid: f.uid })}
                        aria-label={`Remove ${f.name}`}
                        className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-mist hover:text-ink"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}
