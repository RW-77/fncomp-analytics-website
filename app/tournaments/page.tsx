import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import {
  compareTournamentRegions,
  formatTournamentLabel,
  getEventWindowGroupId,
  getEventWindowRegion,
} from "@/lib/tournaments"

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function formatDateRange(startTime: Date | null, endTime: Date | null) {
  if (!startTime && !endTime) {
    return "Date unavailable"
  }

  if (startTime && endTime) {
    return `${dateFormatter.format(startTime)} - ${dateFormatter.format(endTime)}`
  }

  return dateFormatter.format(startTime ?? endTime ?? new Date())
}

export default async function TournamentsPage() {
  const eventWindows = await prisma.event_windows.findMany({
    orderBy: { discovered_at: "desc" },
  })

  const groupedEventWindowsMap = eventWindows.reduce(
    (groups, eventWindow) => {
      const groupId = getEventWindowGroupId(eventWindow.event_window_id)
      const region = getEventWindowRegion(eventWindow.event_window_id)

      const existingGroup = groups.get(groupId)
      if (!existingGroup) {
        groups.set(groupId, {
          groupId,
          primaryEventWindowId: eventWindow.event_window_id,
          regions: region ? [region] : [],
          startTime: eventWindow.start_time,
          endTime: eventWindow.end_time,
          totalMatches: eventWindow.total_matches,
          processedMatches: eventWindow.processed_matches,
          discoveredAt: eventWindow.discovered_at,
        })
        return groups
      }

      if (region && !existingGroup.regions.includes(region)) {
        existingGroup.regions.push(region)
        existingGroup.regions.sort(compareTournamentRegions)
      }

      const eventWindowStart = eventWindow.start_time?.getTime()
      const groupStart = existingGroup.startTime?.getTime()
      if (eventWindowStart !== undefined && eventWindowStart !== null) {
        if (groupStart === undefined || groupStart === null || eventWindowStart < groupStart) {
          existingGroup.startTime = eventWindow.start_time
        }
      }

      const eventWindowEnd = eventWindow.end_time?.getTime()
      const groupEnd = existingGroup.endTime?.getTime()
      if (eventWindowEnd !== undefined && eventWindowEnd !== null) {
        if (groupEnd === undefined || groupEnd === null || eventWindowEnd > groupEnd) {
          existingGroup.endTime = eventWindow.end_time
        }
      }

      existingGroup.totalMatches = Math.max(existingGroup.totalMatches, eventWindow.total_matches)
      existingGroup.processedMatches = Math.max(
        existingGroup.processedMatches,
        eventWindow.processed_matches
      )

      return groups
    },
    new Map<
      string,
      {
        groupId: string
        primaryEventWindowId: string
        regions: string[]
        startTime: Date | null
        endTime: Date | null
        totalMatches: number
        processedMatches: number
        discoveredAt: Date
      }
    >()
  )

  const groupedEventWindows = Array.from(groupedEventWindowsMap.values()).sort(
    (left, right) => right.discoveredAt.getTime() - left.discoveredAt.getTime()
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 rounded-2xl border border-white/8 bg-[#0b1321]/80 px-5 py-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-sky-200">
              Event Windows
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Tournaments
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-400">
              Scan series coverage, compare regional windows, and jump straight into player-level
              elimination and damage splits.
            </p>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            <span className="font-semibold text-white">{groupedEventWindows.length}</span> grouped
            tournaments available
          </div>
        </div>
      </section>

      {groupedEventWindows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b1321]/60 px-6 py-10 text-center text-sm text-slate-400">
          No tournaments found.
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groupedEventWindows.map((eventWindowGroup) => {
            const completionRate =
              eventWindowGroup.totalMatches > 0
                ? Math.round(
                    (eventWindowGroup.processedMatches / eventWindowGroup.totalMatches) * 100
                  )
                : 0

            return (
              <Link
                key={eventWindowGroup.groupId}
                href={`/tournaments/${eventWindowGroup.primaryEventWindowId}`}
                className="group"
              >
                <Card className="h-full gap-0 overflow-hidden border-white/8 bg-[#0b1321]/78 py-0 shadow-[0_12px_40px_rgba(2,6,23,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/30 hover:bg-[#0e1727] hover:shadow-[0_20px_60px_rgba(2,6,23,0.32)]">
                  <CardHeader className="gap-4 border-b border-white/8 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                          Series
                        </div>
                        <CardTitle className="line-clamp-2 text-base font-semibold leading-snug text-white">
                          {formatTournamentLabel(eventWindowGroup.groupId)}
                        </CardTitle>
                      </div>

                      <div className="rounded-md border border-sky-400/15 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
                        {completionRate}%
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {eventWindowGroup.regions.length > 0 ? (
                        eventWindowGroup.regions.map((region) => (
                          <span
                            key={region}
                            className="rounded-md border border-white/8 bg-white/[0.04] px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-300"
                          >
                            {region}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md border border-white/8 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-400">
                          {eventWindowGroup.primaryEventWindowId}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 px-4 py-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Matches
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white tabular-nums">
                          {eventWindowGroup.totalMatches}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Processed
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white tabular-nums">
                          {eventWindowGroup.processedMatches}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/8 bg-[#0f1726]/90 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Date range
                      </div>
                      <div className="mt-1 text-sm font-medium leading-6 text-slate-200">
                        {formatDateRange(eventWindowGroup.startTime, eventWindowGroup.endTime)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </section>
      )}
    </div>
  )
}
