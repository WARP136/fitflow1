import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  Dumbbell,
  Droplets,
  Apple,
  Salad,
  ScanLine,
  Footprints,
  MessageCircle,
  Sparkles,
  CalendarDays,
  Telescope,
  UserRound,
  Volume2,
  VolumeX,
  RotateCcw,
  LogOut,
} from 'lucide-react'
import { useApp } from '../store/AppState.jsx'
import { useAccount } from '../store/Account.jsx'
import { getEnergy } from '../data/energy.js'

const NAV = [
  { to: '/today', label: 'Today', icon: Home },
  { to: '/move', label: 'Move', icon: Dumbbell },
  { to: '/water', label: 'Water', icon: Droplets },
  { to: '/food', label: 'Food', icon: Apple },
  { to: '/plan', label: 'Meal plan', icon: Salad },
  { to: '/scan', label: 'Scan a label', icon: ScanLine },
  { to: '/jog', label: 'Jog', icon: Footprints },
  { to: '/neha', label: 'Neha', icon: MessageCircle },
  { to: '/sky', label: 'Your sky', icon: Sparkles },
  { to: '/week', label: 'This week', icon: CalendarDays },
  { to: '/predict', label: 'Looking ahead', icon: Telescope },
  { to: '/you', label: 'You', icon: UserRound },
]

/*
 * Navigation rail. A fixed left rail is what a desktop product does, and it
 * leaves the full width of the page for content.
 *
 * Neha is pinned to the bottom so she's always present rather than hidden
 * inside one tab.
 */
export default function Sidebar() {
  const { name, energy, voiceOn, dispatch, waterPct } = useApp()
  const { account, leave } = useAccount()
  const e = getEnergy(energy)

  return (
    <aside className="sidebar fixed left-0 top-0 z-40 flex h-screen w-[268px] flex-col border-r border-[#8b9a6e] bg-[#2f3826] px-6 py-7 text-white">
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 place-items-center rounded-xl font-display text-[15px] font-bold"
          style={{ background: e.accent, color: e.accentFg }}
        >
          F
        </span>
        <div>
          <p className="font-display text-[17px] font-semibold leading-none tracking-tight">
            FitFlow
          </p>
          <p className="mt-1 text-[11px] leading-none text-muted">
            {name ? name : 'Welcome'}
          </p>
        </div>
      </div>

      {/* min-h-0 + scroll, so on a short laptop screen ten links scroll
          rather than crushing Neha's card off the bottom. */}
      <nav className="mt-9 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="group relative block shrink-0">
            {({ isActive }) => (
              <div className="relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    className="absolute inset-0 rounded-2xl border border-edge bg-white/[0.08] shadow-lift"
                  />
                )}
                <Icon
                  size={18}
                  strokeWidth={2}
                  className="relative shrink-0 transition-colors"
                  style={{ color: isActive ? '#FFFFFF' : 'rgba(255,255,255,.72)' }}
                />
                <span
                  className={`relative text-[14.5px] transition-colors ${
                    isActive ? 'font-medium text-white' : 'text-white/75 group-hover:text-white'
                  }`}
                >
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Ambient status: a hairline of today's hydration, no numbers shouting. */}
      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="eyebrow">Water today</span>
          <span className="num text-[12px] text-muted">{waterPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-mist">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--accent)' }}
            initial={{ width: 0 }}
            animate={{ width: `${waterPct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-edge/80 bg-mist/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="animate-breathe h-2 w-2 rounded-full"
              style={{ background: e.accent }}
            />
            <span className="text-[13px] font-medium">Neha is around</span>
          </div>
          <button
            onClick={() => dispatch({ type: 'voice', on: !voiceOn })}
            aria-label={voiceOn ? 'Turn the voice coach off' : 'Turn the voice coach on'}
            title={voiceOn ? 'Voice coach on' : 'Voice coach off'}
            className="rounded-lg p-1.5 text-muted transition hover:bg-white/[0.11] hover:text-ink"
          >
            {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Private, and never keeping score.
        </p>
      </div>

      {/* Two different kinds of leaving, deliberately not the same button.
          Signing out loses nothing - the data stays under this account's key and
          comes back on the next sign-in - so it asks nothing. Start fresh does
          wipe the day, so it confirms and points at the You page's export. */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            if (
              window.confirm(
                'Clear everything and go back to the welcome page? This wipes today\'s log. To keep a copy first, cancel and use Export on the You page.'
              )
            )
              dispatch({ type: 'reset' })
          }}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-muted/80 transition hover:text-ink"
        >
          <RotateCcw size={11} />
          Start fresh
        </button>

        {account && (
          <button
            onClick={leave}
            title={`Sign out of ${account.name}. Nothing is deleted.`}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-muted/80 transition hover:text-ink"
          >
            <LogOut size={11} />
            Sign out
          </button>
        )}
      </div>
    </aside>
  )
}
