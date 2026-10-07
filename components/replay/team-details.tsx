'use client'

import type { Engagement, Outcome } from '@/lib/replay/engagements'
import type { ReplayEngine } from '@/lib/replay/engine'
import { useReplay } from '@/lib/replay/use-replay'
import { formatClock } from '@/lib/replay/format'
import { DetailsHeader } from '@/components/replay/details-header'
import { OutcomeChip } from '@/components/replay/outcome-chip'
import { VitalBars, playerStatus } from '@/components/replay/player-details'
import { cn } from '@/lib/utils'

const OUTCOMES: Outcome[] = ['won', 'favorable', 'stalemate', 'unfavorable', 'lost']

// Details for the team being viewed, at the current replay time: each player's
// live state (click a name to follow that player), and the team's results and
// totals from the fights that have ended so far. Reads the time and vitals from
// the engine, so it re-renders when those change.
export function TeamDetails({
  engine,
  teamId,
  label,
  members,
  engagements,
  onOpenPlayer,
  onClose,
}: {
  engine: ReplayEngine
  teamId: number
  label: string                                // "player + player"
  members: { id: string; name: string }[]
  engagements: Engagement[]                    // this team's fights
  onOpenPlayer: (playerId: string) => void
  onClose: () => void
}) {
  const time = useReplay(engine, (s) => Math.floor(s.time))
  const states = useReplay(engine, (s) => s.vitals)   // every player's; refreshed up to 4×/s
  const known = members.filter((m) => states[m.id])
  const alive = known.filter((m) => states[m.id].alive).length
  const where = known.length === 0 ? '' : alive === 0 ? ' · eliminated' : ` · ${alive} of ${members.length} alive`

  const counts: Record<Outcome, number> = { won: 0, favorable: 0, stalemate: 0, unfavorable: 0, lost: 0 }
  const totals = { fights: 0, elimsDealt: 0, elimsTaken: 0, knocksDealt: 0, knocksTaken: 0, dealt: 0, taken: 0 }
  for (const e of engagements) {
    if (e.end_s > time) continue
    const o = e.outcomes.find((x) => x.team_id === teamId)
    if (!o) continue
    counts[o.label] += 1
    totals.fights += 1
    totals.elimsDealt += o.elims_dealt
    totals.elimsTaken += o.elims_received
    totals.knocksDealt += o.knocks_dealt
    totals.knocksTaken += o.knocks_received
    totals.dealt += o.damage_dealt
    totals.taken += o.damage_received
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailsHeader title={label} meta={`at ${formatClock(time)}${where}`} onClose={onClose} />

      <section className="grid gap-1">
        <h3 className="text-sm font-medium text-slate-400">Players</h3>
        {members.map((m) => {
          const status = playerStatus(states[m.id])
          return (
            <div key={m.id} className="grid gap-1.5 border-t border-white/[0.06] py-2">
              <div className="flex items-baseline gap-2">
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
              <VitalBars state={states[m.id]} />
            </div>
          )
        })}
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium text-slate-400">So far</h3>
        {totals.fights > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {OUTCOMES.filter((k) => counts[k] > 0).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <OutcomeChip outcome={k} />
                <span className="text-sm tabular-nums">{counts[k]}</span>
              </span>
            ))}
          </div>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Fights</dt>
          <dd className="tabular-nums">{totals.fights}</dd>
          <dt className="text-slate-500">Eliminations</dt>
          <dd className="tabular-nums">{totals.elimsDealt} dealt · {totals.elimsTaken} taken</dd>
          <dt className="text-slate-500">Knocks</dt>
          <dd className="tabular-nums">{totals.knocksDealt} dealt · {totals.knocksTaken} taken</dd>
          <dt className="text-slate-500">Damage</dt>
          <dd className="tabular-nums">{Math.round(totals.dealt)} dealt · {Math.round(totals.taken)} taken</dd>
        </dl>
        <p className="text-xs text-slate-500">From fights that ended before {formatClock(time)}.</p>
      </section>
    </div>
  )
}
