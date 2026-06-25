import Link from "next/link"
import { ArrowRight, BarChart3, Database, Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getFilteredStats } from "@/lib/actions"
import { prisma } from "@/lib/prisma"
import {
  compareTournamentRegions,
  getTournamentDisplayTitle,
} from "@/lib/tournaments"

import { cacheLife, cacheTag } from "next/cache"


const featureCards = [
  {
    title: "Tournament coverage",
    description: "Organize event windows by series and region so analysts can move through weekends quickly.",
    icon: Database,
  },
  {
    title: "Scenario filters",
    description: "Drill into matches, weapon pools, damage distance, and time windows without leaving the stats view.",
    icon: Filter,
  },
  {
    title: "Player comparison",
    description: "Sort clean elimination and damage output tables to spot consistent performers and outliers.",
    icon: BarChart3,
  },
]

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function formatDateRange(startTime: Date | null, endTime: Date | null) {
  if (!startTime && !endTime) {
    return "Date unavailable"
  }

  if (startTime && endTime) {
    return `${dateFormatter.format(startTime)} - ${dateFormatter.format(endTime)}`
  }

  return dateFormatter.format(startTime ?? endTime ?? new Date())
}

/**
 * Builds the homepage's "latest tournament" preview card. Picks the tournament
 * with the most recent event_window start time and aggregates regions, matches,
 * and top players across all of its event_windows.
 */
async function getHomepagePreview() {
  "use cache"
  cacheLife("max")
  cacheTag("preview-stats")
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

  const eventWindowIds = eventWindows.map((eventWindow) => eventWindow.event_window_id)
  const matches = await prisma.matches.findMany({
    where: { event_window_id: { in: eventWindowIds } },
    select: { match_id: true },
    orderBy: { start_time: "desc" },
  })

  const statsRows = await getFilteredStats({
    selectedMatches: matches.map((match) => match.match_id),
    weaponTypes: [],
    distanceRange: [0, 400],
    timeRange: [0, 30],
  })

  const startTimes = eventWindows
    .map((eventWindow) => eventWindow.start_time)
    .filter((value): value is Date => value !== null)
  const endTimes = eventWindows
    .map((eventWindow) => eventWindow.end_time)
    .filter((value): value is Date => value !== null)
  const startTime = startTimes.length
    ? new Date(Math.min(...startTimes.map((d) => d.getTime())))
    : null
  const endTime = endTimes.length
    ? new Date(Math.max(...endTimes.map((d) => d.getTime())))
    : null

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

  const dateRange = formatDateRange(startTime, endTime)
  const title = getTournamentDisplayTitle(tournament)

  return {
    title,
    subtitle: `Latest tournament overview across ${regions.length} region${regions.length === 1 ? "" : "s"}`,
    badge: `${regions.join(", ")} · ${matches.length} matches`,
    stats: [
      { label: "Tracked players", value: statsRows.length.toLocaleString() },
      { label: "Match count", value: matches.length.toLocaleString() },
      { label: "Date range", value: dateRange },
    ],
    chips: [
      "Latest tournament",
      `Regions: ${regions.join(", ")}`,
      `Window: ${dateRange}`,
    ],
    rows: topRows,
  }
}

export default async function Home() {
  const preview = await getHomepagePreview()

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-8 pb-10 pt-4 lg:grid-cols-[1.02fr_0.98fr] lg:items-start lg:gap-10 lg:pt-10">
        <div className="space-y-6">
          <div className="inline-flex items-center rounded-full border border-sky-400/15 bg-sky-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-sky-200">
            Fortnite Competitive Analytics
          </div>

          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]">
              Intelligent Fortnite analytics with context
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Explore tournaments, filter stats, and compare player output across competitive Fortnite.
            </p>
          </div>

          <div className="flex justify-center">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-xl px-8 text-lg font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(125,211,252,0.42),0_28px_56px_rgba(14,165,233,0.22)] transition-colors hover:bg-sky-300 sm:min-w-[300px]"
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
                    <div className="flex size-9 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-sky-300">
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

        <Card className="overflow-hidden border-white/8 bg-[#09111d]/90 py-0 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <CardContent className="p-0">
            <div className="border-b border-white/8 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                    Dashboard Preview
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {preview?.title ?? "No tournaments available"}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {preview?.subtitle ?? "Tournament data will appear here when matches are available."}
                  </div>
                </div>
                {preview && (
                  <div className="rounded-full border border-sky-400/15 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
                    {preview.badge}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {(preview?.stats ?? []).map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {stat.label}
                    </div>
                    <div className="mt-2 text-xl font-semibold tracking-tight text-white">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-white/8 bg-[#0d1524]/90">
                <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
                  {(preview?.chips ?? []).map((chip) => (
                    <span
                      key={chip}
                      className="rounded-md border border-white/8 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300"
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(96px,0.8fr))] gap-3 border-b border-white/8 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  <span>Player</span>
                  <span className="text-right">Elims</span>
                  <span className="text-right">Damage</span>
                </div>

                <div className="divide-y divide-white/6">
                  {(preview?.rows ?? []).map((row) => (
                    <div
                      key={row.player}
                      className="grid grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(96px,0.8fr))] gap-3 px-4 py-3 text-sm text-slate-200"
                    >
                      <span className="font-medium text-white">{row.player}</span>
                      <span className="text-right font-medium tabular-nums">{row.eliminations}</span>
                      <span className="text-right font-medium tabular-nums">{row.damage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
