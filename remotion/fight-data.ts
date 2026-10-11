// The real fight the event-grouping animation plays (remotion/public/
// fight.json, written by remotion/data/extract_fight.py), and the geometry
// and scoring the animation needs from it.

import type { Engagement, InteractionRecord, Outcome } from "@/lib/replay/engagements"

// One sample: x, y (m from the fight's centroid), yaw (deg clockwise from
// east), hp, shield, alive (0/1), knocked (0/1).
export type Sample = [number, number, number, number, number, number, number]

export type FightPlayer = {
  id: string
  name: string
  team: number
  s: Sample[]
}

export type FightShot = {
  t: number        // game seconds
  p: string        // shooter id
  team: number
  ax: number; ay: number; ex: number; ey: number   // m from the centroid
  sg: boolean      // shotgun
}

export type FightData = {
  matchId: string
  window: [number, number]     // game seconds covered by the samples
  sampleHz: number
  players: FightPlayer[]
  shots: FightShot[]
  // Records' ax/ay/rx/ry are m from the centroid; az/rz stay in cm.
  fight: Engagement & { number: number }
  teamRosters: Record<number, string[]>
  playerNames: Record<string, string>
  // The team the animation and card follow, if any (set from fights.ts, not
  // the file): first on the card, in gold, with its own verdict.
  perspective?: number | null
}

export type PlayerState = {
  x: number; y: number; yaw: number
  hp: number; shield: number
  alive: boolean; knocked: boolean
}

// A player at game time t, between the two nearest samples (null outside
// the window).
export function playerAt(data: FightData, p: FightPlayer, t: number): PlayerState | null {
  const f = (t - data.window[0]) * data.sampleHz
  const i = Math.floor(f)
  if (i < 0 || i >= p.s.length - 1) return null
  const a = p.s[i]
  const b = p.s[i + 1]
  const k = f - i
  const turn = ((((b[2] - a[2]) % 360) + 540) % 360) - 180   // the short way round
  return {
    x: a[0] + (b[0] - a[0]) * k,
    y: a[1] + (b[1] - a[1]) * k,
    yaw: a[2] + turn * k,
    hp: a[3], shield: a[4],
    alive: a[5] === 1,
    knocked: a[6] === 1,
  }
}

// Pulls far-off players in toward the fight so a zoomed-out view isn't mostly
// empty: distances up to R0 stay true (the fight itself keeps its real
// shape); beyond that they shrink by K.
const R0 = 120
const K = 0.35
export function compress(x: number, y: number): [number, number] {
  const r = Math.hypot(x, y)
  if (r <= R0) return [x, y]
  const s = (R0 + (r - R0) * K) / r
  return [x * s, y * s]
}

// ---------------------------------------------------------------------------
// The grouping algorithm's evidence, ported from the ETL's segment_engagements
// (etl/parsing/match/clustering/engagements.py, SegmentParams defaults), so
// the animation shows a fight forming when the real algorithm would see it.
// ---------------------------------------------------------------------------

const D0_M = 25          // a record's distance falloff is 1/2 at this range
const FALLOFF_P = 3
export const TAU_S = 5   // evidence fades by e every TAU_S seconds
const START_THETA = 0.1  // both teams fired at each other enough
const JOIN_THETA = 1.2   // a third team's exchange is strong enough to join
const KIND_WEIGHT: Record<InteractionRecord["kind"], number> = { shot_attempt: 0.25, hit: 3, knock: 10, elim: 20 }

// What one record adds: its kind's weight times the distance falloff.
export function recordWeight(r: InteractionRecord): number {
  const d = Math.hypot(r.ax - r.rx, r.ay - r.ry, (r.az - r.rz) / 100)
  return KIND_WEIGHT[r.kind] / (1 + (d / D0_M) ** FALLOFF_P)
}

// When each team pair's exchange first qualifies: `start` when both
// directions (plus knocks and elims) reach START_THETA, `join` when both
// directions summed reach JOIN_THETA. Mirrors _Exchange.score.
export function exchangeMoments(records: InteractionRecord[]): Map<string, { start: number | null; join: number | null }> {
  const pairs = new Map<string, InteractionRecord[]>()
  for (const r of records) {
    const key = [r.actor_team, r.recipient_team].sort((a, b) => a - b).join("-")
    pairs.set(key, [...(pairs.get(key) ?? []), r])
  }
  const out = new Map<string, { start: number | null; join: number | null }>()
  for (const [key, rs] of pairs) {
    const a = Number(key.split("-")[0])
    let aOnB = 0, bOnA = 0, decisive = 0, prev = rs[0].t_s
    let start: number | null = null, join: number | null = null
    for (const r of rs) {
      const fade = Math.exp(-(r.t_s - prev) / TAU_S)
      aOnB *= fade; bOnA *= fade; decisive *= fade
      prev = r.t_s
      const w = recordWeight(r)
      if (r.kind === "knock" || r.kind === "elim") decisive += w
      else if (r.actor_team === a) aOnB += w
      else bOnA += w
      if (start === null && Math.min(aOnB, bOnA) + decisive >= START_THETA) start = r.t_s
      if (join === null && aOnB + bOnA + decisive >= JOIN_THETA) join = r.t_s
    }
    out.set(key, { start, join })
  }
  return out
}

// The card's team order (best outcome first), so the animation colors each
// team like the card's dots do.
const OUTCOME_ORDER: Record<Outcome, number> = { won: 0, favorable: 1, stalemate: 2, unfavorable: 3, lost: 4 }
export function teamsByOutcome(fight: Engagement): number[] {
  return [...fight.outcomes].sort((a, b) => OUTCOME_ORDER[a.label] - OUTCOME_ORDER[b.label]).map((o) => o.team_id)
}

// How long the grouping takes to show once the algorithm takes a team in:
// its color fades in and the circle closes over this many game seconds.
export const CLAIM_S = 1.6

// The fight's moments as the grouping algorithm sees them: which teams start
// it, when the evidence first says they're fighting (`detected`), and when a
// third team joins (`entry`; Infinity if none does).
export function fightTimes(data: FightData) {
  const fight = data.fight
  const coreTeams = fight.phases[0].teams
  const entry = fight.phases[1]?.start_s ?? Infinity
  const joiners = fight.teams.filter((t) => !coreTeams.includes(t))
  const fighters = new Set(fight.participants.map((p) => p.player_id))
  const moments = exchangeMoments(fight.records)
  const detected = moments.get([...coreTeams].sort((a, b) => a - b).join("-"))?.start ?? fight.start_s
  return { fight, coreTeams, entry, joiners, fighters, detected }
}

// When the animation shows the core teams as one fight: when the algorithm's
// evidence first says they're fighting ("detection"), or sooner, at the
// fight's first interaction, the moment the algorithm dates it from
// ("first-hit").
export type GroupFrom = "detection" | "first-hit"
export function groupedAt(data: FightData, from: GroupFrom): number {
  const { fight, detected } = fightTimes(data)
  return from === "first-hit" ? fight.start_s : detected
}
