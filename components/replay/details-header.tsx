'use client'

import { X } from 'lucide-react'

// Header shared by every details-panel view (fight, team, player): an optional
// back link, the title, a smaller line under it, anything extra under that
// (the fight's verdict), and the close button.
export function DetailsHeader({
  title,
  meta,
  onClose,
  back,
  children,
}: {
  title: string
  meta?: string
  onClose: () => void
  back?: { label: string; onClick: () => void }
  children?: React.ReactNode
}) {
  return (
    <header className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        {back && (
          <button type="button" onClick={back.onClick} className="mb-1 text-sm text-sky-400 hover:text-sky-300">
            ← {back.label}
          </button>
        )}
        <h2 className="text-xl font-semibold text-white [overflow-wrap:anywhere]">{title}</h2>
        {meta && <p className="mt-1 text-sm tabular-nums text-slate-400">{meta}</p>}
        {children}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className="shrink-0 rounded-sm p-1 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
      >
        <X className="size-5" />
      </button>
    </header>
  )
}
