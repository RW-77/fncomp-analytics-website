'use client'

import type { Engagement } from '@/lib/replay/engagements'
import type { PlayerVitals, ReplayEngine } from '@/lib/replay/engine'
import { useReplay } from '@/lib/replay/use-replay'
import { formatClock } from '@/lib/replay/format'
import { DetailsHeader } from '@/components/replay/details-header'
import { cn } from '@/lib/utils'

// Alive / Knocked / Eliminated, from the replay's live state.
export function playerStatus(state: PlayerVitals | undefined): { label: string; className: string } {
  if (!state) return { label: '—', className: 'text-slate-500' }
  if (!state.alive) return { label: 'Eliminated', className: 'text-red-400' }
  if (state.knocked) return { label: 'Knocked', className: 'text-orange-400' }
  return { label: 'Alive', className: 'text-green-400' }
}

// Health and shield bars (0–100). Nothing for an eliminated player.
export function VitalBars({ state }: { state: PlayerVitals | undefined }) {
  if (!state || !state.alive) return null
  const bars = [
    { label: 'Health', value: state.hp, color: 'bg-green-400' },
    { label: 'Shield', value: state.shield, color: 'bg-sky-400' },
  ]
  return (
    <div className="grid gap-1">
      {bars.map((b) => (
        <div key={b.label} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-2 text-xs text-slate-400">
          <span>{b.label}</span>
          <span className="h-1.5 overflow-hidden rounded-sm bg-slate-400/15">
            {/* the width eases between the ~4/s updates so the bar moves smoothly */}
            <span
              className={cn('block h-full transition-[width] duration-300 ease-linear', b.color)}
              style={{ width: `${Math.max(0, Math.min(100, b.value))}%` }}
            />
          </span>
          <span className="text-right tabular-nums">{b.value}</span>
        </div>
      ))}
    </div>
  )
}

// Details for one player at the current replay time: their live state, and
// their totals from the fights that have ended so far. Reads the time and the
// player's vitals from the engine, so it re-renders when those change (about
// once a second for the time, up to 4 times a second for health).
export function PlayerDetails({
  engine,
  playerId,
  name,
  teamLabel,
  engagements,
  onClose,
  onBack,
}: {
  engine: ReplayEngine
  playerId: string
  name: string
  teamLabel: string
  engagements: Engagement[]               // all fights; this player's are picked out
  onClose: () => void
  onBack?: () => void                     // set when opened from the team panel
}) {
  const time = useReplay(engine, (s) => Math.floor(s.time))
  const state = useReplay(engine, (s) => s.vitals[playerId])
  const status = playerStatus(state)

  const totals = { fights: 0, elims: 0, knocks: 0, dealt: 0, taken: 0 }
  for (const e of engagements) {
    if (e.end_s > time) continue
    const p = e.players.find((x) => x.player_id === playerId)
    if (!p) continue
    totals.fights += 1
    totals.elims += p.elims_dealt
    totals.knocks += p.knocks_dealt
    totals.dealt += p.damage_dealt
    totals.taken += p.damage_received
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailsHeader
        title={name}
        meta={`${teamLabel} · at ${formatClock(time)}`}
        onClose={onClose}
        back={onBack ? { label: 'Back to team', onClick: onBack } : undefined}
      />

      <section className="grid gap-2">
        <h3 className="flex items-baseline justify-between text-sm font-medium text-slate-400">
          Right now <span className={cn('text-sm font-semibold', status.className)}>{status.label}</span>
        </h3>
        <VitalBars state={state} />
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium text-slate-400">So far</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Fights</dt>
          <dd className="tabular-nums">{totals.fights}</dd>
          <dt className="text-slate-500">Eliminations</dt>
          <dd className="tabular-nums">{totals.elims}</dd>
          <dt className="text-slate-500">Knocks</dt>
          <dd className="tabular-nums">{totals.knocks}</dd>
          <dt className="text-slate-500">Damage</dt>
          <dd className="tabular-nums">
            {Math.round(totals.dealt)} dealt · {Math.round(totals.taken)} taken
          </dd>
        </dl>
        <p className="text-xs text-slate-500">From fights that ended before {formatClock(time)}.</p>
      </section>
    </div>
  )
}
