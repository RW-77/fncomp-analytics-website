import type { Outcome } from '@/lib/replay/engagements'

// Colors for each outcome, shared by the chip and the list's numbered circles.
export const OUTCOME_COLORS: Record<Outcome, { label: string; text: string; bg: string; border: string }> = {
  won:         { label: 'Won',         text: 'text-green-400',  bg: 'bg-green-400/15',  border: 'border-green-400' },
  favorable:   { label: 'Favorable',   text: 'text-teal-400',   bg: 'bg-teal-400/15',   border: 'border-teal-400' },
  stalemate:   { label: 'Stalemate',   text: 'text-slate-400',  bg: 'bg-slate-400/15',  border: 'border-slate-400' },
  unfavorable: { label: 'Unfavorable', text: 'text-orange-400', bg: 'bg-orange-400/15', border: 'border-orange-400' },
  lost:        { label: 'Lost',        text: 'text-red-400',    bg: 'bg-red-400/15',    border: 'border-red-400' },
}

export function OutcomeChip({ outcome }: { outcome: Outcome }) {

  const colors = OUTCOME_COLORS[outcome]

  return (
    <span className={`inline-block rounded-sm px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${colors.bg} ${colors.text}`}>
      {colors.label}
    </span>
  )
}
