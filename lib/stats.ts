import { prisma } from "@/lib/prisma"
import { PlayerRow } from "@/app/tournaments/[tournamentId]/columns"
import { StatFilters, FilterCapabilities } from "@/lib/types"
import { Button } from "@/components/ui/button";
import { Heading1 } from "lucide-react";

// ============================================================================
// Replay
// ============================================================================

export async function getMatchBuildVersion(
  matchId: string
): Promise<{ build_major: number; build_minor: number } | null> {
  const match = await prisma.matches.findUnique({
    where: { match_id: matchId },
    select: { build_major: true, build_minor: true },
  })
  if (!match || match.build_major === null || match.build_minor === null) return null
  return { build_major: match.build_major, build_minor: match.build_minor }
}

// ============================================================================
// Meta functions (consumed by server components)
// ============================================================================

/**
 * Returns the matches across the supplied event windows. Used to drive the
 * Matches filter on the tournament detail page, where a single view may span
 * multiple event windows (cumulative across days).
 */
export async function getMatches(
  eventWindowIds: string[]
): Promise<Array<{ id: string; label: string }>> {
  if (eventWindowIds.length === 0) {
    return []
  }

  const matches = await prisma.matches.findMany({
    where: { event_window_id: { in: eventWindowIds } },
    select: { match_id: true },
    orderBy: { start_time: "asc" },
  })
  return matches.map((m: { match_id: string }, index: number) => ({
    id: m.match_id,
    label: `Match ${index + 1}`,
  }))
}

export async function getAllPlayers(
  matchIds: string[]
): Promise<Array<{ epicId: string; displayName: string }>> {
  const players = await prisma.match_players.findMany({
    where: { match_id: { in: matchIds } },
    select: { epic_id: true, epic_username: true },
    distinct: ["epic_id"],
    orderBy: { epic_username: "asc" },
  })
  return players.map((p: { epic_id: string; epic_username: string }) => ({
    epicId: p.epic_id,
    displayName: p.epic_username,
  }))
}

/**
 * Returns the distinct weapon types across the supplied event windows. Used to
 * drive the Weapons filter on the tournament detail page.
 */
export async function getWeaponIds(
  eventWindowIds: string[]
): Promise<Array<{ id: string; label: string }>> {
  if (eventWindowIds.length === 0) return []

  // weapons is now a global catalog (no event_window_id column). Per-match
  // weapon appearances live in match_weapons, so we go:
  //   event_window_ids → match_ids → match_weapons.weapon_type
  const matchRows = await prisma.matches.findMany({
    where: { event_window_id: { in: eventWindowIds } },
    select: { match_id: true },
  })
  const matchIds = matchRows.map((m: { match_id: string }) => m.match_id)
  if (matchIds.length === 0) return []

  const rows = await prisma.match_weapons.findMany({
    where: { match_id: { in: matchIds }, weapon_type: { not: null } },
    select: { weapon_type: true },
    distinct: ["weapon_type"],
    orderBy: { weapon_type: "asc" },
  })

  return rows
    .filter((w: { weapon_type: string | null }) => w.weapon_type !== null)
    .map((w: { weapon_type: string | null }) => ({
      id: w.weapon_type!,
      label: w.weapon_type!,
    }))
}

// ============================================================================
// Homepage preview (lightweight)
// ============================================================================

/**
 * Lightweight per-player aggregation for the homepage preview card, which only
 * displays eliminations and damage dealt. Deliberately avoids the full
 * {@link computeFilteredStats} pipeline so it never touches the ~6M-row
 * fire_weapon_events table (shots/contribution), which the preview doesn't show.
 */
