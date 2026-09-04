import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

/*
 * Slow drifting point cloud behind the weekly wrap. That page is the one that
 * says "no score here", so it gets the quietest 3D we have: 700 points on a
 * flattened sphere, turning slowly enough that you only notice if you stop and
 * look. Generated once with useMemo, never reallocated.
 */
export default function Particles({ color = '#34D399', speed = 1, count = 700 }) {
  const ref = useRef()

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 3.1 + Math.random() * 3.6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.cos(phi) * 0.45 // flattened, so it reads as a field
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return arr
  }, [count])

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1)
    if (!ref.current) return
    ref.current.rotation.y += d * 0.045 * speed
    ref.current.rotation.x += d * 0.012 * speed
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color={color}
        transparent
        opacity={0.62}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
