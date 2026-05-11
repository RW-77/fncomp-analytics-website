import Image from "next/image"
import Link from "next/link"

import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { getEventImageUrl, getTournamentEventImageKey } from "@/lib/event-images"
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
    orderBy: { created_at: "desc" },
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
          createdAt: eventWindow.created_at,
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
        createdAt: Date
      }
    >()
  )

  const groupedEventWindows = Array.from(groupedEventWindowsMap.values()).sort(
    (left, right) =>
      (right.startTime?.getTime() ?? 0) - (left.startTime?.getTime() ?? 0) ||
      right.createdAt.getTime() - left.createdAt.getTime()
  )

  const eventImageKeys = Array.from(
    new Set(
      groupedEventWindows
        .map((eventWindowGroup) => getTournamentEventImageKey(eventWindowGroup.groupId))
        .filter((key): key is NonNullable<ReturnType<typeof getTournamentEventImageKey>> => key !== null)
    )
  )

  const signedImageEntries = await Promise.all(
    eventImageKeys.map(async (key) => [key, await getEventImageUrl(key)] as const)
  )
  const signedImageUrls = new Map(signedImageEntries)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 rounded-2xl border border-white/8 bg-[#0b1321]/80 px-5 py-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-sky-200">
            Tournament Library
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Tournaments
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            Browse event windows by tournament day, region, and date range before drilling into
            player-level stat tables.
          </p>
        </div>
      </section>

      {groupedEventWindows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b1321]/60 px-6 py-10 text-center text-sm text-slate-400">
          No tournaments found.
        </div>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {groupedEventWindows.map((eventWindowGroup) => {
            const imageKey = getTournamentEventImageKey(eventWindowGroup.groupId)
            const imageSrc = imageKey ? signedImageUrls.get(imageKey) ?? null : null
            const formattedLabel = formatTournamentLabel(eventWindowGroup.groupId)

            return (
              <Link
                key={eventWindowGroup.groupId}
                href={`/tournaments/${eventWindowGroup.primaryEventWindowId}`}
                className="group block"
              >
                <Card className="relative h-full min-h-[420px] overflow-hidden border-white/8 bg-[#0b1321]/90 py-0 shadow-[0_18px_50px_rgba(2,6,23,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/30 hover:shadow-[0_26px_70px_rgba(2,6,23,0.36)]">
                  <div className="absolute inset-0">
                    {imageSrc ? (
                      <Image
                        fill
                        alt={formattedLabel}
                        src={imageSrc}
                        sizes="(min-width: 1280px) 30vw, (min-width: 640px) 46vw, 100vw"
                        className="object-cover opacity-70 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-80"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.45),rgba(2,6,23,0.98))]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/30 to-slate-950/92" />
                    <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
                  </div>

                  <CardContent className="relative flex min-h-[420px] flex-col justify-between p-5">
                    <div className="flex flex-wrap gap-2">
                      {eventWindowGroup.regions.length > 0 ? (
                        eventWindowGroup.regions.map((region) => (
                          <span
                            key={region}
                            className="rounded-full border border-white/10 bg-slate-950/45 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-100 backdrop-blur-sm"
                          >
                            {region}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-white/10 bg-slate-950/45 px-2.5 py-1 text-[11px] text-slate-200 backdrop-blur-sm">
                          {eventWindowGroup.primaryEventWindowId}
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      <CardTitle className="max-w-[17rem] text-xl font-semibold leading-tight text-white sm:text-[1.35rem]">
                        {formattedLabel}
                      </CardTitle>

                      <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-3">
                        <div className="min-w-0 space-y-1">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            Date range
                          </div>
                          <div className="text-xs font-medium leading-5 text-slate-200">
                            {formatDateRange(eventWindowGroup.startTime, eventWindowGroup.endTime)}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            Matches
                          </div>
                          <div className="mt-1 text-sm font-semibold text-white tabular-nums">
                            {eventWindowGroup.totalMatches}
                          </div>
                        </div>
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