export async function getPreviewPlayerStats(
  matchIds: string[]
): Promise<Array<{ player: string; eliminations: number; damageDealt: number }>> {
  if (matchIds.length === 0) return []

  const where = { match_id: { in: matchIds } }

  const [elimRows, damageRows] = await Promise.all([
    prisma.elimination_events.groupBy({
      by: ["actor_id"],
      where,
      _count: { _all: true },
    }),
    prisma.damage_dealt_events.groupBy({
      by: ["actor_id"],
      where,
      _sum: { damage_amount: true },
    }),
  ])

  const actorIds = new Set<number>()
  for (const row of elimRows) if (row.actor_id !== null) actorIds.add(row.actor_id)
  for (const row of damageRows) if (row.actor_id !== null) actorIds.add(row.actor_id)

  const matchPlayers = await prisma.match_players.findMany({
    where: { id: { in: Array.from(actorIds) } },
    select: { id: true, epic_id: true, epic_username: true },
  })
  const playerInfo = new Map<number, { epicId: string; displayName: string }>()
  for (const mp of matchPlayers) {
    playerInfo.set(mp.id, { epicId: mp.epic_id, displayName: mp.epic_username })
  }

  const rows = new Map<string, { player: string; eliminations: number; damageDealt: number }>()
  function getOrCreate(epicId: string, displayName: string) {
    if (!rows.has(epicId)) {
      rows.set(epicId, { player: displayName, eliminations: 0, damageDealt: 0 })
    }
    return rows.get(epicId)!
  }

  for (const row of elimRows) {
    if (row.actor_id === null) continue
    const info = playerInfo.get(row.actor_id)
    if (!info) continue
    if (row._count && typeof row._count === "object" && "_all" in row._count) {
      const count = row._count._all
      if (typeof count === "number") {
        getOrCreate(info.epicId, info.displayName).eliminations += count
      }
    }
  }

  for (const row of damageRows) {
    if (row.actor_id === null) continue
    const info = playerInfo.get(row.actor_id)
    if (!info) continue
    if (row._sum && row._sum.damage_amount !== null && row._sum.damage_amount !== undefined) {
      getOrCreate(info.epicId, info.displayName).damageDealt += Math.round(row._sum.damage_amount)
    }
  }

  return Array.from(rows.values())
}

// ============================================================================
// Filter Builder Utilities
// ============================================================================

/**
 * Builds a Prisma where clause based on filter capabilities and filter values.
 * Only applies filters that are supported by the stat type.
 */
function buildWhereClause(
  filters: StatFilters,
  capabilities: FilterCapabilities
): Record<string, unknown> {
  const where: Record<string, unknown> = {}

  if (capabilities.supportsMatches && filters.selectedMatches.length > 0) {
    where.match_id = { in: filters.selectedMatches }
  }

  if (capabilities.supportsWeaponTypes && filters.weaponTypes.length > 0) {
    // Include events that match selected weapon types OR have null weapon_type
    // This ensures events without classified weapons are not excluded
    where.OR = [{ weapon_type: { in: filters.weaponTypes } }, { weapon_type: null }]
  }

  if (capabilities.supportsTimeRange) {
    where.game_time_seconds = {
      gte: filters.timeRange[0] * 60,
      lte: filters.timeRange[1] * 60,
    }
  }

  if (capabilities.supportsDistanceRange) {
    where.distance = {
      gte: filters.distanceRange[0] * 100,
      lte: filters.distanceRange[1] * 100,
    }
  }

  return where
}

// ============================================================================
// Stat Query Functions
// ============================================================================

/**
 * Stat type definitions with their filter capabilities.
 * Add new stat types here with their specific capabilities.
 */
