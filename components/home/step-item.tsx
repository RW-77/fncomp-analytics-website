"use client"

import type { Ref } from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

// One item in a homepage list that plays through by itself: a replay demo's
// steps and the stats demo's questions. Each sits on a panel with a chevron so
// it reads as clickable; the playing one is lighter, with a gold title and a
// gold bar along its bottom that fills as it plays. `progress` is a ref to
// that bar: the caller sets its scaleX (0 to 1) every frame, so playing
// doesn't re-render the list.
export function StepItem({
  title,
  body,
  active,
  progress,
  onSelect,
}: {
  title: string
  body: string
  active: boolean
  progress?: Ref<HTMLSpanElement>
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "step" : undefined}
        className={cn(
          "group relative flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-[4px] px-4 py-3 text-left transition-colors",
          active ? "bg-[var(--panel-selected)]" : "bg-[var(--panel)] hover:bg-[var(--panel-raised)]",
        )}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[15px] font-semibold",
              active ? "text-[var(--accent-gold)]" : "text-slate-200 group-hover:text-white",
            )}
          >
            {title}
          </span>
          <span className="mt-0.5 block text-sm leading-6 text-slate-400">{body}</span>
        </span>
        <ChevronRight
          aria-hidden
          className={cn(
            "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
            active ? "text-[var(--accent-gold)]" : "text-slate-500 group-hover:text-slate-300",
          )}
        />
        {active && (
          <span
            ref={progress}
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-[var(--accent-gold)]"
          />
        )}
      </button>
    </li>
  )
}
