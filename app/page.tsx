import Link from "next/link"
import { ArrowRight, BarChart3, Database, Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getPreviewPlayerStats } from "@/lib/stats"
import { prisma } from "@/lib/prisma"
import {
  compareTournamentRegions,
  getTournamentDisplayTitle,
} from "@/lib/tournaments"

// Statically generate the homepage and regenerate it at most once an hour (ISR).
// The preview data only changes when a new tournament is ingested, so there's no
// need to rebuild it on every request.
export const revalidate = 3600



const featureCards = [
  {
    title: "Tournament coverage",
    description: "Organize event windows by series and region so analysts can move through tournaments quickly.",
    icon: Database,
  },
  {
    title: "Time and Distance Filters",
    description: "Know when and how eliminations, damage, and assist events occured.",
    icon: Filter,
  },
  {
    title: "Advanced Stats",
    description: "Geometric shot accuracy, shot attempt detection, true assists, and more.",
    icon: BarChart3,
  },
]

/**
 * Builds the homepage's "latest tournament" preview. Picks the tournament with
 * the most recent event_window start time, then scopes the preview to a single
 * region (NAC when present, otherwise the first available region) so the top
 * players read as one leaderboard rather than a mix across regions.
 */
async function getHomepagePreview() {
  const latestEventWindow = await prisma.event_windows.findFirst({
    where: { tournament_id: { not: null }, start_time: { not: null } },
    orderBy: { start_time: "desc" },
    select: { tournament_id: true },
  })

  if (!latestEventWindow?.tournament_id) {
    return null
  }

  const tournamentId = latestEventWindow.tournament_id

  const [tournament, eventWindows] = await Promise.all([
    prisma.tournaments.findUnique({ where: { tournament_id: tournamentId } }),
    prisma.event_windows.findMany({
      where: { tournament_id: tournamentId },
      include: { events: true },
    }),
  ])

  if (!tournament || eventWindows.length === 0) {
    return null
  }

  const regions = Array.from(
    new Set(
      eventWindows
        .map((eventWindow) => eventWindow.events?.region_code)
        .filter((region): region is string => Boolean(region))
    )
  ).sort(compareTournamentRegions)

  // Scope the preview to a single region — NAC by default, else the first
  // available region — so the leaderboard isn't mixed across regions.
  const previewRegion = regions.includes("NAC") ? "NAC" : regions[0] ?? null

  const regionEventWindows = previewRegion
    ? eventWindows.filter(
        (eventWindow) => eventWindow.events?.region_code === previewRegion
      )
    : eventWindows

  const eventWindowIds = regionEventWindows.map(
    (eventWindow) => eventWindow.event_window_id
  )
  const matches = await prisma.matches.findMany({
    where: { event_window_id: { in: eventWindowIds } },
    select: { match_id: true },
    orderBy: { start_time: "desc" },
  })

  const statsRows = await getPreviewPlayerStats(matches.map((match) => match.match_id))

  const topRows = [...statsRows]
    .sort(
      (left, right) =>
        (right.eliminations ?? 0) - (left.eliminations ?? 0) ||
        (right.damageDealt ?? 0) - (left.damageDealt ?? 0)
    )
    .slice(0, 4)
    .map((row) => ({
      player: row.player,
      eliminations: row.eliminations.toLocaleString(),
      damage: row.damageDealt.toLocaleString(),
    }))

  return {
    tournamentId,
    title: getTournamentDisplayTitle(tournament),
    region: previewRegion,
    trackedPlayers: statsRows.length.toLocaleString(),
    matchCount: matches.length.toLocaleString(),
    rows: topRows,
  }
}

export default async function Home() {
  const preview = await getHomepagePreview()

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-8 pb-10 pt-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-start lg:gap-10 lg:pt-18">
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="max-w-3xl font-[family-name:var(--font-sora)] text-5xl font-extrabold tracking-[-0.03em] text-white sm:text-6xl lg:text-[4.1rem] lg:leading-[0.98]">
              <span className="text-gradient-gold">Intelligent</span> Fortnite Analytics
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Explore tournaments, filter stats, and compare player output across competitive Fortnite.
            </p>
          </div>

          <div className="flex justify-center">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-xl bg-[var(--accent-gold)] px-8 text-lg font-semibold text-[var(--accent-gold-fg)] shadow-[0_0_0_1px_rgba(236,214,153,0.35),0_24px_50px_rgba(227,201,126,0.20)] transition-colors hover:bg-[var(--accent-gold-strong)] sm:min-w-[300px]"
            >
              <Link href="/tournaments">
                Browse tournaments
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {featureCards.map((feature) => {
              const Icon = feature.icon

              return (
                <Card
                  key={feature.title}
                  className="gap-3 border-white/8 bg-[#0b1321]/75 py-4 shadow-[0_10px_30px_rgba(2,6,23,0.2)]"
                >
                  <CardContent className="space-y-3 px-4">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-[var(--accent-gold)]/20 bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]">
                      <Icon className="size-4" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-sm font-semibold text-white">{feature.title}</h2>
                      <p className="text-sm leading-6 text-slate-400">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {preview ? (
          <Link
            href={`/tournaments/${preview.tournamentId}`}
            className="group block overflow-hidden rounded-xl bg-[#141d30] shadow-[0_24px_80px_rgba(2,6,23,0.45)] transition-colors hover:bg-[#16203552]"
          >
            <div className="border-b border-white/[0.06] px-5 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Latest Tournament
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <div className="text-lg font-semibold text-white transition-colors group-hover:text-[var(--accent-gold-strong)]">
                  {preview.title}
                </div>
                {preview.region && (
                  <span className="rounded-full border border-[var(--accent-gold)]/20 bg-[var(--accent-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-gold)]">
                    {preview.region}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-400">
                <span>
                  <span className="font-semibold text-white tabular-nums">{preview.trackedPlayers}</span> players
                </span>
                <span aria-hidden className="text-slate-600">·</span>
                <span>
                  <span className="font-semibold text-white tabular-nums">{preview.matchCount}</span> matches
                </span>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(84px,0.8fr))] gap-3 border-b border-white/[0.06] bg-[#1c2942] px-4 py-2.5 text-[13px] font-medium tracking-tight">
                <span className="text-slate-400">Player</span>
                <span className="text-center text-[var(--accent-gold)]">Elims</span>
                <span className="text-center text-slate-400">Damage</span>
              </div>

              {preview.rows.map((row) => (
                <div
                  key={row.player}
                  className="grid grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(84px,0.8fr))] gap-3 border-b border-white/[0.05] px-4 py-2.5 text-sm text-slate-300 last:border-b-0"
                >
                  <span className="truncate font-medium text-white">{row.player}</span>
                  <span className="text-center font-medium tabular-nums">{row.eliminations}</span>
                  <span className="text-center font-medium tabular-nums">{row.damage}</span>
                </div>
              ))}
            </div>
          </Link>
        ) : (
          <div className="overflow-hidden rounded-xl bg-[#141d30] px-5 py-8 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
              Latest Tournament
            </div>
            <div className="mt-1 text-lg font-semibold text-white">No tournaments available</div>
            <div className="mt-1 text-sm text-slate-400">
              Tournament data will appear here when matches are available.
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
