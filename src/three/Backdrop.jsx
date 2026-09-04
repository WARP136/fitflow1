import Scene from './Scene.jsx'
import Aurora from './Aurora.jsx'
import { useApp } from '../store/AppState.jsx'

/*
 * App-wide backdrop. Mounted once in Shell and left mounted while pages come
 * and go, so the light field drifts continuously instead of restarting on
 * every navigation.
 *
 * Fixed to the viewport rather than the page, so it doesn't scroll away on the
 * long ones (Move, Food, Your week) and leave the bottom of the screen dead.
 *
 * With no WebGL this renders nothing, which is fine - body already carries
 * four large radial gradients in the same hues. The 3D layer only adds motion
 * and depth on top of something that works without it.
 */
export default function Backdrop() {
  const { energyMeta } = useApp()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <Scene
        camera={{ position: [0, 0, 10], fov: 60 }}
        dpr={[1, 1.5]}
        fallback={null}
        fade={false}
      >
        <Aurora
          accent={energyMeta.accent}
          speed={1 / energyMeta.tempo}
          intensity={1}
        />
      </Scene>
      {/* A vignette pulls the corners down so text near the edges of the
          screen keeps its contrast against the brightest parts of the field. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(5,16,11,.55) 100%)',
        }}
      />
    </div>
  )
}
