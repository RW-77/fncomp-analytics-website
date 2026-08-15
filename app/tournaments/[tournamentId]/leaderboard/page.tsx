import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import {
  CUMULATIVE_DAY,
  DaySelection,
  compareTournamentRegions,
  resolveDay,
  resolveRegion,
} from "@/lib/tournaments"

import { LeaderboardClient, type LeaderboardData } from "./leaderboard-client"

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
    ? `/tournaments/${tournamentId}/leaderboard?${query}`
    : `/tournaments/${tournamentId}/leaderboard`
}

// Per-team, per-match results for the selected windows. The client sums a prefix
// of each team's matches to render the standings "after match N". Matches are
// ordered globally by session end time — the shared-lobby game order — because
// game_number is a per-team ordinal that drifts when a team misses a game.
async function buildLeaderboardData(
  eventWindowIds: string[]
): Promise<LeaderboardData> {
  if (eventWindowIds.length === 0) return { matchCount: 0, teams: [] }

  const [players, matchRows] = await Promise.all([
    prisma.match_players.findMany({
      where: { matches: { event_window_id: { in: eventWindowIds } } },
      select: { epic_id: true, epic_username: true },
      distinct: ["epic_id"],
    }),
    prisma.event_window_team_matches.findMany({
      where: { event_window_id: { in: eventWindowIds } },
      select: {
        team_id: true,
        session_id: true,
        end_time: true,
        total_points: true,
        victory_royale: true,
        team_elims: true,
        placement: true,
        placement_tiebreaker: true,
      },
    }),
  ])

  const nameByEpicId = new Map(players.map((p) => [p.epic_id, p.epic_username]))
  // team_id is the canonical (sorted) roster key, so it groups a team across days.
  const teamName = (teamId: string) =>
    teamId
      .split(":")
      .map((id) => nameByEpicId.get(id) ?? id.slice(0, 8))
      .join(" & ")

  // Global match order: distinct sessions, earliest end time first.
  const sessionEndTime = new Map<string, number>()
  for (const row of matchRows) {
    sessionEndTime.set(row.session_id, row.end_time.getTime())
  }
  const orderedSessions = [...sessionEndTime.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([sessionId]) => sessionId)
  const matchIndex = new Map(orderedSessions.map((sessionId, i) => [sessionId, i]))
  const matchCount = orderedSessions.length

  const teams = new Map<string, LeaderboardData["teams"][number]>()
  for (const row of matchRows) {
    let team = teams.get(row.team_id)
    if (!team) {
      team = {
        teamId: row.team_id,
        name: teamName(row.team_id),
        perMatch: Array(matchCount).fill(null),
      }
      teams.set(row.team_id, team)
    }
    team.perMatch[matchIndex.get(row.session_id)!] = {
      points: row.total_points,
      win: row.victory_royale ? 1 : 0,
      kills: row.team_elims,
      placement: row.placement,
      tiebreaker: row.placement_tiebreaker ?? 0,
    }
  }

  return { matchCount, teams: [...teams.values()] }
}

export default async function LeaderboardPage({ params, searchParams }: PageProps) {
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

  const data = await buildLeaderboardData(
    selectedEventWindows.map((ew) => ew.event_window_id)
  )

  // Remount (reset the scrubber to Cumulative) when the region/day selection changes.
  const selectionKey = `${effectiveRegion ?? "all"}:${effectiveDay ?? "all"}`

  return <LeaderboardClient key={selectionKey} data={data} />
}
