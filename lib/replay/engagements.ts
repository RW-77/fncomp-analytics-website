// ---------------------------------------------------------------------------
// Engagement data — the website side of the ETL's engagement output.
//
// These types mirror etl/parsing/match/clustering/engagements.py (to_dict on
// InteractionRecord / Engagement / TeamOutcome / PlayerOutcome) and the file
// build_engagements_asset writes to S3 (replays/matches/<id>/engagements.json).
// If the ETL output changes, change it here too.
//
// Client-safe: no server imports (lib/replay/match-data.ts builds an S3 client
// at import time, so nothing here may import from it except types).
// ---------------------------------------------------------------------------

import type { MatchMetadata } from '@/lib/replay/match-data'

export type InteractionKind = 'shot_attempt' | 'hit' | 'knock' | 'elim'

export type Outcome = 'won' | 'lost' | 'favorable' | 'unfavorable' | 'stalemate'

// Which evaluator rule decided a team's outcome:
//   wiped         -> lost: every participant on the team was eliminated
//   last_standing -> won: the only team left after at least one team was wiped
//   net_elims     -> won/lost: more (or fewer) elims dealt than taken
//   damage_ratio  -> favorable/unfavorable: elims even, decided by damage ratio
//   even          -> stalemate: elims even, damage within the ratio threshold
export type OutcomeReason = 'wiped' | 'last_standing' | 'net_elims' | 'damage_ratio' | 'even'

// One cross-team combat action that belongs to the engagement.
// Positions are WORLD coords (cm): a* = actor, r* = recipient.
export type InteractionRecord = {
  ts: number                // raw µs since epoch
  t_s: number               // seconds since bus launch (replay time)
  kind: InteractionKind
  actor_id: string
  recipient_id: string
  actor_team: number
  recipient_team: number
  ax: number; ay: number; az: number
  rx: number; ry: number; rz: number
  weapon_id: string | null
  damage: number
}

export type EngagementParticipant = {
  player_id: string
  team_id: number
  first_s: number
  last_s: number
}

// Per-team result. Stats are dealt / received within the engagement's window,
// between its participants.
export type TeamOutcome = {
  team_id: number
  label: Outcome
  reason: OutcomeReason
  elims_dealt: number
  elims_received: number
  knocks_dealt: number
  knocks_received: number
  damage_dealt: number
  damage_received: number
}

// Per-participant stats; a team's player rows sum to its TeamOutcome.
export type PlayerOutcome = {
  player_id: string
  team_id: number
  elims_dealt: number
  elims_received: number
  knocks_dealt: number
  knocks_received: number
  damage_dealt: number
  damage_received: number
}

// A stretch of an engagement with a fixed set of core teams, graded on its
// own. A new phase starts each time a team joins (a third party); teams that
// are wiped or leave don't start one.
export type EngagementPhase = {
  start_s: number
  end_s: number
  teams: number[]
  outcomes: TeamOutcome[]
  players: PlayerOutcome[]
}

// One engagement with its evaluation — everything the list, the details panel
// and the map need.
export type Engagement = {
  id: number                          // chronological index within the match
  match_id: string
  start_s: number
  end_s: number
  teams: number[]                     // core teams
  participants: EngagementParticipant[]
  centroid: [number, number, number]  // world coords
  activity_index: number              // summed distance-weighted evidence
  zone: number | null                 // zone at the first record
  records: InteractionRecord[]        // between core teams, time-ordered
  // Records between a core team and a team shooting in from outside the
  // fight. That team is not a participant and is not graded.
  periphery: InteractionRecord[]
  outcomes: TeamOutcome[]             // whole engagement
  players: PlayerOutcome[]            // whole engagement
  phases: EngagementPhase[]           // in time order; one phase without a third party
}

// One match's engagements file (served by /api/replay/[matchId]/engagements).
export type MatchEngagements = {
  schema_version?: number              // file shape; absent in files written before it existed
  match_id: string
  params: {
    d0_cm: number
    falloff_p: number
    tau_s: number
    start_theta: number
    join_theta: number
    contact_cm: number
    sustain_cm: number
    join_radius_cm: number
    zone_cutoff: number | null
    kind_weight: Record<InteractionKind, number>
  }
  engagement_count: number
  engagements: Engagement[]
}

