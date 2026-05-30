import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound, redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getFilteredStats, getMatches, getWeaponIds } from "@/lib/actions"
import { prisma } from "@/lib/prisma"
import { StatFilters } from "@/lib/types"
import {
  CUMULATIVE_DAY,
  compareTournamentRegions,
  DaySelection,
  getTournamentDisplayTitle,
  resolveDay,
  resolveRegion,
} from "@/lib/tournaments"

import TournamentStatsClient from "./tournamentStatsClient"

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

type PageProps = {
  params: Promise<{ tournamentId: string }>
  searchParams: Promise<{ region?: string; day?: string }>
}

function formatDateRange(startTime: Date | null, endTime: Date | null) {
  if (!startTime && !endTime) {
    return "Date unavailable"
  }

  if (startTime && endTime) {
    return `${dateFormatter.format(startTime)} - ${dateFormatter.format(endTime)}`
  }

  return dateFormatter.format(startTime ?? endTime ?? new Date())
}

/**
 * Builds the canonical URL for a tournament view. Always includes the resolved
 * region and day in the query string so the URL fully describes what is being
 * viewed (no implicit defaults). The day param is omitted only for tournaments
 * that have no numbered days at all (day_index = null on all event_windows).
 */
function buildTournamentUrl(
  tournamentId: string,
  region: string | null,
  day: DaySelection | null
): string {
  const params = new URLSearchParams()
  if (region) {
    params.set("region", region)
  }
  if (day !== null) {
    params.set("day", String(day))
  }
  const query = params.toString()
  return query ? `/tournaments/${tournamentId}?${query}` : `/tournaments/${tournamentId}`
}

