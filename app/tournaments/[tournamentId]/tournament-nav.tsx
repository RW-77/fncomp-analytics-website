"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { CUMULATIVE_DAY, DaySelection, resolveDay, resolveRegion } from "@/lib/tournaments"

const TABS = [
  { label: "Players", segment: "players" },
  { label: "Matches", segment: "matches" },
] as const

export type SerializedEventWindow = {
  event_window_id: string
  day_index: number | null
  total_matches: number
  start_time: string | null
  end_time: string | null
  region_code: string | null
}

// ---------------------------------------------------------------------------
// Tab navigation — rendered outside the header card as a primary nav bar
// ---------------------------------------------------------------------------

export function TournamentTabNav({ tournamentId }: { tournamentId: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabParams = new URLSearchParams()
  const region = searchParams.get("region")
  const day = searchParams.get("day")
  if (region) tabParams.set("region", region)
  if (day) tabParams.set("day", day)
  const query = tabParams.toString() ? `?${tabParams.toString()}` : ""

  const currentSegment = pathname.split("/").at(-1)

  return (
    <nav className="mb-5 flex gap-1 border-b border-white/8">
      {TABS.map(({ label, segment }) => {
        const isActive = currentSegment === segment
        return (
          <Link
            key={segment}
            href={`/tournaments/${tournamentId}/${segment}${query}`}
            className={[
              "-mb-px inline-flex items-center border-b-2 px-1 pb-3 pt-1 text-sm font-medium transition-colors",
              isActive
                ? "border-sky-400 text-white"
                : "border-transparent text-slate-400 hover:border-white/20 hover:text-slate-200",
            ].join(" ")}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Region + Day toggles — compact, no section labels
// ---------------------------------------------------------------------------

export function RegionDayToggles({
  availableRegions,
  regionToDays,
}: {
  availableRegions: string[]
  regionToDays: Record<string, number[]>
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const requestedRegion = searchParams.get("region") ?? undefined
  const requestedDay = searchParams.get("day") ?? undefined

  const effectiveRegion = resolveRegion(requestedRegion, availableRegions)
  const availableDays = effectiveRegion ? (regionToDays[effectiveRegion] ?? []) : []
  const effectiveDay = resolveDay(requestedDay, availableDays)

  function buildUrl(region: string | null, day: DaySelection | null) {
    const params = new URLSearchParams()
    if (region) params.set("region", region)
    if (day !== null) params.set("day", String(day))
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  const showRegionToggle = availableRegions.length > 1
  const showDayToggle = availableDays.length > 0

  if (!showRegionToggle && !showDayToggle) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/8 pt-3">
      {showRegionToggle && (
        <div className="flex flex-wrap gap-1.5">
          {availableRegions.map((region) => {
            const isActive = region === effectiveRegion
            return (
              <Button
                asChild
                key={region}
                variant={isActive ? "default" : "outline"}
                className={
                  isActive
                    ? "h-7 rounded-full bg-sky-400 px-3 text-xs font-semibold text-slate-950 hover:bg-sky-300"
                    : "h-7 rounded-full border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
                }
              >
                <Link href={buildUrl(region, null)}>{region}</Link>
              </Button>
            )
          })}
        </div>
      )}

      {showRegionToggle && showDayToggle && (
        <div className="h-4 w-px bg-white/10" aria-hidden />
      )}

      {showDayToggle && (
        <div className="flex flex-wrap gap-1.5">
          {availableDays.map((day) => {
            const isActive = effectiveDay === day
            return (
              <Button
                asChild
                key={day}
                variant={isActive ? "default" : "outline"}
                className={
                  isActive
                    ? "h-7 rounded-full bg-sky-400 px-3 text-xs font-semibold text-slate-950 hover:bg-sky-300"
                    : "h-7 rounded-full border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
                }
              >
                <Link href={buildUrl(effectiveRegion, day)}>Day {day}</Link>
              </Button>
            )
          })}
          <Button
            asChild
            variant={effectiveDay === CUMULATIVE_DAY ? "default" : "outline"}
            className={
              effectiveDay === CUMULATIVE_DAY
                ? "h-7 rounded-full bg-sky-400 px-3 text-xs font-semibold text-slate-950 hover:bg-sky-300"
                : "h-7 rounded-full border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
            }
          >
            <Link href={buildUrl(effectiveRegion, CUMULATIVE_DAY)}>All days</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat cards (match count + date range) — reactive to region/day URL params
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function formatDateRange(startTime: Date | null, endTime: Date | null) {
  if (!startTime && !endTime) return "Date unavailable"
  if (startTime && endTime)
    return `${dateFormatter.format(startTime)} – ${dateFormatter.format(endTime)}`
  return dateFormatter.format(startTime ?? endTime ?? new Date())
}

export function TournamentStatCards({
  eventWindows,
}: {
  eventWindows: SerializedEventWindow[]
}) {
  const searchParams = useSearchParams()
  const region = searchParams.get("region")
  const day = searchParams.get("day")

  let filtered = region
    ? eventWindows.filter((ew) => ew.region_code === region)
    : eventWindows

  if (day && day !== CUMULATIVE_DAY) {
    const dayNum = Number(day)
    filtered = filtered.filter((ew) => ew.day_index === dayNum)
  }

  const totalMatches = filtered.reduce((sum, ew) => sum + ew.total_matches, 0)

  const startTimes = filtered
    .map((ew) => (ew.start_time ? new Date(ew.start_time) : null))
    .filter((d): d is Date => d !== null)
  const endTimes = filtered
    .map((ew) => (ew.end_time ? new Date(ew.end_time) : null))
    .filter((d): d is Date => d !== null)

  const startTime = startTimes.length
    ? new Date(Math.min(...startTimes.map((d) => d.getTime())))
    : null
  const endTime = endTimes.length
    ? new Date(Math.max(...endTimes.map((d) => d.getTime())))
    : null

  return (
    <div className="flex shrink-0 gap-3">
      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Matches</div>
        <div className="mt-0.5 text-lg font-semibold text-white tabular-nums">{totalMatches}</div>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Dates</div>
        <div className="mt-0.5 text-sm font-medium text-slate-200">
          {formatDateRange(startTime, endTime)}
        </div>
      </div>
    </div>
  )
}
