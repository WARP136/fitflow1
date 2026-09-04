import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'
import Lights from './Lights.jsx'

/*
 * Loose cluster of floating primitives behind the Move page. Every shape
 * drifts on its own Float cycle at its own speed so the group never falls into
 * visible lockstep, and the cluster rotates slowly as one body so it doesn't
 * read as a static image with wobble bolted on.
 *
 * Each shape lerps its own material colour toward the accent. Looks like
 * duplicated work, but one shared THREE.Color doesn't work here:
 * react-three-fiber only re-applies a prop when the reference changes, so a
 * mutated shared object never reaches the materials.
 */

const SHAPES = [
  { kind: 'torus', pos: [-2.9, 1.2, -1], s: 0.72, spin: 1.0 },
  { kind: 'octa', pos: [2.95, 0.5, -0.6], s: 0.62, spin: 1.35 },
  { kind: 'sphere', pos: [1.6, -1.7, 0.4], s: 0.45, spin: 0.8 },
  { kind: 'box', pos: [-1.9, -1.9, -0.8], s: 0.5, spin: 1.15 },
  { kind: 'torus', pos: [0.2, 2.1, -1.8], s: 0.42, spin: 0.7 },
]

function Shape({ kind, pos, s, spin, color, speed }) {
  const mesh = useRef()
  const mat = useRef()
  const [initialColor] = useState(color)
  const target = useRef(new THREE.Color(initialColor))

  target.current.set(color)

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1)
    if (mesh.current) {
      mesh.current.rotation.x += d * 0.28 * spin * speed
      mesh.current.rotation.y += d * 0.2 * spin * speed
    }
    if (mat.current) {
      mat.current.color.lerp(target.current, Math.min(1, d * 2.2))
    }
  })

  return (
    <Float
      speed={(0.8 + spin * 0.4) * speed}
      rotationIntensity={0.5}
      floatIntensity={1.1}
    >
      <mesh ref={mesh} position={pos} scale={s}>
        {kind === 'torus' && <torusGeometry args={[1, 0.36, 20, 60]} />}
        {kind === 'octa' && <octahedronGeometry args={[1, 0]} />}
        {kind === 'sphere' && <sphereGeometry args={[1, 32, 32]} />}
        {kind === 'box' && <boxGeometry args={[1.3, 1.3, 1.3]} />}
        <meshStandardMaterial
          ref={mat}
          color={initialColor}
          roughness={0.28}
          metalness={0.3}
          transparent
          opacity={0.82}
        />
      </mesh>
    </Float>
  )
}

export default function ShapeField({ color = '#34D399', speed = 1 }) {
  const group = useRef()

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1)
    if (group.current) group.current.rotation.y += d * 0.05 * speed
  })

  return (
    <>
      <Lights intensity={0.92} />
      <group ref={group}>
        {SHAPES.map((sh, i) => (
          <Shape key={i} {...sh} color={color} speed={speed} />
        ))}
      </group>
    </>
  )
}
