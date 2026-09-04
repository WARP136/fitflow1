/*
 * No-WebGL fallback. If we can't get a context, or three.js throws, Scene
 * renders this: a blurred breathing orb from two stacked radial gradients in
 * the current accent. Not the same effect, but the page keeps a soft moving
 * focal point in the right place and nothing reads as broken.
 */
export default function CssOrb({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 grid place-items-center ${className}`}
    >
      <div className="relative h-[22rem] w-[22rem]">
        <div
          className="animate-breathe absolute inset-0 rounded-full blur-[38px]"
          style={{
            background:
              'radial-gradient(circle at 38% 34%, rgba(var(--accent-rgb),.85), rgba(var(--accent-rgb),.25) 58%, rgba(var(--accent-rgb),0) 74%)',
          }}
        />
        <div
          className="animate-breathe absolute inset-[18%] rounded-full blur-[22px]"
          style={{
            background:
              'radial-gradient(circle at 62% 62%, rgba(var(--g-mint),.7), rgba(var(--g-mint),0) 68%)',
          }}
        />
      </div>
    </div>
  )
}
