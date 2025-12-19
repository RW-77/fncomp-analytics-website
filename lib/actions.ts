"use server"

import { prisma } from "@/lib/primsa"

// meta function (passed by server component)
export async function getMatches(tournamentId: string) {
  const matches = await prisma.matches.findMany({
      where: { event_window_id: tournamentId },
      select: { match_id: true },
      orderBy: { start_time: 'asc' },
  });
  return matches.map(m => ({ id: m.match_id, label: m.match_id }));
}

// meta function (passed by server component)
export async function getAllPlayers(matchIds: string[]) {
  const players = await prisma.match_players.findMany({
    where: { match_id: { in: matchIds } },
    select: { epic_id: true, epic_username: true },
    distinct: ['epic_id'],
    orderBy: { epic_username: 'asc' },
  });
  return players.map(p => ({
    epicId: p.epic_id,
    displayName: p.epic_username,
  }));
}

// meta function (passed by server component)
export async function getWeaponIds(tournamentId: string) {
  // Fetch unique weapon types for this tournament from the weapons table
  const weapons = await prisma.weapons.findMany({
    where: { event_window_id: tournamentId },
    select: { weapon_type: true },
    distinct: ['weapon_type'],
    orderBy: { weapon_type: 'asc' },
  });

  return weapons.map(w => ({
    id: w.weapon_type,
    label: w.weapon_type,
  }));
}

export interface Filters {
    selectedMatches: string[],
    weaponTypes: string[],
    distanceRange: [number, number],
    timeRange: [number, number];
}

export type PlayerRow = {
  epicId: string
  player: string
} & Record<string, number>


// single function which returns all stats based on filters
export async function getFilteredStats(
  filters: Filters
): Promise<PlayerRow[]> {
  const {
    selectedMatches,
    distanceRange,
    timeRange,
    weaponTypes
  } = filters;
  const damageDealtEvents = await getFilteredDamageDealt(filters);
  const eliminationEvents = await getFilteredEliminations(filters);

  return [];
}

export async function getFilteredDamageDealt(filters: Filters) {
  const {
    selectedMatches,
    distanceRange,
    timeRange,
    weaponTypes
  } = filters;

  const whereClause = {
    match_id: selectedMatches.length > 0 ? { in: selectedMatches } : undefined,
    weapon_type: weaponTypes.length > 0 ? { in: weaponTypes } : undefined,
    game_time_seconds: {
      gte: timeRange[0] * 60,
      lte: timeRange[1] * 60,
    },
    distance: {
      gte: distanceRange[0] * 100,
      lte: distanceRange[1] * 100,
    },
  };

  console.log("[getFilteredDamageDealt] filters", filters);
  console.log("[getFilteredDamageDealt] where", JSON.stringify(whereClause));

  const results = await prisma.damage_dealt_events.findMany({
    where: whereClause,
    include: {
      match_players_damage_dealt_events_actor_idTomatch_players: true,
      match_players_damage_dealt_events_recipient_idTomatch_players: true,
      matches: true,
    },
  });

  console.log("[getFilteredDamageDealt] count", results.length);

  return results;
}

export async function getFilteredEliminations(filters: Filters) {
  const {
    selectedMatches,
    distanceRange,
    timeRange,
    weaponTypes
  } = filters;

  const whereClause = {
    match_id: selectedMatches.length > 0 ? { in: selectedMatches } : undefined,
    weapon_type: weaponTypes.length > 0 ? { in: weaponTypes } : undefined,
    game_time_seconds: {
      gte: timeRange[0] * 60,
      lte: timeRange[1] * 60,
    },
    distance: {
        gte: distanceRange[0] * 100,
        lte: distanceRange[1] * 100,
    },
  };

  console.log("[getFilteredEliminations] filters", filters);
  console.log("[getFilteredEliminations] where", JSON.stringify(whereClause));

  const results = await prisma.elimination_events.findMany({
    where: whereClause,
    include: {
      match_players_elimination_events_actor_idTomatch_players: true,
      match_players_elimination_events_recipient_idTomatch_players: true,
      matches: true,
    },
  });

  console.log("[getFilteredEliminations] count", results.length);

  return results;
}