"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { CUMULATIVE_DAY, DaySelection, resolveDay, resolveRegion } from "@/lib/tournaments"

const LEADERBOARD_TAB = { label: "Leaderboard", segment: "leaderboard" } as const
const BASE_TABS = [
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

export function TournamentTabNav({
  tournamentId,
  hasLeaderboard,
}: {
  tournamentId: string
  hasLeaderboard: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabs = hasLeaderboard ? [LEADERBOARD_TAB, ...BASE_TABS] : BASE_TABS

  const tabParams = new URLSearchParams()
  const region = searchParams.get("region")
  const day = searchParams.get("day")
  if (region) tabParams.set("region", region)
  if (day) tabParams.set("day", day)
  const query = tabParams.toString() ? `?${tabParams.toString()}` : ""

  const currentSegment = pathname.split("/").at(-1)

  return (
    <nav className="mb-4 inline-flex items-center gap-1.5 rounded-xl bg-[#141d30] p-1.5">
      {tabs.map(({ label, segment }) => {
        const isActive = currentSegment === segment
        return (
          <Link
            key={segment}
            href={`/tournaments/${tournamentId}/${segment}${query}`}
            aria-current={isActive ? "page" : undefined}
            className={[
              "rounded-lg px-7 py-3 text-base transition-colors",
              isActive
                ? "bg-[var(--accent-gold)]/10 font-semibold text-[var(--accent-gold)] ring-1 ring-inset ring-[var(--accent-gold)]/60"
                : "font-medium text-slate-400 hover:bg-white/[0.05] hover:text-slate-200",
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
  allDays,
}: {
  availableRegions: string[]
  regionToDays: Record<string, number[]>
  // Days across every window — used for region-less events (e.g. LAN Global
  // Championships), mirroring the leaderboard page's no-region fallback.
  allDays: number[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const requestedRegion = searchParams.get("region") ?? undefined
  const requestedDay = searchParams.get("day") ?? undefined

  const effectiveRegion = resolveRegion(requestedRegion, availableRegions)
  const availableDays = effectiveRegion ? (regionToDays[effectiveRegion] ?? []) : allDays
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
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
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
                    ? "h-7 rounded-md bg-[var(--accent-gold)] px-3 text-xs font-semibold text-[var(--accent-gold-fg)] hover:bg-[var(--accent-gold-strong)]"
                    : "h-7 rounded-md px-3 text-xs font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                }
              >
                <Link href={buildUrl(region, null)}>{region}</Link>
              </Button>
            )
          })}
        </div>
      )}

      {showRegionToggle && showDayToggle && (
        <div className="h-4 w-px bg-white/[0.08]" aria-hidden />
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
                    ? "h-7 rounded-md bg-[var(--accent-gold)] px-3 text-xs font-semibold text-[var(--accent-gold-fg)] hover:bg-[var(--accent-gold-strong)]"
                    : "h-7 rounded-md px-3 text-xs font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
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
                ? "h-7 rounded-md bg-[var(--accent-gold)] px-3 text-xs font-semibold text-[var(--accent-gold-fg)] hover:bg-[var(--accent-gold-strong)]"
                : "h-7 rounded-md px-3 text-xs font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
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
// Metadata line (match count + date range) — reactive to region/day URL params
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

export function TournamentMeta({
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
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-slate-400">
      <span>
        <span className="font-semibold text-slate-200 tabular-nums">{totalMatches}</span> matches
      </span>
      <span aria-hidden className="text-slate-600">
        ·
      </span>
      <span className="tabular-nums">{formatDateRange(startTime, endTime)}</span>
    </div>
  )
}
