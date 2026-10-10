'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, Copy } from 'lucide-react'
import { LocalTime } from '@/components/local-time'

// Top of the match page's left panel: back to the matches list; the
// tournament, then region, day and date, then the match's number; and a
// button that copies the match id (the id itself isn't shown).
export function MatchHeader({
  tournament,
  details,
  startTime,
  title,
  matchId,
  backHref,
}: {
  tournament: string | null  // the tournament's display title
  details: string[]          // ["NAC", "Day 2"]: whichever apply
  startTime: string | null   // ISO
  title: string              // "Match 4"
  matchId: string
  backHref: string           // the matches list this match is in
}) {
  // Shows a check for a moment after copying.
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = () => {
    navigator.clipboard.writeText(matchId).then(
      () => setCopied(true),
      () => {}, // clipboard blocked (e.g. insecure origin): nothing to show
    )
  }

  return (
    <div className="flex items-start gap-0.5 py-1.5 pl-1 pr-1.5">
      <Link
        href={backHref}
        aria-label="Back to matches"
        className="grid size-9 place-items-center rounded-sm text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5">
        {tournament && <span className="text-xs leading-snug text-slate-300 [overflow-wrap:anywhere]">{tournament}</span>}
        {(details.length > 0 || startTime) && (
          <span className="text-xs text-slate-500">
            {details.join(' · ')}
            {details.length > 0 && startTime && ' · '}
            {startTime && <LocalTime iso={startTime} format="date" />}
          </span>
        )}
        <h1 className="text-base font-bold leading-tight text-white">{title}</h1>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy match ID"
        title={copied ? 'Copied' : 'Copy match ID'}
        className="grid size-9 place-items-center rounded-sm text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
      >
        {copied ? <Check className="size-4 text-green-400" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}
