import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { compareTournamentRegions, getTournamentDisplayTitle } from "@/lib/tournaments"

import {
  RegionDayToggles,
  SerializedEventWindow,
  TournamentMeta,
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
    <>
      {/* Scoped solid-navy backdrop — overrides the global body gradient for
          tournament pages only, without editing globals.css. */}
      <div className="fixed inset-0 -z-10 bg-[#0a0f1a]" aria-hidden />

      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 md:px-14">
        {/* Header — integrated into the page, no card */}
        <header className="mb-6">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            <ArrowLeft className="size-3.5" />
            Tournaments
          </Link>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-5xl">
            {tournamentTitle}
          </h1>

          <TournamentMeta eventWindows={serializedEventWindows} />

          <RegionDayToggles availableRegions={availableRegions} regionToDays={regionToDays} />
        </header>

        {/* Primary view switcher */}
        <TournamentTabNav tournamentId={tournamentId} />

        {children}
      </div>
    </>
  )
}
