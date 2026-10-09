'use client'

import { ChevronsDown, Crosshair, HeartCrack, Swords } from 'lucide-react'
import type { MatchTotals } from '@/lib/replay/engine'
import type { Loadable } from '@/lib/replay/use-replay'
import { LoadNote, Skeleton } from '@/components/replay/load-state'

// ---------------------------------------------------------------------------
// Whole-match totals (eliminations, knocks, damage dealt and taken) for the
// player and team panels: one row of four, icon over number over a short
// label, like a HUD strip. Crosshair is the in-game eliminations icon.
// ---------------------------------------------------------------------------

const STATS = [
  { icon: Crosshair, label: 'Eliminations', short: 'Elims', value: (t: MatchTotals) => t.elims },
  { icon: ChevronsDown, label: 'Knocks', short: 'Knocks', value: (t: MatchTotals) => t.knocks },
  { icon: Swords, label: 'Damage dealt', short: 'Dealt', value: (t: MatchTotals) => Math.round(t.dealt) },
  { icon: HeartCrack, label: 'Damage taken', short: 'Taken', value: (t: MatchTotals) => Math.round(t.taken) },
]

export function MatchTotalsView({ totals, onRetry }: { totals: Loadable<MatchTotals>; onRetry: () => void }) {
  if (totals.status === 'missing') return <LoadNote>No stats for this match yet.</LoadNote>
  if (totals.status === 'error') return <LoadNote onRetry={onRetry}>Couldn&apos;t load the stats.</LoadNote>

  // While loading, the same row with placeholders for the numbers.
  const data = totals.status === 'ready' ? totals.data : null
  return (
    <div className="grid grid-cols-4 divide-x divide-white/[0.06] rounded-sm bg-white/[0.035] py-2.5">
      {STATS.map(({ icon: Icon, label, short, value }) => (
        <div key={label} title={label} className="flex flex-col items-center gap-1">
          <Icon className="size-4 text-slate-400" />
          {data ? (
            <span className="text-lg font-semibold leading-none tabular-nums text-white">{value(data)}</span>
          ) : (
            <Skeleton className="h-[18px] w-7" />
          )}
          <span className="text-[11px] text-slate-500">{short}</span>
        </div>
      ))}
    </div>
  )
}
