import { prisma } from '@/lib/prisma'
import type { ZonePhase } from '@/lib/replay/engine'
import { getMapAssets, getMatchMetadata, getMatchZones, type MapAssets } from '@/lib/replay/match-data'
import { getMatchNumbers } from '@/lib/stats'

// What a match card shows: when the game was, how its storm closed, and who
// won. The number is the match page's (see getMatchNumbers).
export type MatchCard = {
  matchId: string
  number: number | null
  startTime: string | null       // ISO
  playerCount: number | null
  durationS: number | null
  elims: number
  winner: string[] | null        // the winning team's player names; null when not on the leaderboard
  zones: ZonePhase[]             // empty when the match has none
  mapKey: string | null          // into MatchCardsData.maps; null when the build is unknown
}

export type MatchCardsData = {
  cards: MatchCard[]
  maps: Record<string, MapAssets>  // one per build and mode: every card of a build shares one image
}

// The cards for some of a tournament's event windows (one region's, for a
// day or all days), in start order.
export async function getMatchCards({
  tournamentId,
  regionCode,
  eventWindowIds,
}: {
  tournamentId: string
  regionCode: string | null
  eventWindowIds: string[]
}): Promise<MatchCardsData> {
  const matches = await prisma.matches.findMany({
    where: { event_window_id: { in: eventWindowIds } },
    select: {
      match_id: true,
      session_id: true,
      start_time: true,
      player_count: true,
      build_major: true,
      build_minor: true,
      mode_id: true,
    },
    orderBy: { start_time: 'asc' },
  })
  const ids = matches.map((m) => m.match_id)

  const [numbers, winners, elims, files] = await Promise.all([
    getMatchNumbers(tournamentId, regionCode),
    prisma.event_window_team_matches.findMany({
      where: { session_id: { in: matches.map((m) => m.session_id) }, placement: 1 },
      select: { session_id: true, team_id: true },
    }),
    prisma.elimination_events.groupBy({ by: ['match_id'], where: { match_id: { in: ids } }, _count: { _all: true } }),
    Promise.all(ids.map((id) => Promise.all([getMatchMetadata(id), getMatchZones(id)]))),
  ])
  const winnerBySession = new Map(winners.map((w) => [w.session_id, w.team_id.split(':')]))
  const elimsByMatch = new Map(elims.map((e) => [e.match_id, e._count._all]))

  const mapKeyOf = (m: (typeof matches)[number]) =>
    m.build_major === null || m.build_minor === null ? null : `${m.build_major}.${m.build_minor}/${m.mode_id ?? 'br'}`
  const maps: Record<string, MapAssets> = {}
  await Promise.all(
    [...new Map(matches.map((m) => [mapKeyOf(m), m])).entries()].map(async ([key, m]) => {
      if (key === null) return
      const assets = await getMapAssets(m.build_major!, m.build_minor!, m.mode_id ?? undefined)
      if (assets) maps[key] = assets
    }),
  )

  const cards = matches.map((m, i): MatchCard => {
    const [metadata, zones] = files[i]
    const winnerIds = winnerBySession.get(m.session_id)
    const key = mapKeyOf(m)
    return {
      matchId: m.match_id,
      number: numbers.get(m.match_id) ?? null,
      startTime: m.start_time?.toISOString() ?? null,
      playerCount: m.player_count,
      durationS: metadata?.duration_seconds ?? null,
      elims: elimsByMatch.get(m.match_id) ?? 0,
      winner: winnerIds ? winnerIds.map((id) => metadata?.id_to_username?.[id] ?? id.slice(0, 8)) : null,
      zones: zones ?? [],
      mapKey: key !== null && maps[key] ? key : null,
    }
  })
  return { cards, maps }
}
