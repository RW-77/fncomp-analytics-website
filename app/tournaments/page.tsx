import { getTournamentImagePath } from "@/lib/event-images"
import { prisma } from "@/lib/prisma"
import {
  compareTournamentRegions,
  DaySelection,
  getTournamentDisplayTitle,
  resolveDay,
  resolveRegion,
} from "@/lib/tournaments"

import { TournamentGrid } from "./tournament-grid"

// Statically generate the list and regenerate at most once an hour (ISR). The
// set of tournaments only changes on ingestion, not per request.
export const revalidate = 3600

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
    <div className="page-x py-8">
      <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl [font-family:var(--font-onest)]">
        Tournaments
      </h1>
      {tournamentCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[var(--panel-inset)]/60 px-6 py-10 text-center text-sm text-slate-400">
          No tournaments found.
        </div>
      ) : (
        <TournamentGrid
          tournaments={tournamentCards.map((t) => ({
            tournamentId: t.tournamentId,
            title: t.title,
            href: t.href,
            regions: t.regions,
            imageSrc: getTournamentImagePath(t.imageKey),
            dateRange: formatDateRange(t.startTime, t.endTime),
            totalMatches: t.totalMatches,
          }))}
        />
      )}
    </div>
  )
}
