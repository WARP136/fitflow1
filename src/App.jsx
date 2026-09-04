import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell.jsx'
import Welcome from './pages/Welcome.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Workouts from './pages/Workouts.jsx'
import Hydration from './pages/Hydration.jsx'
import Nutrition from './pages/Nutrition.jsx'
import DietPlan from './pages/DietPlan.jsx'
import Scan from './pages/Scan.jsx'
import JogTracker from './pages/JogTracker.jsx'
import Chat from './pages/Chat.jsx'
import Sky from './pages/Sky.jsx'
import WeeklyWrap from './pages/WeeklyWrap.jsx'
import Predict from './pages/Predict.jsx'
import You from './pages/You.jsx'
import { useApp } from './store/AppState.jsx'
import { primeVoices } from './services/voice.js'

export default function App() {
  const { onboarded } = useApp()

  // Warm up the OS voice list once, so the first coach line isn't silent.
  useEffect(() => {
    primeVoices()
  }, [])

  return (
    <>
      <Routes>
        {/* "/" is the pitch, and the only screen outside the shell. Once onboarded
            it redirects instead. "Forget everything" on /you clears the flag. */}
        <Route
          path="/"
          element={onboarded ? <Navigate to="/today" replace /> : <Welcome />}
        />
        {/* Pathless layout route: everything below renders inside the shell. */}
        <Route element={<Shell />}>
          <Route path="/today" element={<Dashboard />} />
          <Route path="/move" element={<Workouts />} />
          <Route path="/water" element={<Hydration />} />
          <Route path="/food" element={<Nutrition />} />
          <Route path="/plan" element={<DietPlan />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/jog" element={<JogTracker />} />
          <Route path="/neha" element={<Chat />} />
          <Route path="/sky" element={<Sky />} />
          <Route path="/week" element={<WeeklyWrap />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/you" element={<You />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
