import Link from "next/link"
import { Play } from "lucide-react"

import { ReplayDemos } from "@/components/home/replay-demos"
import { SectionHeading } from "@/components/home/section-heading"

// The replay viewer's section: its pitch and a way in, then the walkthrough
// of its fights and players panels.
export function ReplaySection({ latestReplay }: { latestReplay: string | null }) {
  return (
    <section className="border-t border-white/[0.06]">
      <div className="section-x py-20 lg:py-28">
        <div className="flex flex-col gap-6">
          <SectionHeading title="Introducing the FNAnalytics 2D replay viewer" size="lg" className="max-w-5xl [&>div]:max-w-3xl">
            The most advanced of its kind. Every game&apos;s events are detected and grouped into fights,
            and every engagement is evaluated. Inspect any player&apos;s live vitals, inventory and stats, and filter
            the events down to the types you care about.
          </SectionHeading>
          {latestReplay && (
            <Link
              href={latestReplay}
              className="inline-flex h-10 items-center gap-2 self-start rounded-[4px] border border-[var(--panel-control)] px-4 text-sm font-semibold text-[var(--accent-gold)] hover:bg-white/[0.04] hover:text-[var(--accent-gold-strong)]"
            >
              <Play className="size-3.5 fill-current" aria-hidden />
              Try it out
            </Link>
          )}
        </div>
        <ReplayDemos className="mt-12 lg:mt-4" />
      </div>
    </section>
  )
}
