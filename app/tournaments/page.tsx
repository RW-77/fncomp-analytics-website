import Image from "next/image"
import Link from "next/link"

import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { getTournamentImagePath } from "@/lib/event-images"
import { prisma } from "@/lib/prisma"
import {
  compareTournamentRegions,
  DaySelection,
  getTournamentDisplayTitle,
  resolveDay,
  resolveRegion,
} from "@/lib/tournaments"

export const dynamic = "force-dynamic"

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

type TournamentCard = {
  tournamentId: string
  title: string
  imageKey: string | null
  href: string
  regions: string[]
  startTime: Date | null
  endTime: Date | null
  totalMatches: number
}

function buildTournamentUrl(
  tournamentId: string,
  region: string | null,
  day: DaySelection | null
): string {
  const params = new URLSearchParams()
  if (region) {
    params.set("region", region)
  }
  if (day !== null) {
    params.set("day", String(day))
  }
  const query = params.toString()
  return query ? `/tournaments/${tournamentId}?${query}` : `/tournaments/${tournamentId}`
}

/**
 * Loads everything the tournaments list needs in two queries and assembles one
 * card per tournament. The shape of each card matches what the UI renders, so
 * the page below stays presentational.
 */
async function getTournamentCards(): Promise<TournamentCard[]> {
  const [tournaments, eventWindows] = await Promise.all([
    prisma.tournaments.findMany(),
    prisma.event_windows.findMany({
      where: { tournament_id: { not: null } },
      include: { events: true },
    }),
  ])

  const eventWindowsByTournament = new Map<string, typeof eventWindows>()
  for (const eventWindow of eventWindows) {
    if (!eventWindow.tournament_id) continue
    const bucket = eventWindowsByTournament.get(eventWindow.tournament_id) ?? []
    bucket.push(eventWindow)
    eventWindowsByTournament.set(eventWindow.tournament_id, bucket)
  }

  const cards: TournamentCard[] = []

  for (const tournament of tournaments) {
    const tournamentEventWindows =
      eventWindowsByTournament.get(tournament.tournament_id) ?? []
    if (tournamentEventWindows.length === 0) continue

    const regions = Array.from(
      new Set(
        tournamentEventWindows
          .map((eventWindow) => eventWindow.events?.region_code)
          .filter((region): region is string => Boolean(region))
      )
    ).sort(compareTournamentRegions)

    const firstEventWithImage = tournamentEventWindows.find(
      (eventWindow) => eventWindow.events?.image_key
    )
    const imageKey = firstEventWithImage?.events?.image_key ?? null

    const effectiveRegion = resolveRegion(undefined, regions)
    const eventWindowsForDefaultView = effectiveRegion
      ? tournamentEventWindows.filter(
          (eventWindow) => eventWindow.events?.region_code === effectiveRegion
        )
      : tournamentEventWindows
    const availableDays = Array.from(
      new Set(
        eventWindowsForDefaultView
          .map((eventWindow) => eventWindow.day_index)
          .filter((dayIndex): dayIndex is number => dayIndex !== null)
      )
    ).sort((left, right) => left - right)
    const effectiveDay = resolveDay(undefined, availableDays)
    const href = buildTournamentUrl(tournament.tournament_id, effectiveRegion, effectiveDay)

    const startTimes = tournamentEventWindows
      .map((eventWindow) => eventWindow.start_time)
      .filter((value): value is Date => value !== null)
    const endTimes = tournamentEventWindows
      .map((eventWindow) => eventWindow.end_time)
      .filter((value): value is Date => value !== null)

    cards.push({
      tournamentId: tournament.tournament_id,
      title: getTournamentDisplayTitle(tournament),
      imageKey,
      href,
      regions,
      startTime: startTimes.length
        ? new Date(Math.min(...startTimes.map((d) => d.getTime())))
        : null,
      endTime: endTimes.length
        ? new Date(Math.max(...endTimes.map((d) => d.getTime())))
        : null,
      totalMatches: eventWindowsForDefaultView.reduce(
        (sum, eventWindow) => sum + eventWindow.total_matches,
        0
      ),
    })
  }

  // Most-recent first; tournaments with no start time sink to the bottom.
  return cards.sort(
    (left, right) =>
      (right.startTime?.getTime() ?? 0) - (left.startTime?.getTime() ?? 0)
  )
}

export default async function TournamentsPage() {
  const tournamentCards = await getTournamentCards()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 rounded-2xl border border-white/8 bg-[#0b1321]/80 px-5 py-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-sky-200">
            Tournament Library
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Tournaments
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            Browse tournaments by region and day before drilling into player-level stat tables.
          </p>
        </div>
      </section>

      {tournamentCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b1321]/60 px-6 py-10 text-center text-sm text-slate-400">
          No tournaments found.
        </div>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {tournamentCards.map((tournament) => {
            const imageSrc = getTournamentImagePath(tournament.imageKey)

            return (
              <Link
                key={tournament.tournamentId}
                href={tournament.href}
                className="group block"
              >
                <Card className="relative h-full min-h-[420px] overflow-hidden border-white/8 bg-[#0b1321]/90 py-0 shadow-[0_18px_50px_rgba(2,6,23,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/30 hover:shadow-[0_26px_70px_rgba(2,6,23,0.36)]">
                  <div className="absolute inset-0">
                    {imageSrc ? (
                      <Image
                        fill
                        alt={tournament.title}
                        src={imageSrc}
                        sizes="(min-width: 1280px) 30vw, (min-width: 640px) 46vw, 100vw"
                        className="object-cover opacity-70 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-80"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.45),rgba(2,6,23,0.98))]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/30 to-slate-950/92" />
                    <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
                  </div>

                  <CardContent className="relative flex min-h-[420px] flex-col justify-between p-5">
                    <div className="flex flex-wrap gap-2">
                      {tournament.regions.length > 0 ? (
                        tournament.regions.map((region) => (
                          <span
                            key={region}
                            className="rounded-full border border-white/10 bg-slate-950/45 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-100 backdrop-blur-sm"
                          >
                            {region}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-white/10 bg-slate-950/45 px-2.5 py-1 text-[11px] text-slate-200 backdrop-blur-sm">
                          {tournament.tournamentId}
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      <CardTitle className="max-w-[17rem] text-xl font-semibold leading-tight text-white sm:text-[1.35rem]">
                        {tournament.title}
                      </CardTitle>

                      <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-3">
                        <div className="min-w-0 space-y-1">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            Date range
                          </div>
                          <div className="text-xs font-medium leading-5 text-slate-200">
                            {formatDateRange(tournament.startTime, tournament.endTime)}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            Matches
                          </div>
                          <div className="mt-1 text-sm font-semibold text-white tabular-nums">
                            {tournament.totalMatches}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </section>
      )}
    </div>
  )
}
