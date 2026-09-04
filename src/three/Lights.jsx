/*
 * One lighting rig, reused by every solid 3D object so the geometry all looks
 * like it lives in the same room.
 *
 * No environment map: drei's Environment presets fetch HDR files from a CDN
 * and nothing here depends on the network.
 *
 * The two coloured fills are what stop dark geometry going grey. A violet key
 * above-left and a cyan bounce below-right keeps a hue on the shadowed side of
 * everything, which is why the objects read as lit rather than as flat shapes.
 */
export default function Lights({ intensity = 1 }) {
  return (
    <>
      <ambientLight intensity={0.35 * intensity} />
      <directionalLight position={[4, 6, 5]} intensity={0.9 * intensity} />
      <directionalLight
        position={[-5, 4, 2]}
        intensity={0.7 * intensity}
        color="#A78BFA"
      />
      <directionalLight
        position={[3, -4, -3]}
        intensity={0.55 * intensity}
        color="#22D3EE"
      />
      <pointLight
        position={[0, 2, 4]}
        intensity={0.5 * intensity}
        color="#6EE7B7"
      />
    </>
  )
}
