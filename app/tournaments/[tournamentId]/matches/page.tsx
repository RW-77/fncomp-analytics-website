import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import {
  CUMULATIVE_DAY,
  DaySelection,
  compareTournamentRegions,
  resolveDay,
  resolveRegion,
} from "@/lib/tournaments"

import { getMatchCards } from "@/lib/replay/match-cards"
import { MatchCard } from "@/components/matches/match-card"

type PageProps = {
  params: Promise<{ tournamentId: string }>
  searchParams: Promise<{ region?: string; day?: string }>
}

function buildUrl(
  tournamentId: string,
  region: string | null,
  day: DaySelection | null
): string {
  const params = new URLSearchParams()
  if (region) params.set("region", region)
  if (day !== null) params.set("day", String(day))
  const query = params.toString()
  return query
    ? `/tournaments/${tournamentId}/matches?${query}`
    : `/tournaments/${tournamentId}/matches`
}

export default async function MatchesPage({ params, searchParams }: PageProps) {
  const { tournamentId } = await params
  const { region: requestedRegion, day: requestedDay } = await searchParams

  const allEventWindows = await prisma.event_windows.findMany({
    where: { tournament_id: tournamentId },
    include: { events: true },
    orderBy: [{ start_time: "asc" }, { day_index: "asc" }],
  })

  const availableRegions = Array.from(
    new Set(
      allEventWindows
        .map((ew) => ew.events?.region_code)
        .filter((r): r is string => Boolean(r))
    )
  ).sort(compareTournamentRegions)

  const effectiveRegion = resolveRegion(requestedRegion, availableRegions)
  const eventWindowsForRegion = effectiveRegion
    ? allEventWindows.filter((ew) => ew.events?.region_code === effectiveRegion)
    : allEventWindows

  const availableDays = Array.from(
    new Set(
      eventWindowsForRegion
        .map((ew) => ew.day_index)
        .filter((d): d is number => d !== null)
    )
  ).sort((a, b) => a - b)

  const effectiveDay = resolveDay(requestedDay, availableDays)

  const expectedRegionParam = effectiveRegion ?? undefined
  const expectedDayParam = effectiveDay === null ? undefined : String(effectiveDay)
  const isCanonical =
    requestedRegion === expectedRegionParam && requestedDay === expectedDayParam

  if (!isCanonical) {
    redirect(buildUrl(tournamentId, effectiveRegion, effectiveDay))
  }

  const selectedEventWindows =
    effectiveDay === null || effectiveDay === CUMULATIVE_DAY
      ? eventWindowsForRegion
      : eventWindowsForRegion.filter((ew) => ew.day_index === effectiveDay)

  const { cards, maps } = await getMatchCards({
    tournamentId,
    regionCode: effectiveRegion,
    eventWindowIds: selectedEventWindows.map((ew) => ew.event_window_id),
  })

  if (cards.length === 0) {
    return (
      <div className="rounded-[3px] bg-[var(--panel)] px-4 py-10 text-center text-sm text-slate-500">
        No matches yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {cards.map((card) => (
        <MatchCard key={card.matchId} card={card} map={card.mapKey ? maps[card.mapKey] : null} />
      ))}
    </div>
  )
}
