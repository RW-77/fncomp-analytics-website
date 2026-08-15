"use client"

import { useCallback, useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/common/data-table"
import { cn } from "@/lib/utils"

import { leaderboardColumns, LeaderboardRow } from "./columns"
import { TeamDetailPanel, type TeamDetail } from "./team-detail-panel"
import type { StandingGame } from "./standings-chart"

type PerMatch = {
  points: number
  win: number
  kills: number
  placement: number | null
  tiebreaker: number
} | null

export type LeaderboardData = {
  matchCount: number
  teams: {
    teamId: string
    name: string
    // Results aligned to the global match order; null where the team didn't play.
    perMatch: PerMatch[]
  }[]
}

// "cumulative" = all matches; a number = standings after that match (1-based).
type Selection = "cumulative" | number

function snapshot(data: LeaderboardData, upTo: number): LeaderboardRow[] {
  const totals = data.teams
    .map((team) => {
      let points = 0
      let wins = 0
      let kills = 0
      let tiebreaker = 0
      let matches = 0
      for (let i = 0; i < upTo; i++) {
        const m = team.perMatch[i]
        if (!m) continue
        points += m.points
        wins += m.win
        kills += m.kills
        tiebreaker += m.tiebreaker
        matches += 1
      }
      return { teamId: team.teamId, team: team.name, points, wins, kills, tiebreaker, matches }
    })
    .filter((row) => row.matches > 0)

  totals.sort((a, b) => b.points - a.points || b.tiebreaker - a.tiebreaker)

  return totals.map((row, i) => ({
    teamId: row.teamId,
    rank: i + 1,
    team: row.team,
    points: row.points,
    matches: row.matches,
    wins: row.wins,
    kills: row.kills,
  }))
}

export function LeaderboardClient({ data }: { data: LeaderboardData }) {
  const [selected, setSelected] = useState<Selection>("cumulative")
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const upTo = selected === "cumulative" ? data.matchCount : selected
  const rows = useMemo(() => snapshot(data, upTo), [data, upTo])

  // Default to the current rank-1 team until the user clicks a row.
  const activeTeamId = selectedTeamId ?? rows[0]?.teamId ?? null

  const activeTeam = useMemo<TeamDetail | null>(() => {
    if (!activeTeamId) return null
    const source = data.teams.find((t) => t.teamId === activeTeamId)
    const row = rows.find((r) => r.teamId === activeTeamId)
    if (!source || !row) return null

    // Full standing progression — the team's rank after each game across the
    // whole tournament, independent of the match scrubber. `snapshot(k)` is the
    // same ranking the table uses, so standings stay consistent.
    const games: StandingGame[] = Array.from({ length: data.matchCount }, (_, i) => {
      const m = source.perMatch[i]
      const ranked = snapshot(data, i + 1)
      const idx = ranked.findIndex((r) => r.teamId === activeTeamId)
      return {
        game: i + 1,
        standing: idx === -1 ? null : idx + 1,
        placement: m?.placement ?? null,
        points: m?.points ?? null,
        kills: m?.kills ?? null,
        win: m?.win === 1,
        played: m != null,
      }
    })

    // Average finish over the games counted in the current view.
    let placementSum = 0
    let placementCount = 0
    for (let i = 0; i < upTo; i++) {
      const p = source.perMatch[i]?.placement
      if (p != null) {
        placementSum += p
        placementCount += 1
      }
    }

    return {
      teamId: activeTeamId,
      name: source.name,
      rank: row.rank,
      matches: row.matches,
      points: row.points,
      wins: row.wins,
      kills: row.kills,
      avgPlacement: placementCount ? placementSum / placementCount : null,
      games,
    }
  }, [data, activeTeamId, rows, upTo])

  // Stable identities so the memoized DataTable rows aren't invalidated on every
  // render (setState functions are already stable).
  const handleRowClick = useCallback((row: LeaderboardRow) => setSelectedTeamId(row.teamId), [])
  const getRowId = useCallback((row: LeaderboardRow) => row.teamId, [])

  // Switching matches recomputes the whole table; run it as a non-urgent
  // transition so the click stays responsive.
  const selectMatch = useCallback(
    (next: Selection) => startTransition(() => setSelected(next)),
    []
  )

  return (
    // Filters span the top row; the table and panel share the second row, whose
    // track is capped at 80vh (`minmax(0,80vh)`) so both panes get the same
    // bounded height and each scrolls internally instead of the taller one
    // forcing dead space into the other.
    <div className="grid gap-x-4 gap-y-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,80vh)]">
      {data.matchCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 lg:col-span-2">
          <MatchButton active={selected === "cumulative"} onClick={() => selectMatch("cumulative")}>
            Cumulative
          </MatchButton>
          {Array.from({ length: data.matchCount }, (_, i) => i + 1).map((n) => (
            <MatchButton key={n} active={selected === n} onClick={() => selectMatch(n)}>
              {n}
            </MatchButton>
          ))}
        </div>
      )}

      <DataTable
        columns={leaderboardColumns}
        data={rows}
        fullWidth
        fillHeight
        getRowId={getRowId}
        selectedRowId={activeTeamId ?? undefined}
        onRowClick={handleRowClick}
        showResultsCount={false}
        searchColumnId="team"
        searchPlaceholder="Search for a team"
        showColumnManager={false}
        initialSorting={[{ id: "points", desc: true }]}
      />

      <TeamDetailPanel team={activeTeam} />
    </div>
  )
}

function MatchButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      asChild={false}
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        "h-9 rounded-md px-4 text-xs shadow-none",
        active
          ? "border-0 bg-[var(--accent-gold)] font-semibold text-[var(--accent-gold-fg)] hover:bg-[var(--accent-gold-strong)] dark:bg-[var(--accent-gold)] dark:hover:bg-[var(--accent-gold-strong)]"
          : "border-white/[0.08] bg-transparent font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
      )}
    >
      {children}
    </Button>
  )
}