const STAT_CAPABILITIES = {
  eliminations: {
    supportsMatches: true,
    supportsWeaponTypes: true,
    supportsTimeRange: true,
    supportsDistanceRange: true,
  } as FilterCapabilities,
  damageDealt: {
    supportsMatches: true,
    supportsWeaponTypes: true,
    supportsTimeRange: true,
    supportsDistanceRange: true,
  } as FilterCapabilities,
  damageReceived: {
    supportsMatches: true,
    supportsWeaponTypes: true,
    supportsTimeRange: true,
    supportsDistanceRange: true,
  } as FilterCapabilities,
  shotsTaken: {
    supportsMatches: true,
    supportsWeaponTypes: false, // fire_weapon_events has weapon_id but not weapon_type
    supportsTimeRange: true,
    supportsDistanceRange: true,
  } as FilterCapabilities,
  damageContribution: {
    supportsMatches: true,
    supportsWeaponTypes: false, // fire_weapon_events has weapon_id but not weapon_type
    supportsTimeRange: true,
    supportsDistanceRange: false,
  } as FilterCapabilities,
  assists: {
    supportsMatches: true,
    supportsWeaponTypes: false, // assist_events has no weapon column
    supportsTimeRange: true,
    supportsDistanceRange: false,
  } as FilterCapabilities,
  shotAttempts: {
    supportsMatches: true,
    supportsWeaponTypes: false, // shot_attempt_events has weapon_id, not weapon_type
    supportsTimeRange: true,
    supportsDistanceRange: false, // passing_distance is not a range-to-target
  } as FilterCapabilities,
  reboots: {
    supportsMatches: true,
    supportsWeaponTypes: false, // reboot_events has no weapon column
    supportsTimeRange: true,
    supportsDistanceRange: false,
  } as FilterCapabilities,
  revives: {
    supportsMatches: true,
    supportsWeaponTypes: false, // revive_events has no weapon column
    supportsTimeRange: true,
    supportsDistanceRange: false,
  } as FilterCapabilities,
  buildsPlaced: {
    supportsMatches: true,
    supportsWeaponTypes: false, // build_placed_events has no weapon column
    supportsTimeRange: true,
    supportsDistanceRange: false,
  } as FilterCapabilities,
  timeAlive: {
    supportsMatches: true,
    supportsWeaponTypes: false, // alive_intervals has no weapon column
    // Time range IS supported, but via interval clipping in getTimeAliveByPlayer
    // (not the single-field game_time_seconds filter in buildWhereClause).
    supportsTimeRange: false,
    supportsDistanceRange: false,
  } as FilterCapabilities,
} as const

/**
 * Gets elimination counts per player, filtered according to capabilities.
 */
