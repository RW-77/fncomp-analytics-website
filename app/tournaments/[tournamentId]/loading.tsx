import React from "react"

const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse rounded bg-white/[0.06] ${className ?? ""}`} style={style} />
)

export default function Loading() {
  return (
    <div>
      {/* Floating filters — one row, above and separate from the table */}
      <div className="mb-2.5 flex flex-col gap-3 lg:flex-row lg:items-end">
        <Skeleton className="h-[3.25rem] w-full rounded-lg lg:w-56 lg:shrink-0" />
        <Skeleton className="h-[3.25rem] w-full rounded-lg lg:w-80 lg:shrink-0" />
        <Skeleton className="h-[3.25rem] w-full rounded-lg lg:w-80 lg:shrink-0" />
      </div>

      {/* Table surface */}
      <div className="overflow-hidden rounded-xl bg-[#141d30]">
        {/* Table controls */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4">
          <Skeleton className="h-8 w-full max-w-md" />
          <Skeleton className="h-8 w-32 shrink-0" />
        </div>

        {/* Header row */}
        <div className="flex gap-4 border-b border-white/[0.06] px-4 py-3">
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
    </div>
  )
}
