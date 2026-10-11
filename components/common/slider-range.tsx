"use client"

import * as SliderPrimitive from "@radix-ui/react-slider"

// A two-handled range slider with a gold caption: the players tab's distance
// and time-window filters, and the homepage's stats demo.
export function SliderRange({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
}: {
  label: string
  value: [number, number]
  onValueChange: (value: [number, number]) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}) {
  return (
    <div>
      {/* Compact caption — kept small so the slider below is the dominant element. */}
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-[var(--accent-gold)]">{label}</span>
        <span className="text-xs tabular-nums text-slate-400">
          {value[0]}–{value[1]}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>

      {/* Rectangular (rounded-lg) track to match the other filter controls; tall
          so the slider dominates. Sky fill = selected range; full-height white
          vertical bars = draggable handles. No ring/shadow (they produced a stray
          light bar at the handle edge while dragging) — focus tints the handle. */}
      <SliderPrimitive.Root
        value={value}
        onValueChange={(newValue) => onValueChange(newValue as [number, number])}
        min={min}
        max={max}
        step={step}
        className="relative flex h-11 w-full touch-none items-center select-none rounded-md border-x-[6px] border-transparent bg-[var(--panel)]"
      >
        <SliderPrimitive.Track className="relative h-full w-full grow overflow-hidden rounded bg-[var(--panel)]">
          <SliderPrimitive.Range className="absolute h-full rounded-[2px] bg-[var(--accent-gold)]/25 ring-1 ring-inset ring-[var(--accent-gold)]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={`${label} minimum`}
          className="block h-11 w-1.5 rounded-[2px] bg-[var(--accent-gold)] outline-none transition-colors focus-visible:bg-[var(--accent-gold-strong)]"
        />
        <SliderPrimitive.Thumb
          aria-label={`${label} maximum`}
          className="block h-11 w-1.5 rounded-[2px] bg-[var(--accent-gold)] outline-none transition-colors focus-visible:bg-[var(--accent-gold-strong)]"
        />
      </SliderPrimitive.Root>
    </div>
  )
}
