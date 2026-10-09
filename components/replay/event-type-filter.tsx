'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { EventType } from '@/lib/replay/engagements'
import { cn } from '@/lib/utils'

export type EventTypeOption = {
  id: EventType
  label: string     // "Early game fights"
  count: number     // how many the viewed team has
}

// Which event types the list and the map show. A row that opens into a
// checklist in place (not a popup); closed, it summarizes what's shown.
// Hovering a type offers "Only", which shows just that type.
export function EventTypeFilter({
  types,
  hidden,
  onChange,
}: {
  types: EventTypeOption[]
  hidden: EventType[]                      // the unchecked types
  onChange: (hidden: EventType[]) => void
}) {
  // Whether the checklist is open. Only this component cares, so it lives here.
  const [open, setOpen] = useState(false)

  const shown = types.filter((t) => !hidden.includes(t.id))
  const filtered = shown.length < types.length
  const summary =
    !filtered ? 'All'
      : shown.length === 0 ? 'None'
      : shown.length === 1 ? shown[0].label
      : `${shown.length} of ${types.length}`

  const toggle = (id: EventType) =>
    onChange(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id])
  const only = (id: EventType) => onChange(types.map((t) => t.id).filter((x) => x !== id))

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-sm border bg-[var(--panel-inset)] pl-2.5 pr-2 text-left text-sm',
          filtered ? 'border-sky-400/50' : 'border-white/[0.08] hover:border-white/15',
        )}
      >
        <span className="text-slate-400">Event types</span>
        <span className={cn('min-w-0 flex-1 truncate text-right font-semibold', filtered ? 'text-sky-300' : 'text-slate-100')}>
          {summary}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="flex flex-col py-1.5">
          {types.map((t) => (
            <div key={t.id} className="group flex items-center rounded-sm hover:bg-white/[0.04]">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1.5 pl-2.5 pr-1 text-sm">
                <input
                  type="checkbox"
                  checked={!hidden.includes(t.id)}
                  onChange={() => toggle(t.id)}
                  className="size-3.5 accent-sky-400"
                />
                <span className="min-w-0 flex-1">{t.label}</span>
                <span className="text-xs tabular-nums text-slate-500">{t.count}</span>
              </label>
              <button
                type="button"
                onClick={() => only(t.id)}
                className="invisible px-1.5 py-1 text-xs text-sky-400 hover:text-sky-300 focus-visible:visible group-hover:visible"
              >
                Only
              </button>
            </div>
          ))}
          {filtered && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="self-start px-2.5 py-1 text-sm text-sky-400 hover:text-sky-300"
            >
              Select all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
