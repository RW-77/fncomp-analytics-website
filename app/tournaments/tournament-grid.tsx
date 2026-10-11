"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Search } from "lucide-react"

import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export type TournamentGridItem = {
  tournamentId: string
  title: string
  href: string
  regions: string[]
  imageSrc: string | null
  dateRange: string
  totalMatches: number
}

// The tournaments list: a title search over a grid of square cards (the event
// images are square, so a square card shows them whole).
export function TournamentGrid({ tournaments }: { tournaments: TournamentGridItem[] }) {
  const [query, setQuery] = useState("")
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = tournaments.filter((t) => words.every((w) => t.title.toLowerCase().includes(w)))

  return (
    <>
      <div className="relative mb-6 w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tournaments"
          aria-label="Search tournaments by title"
          className="h-10 border-white/[0.08] bg-[var(--panel-raised)] pl-9 text-slate-100 shadow-none placeholder:text-slate-500 focus-visible:border-sky-400/30 focus-visible:ring-sky-400/15"
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-400">No tournaments match &ldquo;{query}&rdquo;.</p>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((tournament) => (
            <Link key={tournament.tournamentId} href={tournament.href} className="group block">
              <Card className="relative aspect-square overflow-hidden border-white/8 bg-[var(--panel-inset)]/90 py-0 shadow-[0_18px_50px_rgba(2,6,23,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/30 hover:shadow-[0_26px_70px_rgba(2,6,23,0.36)]">
                <div className="absolute inset-0">
                  {tournament.imageSrc ? (
                    <Image
                      fill
                      alt={tournament.title}
                      src={tournament.imageSrc}
                      sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw"
                      className="object-cover opacity-70 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-80"
                      unoptimized
                    />
                  ) : (
                    <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.45),rgba(2,6,23,0.98))]" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/30 to-slate-950/92" />
                  <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
                </div>

                <CardContent className="relative flex h-full flex-col justify-between p-5">
                  <div className="flex flex-wrap gap-2">
                    {tournament.regions.length > 0 ? (
                      tournament.regions.map((region) => (
                        <span
                          key={region}
                          className="rounded-full border border-white/10 bg-slate-950/45 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-100 backdrop-blur-sm"
                        >
                          {region}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-white/10 bg-slate-950/45 px-2.5 py-1 text-[11px] text-slate-200 backdrop-blur-sm">
                        {tournament.tournamentId}
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    <CardTitle className="max-w-[17rem] text-xl font-semibold leading-tight text-white sm:text-[1.35rem]">
                      {tournament.title}
                    </CardTitle>

                    <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-3">
                      <div className="min-w-0 space-y-1">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Date range</div>
                        <div className="text-xs font-medium leading-5 text-slate-200">{tournament.dateRange}</div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Matches</div>
                        <div className="mt-1 text-sm font-semibold text-white tabular-nums">{tournament.totalMatches}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </>
  )
}
