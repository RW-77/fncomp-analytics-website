import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getFilteredStats, getMatches, getWeaponIds } from "@/lib/actions"
import { prisma } from "@/lib/prisma"
import { StatFilters } from "@/lib/types"
import {
  formatTournamentLabel,
  getEventWindowGroupId,
  getEventWindowRegion,
  getTournamentSeriesId,
} from "@/lib/tournaments"

import TournamentStatsClient from "./tournamentStatsClient"

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

type PageProps = {
  params: Promise<{ tournamentId: string }>
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

export default async function TournamentPage({ params }: PageProps) {
  const { tournamentId } = await params
  const currentEventWindow = await prisma.event_windows.findUnique({
    where: { event_window_id: tournamentId },
  })

  if (!currentEventWindow) {
    notFound()
  }

  const region = getEventWindowRegion(tournamentId)
  const eventWindowGroupId = getEventWindowGroupId(tournamentId)
  const tournamentSeriesId = getTournamentSeriesId(tournamentId)

  const regionEventWindows = region
    ? (
        await prisma.event_windows.findMany({
          where: {
            event_window_id: {
              startsWith: `${eventWindowGroupId}_`,
            },
          },
          orderBy: { event_window_id: "asc" },
        })
      ).filter(
        (eventWindow) => getEventWindowGroupId(eventWindow.event_window_id) === eventWindowGroupId
      )
    : [currentEventWindow]

  const matches = await getMatches(tournamentId)
  const weapons = await getWeaponIds(tournamentId)

  const initialFilters: StatFilters = {
    selectedMatches: matches.map((match) => match.id),
    weaponTypes: weapons.map((weapon) => weapon.id),
    distanceRange: [0, 400],
    timeRange: [0, 30],
  }
  const initialData = await getFilteredStats(initialFilters)

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
                {formatTournamentLabel(eventWindowGroupId)}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                Series: {formatTournamentLabel(tournamentSeriesId)}
                {region ? ` · Region: ${region}` : ""}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Matches</div>
              <div className="mt-1 text-xl font-semibold text-white tabular-nums">
                {currentEventWindow.total_matches}
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Date range
              </div>
              <div className="mt-1 text-sm font-medium leading-6 text-slate-200">
                {formatDateRange(currentEventWindow.start_time, currentEventWindow.end_time)}
              </div>
            </div>
          </div>
        </div>

        {regionEventWindows.length > 1 && (
          <div className="mt-5 border-t border-white/8 pt-4">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Regional windows
            </div>
            <div className="flex flex-wrap gap-2">
              {regionEventWindows.map((eventWindow) => {
                const eventWindowRegion =
                  getEventWindowRegion(eventWindow.event_window_id) ?? eventWindow.event_window_id
                const isActive = eventWindow.event_window_id === tournamentId

                return (
                  <Button
                    asChild
                    key={eventWindow.event_window_id}
                    variant={isActive ? "default" : "outline"}
                    className={
                      isActive
                        ? "h-8 rounded-full bg-sky-400 px-3 text-xs font-semibold text-slate-950 hover:bg-sky-300"
                        : "h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-200 hover:bg-white/[0.06]"
                    }
                  >
                    <Link href={`/tournaments/${eventWindow.event_window_id}`}>
                      {eventWindowRegion}
                    </Link>
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <TournamentStatsClient matches={matches} weapons={weapons} initialData={initialData} />
    </div>
  )
}
