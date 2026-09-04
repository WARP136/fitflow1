import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import { useApp } from '../store/AppState.jsx'

/*
 * App frame: fixed rail left, everything else right. AnimatePresence lives
 * here rather than around the router, so pages cross-fade while the sidebar
 * stays put.
 *
 * z-0 is Backdrop (the WebGL aurora, fixed to the viewport, mounted once so it
 * never restarts on navigation). z-10 is GradientMesh plus the content, mesh at
 * the bottom of that layer.
 *
 * The content wrapper needs the explicit z-10: it scopes GradientMesh's -z-10
 * inside that stacking context so the mesh can't slip behind the canvas.
 * Without it the two fight and the winner depends on the browser.
 */
export default function Shell() {
  const location = useLocation()
  const { onboarded } = useApp()

  if (!onboarded) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="relative z-10 min-h-screen pl-[268px]">
        <div key={location.pathname}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
