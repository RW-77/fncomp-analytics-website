'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, Copy } from 'lucide-react'

// Top of the match page's left panel: back to the matches list, the
// tournament and the match's number, and a button that copies the match id
// (the id itself isn't shown).
export function MatchHeader({
  tournament,
  title,
  matchId,
  backHref,
}: {
  tournament: string   // the tournament's display title
  title: string        // "Match 4"
  matchId: string
  backHref: string     // the matches list this match was opened from
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
    <div className="flex items-center gap-0.5 py-1.5 pl-1 pr-1.5">
      <Link
        href={backHref}
        aria-label="Back to matches"
        className="grid size-9 place-items-center rounded-sm text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs text-slate-400" title={tournament}>{tournament}</span>
        <h1 className="truncate text-base font-bold leading-tight text-white">{title}</h1>
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
