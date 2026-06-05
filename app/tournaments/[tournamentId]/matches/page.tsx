import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import {
  CUMULATIVE_DAY,
  DaySelection,
  compareTournamentRegions,
  resolveDay,
  resolveRegion,
} from "@/lib/tournaments"

import { MatchesClient } from "./matches-client"

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

  const selectedEventWindowIds = selectedEventWindows.map((ew) => ew.event_window_id)

  const matches = await prisma.matches.findMany({
    where: { event_window_id: { in: selectedEventWindowIds } },
    select: {
      match_id: true,
      start_time: true,
      player_count: true,
      map_path: true,
    },
    orderBy: { start_time: "asc" },
  })

  return <MatchesClient matches={matches} />
}
