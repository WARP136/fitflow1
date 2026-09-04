import { useEffect, useRef, useState } from 'react'
import Lottie from 'lottie-react'

/*
 * Lottie wrapper. Must never be the reason something crashes mid-demo.
 *
 * - The JSON is fetched at runtime from /public/lottie, not imported at
 *   build time. A missing file therefore cannot break the build; it just
 *   renders the fallback.
 * - autoplay is off, so the animation sits parked on frame 0 until told
 *   to play. That is what makes "paused until you press Start" work.
 * - speed is driven from outside via setSpeed(), which is how the energy
 *   level changes the pace of the exercise animation.
 * - playing=false pauses in place (it does not rewind); bump resetKey to
 *   send it back to frame 0.
 */
/*
 * Most LottieFiles exercise animations are drawn on a white artboard, and
 * that artboard ships in the JSON as a full-size solid layer (ty: 1, usually
 * "White Solid"). On a near-black page it's a hard white rectangle behind the
 * figure. Stripping those layers makes the animation transparent so the
 * figure sits on the card.
 *
 * Done at runtime rather than by editing the files, so anything dropped into
 * public/lottie later gets the same treatment for free.
 *
 * Two cases, because illustrators do backdrops two ways:
 *
 * 1. A full-canvas solid (ty: 1). Size is on the layer so we can measure it.
 *    Only full-canvas ones go - a small solid is part of the artwork (a mat,
 *    a shadow, a phone screen) and dropping it would gut the drawing.
 *
 * 2. A shape layer named "BG" or "Background". Its size lives in a nested
 *    bezier path, and a portrait's backdrop is usually a circle smaller than
 *    the canvas anyway, so measuring wouldn't catch it. The name is the
 *    better signal - nobody calls a hand or a dumbbell "BG". This is what
 *    kills the grey disc behind Neha so we can draw it in CSS instead and
 *    have it follow the accent colour.
 *
 * The backdrop isn't always top-level, which cost an afternoon to find.
 * jumpingsquats.json has exactly one top-level layer - a precomp (ty: 0)
 * wrapping everything - with its white artboard as the 33rd layer inside, in
 * assets[0].layers. A stripper that only walks json.layers finds nothing and
 * the rectangle survives. pushup.json and jumpingjacks.json expose the same
 * #f5f5f5 solid at the top level, which is why two came out transparent and
 * the third didn't. Hence stripComp() below, run over the root and every
 * precomp asset.
 */
const BG_NAMES = /^(bg|background|bgc|back)(\s|_|-|\d)*$/i

/*
 * Strip backdrops out of one composition's layer list.
 *
 * refW/refH are what "full-canvas" gets measured against: the animation's own
 * w/h at the root, the precomp's declared size inside one, falling back to the
 * root when it doesn't declare one (AE often omits it, and a precomp wrapping
 * the whole animation is canvas size anyway).
 *
 * Returns the same array reference when there's nothing to drop - callers use
 * that check to skip rebuilding an animation that didn't need touching.
 */
function stripComp(layers, refW, refH) {
  if (!Array.isArray(layers) || layers.length === 0) return layers

  const solid = (l) =>
    l.ty === 1 && (l.sw || 0) >= refW * 0.98 && (l.sh || 0) >= refH * 0.98
  const named = (l) => l.ty === 4 && BG_NAMES.test((l.nm || '').trim())
  const drop = (l) => solid(l) || named(l)

  const doomed = layers.filter(drop)
  if (doomed.length === 0) return layers
  // Never empty a composition. If everything in here looks like a backdrop then
  // the measurement is wrong, and a blank card is worse than a white one.
  if (doomed.length === layers.length) return layers

  const gone = new Set(doomed.map((l) => l.ind))
  return layers
    .filter((l) => !drop(l))
    // A layer parented to the backdrop would be orphaned by the removal, which
    // Lottie renders as a jump to the origin. Cut the parent link instead;
    // losing an inherited transform is far less visible than a flying limb.
    // `ind` and `parent` are scoped to one composition, which is exactly why
    // this repair has to happen per-composition rather than once globally.
    .map((l) => (gone.has(l.parent) ? { ...l, parent: undefined } : l))
}

function stripBackdrop(json) {
  if (!json) return json
  const w = json.w || 0
  const h = json.h || 0

  const layers = stripComp(json.layers, w, h)

  let assets = json.assets
  if (Array.isArray(assets)) {
    let touched = false
    const next = assets.map((a) => {
      // Image assets have no layers; only precomps do.
      if (!a || !Array.isArray(a.layers)) return a
      const inner = stripComp(a.layers, a.w || w, a.h || h)
      if (inner === a.layers) return a
      touched = true
      return { ...a, layers: inner }
    })
    if (touched) assets = next
  }

  if (layers === json.layers && assets === json.assets) return json
  // Assign only what actually changed, so a file with no `assets` key does not
  // come out of here with `assets: undefined` bolted on.
  const out = { ...json }
  if (layers !== json.layers) out.layers = layers
  if (assets !== json.assets) out.assets = assets
  return out
}

export default function LottieBox({
  src,
  playing = false,
  speed = 1,
  loop = true,
  resetKey = 0,
  className = '',
  fallback = null,
  transparent = true,
}) {
  const [data, setData] = useState(null)
  const [missing, setMissing] = useState(false)
  const anim = useRef(null)
  const lastReset = useRef(resetKey)
  // Mirrored into a ref so the reset effect can read the latest value
  // without listing `playing` as a dependency (which would rewind on pause).
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    let alive = true
    setData(null)
    setMissing(false)
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then((json) => alive && setData(transparent ? stripBackdrop(json) : json))
      .catch(() => alive && setMissing(true))
    return () => {
      alive = false
    }
  }, [src, transparent])

  useEffect(() => {
    if (anim.current && data) anim.current.setSpeed(speed)
  }, [speed, data])

  useEffect(() => {
    if (!anim.current || !data) return
    anim.current.pause()
  }, [playing, data])

  useEffect(() => {
    if (!anim.current || !data) return
    if (lastReset.current === resetKey) return // don't rewind on first mount
    lastReset.current = resetKey
    anim.current.goToAndStop(0, true)
  }, [resetKey, data])

  if (missing) {
    return (
      fallback || (
        <div className={`grid place-items-center ${className}`}>
          <div
            className="animate-breathe h-24 w-24 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, rgba(var(--accent-rgb),.5), rgba(var(--accent-rgb),.12))',
            }}
          />
        </div>
      )
    )
  }

  if (!data) {
    return (
      <div className={`grid place-items-center ${className}`}>
        <div className="h-24 w-24 animate-pulse rounded-full bg-mist" />
      </div>
    )
  }

  return (
    <Lottie
      lottieRef={anim}
      animationData={data}
      loop={loop}
      autoplay={false}
      className={className}
    />
  )
}
