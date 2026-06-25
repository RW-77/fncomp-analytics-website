import React from "react"

const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse rounded bg-white/[0.07] ${className ?? ""}`} style={style} />
)

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header block — mirrors the "Tournament Library" section */}
      <section className="mb-6 rounded-2xl border border-white/8 bg-[#0b1321]/80 px-5 py-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <div className="space-y-2">
          <Skeleton className="h-2.5" style={{ width: 140 }} />
          <Skeleton className="h-8" style={{ width: 240 }} />
          <Skeleton className="h-3.5" style={{ width: 420, maxWidth: "100%" }} />
        </div>
      </section>

      {/* Card grid — matches the live grid columns and min card height */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-xl border border-white/8 bg-[#0b1321]/90 p-5 shadow-[0_18px_50px_rgba(2,6,23,0.28)]"
          >
            {/* Region chips */}
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6" style={{ width: 56, borderRadius: 9999 }} />
              <Skeleton className="h-6" style={{ width: 56, borderRadius: 9999 }} />
            </div>

            {/* Title + footer */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-5" style={{ width: "80%" }} />
                <Skeleton className="h-5" style={{ width: "55%" }} />
              </div>

              <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-2" style={{ width: 64 }} />
                  <Skeleton className="h-3.5" style={{ width: 120 }} />
                </div>
                <div className="space-y-1.5 text-right">
                  <Skeleton className="ml-auto h-2" style={{ width: 48 }} />
                  <Skeleton className="ml-auto h-3.5" style={{ width: 32 }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
