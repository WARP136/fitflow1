import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/*
 * The aurora: the full-viewport light field behind the whole app. Not a
 * decorative object in a corner - it fills the screen on every page and the
 * content floats on glass above it.
 *
 * Each glow is a sprite carrying one soft radial-gradient texture, drawn
 * additively. Additive blending is what makes overlapping colours read as
 * light: where emerald and violet cross you get a real third colour, the way
 * light mixes, instead of one flat shape covering another.
 *
 * No custom shader anywhere, on purpose. A GLSL compile error on an
 * unfamiliar laptop is a black screen thirty seconds into a demo, and nine
 * sprites cost almost nothing to draw.
 *
 * Two of the nine track the accent colour and lerp toward it over about half
 * a second, so changing energy re-lights the page instead of just recolouring
 * a button.
 */

// One 256px radial gradient, reused by every sprite. Generated in code so
// there is no image file to load and nothing to fetch over the network.
function makeGlowTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  // A long, soft falloff. A short falloff would read as a hard circle.
  g.addColorStop(0.0, 'rgba(255,255,255,1)')
  g.addColorStop(0.14, 'rgba(255,255,255,0.62)')
  g.addColorStop(0.34, 'rgba(255,255,255,0.24)')
  g.addColorStop(0.62, 'rgba(255,255,255,0.06)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/*
 * Nine glows. `tracksAccent` marks the two that follow the energy choice.
 * Prime-ish periods, so the field never visibly loops back to an arrangement
 * you've already seen.
 */
const GLOWS = [
  { hue: '#34D399', pos: [-6.5, 3.4, -3], scale: 15, amp: [1.5, 1.0], period: [31, 24], opacity: 0.55 },
  { hue: '#8B5CF6', pos: [6.8, 3.0, -4], scale: 17, amp: [1.7, 1.3], period: [27, 35], opacity: 0.5 },
  { hue: '#22D3EE', pos: [3.4, -3.6, -2.4], scale: 13, amp: [1.9, 1.1], period: [23, 29], opacity: 0.45 },
  { hue: '#FBBF24', pos: [-5.2, -4.2, -3.6], scale: 11, amp: [1.2, 0.9], period: [37, 21], opacity: 0.3 },
  { hue: '#34D399', pos: [0.4, 5.2, -5], scale: 14, amp: [2.1, 0.7], period: [41, 26], opacity: 0.32 },
  { hue: '#22D3EE', pos: [-8.5, -0.6, -5], scale: 12, amp: [1.1, 1.6], period: [33, 19], opacity: 0.3 },
  { hue: '#8B5CF6', pos: [8.2, -2.4, -5.5], scale: 12, amp: [1.4, 1.2], period: [25, 39], opacity: 0.28 },
  // The two that follow the energy choice sit nearest the camera and dead
  // centre, so the recolour is impossible to miss.
  { hue: null, tracksAccent: true, pos: [-1.6, 0.8, -1.2], scale: 10, amp: [2.4, 1.5], period: [22, 30], opacity: 0.5 },
  { hue: null, tracksAccent: true, pos: [2.6, -1.2, -1.8], scale: 8, amp: [1.8, 2.0], period: [28, 20], opacity: 0.4 },
]

function Glow({ spec, accent, speed, texture }) {
  const ref = useRef()
  const mat = useRef()
  const t = useRef(Math.random() * 100) // desynchronise the paths on mount
  const target = useMemo(() => new THREE.Color(spec.hue || accent), [spec.hue, accent])

  target.set(spec.hue || accent)

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1) // a dropped frame must not jolt the field
    t.current += d * speed
    if (ref.current) {
      const [ax, ay] = spec.amp
      const [px, py] = spec.period
      ref.current.position.x = spec.pos[0] + Math.sin((t.current / px) * Math.PI * 2) * ax
      ref.current.position.y = spec.pos[1] + Math.cos((t.current / py) * Math.PI * 2) * ay
      // Breathing scale, tiny - enough to feel alive, not enough to notice.
      const b = 1 + Math.sin((t.current / 17) * Math.PI * 2) * 0.07
      ref.current.scale.setScalar(spec.scale * b)
    }
    if (mat.current && spec.tracksAccent) {
      mat.current.color.lerp(target, Math.min(1, d * 2.2))
    }
  })

  return (
    <sprite ref={ref} position={spec.pos} scale={spec.scale}>
      <spriteMaterial
        ref={mat}
        map={texture}
        color={spec.hue || accent}
        transparent
        opacity={spec.opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
      />
    </sprite>
  )
}

export default function Aurora({ accent = '#34D399', speed = 1, intensity = 1 }) {
  const texture = useMemo(makeGlowTexture, [])

  return (
    <group>
      {GLOWS.map((spec, i) => (
        <Glow
          key={i}
          spec={{ ...spec, opacity: spec.opacity * intensity }}
          accent={accent}
          speed={speed}
          texture={texture}
        />
      ))}
    </group>
  )
}
