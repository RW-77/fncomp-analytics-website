"use server"

import { prisma } from "@/lib/prisma"
import { PlayerRow } from "@/app/tournaments/[tournamentId]/columns"
import { StatFilters, FilterCapabilities } from "@/lib/types"

// ============================================================================
// Meta functions (passed by server component)
// ============================================================================

export async function getMatches(tournamentId: string): Promise<Array<{ id: string; label: string }>> {
  const matches = await prisma.matches.findMany({
      where: { event_window_id: tournamentId },
      select: { match_id: true },
      orderBy: { start_time: 'asc' },
  });
  return matches.map((m: { match_id: string }) => ({ id: m.match_id, label: m.match_id }));
}

export async function getAllPlayers(matchIds: string[]): Promise<Array<{ epicId: string; displayName: string }>> {
  const players = await prisma.match_players.findMany({
    where: { match_id: { in: matchIds } },
    select: { epic_id: true, epic_username: true },
    distinct: ['epic_id'],
    orderBy: { epic_username: 'asc' },
  });
  return players.map((p: { epic_id: string; epic_username: string }) => ({
    epicId: p.epic_id,
    displayName: p.epic_username,
  }));
}

export async function getWeaponIds(tournamentId: string): Promise<Array<{ id: string; label: string }>> {
  const weapons = await prisma.weapons.findMany({
    where: { event_window_id: tournamentId },
    select: { weapon_type: true },
    distinct: ['weapon_type'],
    orderBy: { weapon_type: 'asc' },
  });

  return weapons.map((w: { weapon_type: string }) => ({
    id: w.weapon_type,
    label: w.weapon_type,
  }));
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
): Record<string, any> {
  const where: Record<string, any> = {};

  if (capabilities.supportsMatches && filters.selectedMatches.length > 0) {
    where.match_id = { in: filters.selectedMatches };
  }

  if (capabilities.supportsWeaponTypes && filters.weaponTypes.length > 0) {
    // Include events that match selected weapon types OR have null weapon_type
    // This ensures events without classified weapons are not excluded
    where.OR = [
      { weapon_type: { in: filters.weaponTypes } },
      // { weapon_type: null },
    ];
  }

  if (capabilities.supportsTimeRange) {
    where.game_time_seconds = {
      gte: filters.timeRange[0] * 60,
      lte: filters.timeRange[1] * 60,
    };
  }

  if (capabilities.supportsDistanceRange) {
    where.distance = {
      gte: filters.distanceRange[0] * 100,
      lte: filters.distanceRange[1] * 100,
    };
  }

  return where;
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
  // Future stat types can be added here:
  // assists: {
  //   supportsMatches: true,
  //   supportsWeaponTypes: true,
  //   supportsTimeRange: true,
  //   supportsDistanceRange: false, // Assists don't support distance filtering
  // } as FilterCapabilities,
  // soloClutchedPoints: {
  //   supportsMatches: true,
  //   supportsWeaponTypes: false, // Solo clutched points don't support weapon filtering
  //   supportsTimeRange: true,
  //   supportsDistanceRange: false, // Solo clutched points don't support distance filtering
  // } as FilterCapabilities,
} as const;

/**
 * Gets elimination counts per player, filtered according to capabilities.
 */
async function getEliminationsByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const capabilities = STAT_CAPABILITIES.eliminations;
  const whereClause = buildWhereClause(filters, capabilities);

  const results = await prisma.elimination_events.groupBy({
    by: ["actor_id"],
    where: whereClause,
    _count: {
      _all: true,
    },
  });

  const map = new Map<number, number>();
  for (const row of results) {
    if (row.actor_id !== null && row._count && typeof row._count === 'object' && '_all' in row._count) {
      const count = row._count._all;
      if (typeof count === 'number') {
        map.set(row.actor_id, count);
      }
    }
  }
  return map;
}

/**
 * Gets total damage dealt per player, filtered according to capabilities.
 */
async function getDamageDealtByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const capabilities = STAT_CAPABILITIES.damageDealt;
  const whereClause = buildWhereClause(filters, capabilities);

  const results = await prisma.damage_dealt_events.groupBy({
    by: ["actor_id"],
    where: whereClause,
    _sum: {
      damage_amount: true,
    },
  });

  const map = new Map<number, number>();
  for (const row of results) {
    if (row.actor_id !== null && row._sum && row._sum.damage_amount !== null && row._sum.damage_amount !== undefined) {
      map.set(row.actor_id, row._sum.damage_amount);
    }
  }
  return map;
}

/**
 * Gets total damage received per player, filtered according to capabilities.
 */