// Event types the left panel filters by. For now every event is an engagement,
// split into early and mid game; more types (rotations, ...) come later.
export type EventType = 'early_fight' | 'mid_fight'

export const EVENT_TYPES: { id: EventType; label: string; singular: string }[] = [
  { id: 'early_fight', label: 'Early game fights', singular: 'Early game fight' },
  { id: 'mid_fight', label: 'Mid game fights', singular: 'Mid game fight' },
]

// Fights up to and including this zone are early game. Placeholder: the split
// will likely move earlier in the match.
const EARLY_GAME_LAST_ZONE = 2

export function engagementType(engagement: Engagement): EventType {
  return engagement.zone !== null && engagement.zone <= EARLY_GAME_LAST_ZONE ? 'early_fight' : 'mid_fight'
}

// Outcome colors for drawing (the map canvas, inline styles): the same hues
// as OUTCOME_COLORS' Tailwind classes in components/replay/outcome-chip.tsx.
export const OUTCOME_HEX: Record<Outcome, string> = {
  won: '#4ade80',
  favorable: '#2dd4bf',
  stalemate: '#94a3b8',
  unfavorable: '#fb923c',
  lost: '#f87171',
}

// The slim view of an engagement that ReplayClient draws as a badge on the map
// (and as a mark on the scrubber, when viewing as a team).
export type EngagementOverlay = {
  id: number
  number: number                       // drawn in the badge; same as the list's number
  centroid: [number, number, number]  // world coords, projected like the storm
  startS: number                       // for seek()
  endS: number
  teamCount: number
  activity: number                     // activity_index — drives the area ring's radius
  outcome: Outcome | null              // the viewed team's outcome; null when viewing all teams
}

export function toOverlay(
  engagement: Engagement,
  number: number,
  perspectiveTeamId: number | null = null,
): EngagementOverlay {
  return {
    id: engagement.id,
    number,
    centroid: engagement.centroid,
    startS: engagement.start_s,
    endS: engagement.end_s,
    teamCount: engagement.teams.length,
    activity: engagement.activity_index,
    outcome: engagement.outcomes.find((o) => o.team_id === perspectiveTeamId)?.label ?? null,
  }
}

// team id -> its players' ids, from the match's full rosters in the replay
// metadata (not just engagement participants). Ordered by name so a team
// reads the same everywhere.
export function buildTeamMembers(metadata: MatchMetadata): Record<number, string[]> {
  const playerToIndex = metadata.player_to_index ?? {}
  const indexToTeam = metadata.index_to_team ?? {}
  const name = (id: string) => metadata.id_to_username?.[id] ?? id

  const members: Record<number, string[]> = {}
  for (const [playerId, index] of Object.entries(playerToIndex)) {
    const team = indexToTeam[String(index)]
    if (team === undefined) continue
    if (!members[team]) members[team] = []
    members[team].push(playerId)
  }
  for (const ids of Object.values(members)) ids.sort((a, b) => name(a).localeCompare(name(b)))
  return members
}

// team id -> its players' names (same order as buildTeamMembers).
export function buildTeamRosters(metadata: MatchMetadata): Record<number, string[]> {
  const idToUsername = metadata.id_to_username ?? {}
  const rosters: Record<number, string[]> = {}
  for (const [team, ids] of Object.entries(buildTeamMembers(metadata))) {
    rosters[Number(team)] = ids.map((id) => idToUsername[id] ?? id.slice(0, 8))
  }
  return rosters
}

// team id -> "player + player" (the roster on one line).
export function buildTeamLabels(metadata: MatchMetadata): Record<number, string> {
  const labels: Record<number, string> = {}
  for (const [team, names] of Object.entries(buildTeamRosters(metadata))) {
    labels[Number(team)] = names.join(' + ')
  }
  return labels
}
