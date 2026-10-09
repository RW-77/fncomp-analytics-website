'use client'

import type { ReplayEngine } from '@/lib/replay/engine'
import type { PlayerSkin } from '@/lib/replay/match-data'
import { useMatchTotals, useReplay } from '@/lib/replay/use-replay'
import { formatOrdinal } from '@/lib/replay/format'
import { DetailsHeader } from '@/components/replay/details-header'
import { MatchTotalsView } from '@/components/replay/match-totals'
import { SkinIcon } from '@/components/replay/skin-icon'
import { VitalBars, playerStatus } from '@/components/replay/player-details'
import { PlayerInventory } from '@/components/replay/player-inventory'
import { cn } from '@/lib/utils'

// Details for the team being viewed: where it placed, then at the current
// replay time each player's live state and hotbar (click a name to follow that
// player), and the team's whole-match totals (its players' summed). Reads the
// vitals, inventories and totals from the engine, so it re-renders when those
// change.
export function TeamDetails({
  engine,
  label,
  placement,
  members,
  onOpenPlayer,
  onClose,
}: {
  engine: ReplayEngine
  label: string                                // "player + player"
  placement?: number                           // where the team finished, from the leaderboard
  members: { id: string; name: string; skin: PlayerSkin | undefined; pickaxe: PlayerSkin | undefined }[]
  onOpenPlayer: (playerId: string) => void
  onClose: () => void
}) {
  const states = useReplay(engine, (s) => s.vitals)   // every player's; refreshed up to 4×/s
  const totals = useMatchTotals(engine, members.map((m) => m.id))

  return (
    <div className="flex flex-col gap-6">
      <DetailsHeader title={label} onClose={onClose}>
        {placement !== undefined && (
          <p className="mt-1.5 flex items-baseline gap-1.5 text-sm text-slate-400">
            Placed
            <span className="text-xl font-bold tabular-nums text-[var(--accent-gold)]">{formatOrdinal(placement)}</span>
          </p>
        )}
      </DetailsHeader>

      <section className="grid gap-4">
        <h3 className="-mb-1.5 text-sm font-medium text-slate-400">Players</h3>
        {members.map((m) => {
          const status = playerStatus(states[m.id])
          return (
            <div key={m.id} className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <SkinIcon skin={m.skin} size={28} />
                <button
                  type="button"
                  onClick={() => onOpenPlayer(m.id)}
                  title={`Follow ${m.name}`}
                  className="min-w-0 truncate text-left font-medium hover:text-sky-300"
                >
                  {m.name}
                </button>
                <span className={cn('ml-auto shrink-0 text-xs font-semibold', status.className)}>{status.label}</span>
              </div>
              <VitalBars state={states[m.id]} compact />
              {states[m.id]?.alive && (
                <PlayerInventory engine={engine} playerId={m.id} pickaxe={m.pickaxe} compact />
              )}
            </div>
          )
        })}
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium text-slate-400">Team stats</h3>
        <MatchTotalsView totals={totals} onRetry={() => engine.retry()} />
      </section>
    </div>
  )
}
