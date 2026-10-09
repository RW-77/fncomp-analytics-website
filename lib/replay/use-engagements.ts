'use client'

// ---------------------------------------------------------------------------
// React hooks for a match's engagements: loading the file, and deriving what
// the event list and the map show from it.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EVENT_TYPES,
  engagementType,
  toOverlay,
  type Engagement,
  type EventType,
  type MatchEngagements,
  type MatchRoster,
} from '@/lib/replay/engagements'
import type { Loadable } from '@/lib/replay/use-replay'

// The match's engagements file. 'missing' means the pipeline hasn't processed
// the match for engagements yet. The request is cancelled on unmount, so a
// late response can't land in a page that has moved on.
export function useMatchEngagements(matchId: string): { engagements: Loadable<Engagement[]>; retry: () => void } {
  const [engagements, setEngagements] = useState<Loadable<Engagement[]>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const settle = (next: Loadable<Engagement[]>) => {
      if (!controller.signal.aborted) setEngagements(next)
    }
    fetch(`/api/replay/${encodeURIComponent(matchId)}/engagements`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) return settle({ status: 'missing' })
        if (!res.ok) throw new Error(`engagements: HTTP ${res.status}`)
        const data = (await res.json()) as Partial<MatchEngagements> | null
        if (!Array.isArray(data?.engagements)) throw new Error('engagements: malformed')
        settle({ status: 'ready', data: data.engagements })
      })
      .catch(() => settle({ status: 'error' }))
    return () => controller.abort()
  }, [matchId, attempt])

  const retry = useCallback(() => {
    setEngagements({ status: 'loading' })
    setAttempt((a) => a + 1)
  }, [])

  return { engagements, retry }
}

export type TeamOption = {
  id: number
  label: string            // "player + player"
  engagementCount: number
  placement?: number       // where the team finished, from the leaderboard
}

// What the left panel and the map show, from every engagement in the match,
// the viewed team (null = all teams) and the unchecked event types. Each
// piece is memoized on just what it depends on.
export function useEngagementView({
  engagements,
  teamId,
  hiddenTypes,
  roster,
  placements,
}: {
  engagements: Engagement[]
  teamId: number | null
  hiddenTypes: EventType[]
  roster: MatchRoster
  placements: Record<string, number>
}) {
  // Every team, busiest first (then by placement): teams with no fights are
  // listed too, so any team can be viewed even without engagements.
  const teamOptions = useMemo<TeamOption[]>(() => {
    const counts = new Map<number, number>()
    for (const e of engagements) for (const t of e.teams) counts.set(t, (counts.get(t) ?? 0) + 1)
    return Object.keys(roster.teamMembers)
      .map(Number)
      .map((id) => ({
        id,
        label: roster.teamLabels[id] ?? `Team ${id}`,
        engagementCount: counts.get(id) ?? 0,
        placement: placements[String(id)],
      }))
      .sort(
        (a, b) =>
          b.engagementCount - a.engagementCount ||
          (a.placement ?? Infinity) - (b.placement ?? Infinity) ||
          a.label.localeCompare(b.label),
      )
  }, [engagements, roster, placements])

  // The viewed team's engagements, numbered in time order. Numbers come from
  // this list, so the type filter hides rows and circles without renumbering.
  const numbered = useMemo(
    () =>
      (teamId === null ? engagements : engagements.filter((e) => e.teams.includes(teamId))).map(
        (engagement, i) => ({ engagement, number: i + 1 }),
      ),
    [engagements, teamId],
  )

  // What the list and the map show. Both get this same array, so a row and
  // its circle carry the same number.
  const visible = useMemo(
    () => numbered.filter(({ engagement }) => !hiddenTypes.includes(engagementType(engagement))),
    [numbered, hiddenTypes],
  )
  const overlays = useMemo(
    () => visible.map(({ engagement, number }) => toOverlay(engagement, number, teamId)),
    [visible, teamId],
  )

  // The type filter's rows, counted over the viewed team's engagements.
  const typeOptions = useMemo(
    () =>
      EVENT_TYPES.map((t) => ({
        id: t.id,
        label: t.label,
        count: numbered.filter(({ engagement }) => engagementType(engagement) === t.id).length,
      })),
    [numbered],
  )

  return { teamOptions, numbered, visible, overlays, typeOptions }
}
