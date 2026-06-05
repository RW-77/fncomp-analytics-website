import React from "react"

const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse rounded bg-white/[0.07] ${className ?? ""}`} style={style} />
)

export default function Loading() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0b1321]/80">
      {/* Header row */}
      <div className="flex gap-4 border-b border-white/8 px-4 py-3">
        {[120, 80, 80, 80, 80, 80, 80].map((w, i) => (
          <Skeleton key={i} className="h-3" style={{ width: w }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 border-b border-white/[0.04] px-4 py-3 last:border-0"
        >
          {[120, 80, 80, 80, 80, 80, 80].map((w, j) => (
            <Skeleton key={j} className="h-3.5" style={{ width: w }} />
          ))}
        </div>
      ))}
    </div>
  )
}
