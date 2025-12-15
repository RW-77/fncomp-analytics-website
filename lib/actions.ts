"use server"

import { prisma } from "@/lib/primsa"

export async function getMatches(tournamentId: string) {
    const matches = await prisma.matches.findMany({
        where: { event_window_id: tournamentId },
        select: { match_id: true },
        orderBy: { start_time: 'asc' },
    });
    return matches.map(m => ({ id: m.match_id, label: m.match_id }));
}

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

export async function getWeaponIds(tournamentId: string) {
  // Fetch weapons for this tournament from the weapons table
  const weapons = await prisma.weapons.findMany({
    where: { event_window_id: tournamentId },
    select: { weapon_id: true, weapon_type: true },
    orderBy: { weapon_type: 'asc' },
  });

  return weapons.map(w => ({
    id: w.weapon_id,
    label: w.weapon_type || w.weapon_id,
  }));
}

export interface Filters {
    selectedMatches: string[],
    weaponTypes: string[],
    distanceRange: [number, number],
    timeRange: [number, number];
}

export interface PlayerStat {
    player: string;
    epicId: string;
    eliminations: number;
    damageDealt: number;
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
    weapon_id: weaponTypes.length > 0 ? { in: weaponTypes } : undefined,
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

  // Transform to PlayerStat format
  const playerStats = results.reduce((acc, event) => {
    const actor = event.match_players_damage_dealt_events_actor_idTomatch_players;
    const epicId = actor?.epic_id || "Unknown";
    const displayName = actor?.epic_username || "Unknown";
    const existing = acc.find(p => p.epicId === epicId);
    if (existing) {
      existing.damageDealt += event.damage_amount;
    } else {
      acc.push({
        player: displayName,
        epicId: epicId,
        eliminations: 0,
        damageDealt: event.damage_amount,
      });
    }
    return acc;
  }, [] as Array<PlayerStat>);

  console.log("[getFilteredDamageDealt] transformed to", playerStats.length, "player stats");
  return playerStats;
}

export async function getFilteredEliminations(filters: Filters) {
  const {
    selectedMatches,
    distanceRange,
    timeRange,
    weaponTypes
  } = filters;

  // Diagnostic: count rows by match alone
  const countByMatch = await prisma.elimination_events.count({
    where: {
      match_id: selectedMatches.length > 0 ? { in: selectedMatches } : undefined,
    },
  });
  console.log("[getFilteredEliminations] count by match_id:", countByMatch);

  // Diagnostic: get actual weapon types in the data
  const actualWeaponTypes = await prisma.elimination_events.findMany({
    where: {
      match_id: selectedMatches.length > 0 ? { in: selectedMatches } : undefined,
    },
    select: { weapon_type: true },
    distinct: ['weapon_type'],
    take: 20,
  });
  console.log("[getFilteredEliminations] actual weapon_types in DB:", actualWeaponTypes.map(w => w.weapon_type));

  // Diagnostic: count rows by match + distance
  const countByMatchDistance = await prisma.elimination_events.count({
    where: {
      match_id: selectedMatches.length > 0 ? { in: selectedMatches } : undefined,
      distance: {
        gte: distanceRange[0] * 100,
        lte: distanceRange[1] * 100,
      },
    },
  });
  console.log("[getFilteredEliminations] count by match_id + distance:", countByMatchDistance);

  // Diagnostic: count rows by match + time
  const countByMatchTime = await prisma.elimination_events.count({
    where: {
      match_id: selectedMatches.length > 0 ? { in: selectedMatches } : undefined,
      game_time_seconds: {
        gte: timeRange[0] * 60,
        lte: timeRange[1] * 60,
      },
    },
  });
  console.log("[getFilteredEliminations] count by match_id + game_time_seconds:", countByMatchTime);

  const whereClause = {
    match_id: selectedMatches.length > 0 ? { in: selectedMatches } : undefined,
    weapon_id: weaponTypes.length > 0 ? { in: weaponTypes } : undefined,
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

  // Transform to PlayerStat format
  const playerStats = results.reduce((acc, event) => {
    const actor = event.match_players_elimination_events_actor_idTomatch_players;
    const epicId = actor?.epic_id || "Unknown";
    const displayName = actor?.epic_username || "Unknown";
    const existing = acc.find(p => p.epicId === epicId);
    if (existing) {
      existing.eliminations += 1;
    } else {
      acc.push({
        player: displayName,
        epicId: epicId,
        eliminations: 1,
        damageDealt: 0,
      });
    }
    return acc;
  }, [] as Array<PlayerStat>);

  console.log("[getFilteredEliminations] transformed to", playerStats.length, "player stats");
  return playerStats;
}
