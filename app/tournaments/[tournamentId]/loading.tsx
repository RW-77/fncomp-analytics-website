import React from "react"

const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse rounded bg-white/[0.07] ${className ?? ""}`} style={style} />
)

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header card */}
      <section className="mb-6 rounded-2xl border border-white/8 bg-[#0b1321]/80 px-5 py-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            {/* Back link */}
            <Skeleton className="h-3.5 w-36" />

            <div className="space-y-2">
              {/* "Tournament Detail" label */}
              <Skeleton className="h-3 w-28" />
              {/* Title */}
              <Skeleton className="h-9 w-72" />
              {/* Subtitle */}
              <Skeleton className="h-4 w-48" />
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-7 w-10" />
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-5 w-36" />
            </div>
          </div>
        </div>
      </section>

      {/* Filters toggle */}
      <div className="mb-4 w-fit overflow-hidden rounded-2xl border border-white/8 bg-[#0b1321]/80 px-4 py-3.5">
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Table skeleton */}
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
    </div>
  )
}
