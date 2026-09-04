/*
 * Seamless ticker. Render the list twice in one flex row and animate from
 * translateX(0) to -50%: at -50% the second copy sits exactly where the first
 * started, so the restart is invisible. Duration follows the energy tempo.
 */
export default function Marquee({ items, speedSeconds = 32, className = '' }) {
  const row = [...items, ...items]
  return (
    <div className={`mask-fade-x relative overflow-hidden ${className}`}>
      <div
        className="flex w-max gap-3 animate-marquee hover:[animation-play-state:paused]"
        style={{ animationDuration: `calc(${speedSeconds}s * var(--tempo))` }}
      >
        {row.map((item, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-2 rounded-full border border-edge/80 bg-white/[0.05] px-5 py-2.5 text-sm text-ink/80 backdrop-blur"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
