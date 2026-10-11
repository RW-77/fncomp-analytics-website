import { prisma } from "@/lib/prisma"
import { CUMULATIVE_DAY, getTournamentDisplayTitle } from "@/lib/tournaments"

// ============================================================================
// Homepage
// ============================================================================

// The hero's counters, all-time across every processed match.
export type HomeCounters = {
  players: number       // distinct players across all matches
  events: number        // every event in the matches' raw logs (match_event_counts)
  eliminations: number
  shots: number         // the fireWeaponEvents log, one of the counted logs
}

export async function getHomeCounters(): Promise<HomeCounters> {
  const [[{ players }], eventCounts, eliminations] = await Promise.all([
    prisma.$queryRaw<[{ players: bigint }]>`SELECT COUNT(DISTINCT epic_id) AS players FROM match_players`,
    // Kept per log by the ETL (its event_counts stat); summed here.
    prisma.match_event_counts.groupBy({ by: ["log_type"], _sum: { count: true } }),
    prisma.elimination_events.count(),
  ])
  const byLog = new Map(eventCounts.map((row) => [row.log_type, row._sum.count ?? 0]))
  return {
    players: Number(players),
    events: [...byLog.values()].reduce((sum, count) => sum + count, 0),
    eliminations,
    shots: byLog.get("fire_weapon_events") ?? 0,
  }
}

// The most recent game with a replay (its timeline is built), for the hero's
// "Watch the latest game". null before any replay exists.
export async function getLatestReplayHref(): Promise<string | null> {
  const match = await prisma.matches.findFirst({
    where: { match_stat_status: { some: { stat_name: "timeline", parser_version: { not: null } } } },
    orderBy: [{ start_time: { sort: "desc", nulls: "last" } }, { match_id: "asc" }],
    select: { match_id: true },
  })
  return match ? `/matches/${match.match_id}` : null
}

// All-time visitors to the production site, from Vercel Web Analytics
// (https://vercel.com/docs/analytics/web-analytics-api). Vercel forgets a
// visitor after a day, so someone who comes back on another day counts again.
// Needs VERCEL_ANALYTICS_TOKEN and VERCEL_ANALYTICS_PROJECT (the project's
// name or id), plus VERCEL_ANALYTICS_TEAM (the team's slug or team_ id) for a
// team's project. null when those aren't set or the request fails, so the
// page just leaves the count out.
export async function getVisitorCount(): Promise<number | null> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN
  const project = process.env.VERCEL_ANALYTICS_PROJECT
  if (!token || !project) return null

  const params = new URLSearchParams({ projectId: project })
  const team = process.env.VERCEL_ANALYTICS_TEAM
  if (team) params.set(team.startsWith("team_") ? "teamId" : "slug", team)

  try {
    const response = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/count?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 900 },
    })
    if (!response.ok) {
      console.error(`Vercel Web Analytics count failed: ${response.status}`)
      return null
    }
    const body = (await response.json()) as { data?: { visitors?: unknown } }
    return typeof body.data?.visitors === "number" ? body.data.visitors : null
  } catch (err) {
    console.error("Vercel Web Analytics count failed", err)
    return null
  }
}

// The stats demo's tournament. Pinned rather than the latest tournament: a big
// event gives the questions enough fights at every range to reshuffle the table.
// Move it on after the next Global Championship.
const DEMO_TOURNAMENT = "MannekenPis"
const DEMO_PLAYERS = 10   // from each of the elims and damage contribution leaders

// The demo's data: each leading player's elims, knocks, damage and damage
// contribution with when (and, except contribution, how far away) they
// happened, so the page filters them itself as the sliders move. Events are
// coarsened to keep the payload small (about 13 KB): when is in 30-second
// steps since the game began, and distance in 5 m steps, capped at 60 (300 m).
export type StatsDemoPlayer = {
  name: string
  elims: number[]          // flat [when, distance, when, distance, ...]
  knocks: number[]         // same as elims
  damage: number[]         // flat [when, distance, amount, ...], summed per step pair
  contribution: number[]   // flat [when, amount, ...], summed per step. Damage on
                           // players then eliminated; it has no distance, as on the players tab
}

export type StatsDemo = {
  title: string
  href: string        // the tournament's players tab, all days
  games: number
  players: StatsDemoPlayer[]
}