async function getEliminationsByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const capabilities = STAT_CAPABILITIES.eliminations
  const whereClause = buildWhereClause(filters, capabilities)

  const results = await prisma.elimination_events.groupBy({
    by: ["actor_id"],
    where: whereClause,
    _count: { _all: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    if (row.actor_id !== null && row._count && typeof row._count === "object" && "_all" in row._count) {
      const count = row._count._all
      if (typeof count === "number") {
        map.set(row.actor_id, count)
      }
    }
  }
  return map
}

/**
 * Gets total damage dealt per player, filtered according to capabilities.
 */
async function getDamageDealtByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const capabilities = STAT_CAPABILITIES.damageDealt
  const whereClause = buildWhereClause(filters, capabilities)

  const results = await prisma.damage_dealt_events.groupBy({
    by: ["actor_id"],
    where: whereClause,
    _sum: { damage_amount: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    if (row.actor_id !== null && row._sum && row._sum.damage_amount !== null && row._sum.damage_amount !== undefined) {
      map.set(row.actor_id, row._sum.damage_amount)
    }
  }
  return map
}

/**
 * Gets total damage received per player, filtered according to capabilities.
 */
async function getDamageReceivedByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const capabilities = STAT_CAPABILITIES.damageReceived
  const whereClause = buildWhereClause(filters, capabilities)

  const results = await prisma.damage_dealt_events.groupBy({
    by: ["recipient_id"],
    where: whereClause,
    _sum: { damage_amount: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    if (row.recipient_id !== null && row._sum && row._sum.damage_amount !== null && row._sum.damage_amount !== undefined) {
      map.set(row.recipient_id, row._sum.damage_amount)
    }
  }
  return map
}

/**
 * Gets shot counts (excluding harvesting tool swings) per player.
 */
async function getShotsTakenByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const capabilities = STAT_CAPABILITIES.shotsTaken
  const whereClause = buildWhereClause(filters, capabilities)
  whereClause.harvest = false

  const results = await prisma.fire_weapon_events.groupBy({
    by: ["actor_id"],
    where: whereClause,
    _count: { _all: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    if (row._count && typeof row._count === "object" && "_all" in row._count) {
      const count = row._count._all
      if (typeof count === "number") {
        map.set(row.actor_id, count)
      }
    }
  }
  return map
}

/**
 * Gets total contributed damage per player — damage dealt to a victim who was
 * then finished by someone else. Filtered according to capabilities.
 */
async function getDamageContributionByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const whereClause = buildWhereClause(filters, STAT_CAPABILITIES.damageContribution)

  const results = await prisma.damage_contribution_events.groupBy({
    by: ["actor_id"],
    where: whereClause,
    _sum: { damage_amount: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    map.set(row.actor_id, row._sum.damage_amount ?? 0)
  }
  return map
}

/**
 * Gets assist counts per player (an assist row already excludes the finisher),
 * filtered according to capabilities.
 */
async function getAssistsByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const whereClause = buildWhereClause(filters, STAT_CAPABILITIES.assists)

  const results = await prisma.assist_events.groupBy({
    by: ["actor_id"],
    where: whereClause,
    _count: { _all: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    if (row._count && typeof row._count === "object" && "_all" in row._count) {
      const count = row._count._all
      if (typeof count === "number") {
        map.set(row.actor_id, count)
      }
    }
  }
  return map
}

/**
 * Gets shot-attempt counts per player. When `hitsOnly` is true, counts only the
 * attempts that connected (direct_hit) — the two are used together to derive
 * accuracy.
 */
async function getShotAttemptsByPlayer(
  filters: StatFilters,
  hitsOnly = false
): Promise<Map<number, number>> {
  const whereClause = buildWhereClause(filters, STAT_CAPABILITIES.shotAttempts)
  if (hitsOnly) whereClause.direct_hit = true

  const results = await prisma.shot_attempt_events.groupBy({
    by: ["actor_id"],
    where: whereClause,
    _count: { _all: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    if (row._count && typeof row._count === "object" && "_all" in row._count) {
      const count = row._count._all
      if (typeof count === "number") {
        map.set(row.actor_id, count)
      }
    }
  }
  return map
}

/**
 * Number of times each player was rebooted (brought back). Reboots are stored
 * one row per rebooter, so a reboot with multiple rebooters is multiple rows —
 * we count DISTINCT (rebooted_id, timestamp) so a reboot counts once regardless
 * of how many teammates tapped the card.
 */
async function getRebootedByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const whereClause = buildWhereClause(filters, STAT_CAPABILITIES.reboots)

  const rows = await prisma.reboot_events.groupBy({
    by: ["rebooted_id", "timestamp"],
    where: whereClause,
  })

  const map = new Map<number, number>()
  for (const r of rows) {
    map.set(r.rebooted_id, (map.get(r.rebooted_id) ?? 0) + 1)
  }
  return map
}

/**
 * Number of reboots each player performed on teammates (rebooter side). Each
 * row is one (reboot, rebooter) pair, so a straight count is correct; rows with
 * a null rebooter are skipped.
 */
async function getRebootedOthersByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const whereClause = buildWhereClause(filters, STAT_CAPABILITIES.reboots)

  const results = await prisma.reboot_events.groupBy({
    by: ["rebooter_id"],
    where: whereClause,
    _count: { _all: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    if (row.rebooter_id === null) continue
    if (row._count && typeof row._count === "object" && "_all" in row._count) {
      const count = row._count._all
      if (typeof count === "number") {
        map.set(row.rebooter_id, count)
      }
    }
  }
  return map
}

/**
 * Number of times each player was revived (revived side). A revive with
 * multiple revivers produces multiple rows sharing a timestamp, so we count
 * DISTINCT (revived_id, timestamp) to avoid double-counting one revive.
 */
async function getRevivedByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const whereClause = buildWhereClause(filters, STAT_CAPABILITIES.revives)

  const rows = await prisma.revive_events.groupBy({
    by: ["revived_id", "timestamp"],
    where: whereClause,
  })

  const map = new Map<number, number>()
  for (const r of rows) {
    map.set(r.revived_id, (map.get(r.revived_id) ?? 0) + 1)
  }
  return map
}

/**
 * Number of revives each player performed on teammates (reviver side). Each row
 * is one (revive, reviver) pair, so a straight count is correct; rows with a
 * null reviver are skipped.
 */
async function getRevivedOthersByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const whereClause = buildWhereClause(filters, STAT_CAPABILITIES.revives)

  const results = await prisma.revive_events.groupBy({
    by: ["reviver_id"],
    where: whereClause,
    _count: { _all: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    if (row.reviver_id === null) continue
    if (row._count && typeof row._count === "object" && "_all" in row._count) {
      const count = row._count._all
      if (typeof count === "number") {
        map.set(row.reviver_id, count)
      }
    }
  }
  return map
}

/**
 * Number of structures each player placed. Each row in build_placed_events is
 * one placement, so a straight count grouped by builder_id is correct.
 */
async function getBuildsPlacedByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const whereClause = buildWhereClause(filters, STAT_CAPABILITIES.buildsPlaced)

  const results = await prisma.build_placed_events.groupBy({
    by: ["builder_id"],
    where: whereClause,
    _count: { _all: true },
  })

  const map = new Map<number, number>()
  for (const row of results) {
    if (row._count && typeof row._count === "object" && "_all" in row._count) {
      const count = row._count._all
      if (typeof count === "number") {
        map.set(row.builder_id, count)
      }
    }
  }
  return map
}

/**
 * Total seconds each player was alive, summed over their alive intervals.
 *
 * Each row in `alive_intervals` is one contiguous span [start_seconds,
 * end_seconds]. Time alive = sum of span lengths. The time-range filter can't
 * use the single-field `game_time_seconds` clause (a span isn't a point), so we
 * fetch overlapping spans and clip each to the window before summing:
 * `min(end, w1) - max(start, w0)`. At the slider's full range this returns each
 * span whole.
 */
async function getTimeAliveByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const w0 = filters.timeRange[0] * 60
  const w1 = filters.timeRange[1] * 60

  const where: Record<string, unknown> = {
    // Only spans overlapping the window contribute.
    start_seconds: { lt: w1 },
    end_seconds: { gt: w0 },
  }
  if (filters.selectedMatches.length > 0) {
    where.match_id = { in: filters.selectedMatches }
  }

  const rows = await prisma.alive_intervals.findMany({
    where,
    select: { player_id: true, start_seconds: true, end_seconds: true },
  })

  const map = new Map<number, number>()
  for (const r of rows) {
    const dur = Math.min(r.end_seconds, w1) - Math.max(r.start_seconds, w0)
    if (dur <= 0) continue
    map.set(r.player_id, (map.get(r.player_id) ?? 0) + dur)
  }
  return map
}

// ============================================================================
// Main Aggregation
// ============================================================================

/**
 * Gets all filtered statistics for all players. Plain async function — the
 * interactive `getFilteredStats` server action (lib/actions.ts) and the
 * server-rendered tournament default view both call into this.
 */
export async function computeFilteredStats(filters: StatFilters): Promise<PlayerRow[]> {
  // Fetch all stat types in parallel
  const [
    eliminationsMap,
    damageDealtMap,
    damageReceivedMap,
    shotsTakenMap,
    damageContributionMap,
    assistsMap,
    shotAttemptsMap,
    shotsHitMap,
    rebootedMap,
    rebootedOthersMap,
    revivedMap,
    revivedOthersMap,
    buildsPlacedMap,
    timeAliveMap,
  ] = await Promise.all([
    getEliminationsByPlayer(filters),
    getDamageDealtByPlayer(filters),
    getDamageReceivedByPlayer(filters),
    getShotsTakenByPlayer(filters),
    getDamageContributionByPlayer(filters),
    getAssistsByPlayer(filters),
    getShotAttemptsByPlayer(filters),
    getShotAttemptsByPlayer(filters, true),
    getRebootedByPlayer(filters),
    getRebootedOthersByPlayer(filters),
    getRevivedByPlayer(filters),
    getRevivedOthersByPlayer(filters),
    getBuildsPlacedByPlayer(filters),
    getTimeAliveByPlayer(filters),
  ])

  // Get all unique actor_ids from all stat queries
  const allActorIds = new Set<number>()
  eliminationsMap.forEach((_, actorId) => allActorIds.add(actorId))
  damageDealtMap.forEach((_, actorId) => allActorIds.add(actorId))
  damageReceivedMap.forEach((_, recipientId) => allActorIds.add(recipientId))
  shotsTakenMap.forEach((_, actorId) => allActorIds.add(actorId))
  damageContributionMap.forEach((_, actorId) => allActorIds.add(actorId))
  assistsMap.forEach((_, actorId) => allActorIds.add(actorId))
  shotAttemptsMap.forEach((_, actorId) => allActorIds.add(actorId))
  shotsHitMap.forEach((_, actorId) => allActorIds.add(actorId))
  rebootedMap.forEach((_, actorId) => allActorIds.add(actorId))
  rebootedOthersMap.forEach((_, actorId) => allActorIds.add(actorId))
  revivedMap.forEach((_, actorId) => allActorIds.add(actorId))
  revivedOthersMap.forEach((_, actorId) => allActorIds.add(actorId))
  buildsPlacedMap.forEach((_, actorId) => allActorIds.add(actorId))
  timeAliveMap.forEach((_, actorId) => allActorIds.add(actorId))

  // Get player information for all actors
  const matchPlayers = await prisma.match_players.findMany({
    where: { id: { in: Array.from(allActorIds) } },
    select: { id: true, epic_id: true, epic_username: true },
  })

  // Create a map from actor_id to player info
  const playerInfoMap = new Map<number, { epicId: string; displayName: string }>()
  for (const mp of matchPlayers) {
    playerInfoMap.set(mp.id, { epicId: mp.epic_id, displayName: mp.epic_username })
  }

  // Aggregate all stats into PlayerRow format
  const playerRows = new Map<string, PlayerRow>()

  function getOrCreateRow(epicId: string, displayName: string): PlayerRow {
    if (!playerRows.has(epicId)) {
      playerRows.set(epicId, {
        player: displayName,
        epicId,
        eliminations: 0,
        damageDealt: 0,
        damageReceived: 0,
        damageRatio: null,
        shotsTaken: 0,
        damageContribution: 0,
        assists: 0,
        shotAttempts: 0,
        shotsHit: 0,
        accuracy: null,
        rebooted: 0,
        rebootedOthers: 0,
        revived: 0,
        revivedOthers: 0,
        buildsPlaced: 0,
        timeAlive: 0,
      } as unknown as PlayerRow)
    }
    return playerRows.get(epicId)!
  }

  // Process eliminations
  eliminationsMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).eliminations += count
    }
  })

  // Process damage dealt
  damageDealtMap.forEach((damage, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).damageDealt += Math.round(damage)
    }
  })

  // Process damage received
  damageReceivedMap.forEach((damage, recipientId) => {
    const playerInfo = playerInfoMap.get(recipientId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).damageReceived += Math.round(damage)
    }
  })

  // Process shots taken
  shotsTakenMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).shotsTaken += count
    }
  })

  // Process damage contribution
  damageContributionMap.forEach((damage, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).damageContribution += Math.round(damage)
    }
  })

  // Process assists
  assistsMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).assists += count
    }
  })

  // Process shot attempts + hits (hits feed the derived accuracy)
  shotAttemptsMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).shotAttempts += count
    }
  })
  shotsHitMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).shotsHit += count
    }
  })

  // Process reboots (times rebooted, and reboots performed on teammates)
  rebootedMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).rebooted += count
    }
  })
  rebootedOthersMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).rebootedOthers += count
    }
  })

  // Process revives (times revived, and revives performed on teammates)
  revivedMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).revived += count
    }
  })
  revivedOthersMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).revivedOthers += count
    }
  })

  // Process builds placed
  buildsPlacedMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).buildsPlaced += count
    }
  })

  // Process time alive (seconds, summed over clipped alive intervals)
  timeAliveMap.forEach((seconds, actorId) => {
    const playerInfo = playerInfoMap.get(actorId)
    if (playerInfo) {
      getOrCreateRow(playerInfo.epicId, playerInfo.displayName).timeAlive += seconds
    }
  })

  // Compute derived stats
  for (const row of playerRows.values()) {
    const dealt = row.damageDealt as number
    const received = row.damageReceived as number
    row.damageRatio = received > 0 ? Math.round((dealt / received) * 100) / 100 : null

    const attempts = row.shotAttempts as number
    const hits = row.shotsHit as number
    // accuracy as a percentage with one decimal; null when no attempts
    row.accuracy = attempts > 0 ? Math.round((hits / attempts) * 1000) / 10 : null
  }

  // Convert to array and sort by player name
  return Array.from(playerRows.values()).sort((a, b) => a.player.localeCompare(b.player))
}
