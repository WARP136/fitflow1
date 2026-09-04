import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  UserPlus,
  LogIn,
  X,
} from 'lucide-react'
import GradientMesh from '../components/GradientMesh.jsx'
import LottieBox from '../components/LottieBox.jsx'
import { useAccount } from '../store/Account.jsx'
import {
  authenticate,
  createAccount,
  forgetAccount,
  MIN_PASSWORD,
  STRONG,
} from '../services/accounts.js'

/*
 * Sign in. A name and a password, nothing more.
 *
 * No email, no confirmation, no password rules past a length floor, no
 * forgotten-password flow. There's no server to send any of it to.
 *
 * The note under the button says so in plain words, because a padlock on a
 * login screen implies a database and we don't have one. Password goes
 * through PBKDF2 with a random salt anyway - people reuse passwords and it
 * costs nothing to do properly - but it isn't a lock on the data.
 *
 * Existing accounts show as chips; clicking one fills the name. Faster than
 * typing, and it puts "two people share this laptop" on the first screen.
 */

export default function SignIn() {
  const { users, enter, refresh, realCrypto } = useAccount()

  // Somebody with no accounts on this browser wants the create form, and
  // somebody with accounts almost always wants the sign-in one. Guessing right
  // saves the most common visit a click, and the toggle is right there.
  const [mode, setMode] = useState(users.length ? 'in' : 'new')
  const [name, setName] = useState(users.length === 1 ? users[0].name : '')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const creating = mode === 'new'

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    // PBKDF2 at 120k iterations is tens of milliseconds of real work, so the
    // await is not decorative - without the busy flag a double-click submits
    // twice and the second one races the first.
    const res = creating ? await createAccount(name, pass) : await authenticate(name, pass)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setPass('')
    enter(res.user)
  }

  const drop = (u) => {
    if (
      !window.confirm(
        `Remove ${u.name} from this browser? Their weigh-ins, week and chat go with them, and there’s no copy anywhere else.`
      )
    )
      return
    forgetAccount(u.id)
    refresh()
    setError(null)
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GradientMesh tone="/today" />

      {/* Same figure as the welcome screen, pushed back into atmosphere. She
          is the product's face and this is now the first screen, so she should
          be here - just not competing with a password field. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-[-10%] -z-10 hidden w-[52vw] max-w-[820px] items-center lg:flex"
        aria-hidden="true"
        style={{ filter: 'blur(3px)' }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--accent-rgb),.26) 0%, rgba(var(--accent-rgb),.07) 54%, transparent 76%)',
          }}
        />
        <LottieBox
          src="/lottie/meditate.json"
          playing
          loop
          className="relative h-auto w-full opacity-[0.5]"
          fallback={<div className="animate-breathe aspect-square w-full opacity-25" />}
        />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(96deg, rgba(5,16,11,.95) 0%, rgba(5,16,11,.86) 38%, rgba(5,16,11,.42) 68%, rgba(5,16,11,.1) 88%)',
        }}
      />

      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col justify-center gap-12 px-10 py-14 lg:flex-row lg:items-center xl:px-16">
        {/* --- Who this is --- */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[520px] lg:flex-1"
        >
          <div className="flex items-center gap-3">
            <span
              className="grid h-11 w-11 place-items-center rounded-2xl font-display text-[18px] font-bold"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              F
            </span>
            <div>
              <p className="font-display text-[21px] font-semibold leading-none tracking-tight">
                FitFlow
              </p>
              <p className="mt-1.5 text-[11.5px] leading-none text-muted">Team Solfinders</p>
            </div>
          </div>

          <h1 className="mt-9 font-display text-[clamp(2.2rem,4vw,3.3rem)] font-semibold leading-[1.02]">
            Pick a name, and it
            <br />
            <span className="grad-text">remembers you</span>.
          </h1>

          <p className="mt-6 max-w-[44ch] text-[16px] leading-relaxed text-muted">
            One name and one password, kept in this browser. It exists so two
            people can share a laptop without sharing a weight log, not because
            anything here wants your details.
          </p>

          <ul className="mt-8 grid max-w-[460px] gap-3">
            {[
              'Nothing is sent anywhere. There’s no server to send it to.',
              'Your password is never stored, only a salted PBKDF2 digest of it.',
              'No email, no verification, no streaks waiting for you inside.',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
                <span className="text-[14px] leading-snug text-ink/75">{line}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* --- The form --- */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[440px]"
        >
          <div className="card-grad p-8">
            <div className="flex items-center gap-2.5">
              {creating ? (
                <UserPlus size={17} style={{ color: 'var(--accent-ink)' }} />
              ) : (
                <LogIn size={17} style={{ color: 'var(--accent-ink)' }} />
              )}
              <p className="eyebrow">{creating ? 'New here' : 'Welcome back'}</p>
            </div>
            <h2 className="mt-2.5 font-display text-[24px] leading-tight">
              {creating ? 'Create an account' : 'Sign in'}
            </h2>

            {/* Who is already on this browser. Clicking fills the name. */}
            {!creating && users.length > 0 && (
              <div className="mt-5">
                <p className="eyebrow">On this browser</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {users.map((u) => (
                    <span
                      key={u.id}
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-1 pl-3.5 text-[13px] transition ${
                        u.name === name
                          ? 'border-mint/50 bg-white/[0.1] text-ink'
                          : 'border-white/[0.1] bg-white/[0.045] text-muted'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setName(u.name)
                          setError(null)
                        }}
                        className="transition hover:text-ink"
                      >
                        {u.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => drop(u)}
                        aria-label={`Remove ${u.name} from this browser`}
                        title={`Remove ${u.name} from this browser`}
                        className="rounded-full p-1 text-muted/70 transition hover:bg-white/[0.1] hover:text-rose"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={submit} className="mt-6">
              <label className="block">
                <span className="eyebrow">Name</span>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setError(null)
                  }}
                  placeholder="What should Neha call you?"
                  aria-label="Your name"
                  autoComplete="username"
                  autoFocus
                  className="field mt-2.5"
                />
              </label>

              <label className="mt-5 block">
                <span className="eyebrow">Password</span>
                <input
                  value={pass}
                  onChange={(e) => {
                    setPass(e.target.value)
                    setError(null)
                  }}
                  type="password"
                  placeholder={creating ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
                  aria-label="Your password"
                  autoComplete={creating ? 'new-password' : 'current-password'}
                  className="field mt-2.5"
                />
              </label>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 inline-flex items-start gap-2 text-[13.5px] leading-relaxed"
                  style={{ color: '#FCA5A5' }}
                >
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  {error}
                </motion.p>
              )}

              <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
                {busy ? 'One moment…' : creating ? 'Create and open FitFlow' : 'Sign in'}
                {!busy && <ArrowRight size={17} />}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(creating ? 'in' : 'new')
                setError(null)
                setPass('')
              }}
              className="mt-4 w-full text-[13.5px] text-muted transition hover:text-ink"
            >
              {creating
                ? 'I already have an account on this browser'
                : 'Create a new account instead'}
            </button>
          </div>

          {/* --- The honest paragraph. Not in a tooltip, not in a footer. --- */}
          <div className="card-flat mt-5 px-6 py-5">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={15} className="accent-text" />
              <p className="eyebrow">What this login is and isn’t</p>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              It keeps two people's logs apart on a shared computer, and it keeps
              your password out of storage in readable form. It isn’t a lock on
              the data: anybody sitting at this browser with the developer tools
              open can read any account's saved text directly. Nothing here is
              encrypted and nothing leaves the machine, so there’s also no
              password reset, because there’s nobody to ask.
            </p>
            <p className="mt-3 inline-flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
              <KeyRound size={13} className="mt-0.5 shrink-0" />
              {realCrypto ? (
                <span>
                  This address has real WebCrypto, so passwords go through{' '}
                  <span className="num">PBKDF2-SHA256</span>, 120,000 rounds, with
                  16 random bytes of salt each.
                </span>
              ) : (
                <span>
                  Heads up: <span className="num">crypto.subtle</span> is missing
                  here, which happens on a plain http address like a phone on the
                  same wifi. Passwords fall back to a scramble that’s honestly
                  labelled and isn’t a password hash. Open FitFlow on{' '}
                  <span className="num">localhost</span> or an https link for the
                  real thing.
                </span>
              )}
            </p>
            {users.some((u) => u.algo !== STRONG) && realCrypto && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                One of the accounts above was made on an http address. Signing
                into it here will quietly re-hash it properly.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