export async function getStatsDemo(): Promise<StatsDemo | null> {
  const [tournament, games, multiDay] = await Promise.all([
    prisma.tournaments.findUnique({ where: { tournament_id: DEMO_TOURNAMENT }, select: { title: true } }),
    prisma.matches.count({ where: { event_windows: { tournament_id: DEMO_TOURNAMENT } } }),
    prisma.event_windows.findFirst({
      where: { tournament_id: DEMO_TOURNAMENT, day_index: { not: null } },
      select: { event_window_id: true },
    }),
  ])
  if (!tournament || games === 0) return null

  // The leaders by elims (damage breaks ties, as on the players tab) and by
  // damage contribution, and every elim, knock, damage and contribution event
  // of theirs in the tournament.
  const rows = await prisma.$queryRaw<
    { epic_id: string; name: string; start_time: Date | null; kind: "e" | "k" | "d" | "c"; t: number; d: number | null; v: number }[]
  >`
    WITH games AS (
      SELECT m.match_id, m.start_time FROM matches m
      JOIN event_windows ew USING (event_window_id)
      WHERE ew.tournament_id = ${DEMO_TOURNAMENT}
    ),
    events AS (
      SELECT e.actor_id, e.match_id, 'e' AS kind, e.game_time_seconds AS t, e.distance AS d, 1::float AS v
        FROM elimination_events e WHERE e.match_id IN (SELECT match_id FROM games)
      UNION ALL
      SELECT k.actor_id, k.match_id, 'k', k.game_time_seconds, k.distance, 1
        FROM knock_events k WHERE k.match_id IN (SELECT match_id FROM games)
      UNION ALL
      SELECT x.actor_id, x.match_id, 'd', x.game_time_seconds, x.distance, x.damage_amount
        FROM damage_dealt_events x WHERE x.match_id IN (SELECT match_id FROM games)
      UNION ALL
      SELECT c.actor_id, c.match_id, 'c', c.game_time_seconds, NULL, c.damage_amount
        FROM damage_contribution_events c WHERE c.match_id IN (SELECT match_id FROM games)
    ),
    player_events AS (
      SELECT mp.epic_id, mp.epic_username AS name, g.start_time, ev.kind, ev.t, ev.d, ev.v
      FROM events ev
      JOIN match_players mp ON mp.id = ev.actor_id
      JOIN games g ON g.match_id = ev.match_id
      WHERE ev.t IS NOT NULL
    ),
    top AS (
      (SELECT epic_id FROM player_events GROUP BY epic_id
        ORDER BY COUNT(*) FILTER (WHERE kind = 'e') DESC, SUM(v) FILTER (WHERE kind = 'd') DESC NULLS LAST
        LIMIT ${DEMO_PLAYERS})
      UNION
      (SELECT epic_id FROM player_events GROUP BY epic_id
        ORDER BY SUM(v) FILTER (WHERE kind = 'c') DESC NULLS LAST
        LIMIT ${DEMO_PLAYERS})
    )
    SELECT * FROM player_events WHERE epic_id IN (SELECT epic_id FROM top)
  `

  type Building = StatsDemoPlayer & { latest: number; damageSteps: Map<string, number>; contributionSteps: Map<number, number> }
  const players = new Map<string, Building>()
  for (const row of rows) {
    let player = players.get(row.epic_id)
    if (!player) {
      player = {
        name: row.name, elims: [], knocks: [], damage: [], contribution: [],
        latest: -Infinity, damageSteps: new Map(), contributionSteps: new Map(),
      }
      players.set(row.epic_id, player)
    }
    // A player's name as of their latest game
    const started = row.start_time?.getTime() ?? -Infinity
    if (started > player.latest) {
      player.latest = started
      player.name = row.name
    }
    const when = Math.floor(row.t / 30)
    if (row.kind === "c") {
      player.contributionSteps.set(when, (player.contributionSteps.get(when) ?? 0) + row.v)
      continue
    }
    const distance = Math.min(60, Math.round((row.d ?? 0) / 500))   // cm to 5 m steps
    if (row.kind === "e") player.elims.push(when, distance)
    else if (row.kind === "k") player.knocks.push(when, distance)
    else {
      const step = `${when},${distance}`
      player.damageSteps.set(step, (player.damageSteps.get(step) ?? 0) + row.v)
    }
  }

  return {
    title: getTournamentDisplayTitle({ tournament_id: DEMO_TOURNAMENT, title: tournament.title }),
    href: `/tournaments/${DEMO_TOURNAMENT}/players${multiDay ? `?day=${CUMULATIVE_DAY}` : ""}`,
    games,
    players: [...players.values()].map(({ name, elims, knocks, damageSteps, contributionSteps }) => ({
      name,
      elims,
      knocks,
      damage: [...damageSteps].flatMap(([step, amount]) => [...step.split(",").map(Number), Math.round(amount)]),
      contribution: [...contributionSteps].flatMap(([when, amount]) => [when, Math.round(amount)]),
    })),
  }
}
