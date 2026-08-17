import { Flag } from "@/components/common/flag"
import { cn } from "@/lib/utils"

import { StandingsChart, type StandingGame } from "./standings-chart"
import type { TeamPlayer } from "./columns"

// Everything the panel renders for the selected team. Header aggregates
// (rank/points/wins/kills/avgPlacement) reflect the current match-scrubber
// view; `games` is the full standing progression for the chart and cards.
export type TeamDetail = {
  teamId: string
  name: string
  // Per-teammate identities (name + flag) for the header.
  players: TeamPlayer[]
  rank: number
  matches: number
  points: number
  wins: number
  kills: number
  avgPlacement: number | null
  games: StandingGame[]
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function TeamDetailPanel({ team }: { team: TeamDetail | null }) {
  if (!team) {
    return (
      <aside className="rounded-md bg-[#141d30] p-4">
        <div className="text-sm text-slate-500">Select a team to see details.</div>
      </aside>
    )
  }

  return (
    <aside className="rounded-md bg-[#141d30] p-5 lg:h-full lg:min-h-0 lg:overflow-y-auto">
      <div className="flex items-center gap-3.5">
        <div
          className="flex-shrink-0 rounded-[10px] bg-[rgba(227,201,126,0.1)] px-4 py-1.5 text-center"
          style={{ border: "1px solid rgba(227,201,126,0.35)" }}
        >
          <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--accent-gold)]">
            Place
          </div>
          <div className="text-3xl font-bold leading-none text-[var(--accent-gold)]">
            #{team.rank}
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold text-white" title={team.name}>
            {team.players.length > 0
              ? team.players.map((p, i) => (
                  <span key={p.epicId} className="whitespace-nowrap">
                    {i > 0 && <span className="text-slate-500"> &amp; </span>}
                    <Flag token={p.flag} className="mx-1 align-[0.00em]" />
                    {p.name}
                  </span>
                ))
              : team.name}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">{team.matches} matches</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <StatTile label="Points" value={team.points.toLocaleString()} />
        <StatTile label="Wins" value={team.wins} />
        <StatTile label="Kills" value={team.kills} />
        <StatTile
          label="Avg Pl"
          value={team.avgPlacement != null ? team.avgPlacement.toFixed(1) : "—"}
        />
      </div>

      <SectionLabel className="mt-4">Tournament standings history</SectionLabel>
      <div className="mt-1">
        <StandingsChart games={team.games} />
      </div>

      <SectionLabel className="mt-5">Match history</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {team.games.map((g) => (
          <GameCard key={g.game} game={g} />
        ))}
      </div>
    </aside>
  )
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-400",
        className
      )}
    >
      {children}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-[#1b2334] px-2.5 py-2.5">
      <div className="text-[10px] tracking-[0.08em] uppercase text-slate-500">{label}</div>
      <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-white">{value}</div>
    </div>
  )
}

function GameCard({ game }: { game: StandingGame }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-[#1b2334] px-3 py-2.5">
      <div>
        <div className="text-[10px] tracking-[0.08em] uppercase text-slate-500">
          Game {game.game}
        </div>
        <div className="mt-0.5 text-xs text-slate-400">
          {game.played ? `${game.points} pts · ${game.kills} elims` : "Did not play"}
        </div>
      </div>
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          game.win ? "text-[var(--accent-gold)]" : "text-white"
        )}
      >
        {game.placement != null ? ordinal(game.placement) : "—"}
      </div>
    </div>
  )
}
