'use client'

import { X } from 'lucide-react'

// Header shared by every details-panel view (fight, team, player): an optional
// back link, the title (with an optional icon beside it, e.g. the player's
// skin, and an optional action at the right of its line, e.g. "Go to team"), a
// smaller line under it, anything extra under that (the fight's verdict), and
// the close button.
export function DetailsHeader({
  title,
  meta,
  icon,
  action,
  onClose,
  back,
  children,
}: {
  title: string
  meta?: string
  icon?: React.ReactNode
  action?: React.ReactNode
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
        <div className="flex items-center gap-3">
          {icon}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h2 className="min-w-0 text-xl font-semibold text-white [overflow-wrap:anywhere]">{title}</h2>
              {action && <div className="ml-auto shrink-0">{action}</div>}
            </div>
            {meta && <p className="mt-1 text-sm tabular-nums text-slate-400">{meta}</p>}
          </div>
        </div>
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
