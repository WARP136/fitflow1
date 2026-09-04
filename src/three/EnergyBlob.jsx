import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Icosahedron, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import Lights from './Lights.jsx'

/*
 * Soft, slowly deforming sphere - the energy system in three dimensions. Its
 * colour is the current accent; rotation speed and surface turbulence follow
 * the tempo, so a steady day is a calm emerald shape barely moving and a
 * full-send day is bright lime and restless.
 *
 * The colour is lerped, not set, so changing energy walks the sphere to the
 * new green over about half a second.
 */
export default function EnergyBlob({ color = '#34D399', speed = 1, scale = 2.15 }) {
  const mesh = useRef()
  const mat = useRef()
  // Captured once so React never snaps the colour; useFrame owns it after this.
  const [initialColor] = useState(color)
  const target = useRef(new THREE.Color(initialColor))

  target.current.set(color)

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1) // clamp so a dropped frame can't jolt the scene
    if (mesh.current) {
      mesh.current.rotation.y += d * 0.2 * speed
      mesh.current.rotation.x += d * 0.07 * speed
    }
    if (mat.current) {
      mat.current.color.lerp(target.current, Math.min(1, d * 2.4))
    }
  })

  return (
    <>
      <Lights />
      <Float speed={1.1 * speed} rotationIntensity={0.3} floatIntensity={0.85}>
        <Icosahedron ref={mesh} args={[1, 16]} scale={scale}>
          <MeshDistortMaterial
            ref={mat}
            color={initialColor}
            distort={0.34 + 0.1 * speed}
            speed={1.5 * speed}
            roughness={0.2}
            metalness={0.24}
            transparent
            opacity={0.94}
          />
        </Icosahedron>
      </Float>
    </>
  )
}
