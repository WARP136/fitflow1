import { AccountProvider, useAccount } from './store/Account.jsx'
import { AppProvider } from './store/AppState.jsx'
import App from './App.jsx'
import SignIn from './pages/SignIn.jsx'

/*
 * The gate, and the only place the two stores meet. Above: who is signed in
 * (store/Account.jsx). Below: that person's data (store/AppState.jsx).
 *
 * The `key` is load-bearing. AppProvider reads localStorage once on mount and
 * mirrors itself back on every change, so handing it a new storage key while
 * it's already running leaves a live reducer and a live effect pointed at two
 * different accounts for at least one commit - that's how one person's day
 * gets written into another person's key. Keying by account id makes React
 * throw the old provider away, so load() runs once per account from a clean
 * start.
 *
 * The router sits above this on purpose. Somebody who bookmarked /predict and
 * comes back a week later gets sign-in and then lands on /predict, instead of
 * being bounced to the dashboard and having to find it again.
 */
function Gate() {
  const { account } = useAccount()

  if (!account) return <SignIn />

  return (
    <AppProvider key={account.id} scope={account.id} hintName={account.name}>
      <App />
    </AppProvider>
  )
}

export default function Root() {
  return (
    <AccountProvider>
      <Gate />
    </AccountProvider>
  )
}