export default async function TournamentPage({ params, searchParams }: PageProps) {
  const { tournamentId } = await params
  const { region: requestedRegion, day: requestedDay } = await searchParams

  // The tournaments row is optional here: event_windows.tournament_id may
  // reference a tournament that hasn't been backfilled into the tournaments
  // table yet. We render with a derived title in that case.
  const [tournament, allEventWindows] = await Promise.all([
    prisma.tournaments.findUnique({ where: { tournament_id: tournamentId } }),
    prisma.event_windows.findMany({
      where: { tournament_id: tournamentId },
      include: { events: true },
      orderBy: [{ start_time: "asc" }, { day_index: "asc" }],
    }),
  ])

  if (allEventWindows.length === 0) {
    notFound()
  }

  // -- Region resolution --------------------------------------------------

  const availableRegions = Array.from(
    new Set(
      allEventWindows
        .map((eventWindow) => eventWindow.events?.region_code)
        .filter((region): region is string => Boolean(region))
    )
  ).sort(compareTournamentRegions)

  const effectiveRegion = resolveRegion(requestedRegion, availableRegions)
  const eventWindowsForRegion = effectiveRegion
    ? allEventWindows.filter((eventWindow) => eventWindow.events?.region_code === effectiveRegion)
    : allEventWindows

  // -- Day resolution -----------------------------------------------------

  const availableDays = Array.from(
    new Set(
      eventWindowsForRegion
        .map((eventWindow) => eventWindow.day_index)
        .filter((dayIndex): dayIndex is number => dayIndex !== null)
    )
  ).sort((left, right) => left - right)

  const effectiveDay = resolveDay(requestedDay, availableDays)

  // -- Canonicalize the URL before doing any expensive work ---------------
  // The URL must always carry the effective region (and the effective day for
  // multi-day tournaments). If the caller's params don't match, redirect to
  // the canonical URL.

  const expectedRegionParam = effectiveRegion ?? undefined
  const expectedDayParam = effectiveDay === null ? undefined : String(effectiveDay)
  const isCanonicalUrl =
    requestedRegion === expectedRegionParam && requestedDay === expectedDayParam

  if (!isCanonicalUrl) {
    redirect(buildTournamentUrl(tournamentId, effectiveRegion, effectiveDay))
  }

  // -- Resolve the set of event_windows that feed the stats view ----------

  const selectedEventWindows =
    effectiveDay === null || effectiveDay === CUMULATIVE_DAY
      ? eventWindowsForRegion
      : eventWindowsForRegion.filter(
          (eventWindow) => eventWindow.day_index === effectiveDay
        )

  const selectedEventWindowIds = selectedEventWindows.map(
    (eventWindow) => eventWindow.event_window_id
  )

  const [matches, weapons] = await Promise.all([
    getMatches(selectedEventWindowIds),
    getWeaponIds(selectedEventWindowIds),
  ])

  const initialFilters: StatFilters = {
    selectedMatches: matches.map((match) => match.id),
    weaponTypes: weapons.map((weapon) => weapon.id),
    distanceRange: [0, 400],
    timeRange: [0, 30],
  }
  const initialData = await getFilteredStats(initialFilters)

  // -- View-level metadata ------------------------------------------------

  const totalMatches = selectedEventWindows.reduce(
    (sum, eventWindow) => sum + eventWindow.total_matches,
    0
  )
  const startTimes = selectedEventWindows
    .map((eventWindow) => eventWindow.start_time)
    .filter((value): value is Date => value !== null)
  const endTimes = selectedEventWindows
    .map((eventWindow) => eventWindow.end_time)
    .filter((value): value is Date => value !== null)
  const startTime = startTimes.length
    ? new Date(Math.min(...startTimes.map((d) => d.getTime())))
    : null
  const endTime = endTimes.length
    ? new Date(Math.max(...endTimes.map((d) => d.getTime())))
    : null

  const tournamentTitle = getTournamentDisplayTitle(
    tournament ?? { tournament_id: tournamentId, title: null }
  )

  // Show toggles only when there's something to switch between.
  const showRegionToggle = availableRegions.length > 1
  const showDayToggle = availableDays.length > 0

  // Key the client component on the selected view so that switching region or
  // day fully remounts it. Without this, the client's local useState for
  // selectedMatches / data would hold values from the previous view.
  const statsClientKey = `${effectiveRegion}::${effectiveDay ?? "none"}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 rounded-2xl border border-white/8 bg-[#0b1321]/80 px-5 py-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Link
              href="/tournaments"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-slate-200"
            >
              <ArrowLeft className="size-3.5" />
              Back to tournaments
            </Link>

            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-sky-200">
                Tournament Detail
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {tournamentTitle}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                {effectiveRegion ? `Region: ${effectiveRegion}` : "Global event"}
                {effectiveDay === null
                  ? ""
                  : effectiveDay === CUMULATIVE_DAY
                    ? " · All days"
                    : ` · Day ${effectiveDay}`}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Matches</div>
              <div className="mt-1 text-xl font-semibold text-white tabular-nums">
                {totalMatches}
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Date range
              </div>
              <div className="mt-1 text-sm font-medium leading-6 text-slate-200">
                {formatDateRange(startTime, endTime)}
              </div>
            </div>
          </div>
        </div>

        {showRegionToggle && (
          <div className="mt-5 border-t border-white/8 pt-4">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Region
            </div>
            <div className="flex flex-wrap gap-2">
              {availableRegions.map((region) => {
                const isActive = region === effectiveRegion
                return (
                  <Button
                    asChild
                    key={region}
                    variant={isActive ? "default" : "outline"}
                    className={
                      isActive
                        ? "h-8 rounded-full bg-sky-400 px-3 text-xs font-semibold text-slate-950 hover:bg-sky-300"
                        : "h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-200 hover:bg-white/[0.06]"
                    }
                  >
                    <Link href={buildTournamentUrl(tournamentId, region, effectiveDay)}>
                      {region}
                    </Link>
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {showDayToggle && (
          <div className="mt-5 border-t border-white/8 pt-4">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Day
            </div>
            <div className="flex flex-wrap gap-2">
              {availableDays.map((day) => {
                const isActive = effectiveDay === day
                return (
                  <Button
                    asChild
                    key={day}
                    variant={isActive ? "default" : "outline"}
                    className={
                      isActive
                        ? "h-8 rounded-full bg-sky-400 px-3 text-xs font-semibold text-slate-950 hover:bg-sky-300"
                        : "h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-200 hover:bg-white/[0.06]"
                    }
                  >
                    <Link href={buildTournamentUrl(tournamentId, effectiveRegion, day)}>
                      Day {day}
                    </Link>
                  </Button>
                )
              })}
              <Button
                asChild
                variant={effectiveDay === CUMULATIVE_DAY ? "default" : "outline"}
                className={
                  effectiveDay === CUMULATIVE_DAY
                    ? "h-8 rounded-full bg-sky-400 px-3 text-xs font-semibold text-slate-950 hover:bg-sky-300"
                    : "h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-200 hover:bg-white/[0.06]"
                }
              >
                <Link href={buildTournamentUrl(tournamentId, effectiveRegion, CUMULATIVE_DAY)}>
                  Cumulative
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      <TournamentStatsClient
        key={statsClientKey}
        matches={matches}
        weapons={weapons}
        initialData={initialData}
      />
    </div>
  )
}
