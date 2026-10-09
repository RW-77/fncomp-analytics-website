import { redirect } from "next/navigation"

import { computeFilteredStats, getMatches, getWeaponIds } from "@/lib/stats"
import { prisma } from "@/lib/prisma"
import { StatFilters } from "@/lib/types"
import {
  CUMULATIVE_DAY,
  DaySelection,
  compareTournamentRegions,
  resolveDay,
  resolveRegion,
} from "@/lib/tournaments"

import TournamentStatsClient from "../../tournamentStatsClient"

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
    ? `/tournaments/${tournamentId}/players?${query}`
    : `/tournaments/${tournamentId}/players`
}

export default async function PlayersPage({ params, searchParams }: PageProps) {
  const { tournamentId } = await params
  const { region: requestedRegion, day: requestedDay } = await searchParams

  const allEventWindows = await prisma.event_windows.findMany({
    where: { tournament_id: tournamentId },
    include: { events: true },
    orderBy: [{ start_time: "asc" }, { day_index: "asc" }],
  })

  // -- Region resolution --

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

  // -- Day resolution --

  const availableDays = Array.from(
    new Set(
      eventWindowsForRegion
        .map((ew) => ew.day_index)
        .filter((d): d is number => d !== null)
    )
  ).sort((a, b) => a - b)

  const effectiveDay = resolveDay(requestedDay, availableDays)

  // -- Canonicalize --

  const expectedRegionParam = effectiveRegion ?? undefined
  const expectedDayParam = effectiveDay === null ? undefined : String(effectiveDay)
  const isCanonical =
    requestedRegion === expectedRegionParam && requestedDay === expectedDayParam

  if (!isCanonical) {
    redirect(buildUrl(tournamentId, effectiveRegion, effectiveDay))
  }

  // -- Resolve event windows for this view --

  const selectedEventWindows =
    effectiveDay === null || effectiveDay === CUMULATIVE_DAY
      ? eventWindowsForRegion
      : eventWindowsForRegion.filter((ew) => ew.day_index === effectiveDay)

  const selectedEventWindowIds = selectedEventWindows.map((ew) => ew.event_window_id)

  const [matches, weapons] = await Promise.all([
    getMatches(selectedEventWindowIds),
    getWeaponIds(selectedEventWindowIds),
  ])

  const initialFilters: StatFilters = {
    selectedMatches: matches.map((m) => m.id),
    weaponTypes: weapons.map((w) => w.id),
    distanceRange: [0, 400],
    timeRange: [0, 30],
  }
  const initialData = await computeFilteredStats(initialFilters)

  return (
    <TournamentStatsClient
      key={`${effectiveRegion ?? "all"}-${effectiveDay ?? "none"}`}
      matches={matches}
      weapons={weapons}
      initialData={initialData}
    />
  )
}
