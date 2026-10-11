import Link from "next/link"
import { ArrowRight, Play } from "lucide-react"

import { cn } from "@/lib/utils"
import { Typewriter } from "@/components/home/typewriter"

// The words the first line types out. Each keeps its own width; the font
// size below is set so the longest line ("Fortnite Analytics", or the
// longest word) still fits on one line. Micro-level comes before macro-level.
const WORDS = ["Intelligent", "Context-aware", "Micro-level", "Macro-level", "Play-by-play", "Deeper", "Nuanced"]

// The homepage headline, subhead and calls to action. The headline scales
// with this block's width (container query units), not the window's, so the
// same copy fits a half-width column or the full page.
// `latestReplay` is the newest game's match page (no button without one);
// `visitors` is the site's all-time visitor count (no line without one).
export function HeroCopy({
  latestReplay,
  visitors,
  className,
}: {
  latestReplay: string | null
  visitors: number | null
  className?: string
}) {
  return (
    <div className={cn("@container flex flex-col gap-7", className)}>
      <h1 className="text-[clamp(1.75rem,10.5cqi,5.75rem)] font-[family-name:var(--font-sora)] font-extrabold leading-[1.04] tracking-[-0.035em] text-white">
        <span className="sr-only">Fortnite Analytics: intelligent, context-aware, micro-level, macro-level, play-by-play, deeper, nuanced.</span>
        <span aria-hidden className="block whitespace-nowrap">
          <Typewriter words={WORDS} className="text-[var(--accent-gold)]" />
        </span>
        <span aria-hidden className="block whitespace-nowrap">Fortnite Analytics</span>
      </h1>
      <div className="flex max-w-xl flex-col gap-2">
        <p className="text-lg font-semibold text-slate-100 sm:text-xl">Analyze competitive Fortnite on a deeper level.</p>
        <p className="text-base leading-7 text-slate-300 sm:text-lg">
          Tournament standings, player stats, match analysis, event grouping, and so much more. Your personal toolbox for competitive.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/tournaments"
            className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-[var(--accent-gold)] px-5 text-[15px] font-semibold text-[var(--accent-gold-fg)] hover:bg-[var(--accent-gold-strong)]"
          >
            Browse tournaments
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          {latestReplay && (
            <Link
              href={latestReplay}
              className="inline-flex h-11 items-center gap-2 rounded-[4px] border border-[var(--panel-control)] px-5 text-[15px] font-semibold text-slate-100 hover:bg-white/[0.04]"
            >
              <Play className="size-4 fill-current" aria-hidden />
              Watch the latest game
            </Link>
          )}
          {/* On phones it wraps under the buttons; -ml-2 lines its text up with theirs */}
          <Link
            href="/docs"
            className="-ml-2 inline-flex h-11 items-center gap-1.5 px-2 text-[15px] font-semibold text-slate-300 hover:text-white sm:ml-0"
          >
            Read the docs
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {visitors !== null && (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            <span>
              Join <span className="font-medium tabular-nums text-slate-200">{visitors.toLocaleString("en-US")}</span>{" "}
              competitive Fortnite analysts
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
