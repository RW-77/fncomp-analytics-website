'use client'

import { EVENT_TYPES, engagementType, type Engagement } from '@/lib/replay/engagements'
import { OUTCOME_COLORS } from '@/components/replay/outcome-chip'
import { formatClock, formatDuration } from '@/lib/replay/format'
import { cn } from '@/lib/utils'

export type NumberedEngagement = {
  engagement: Engagement
  number: number          // the same number as its circle on the map
}

// The left panel's timeline: one row per event in time order, joined by a rail.
// Each row has the start and end time, the numbered circle (colored by the
// viewed team's outcome), who the fight was against, and its length and type.
export function EngagementList({
  items,
  selectedId,
  perspectiveTeamId,
  teamRosters,
  onSelect,
}: {
  items: NumberedEngagement[]
  selectedId: number | null
  perspectiveTeamId: number | null
  teamRosters: Record<number, string[]>     // team id -> its players' names
  onSelect: (id: number) => void
}) {
  if (items.length === 0) return <p className="px-4 py-3 text-sm text-slate-500">No events</p>

  const roster = (team: number) => teamRosters[team] ?? [`Team ${team}`]

  return (
    <ol className="relative px-2 pb-4">
      {/* The rail, through the middle of the circles' column (8 + 8 + 38 + 14 px in). */}
      <span aria-hidden className="absolute bottom-5 left-[68px] top-5 w-px bg-[var(--panel-line)]" />

      {items.map(({ engagement: e, number }) => {
        const selected = e.id === selectedId
        const type = EVENT_TYPES.find((t) => t.id === engagementType(e))

        // Viewing as a team: the opponent's players, or how many teams. All
        // teams: "A + B" / "vs C + D", or how many teams.
        let lines: string[]
        const outcome = e.outcomes.find((o) => o.team_id === perspectiveTeamId)
        if (perspectiveTeamId !== null) {
          const opponents = e.teams.filter((t) => t !== perspectiveTeamId)
          lines = opponents.length === 1 ? roster(opponents[0]) : [`vs ${opponents.length} teams`]
        } else if (e.teams.length === 2) {
          lines = [roster(e.teams[0]).join(' + '), `vs ${roster(e.teams[1]).join(' + ')}`]
        } else {
          lines = [`${e.teams.length} teams`]
        }

        const colors = outcome ? OUTCOME_COLORS[outcome.label] : null
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onSelect(e.id)}
              aria-pressed={selected}
              className={cn(
                'grid w-full grid-cols-[38px_28px_minmax(0,1fr)] items-start rounded-sm px-2 py-2.5 text-left',
                selected ? 'bg-[var(--panel-selected)]' : 'hover:bg-white/[0.03]',
              )}
            >
              <span className="flex flex-col tabular-nums leading-tight">
                <span className="text-[13px] font-semibold text-slate-100">{formatClock(e.start_s)}</span>
                <span className="text-xs text-slate-500">{formatClock(e.end_s)}</span>
              </span>

              {/* Opaque base (in the row's color, with a ring of it) so the rail
                  stops at the circle; the tint sits on top. */}
              <span
                title={colors?.label}
                className={cn(
                  'relative mx-auto size-[22px] rounded-full',
                  selected ? 'bg-[var(--panel-selected)] shadow-[0_0_0_3px_var(--panel-selected)]' : 'bg-[var(--panel)] shadow-[0_0_0_3px_var(--panel)]',
                )}
              >
                <span
                  className={cn(
                    'grid size-full place-items-center rounded-full border-[1.5px] text-[11px] font-bold tabular-nums',
                    colors ? `${colors.border} ${colors.bg} ${colors.text}` : 'border-sky-400 bg-sky-400/15 text-sky-300',
                  )}
                >
                  {number}
                </span>
              </span>

              <span className="flex min-w-0 flex-col pl-2 text-sm leading-snug text-slate-100">
                {lines.map((line, i) => (
                  <span key={i} className="[overflow-wrap:anywhere]">{line}</span>
                ))}
                <span className="mt-0.5 text-xs tabular-nums text-slate-500">
                  {formatDuration(e.end_s - e.start_s)} · {type?.singular}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
