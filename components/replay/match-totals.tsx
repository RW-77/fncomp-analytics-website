'use client'

import { ChevronsDown, Crosshair, HeartCrack, Swords, type LucideIcon } from 'lucide-react'
import type { MatchTotals } from '@/lib/replay/engine'

// ---------------------------------------------------------------------------
// Whole-match totals (eliminations, knocks, damage dealt and taken) for the
// player and team panels, in one of the styles under trial in the lab's dev
// tools.
// ---------------------------------------------------------------------------

export type StatsStyle = 'tiles' | 'row' | 'split'

export function MatchTotalsView({ totals, style }: { totals: MatchTotals; style: StatsStyle }) {
  if (style === 'row') return <StatRow totals={totals} />
  if (style === 'split') return <StatSplit totals={totals} />
  return <StatTiles totals={totals} />
}

// The four totals, with the icons the styles share. Crosshair is the in-game
// eliminations icon.
function statList(t: MatchTotals): { icon: LucideIcon; label: string; short: string; value: number }[] {
  return [
    { icon: Crosshair, label: 'Eliminations', short: 'Elims', value: t.elims },
    { icon: ChevronsDown, label: 'Knocks', short: 'Knocks', value: t.knocks },
    { icon: Swords, label: 'Damage dealt', short: 'Dealt', value: Math.round(t.dealt) },
    { icon: HeartCrack, label: 'Damage taken', short: 'Taken', value: Math.round(t.taken) },
  ]
}

// A: a 2×2 grid of cards, label with icon on top, the number large below.
function StatTiles({ totals }: { totals: MatchTotals }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {statList(totals).map(({ icon: Icon, label, value }) => (
        <div key={label} className="rounded-sm bg-white/[0.035] px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Icon className="size-3.5" />
            {label}
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</div>
        </div>
      ))}
    </div>
  )
}

// B: one row of four, icon over number over a short label, like a HUD strip.
function StatRow({ totals }: { totals: MatchTotals }) {
  return (
    <div className="grid grid-cols-4 divide-x divide-white/[0.06] rounded-sm bg-white/[0.035] py-2.5">
      {statList(totals).map(({ icon: Icon, label, short, value }) => (
        <div key={label} title={label} className="flex flex-col items-center gap-1">
          <Icon className="size-4 text-slate-400" />
          <span className="text-lg font-semibold leading-none tabular-nums text-white">{value}</span>
          <span className="text-[11px] text-slate-500">{short}</span>
        </div>
      ))}
    </div>
  )
}

// C: eliminations and knocks inline, then damage dealt against taken as one
// split bar (its share of the total each way).
function StatSplit({ totals }: { totals: MatchTotals }) {
  const [elims, knocks, dealt, taken] = statList(totals)
  const total = dealt.value + taken.value
  const dealtPct = total > 0 ? (dealt.value / total) * 100 : 50
  return (
    <div className="grid gap-3">
      <div className="flex gap-6">
        {[elims, knocks].map(({ icon: Icon, label, value }) => (
          <span key={label} className="flex items-center gap-2">
            <Icon className="size-4 text-slate-400" />
            <span className="text-lg font-semibold leading-none tabular-nums text-white">{value}</span>
            <span className="text-sm text-slate-500">{label}</span>
          </span>
        ))}
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between text-sm tabular-nums">
          <span className="flex items-center gap-1.5">
            <Swords className="size-3.5 self-center text-sky-300" />
            <span className="font-semibold text-white">{dealt.value}</span>
            <span className="text-slate-500">damage dealt</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-slate-500">taken</span>
            <span className="font-semibold text-white">{taken.value}</span>
            <HeartCrack className="size-3.5 self-center text-rose-300" />
          </span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          {total > 0 && (
            <>
              <span className="bg-sky-400" style={{ width: `${dealtPct}%` }} />
              <span className="flex-1 bg-rose-400" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
