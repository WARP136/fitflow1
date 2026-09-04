import { Component, Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'

/*
 * WebGL host. Every 3D object mounts through here, mostly so WebGL is safe to
 * demo. Three guards:
 *
 *   1. Capability check - no context available (old driver, remote desktop,
 *      blacklisted GPU) and we render the CSS fallback, never a Canvas.
 *   2. Error boundary - if three.js throws after mounting, swap in the
 *      fallback rather than white-screen the app.
 *   3. Reduced motion - frameloop drops to "demand", so the scene renders one
 *      frame and stops.
 *
 * dpr capped at 1.5 so a 4K laptop doesn't quietly render four times the
 * pixels. No shadow maps, no post, no HDR environment map - an Environment
 * preset fetches from a CDN and this has to work on venue wifi.
 */

function hasWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl'))
    )
  } catch {
    return false
  }
}

class GLBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { dead: false }
  }
  static getDerivedStateFromError() {
    return { dead: true }
  }
  componentDidCatch(err) {
    // Loud enough to find in the console, quiet enough not to break the demo.
    console.warn('[fitflow] 3D scene disabled:', err?.message || err)
  }
  render() {
    return this.state.dead ? this.props.fallback : this.props.children
  }
}

export default function Scene({
  children,
  fallback = null,
  className = '',
  camera = { position: [0, 0, 6], fov: 42 },
  dpr = [1, 1.5],
  fade = true,
}) {
  const supported = useMemo(hasWebGL, [])
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  if (!supported) return fallback

  /* An inset canvas has straight edges, and anything bright that overflows it
     gets sliced off in a dead flat line - which reads as a stray rectangle
     sitting on the card rather than as light. Masking the canvas with a soft
     radial dissolve means the 3D layer always fades out before it reaches a
     boundary, so there is no edge to see. Off for the full-viewport backdrop,
     where the only boundary is the screen itself. */
  const mask = fade
    ? 'radial-gradient(closest-side at 50% 50%, rgba(0,0,0,1) 42%, rgba(0,0,0,.55) 72%, rgba(0,0,0,0) 100%)'
    : undefined

  return (
    <GLBoundary fallback={fallback}>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${className}`}
        style={fade ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        <Canvas
          dpr={dpr}
          camera={camera}
          frameloop={reduced ? 'demand' : 'always'}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </Canvas>
      </div>
    </GLBoundary>
  )
}
