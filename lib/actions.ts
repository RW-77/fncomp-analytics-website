"use server"

import { computeFilteredStats } from "@/lib/stats"
import { PlayerRow } from "@/app/tournaments/[tournamentId]/columns"
import { StatFilters } from "@/lib/types"

/**
 * Live stats query invoked from the client (TournamentStatsClient) whenever the
 * user changes a filter. This is the only data function that needs to be a
 * Server Action; everything else lives in "@/lib/stats" as plain functions that
 * server components call directly.
 */
export async function getFilteredStats(filters: StatFilters): Promise<PlayerRow[]> {
  return computeFilteredStats(filters)
}
