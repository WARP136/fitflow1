import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { activeUser, clearActive, hasRealCrypto, listUsers, setActive } from '../services/accounts.js'

/*
 * Who's signed in. One tiny context, kept separate from the app store and
 * mounted above it: the app store's job is to load and mirror one person's
 * data, and the account decides which person. The other nesting order would
 * force the store to reload itself mid-life on sign-out, and a reducer that
 * swaps its own storage key under a running effect half-writes one account's
 * day into another's.
 *
 * So Root.jsx mounts <AppProvider key={account.id}> instead. Changing account
 * changes the key, React remounts, load() runs cleanly against the new key.
 *
 * Nothing sensitive passes through here - `account` is { id, name, createdAt,
 * algo }, and the salt and digest never leave services/accounts.js.
 */

const Ctx = createContext(null)

export function AccountProvider({ children }) {
  const [book, setBook] = useState(() => ({ account: activeUser(), users: listUsers() }))

  /** Sign in as somebody. createAccount/authenticate have already checked. */
  const enter = useCallback((user) => {
    setActive(user.id)
    setBook({ account: user, users: listUsers() })
  }, [])

  const leave = useCallback(() => {
    clearActive()
    setBook({ account: null, users: listUsers() })
  }, [])

  /** Re-read after something outside React changed the list (e.g. forget). */
  const refresh = useCallback(() => {
    setBook({ account: activeUser(), users: listUsers() })
  }, [])

  const value = useMemo(
    () => ({ ...book, enter, leave, refresh, realCrypto: hasRealCrypto() }),
    [book, enter, leave, refresh]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAccount() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>')
  return ctx
}
