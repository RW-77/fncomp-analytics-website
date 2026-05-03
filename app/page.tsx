import Link from "next/link"
import { ArrowRight, BarChart3, Database, Filter, ShieldCheck } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const featureCards = [
  {
    title: "Tournament coverage",
    description: "Organize event windows by series and region so analysts can move through weekends quickly.",
    icon: Database,
  },
  {
    title: "Scenario filters",
    description: "Drill into matches, weapon pools, damage distance, and time windows without leaving the stats view.",
    icon: Filter,
  },
  {
    title: "Player comparison",
    description: "Sort clean elimination and damage output tables to spot consistent performers and outliers.",
    icon: BarChart3,
  },
]

const previewStats = [
  { label: "Tracked players", value: "1,248" },
  { label: "Processed fights", value: "18,640" },
  { label: "Regions in view", value: "7" },
]

const previewRows = [
  { player: "Mero", eliminations: "42", damage: "8,416" },
  { player: "Malibuca", eliminations: "38", damage: "7,982" },
  { player: "Pinq", eliminations: "34", damage: "7,104" },
  { player: "Chico", eliminations: "31", damage: "6,882" },
]

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-8 pb-10 pt-4 lg:grid-cols-[1.02fr_0.98fr] lg:items-start lg:gap-10 lg:pt-10">
        <div className="space-y-6">
          <div className="inline-flex items-center rounded-full border border-sky-400/15 bg-sky-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-sky-200">
            Fortnite Competitive Analytics
          </div>

          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]">
              Review tournament performance with a dashboard built for analysts, not a splash page.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Explore event windows, isolate combat scenarios, and compare player output across competitive Fortnite tournaments without touching raw replay files.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-11 rounded-lg bg-sky-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(125,211,252,0.4),0_18px_40px_rgba(14,165,233,0.18)] transition-colors hover:bg-sky-300"
            >
              <Link href="/tournaments">
                Browse tournaments
                <ArrowRight className="size-4" />
              </Link>
            </Button>

            <div className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-300">
              <ShieldCheck className="size-4 text-sky-300" />
              Existing filters, routes, and stat behavior kept intact.
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {featureCards.map((feature) => {
              const Icon = feature.icon

              return (
                <Card
                  key={feature.title}
                  className="gap-3 border-white/8 bg-[#0b1321]/75 py-4 shadow-[0_10px_30px_rgba(2,6,23,0.2)]"
                >
                  <CardContent className="space-y-3 px-4">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-sky-300">
                      <Icon className="size-4" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-sm font-semibold text-white">{feature.title}</h2>
                      <p className="text-sm leading-6 text-slate-400">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <Card className="overflow-hidden border-white/8 bg-[#09111d]/90 py-0 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <CardContent className="p-0">
            <div className="border-b border-white/8 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                    Dashboard Preview
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">FNCS Major 3</div>
                  <div className="mt-1 text-sm text-slate-400">
                    Filterable player output across tournament event windows
                  </div>
                </div>
                <div className="rounded-full border border-sky-400/15 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
                  EU · 12 matches
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {previewStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {stat.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-white/8 bg-[#0d1524]/90">
                <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
                  <span className="rounded-md border border-white/8 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">
                    Matches: All
                  </span>
                  <span className="rounded-md border border-white/8 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">
                    Weapons: Shotgun
                  </span>
                  <span className="rounded-md border border-white/8 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">
                    Distance: 0-150m
                  </span>
                </div>

                <div className="grid grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(96px,0.8fr))] gap-3 border-b border-white/8 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  <span>Player</span>
                  <span className="text-right">Elims</span>
                  <span className="text-right">Damage</span>
                </div>

                <div className="divide-y divide-white/6">
                  {previewRows.map((row) => (
                    <div
                      key={row.player}
                      className="grid grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(96px,0.8fr))] gap-3 px-4 py-3 text-sm text-slate-200"
                    >
                      <span className="font-medium text-white">{row.player}</span>
                      <span className="text-right font-medium tabular-nums">{row.eliminations}</span>
                      <span className="text-right font-medium tabular-nums">{row.damage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
