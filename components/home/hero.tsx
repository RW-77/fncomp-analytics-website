import type { HomeCounters } from "@/lib/home"
import { FightsVideo } from "@/components/home/fights-video"
import { HeroCopy } from "@/components/home/hero-copy"

// Over a million, a counter shortens to one decimal ("128.4M").
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const formatCount = (n: number) => (n >= 1_000_000 ? compact.format(n) : n.toLocaleString("en-US"))

function Counters({ counters }: { counters: HomeCounters }) {
  const figures = [
    { value: counters.players, label: "players tracked" },
    { value: counters.events, label: "match events" },
    { value: counters.eliminations, label: "eliminations mapped" },
    { value: counters.shots, label: "shots tracked" },
  ]
  return (
    <dl className="grid grid-cols-2 border-l border-t border-white/[0.08] lg:grid-cols-4">
      {figures.map((f) => (
        <div
          key={f.label}
          className="flex flex-col gap-1 border-b border-r border-white/[0.08] bg-[color-mix(in_srgb,var(--app-bg)_88%,transparent)] px-5 py-4 lg:px-6 lg:py-5"
        >
          <dt className="order-2 text-sm text-slate-400">{f.label}</dt>
          <dd className="font-[family-name:var(--font-sora)] text-3xl font-bold tabular-nums tracking-[-0.02em] text-white lg:text-4xl">
            {formatCount(f.value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// The homepage's first screen: the headline with the fight-grouping video
// playing behind it and the counters under it, filling the screen.
export function Hero({
  counters,
  latestReplay,
  visitors,
}: {
  counters: HomeCounters
  latestReplay: string | null
  visitors: number | null
}) {
  return (
    <section className="relative isolate flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-[var(--app-bg)]">
      {/* lighten: only what's lighter than the page shows (lines, arrows,
          the card), so the video's own dark background is never seen */}
      <div className="absolute inset-y-0 right-0 -z-10 flex w-full items-center opacity-80 mix-blend-lighten lg:w-[64%]">
        <FightsVideo className="w-full" />
      </div>
      <div className="page-x flex flex-1 flex-col justify-center gap-14 py-16 lg:py-20">
        <HeroCopy latestReplay={latestReplay} visitors={visitors} className="max-w-4xl" />
        <Counters counters={counters} />
      </div>
    </section>
  )
}