async function getDamageReceivedByPlayer(filters: StatFilters): Promise<Map<number, number>> {
  const capabilities = STAT_CAPABILITIES.damageReceived;
  const whereClause = buildWhereClause(filters, capabilities);

  const results = await prisma.damage_dealt_events.groupBy({
    by: ["recipient_id"],
    where: whereClause,
    _sum: {
      damage_amount: true,
    },
  });

  const map = new Map<number, number>();
  for (const row of results) {
    if (row.recipient_id !== null && row._sum && row._sum.damage_amount !== null && row._sum.damage_amount !== undefined) {
      map.set(row.recipient_id, row._sum.damage_amount);
    }
  }
  return map;
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

/**
 * Gets all filtered statistics for all players.
 * This is the main entry point called by the client component.
 */
export async function getFilteredStats(
  filters: StatFilters
): Promise<PlayerRow[]> {
  // Fetch all stat types in parallel
  const [eliminationsMap, damageDealtMap, damageReceivedMap] = await Promise.all([
    getEliminationsByPlayer(filters),
    getDamageDealtByPlayer(filters),
    getDamageReceivedByPlayer(filters),
  ]);

  // Get all unique actor_ids from all stat queries
  const allActorIds = new Set<number>();
  eliminationsMap.forEach((_, actorId) => allActorIds.add(actorId));
  damageDealtMap.forEach((_, actorId) => allActorIds.add(actorId));
  damageReceivedMap.forEach((_, recipientId) => allActorIds.add(recipientId));

  // Get player information for all actors
  // Note: We don't filter by match_id here because we already have the specific actor_ids
  // from the stat queries. We also don't use distinct because we need ALL actor_ids,
  // not just one per epic_id (a player can have different actor_ids in different matches).
  const matchPlayers = await prisma.match_players.findMany({
    where: {
      id: { in: Array.from(allActorIds) },
    },
    select: {
      id: true,
      epic_id: true,
      epic_username: true,
    },
  });

  // Create a map from actor_id to player info
  const playerInfoMap = new Map<number, { epicId: string; displayName: string }>();
  for (const mp of matchPlayers) {
    playerInfoMap.set(mp.id, {
      epicId: mp.epic_id,
      displayName: mp.epic_username,
    });
  }

  // Aggregate all stats into PlayerRow format
  const playerRows = new Map<string, PlayerRow>();

  // Process eliminations
  // Note: A player can have multiple actor_ids (one per match), so we need to SUM stats
  eliminationsMap.forEach((count, actorId) => {
    const playerInfo = playerInfoMap.get(actorId);
    if (playerInfo) {
      const key = playerInfo.epicId;
      if (!playerRows.has(key)) {
        const row = {
          player: playerInfo.displayName,
          epicId: playerInfo.epicId,
          eliminations: 0,
          damageDealt: 0,
          damageReceived: 0,
        } as unknown as PlayerRow;
        playerRows.set(key, row);
      }
      const row = playerRows.get(key)!;
      row.eliminations += count; // Sum, don't overwrite
    }
  });

  // Process damage dealt
  // Note: A player can have multiple actor_ids (one per match), so we need to SUM stats
  damageDealtMap.forEach((damage, actorId) => {
    const playerInfo = playerInfoMap.get(actorId);
    if (playerInfo) {
      const key = playerInfo.epicId;
      if (!playerRows.has(key)) {
        const row = {
          player: playerInfo.displayName,
          epicId: playerInfo.epicId,
          eliminations: 0,
          damageDealt: 0,
          damageReceived: 0,
        } as unknown as PlayerRow;
        playerRows.set(key, row);
      }
      const row = playerRows.get(key)!;
      row.damageDealt += Math.round(damage); // Sum, don't overwrite
    }
  });

  // Process damage received
  // Note: A player can have multiple recipient_ids (one per match), so we need to SUM stats
  damageReceivedMap.forEach((damage, recipientId) => {
    const playerInfo = playerInfoMap.get(recipientId);
    if (playerInfo) {
      const key = playerInfo.epicId;
      if (!playerRows.has(key)) {
        const row = {
          player: playerInfo.displayName,
          epicId: playerInfo.epicId,
          eliminations: 0,
          damageDealt: 0,
          damageReceived: 0,
        } as unknown as PlayerRow;
        playerRows.set(key, row);
      }
      const row = playerRows.get(key)!;
      row.damageReceived += Math.round(damage); // Sum, don't overwrite
    }
  });

  // Convert to array and sort by player name
  return Array.from(playerRows.values()).sort((a, b) => 
    a.player.localeCompare(b.player)
  );
}