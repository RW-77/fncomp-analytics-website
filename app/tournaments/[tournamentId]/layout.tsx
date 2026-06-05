import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { compareTournamentRegions, getTournamentDisplayTitle } from "@/lib/tournaments"

import {
  RegionDayToggles,
  SerializedEventWindow,
  TournamentStatCards,
  TournamentTabNav,
} from "./tournament-nav"

type LayoutProps = {
  params: Promise<{ tournamentId: string }>
  children: React.ReactNode
}

export default async function TournamentLayout({ params, children }: LayoutProps) {
  const { tournamentId } = await params

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

  const availableRegions = Array.from(
    new Set(
      allEventWindows
        .map((ew) => ew.events?.region_code)
        .filter((r): r is string => Boolean(r))
    )
  ).sort(compareTournamentRegions)

  const regionToDays: Record<string, number[]> = {}
  for (const region of availableRegions) {
    const days = Array.from(
      new Set(
        allEventWindows
          .filter((ew) => ew.events?.region_code === region)
          .map((ew) => ew.day_index)
          .filter((d): d is number => d !== null)
      )
    ).sort((a, b) => a - b)
    regionToDays[region] = days
  }

  const serializedEventWindows: SerializedEventWindow[] = allEventWindows.map((ew) => ({
    event_window_id: ew.event_window_id,
    day_index: ew.day_index,
    total_matches: ew.total_matches,
    start_time: ew.start_time?.toISOString() ?? null,
    end_time: ew.end_time?.toISOString() ?? null,
    region_code: ew.events?.region_code ?? null,
  }))

  const tournamentTitle = getTournamentDisplayTitle(
    tournament ?? { tournament_id: tournamentId, title: null }
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header card */}
      <section className="mb-5 rounded-2xl border border-white/8 bg-[#0b1321]/80 px-5 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/tournaments"
              className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-slate-200"
            >
              <ArrowLeft className="size-3" />
              Tournaments
            </Link>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-sky-200">
                Tournament
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {tournamentTitle}
              </h1>
            </div>
          </div>

          <TournamentStatCards eventWindows={serializedEventWindows} />
        </div>

        <RegionDayToggles availableRegions={availableRegions} regionToDays={regionToDays} />
      </section>

      {/* Tab nav — primary navigation, lives outside the header card */}
      <TournamentTabNav tournamentId={tournamentId} />

      {children}
    </div>
  )
}
