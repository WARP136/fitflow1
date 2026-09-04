// Small labelled figure. Tabular numerals so live values don't jitter.
export default function StatCard({ label, value, unit, sub, className = '' }) {
  return (
    <div className={`glass px-6 py-5 ${className}`}>
      <p className="eyebrow">{label}</p>
      <p className="num mt-2 font-display text-[34px] leading-none text-ink">
        {value}
        {unit && <span className="ml-1 text-[15px] font-medium text-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-1.5 text-[12.5px] text-muted">{sub}</p>}
    </div>
  )
}
