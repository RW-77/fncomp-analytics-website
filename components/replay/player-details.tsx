'use client'

import { Plus, Shield } from 'lucide-react'
import type { PlayerVitals, ReplayEngine } from '@/lib/replay/engine'
import type { PlayerSkin } from '@/lib/replay/match-data'
import { useMatchTotals, useReplay } from '@/lib/replay/use-replay'
import { DetailsHeader } from '@/components/replay/details-header'
import { MatchTotalsView } from '@/components/replay/match-totals'
import { PlayerInventory } from '@/components/replay/player-inventory'
import { SkinIcon } from '@/components/replay/skin-icon'
import { cn } from '@/lib/utils'

// Alive / Knocked / Eliminated, from the replay's live state.
export function playerStatus(state: PlayerVitals | undefined): { label: string; className: string } {
  if (!state) return { label: '—', className: 'text-slate-500' }
  if (!state.alive) return { label: 'Eliminated', className: 'text-red-400' }
  if (state.knocked) return { label: 'Knocked', className: 'text-orange-400' }
  return { label: 'Alive', className: 'text-green-400' }
}

// Bar colors, sampled from the in-game replay HUD. A knocked player's health
// bar turns red (their shield, if any, still shows).
const SHIELD_COLOR = '#4299ED'
const HEALTH_COLOR = '#58CE4B'
const KNOCKED_COLOR = '#E4403F'
const TRACK_COLOR = '#0D0F26'
const VITAL_MAX = 100

// Shield over health: flat, square bars with the icon and "value | max"
// inside, like the in-game replay HUD. Kept shorter than an inventory tile
// (17 + 2 + 17 px against 44). Nothing for an eliminated player.
export function VitalBars({ state, compact = false }: { state: PlayerVitals | undefined; compact?: boolean }) {
  if (!state || !state.alive) return null
  const icon = compact ? 'size-2.5' : 'size-3'
  return (
    <div className="grid gap-0.5">
      <VitalBar
        label="Shield"
        value={state.shield}
        color={SHIELD_COLOR}
        icon={<Shield className={icon} fill="currentColor" strokeWidth={1.5} />}
        compact={compact}
      />
      <VitalBar
        label="Health"
        value={state.hp}
        color={state.knocked ? KNOCKED_COLOR : HEALTH_COLOR}
        icon={<Plus className={icon} strokeWidth={4} />}
        compact={compact}
      />
    </div>
  )
}

function VitalBar({
  label,
  value,
  color,
  icon,
  compact,
}: {
  label: string
  value: number
  color: string
  icon: React.ReactNode
  compact: boolean
}) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={VITAL_MAX}
      aria-valuenow={value}
      className={cn('relative overflow-hidden', compact ? 'h-[13px]' : 'h-[17px]')}
      style={{ background: TRACK_COLOR }}
    >
      {/* the width eases between the ~4/s updates so the bar moves smoothly */}
      <span
        className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-linear"
        style={{ width: `${Math.max(0, Math.min(100, (value / VITAL_MAX) * 100))}%`, background: color }}
      />
      <span
        className={cn(
          'relative flex h-full items-center gap-1 px-1.5 font-semibold leading-none tabular-nums text-white',
          compact ? 'text-[10px]' : 'text-[11px]',
        )}
      >
        {icon}
        {value} <span className="text-white/70">| {VITAL_MAX}</span>
      </span>
    </div>
  )
}

// Details for one player at the current replay time: their live state and
// inventory, and their whole-match totals so far. Reads the time, vitals,
// inventory and totals from the engine, so it re-renders when those change (a
// few times a second).
export function PlayerDetails({
  engine,
  playerId,
  name,
  skin,
  pickaxe,
  teamLabel,
  onClose,
  onGoToTeam,
}: {
  engine: ReplayEngine
  playerId: string
  name: string
  skin: PlayerSkin | undefined
  pickaxe: PlayerSkin | undefined
  teamLabel: string
  onClose: () => void
  onGoToTeam?: () => void                 // opens the player's team (and views as it)
}) {
  const state = useReplay(engine, (s) => s.vitals[playerId])
  const status = playerStatus(state)

  const totals = useMatchTotals(engine, [playerId])

  return (
    <div className="flex flex-col gap-6">
      <DetailsHeader
        title={name}
        meta={teamLabel}
        icon={<SkinIcon skin={skin} size={48} />}
        action={
          onGoToTeam && (
            <button
              type="button"
              onClick={onGoToTeam}
              className="rounded-sm border border-[var(--panel-control)] px-2.5 py-1 text-[13px] text-sky-300 hover:bg-white/[0.04]"
            >
              Go to team
            </button>
          )
        }
        onClose={onClose}
      />

      <section className="grid gap-2">
        <h3 className="flex items-baseline justify-between text-sm font-medium text-slate-400">
          Status <span className={cn('text-sm font-semibold', status.className)}>{status.label}</span>
        </h3>
        <VitalBars state={state} />
        <div className="mt-1">
          <PlayerInventory engine={engine} playerId={playerId} pickaxe={pickaxe} />
        </div>
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium text-slate-400">Stats</h3>
        <MatchTotalsView totals={totals} onRetry={() => engine.retry()} />
      </section>
    </div>
  )
}
