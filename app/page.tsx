import { DocsSection } from "@/components/home/docs-section"
import { Hero } from "@/components/home/hero"
import { ReplaySection } from "@/components/home/replay-section"
import { StatsSection } from "@/components/home/stats-section"
import type { Metadata } from "next"

import { getHomeCounters, getLatestReplayHref, getStatsDemo, getVisitorCount } from "@/lib/home"

// Statically generate the homepage and regenerate it at most every 15 minutes
// (ISR), for the visitor count. The counters, the latest game and the stats
// demo only change when a match is ingested.
export const revalidate = 900

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default async function Home() {
  const [counters, latestReplay, visitors, statsDemo] = await Promise.all([
    getHomeCounters(),
    getLatestReplayHref(),
    getVisitorCount(),
    getStatsDemo(),
  ])

  // Sections are divided by full-width hairlines (each draws its own top rule)
  // on one page background, rather than by changing colors.
  return (
    <main>
      <Hero counters={counters} latestReplay={latestReplay} visitors={visitors} />
      <ReplaySection latestReplay={latestReplay} />
      {statsDemo && <StatsSection demo={statsDemo} />}
      <DocsSection />
    </main>
  )
}
