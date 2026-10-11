"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import type { StatsDemo, StatsDemoPlayer } from "@/lib/home"
import { SliderRange } from "@/components/common/slider-range"
import { SectionHeading } from "@/components/home/section-heading"
import { StepItem } from "@/components/home/step-item"

type Range = [number, number]
type Filter = { distance: Range; time: Range }
type SortKey = "elims" | "knocks" | "damage" | "contribution"
type Question = { title: string; body: string; filter: Filter; sort: SortKey }

const MAX_DISTANCE = 300   // m; the data caps distances here
const SHOWN = 8            // of the players sent (the elims and contribution leaders)
const ROW = 41             // px, a players-tab row
const DWELL = 2500         // ms each question stays up while it plays by itself
const FIRST_DWELL = 600    // ms the first stays up, so it moves on soon after it scrolls into view
const TWEEN = 450          // ms the sliders take to move to a question's ranges

// The players tab's names for them. Knocks hide on phones, for room.
const COLUMNS: { key: SortKey; label: string; phones?: false }[] = [
  { key: "elims", label: "Elims" },
  { key: "knocks", label: "Knocks", phones: false },
  { key: "damage", label: "DMG Dealt" },
  { key: "contribution", label: "DMG Contrib" },
]

// The questions the table answers, played through in order. Each sets the
// sliders and the column it sorts by.
function questions(games: number, maxTime: number): Question[] {
  const everywhere: Range = [0, MAX_DISTANCE]
  const allGame: Range = [0, maxTime]
  const closeRange: Range = [0, 30]
  return [
    { title: "Comprehensive", body: `Who had the highest fragging output across all ${games} games?`, filter: { distance: everywhere, time: allGame }, sort: "contribution" },
    { title: "Close-range midgame", body: "Who was the most valuable player in midgame fights?", filter: { distance: closeRange, time: [2, 12] }, sort: "damage" },
    { title: "Surge", body: "Who are the best long-distance surge getters?", filter: { distance: [75, MAX_DISTANCE], time: allGame }, sort: "damage" },
    { title: "Lategame", body: "Which players pop off in the later zones?", filter: { distance: everywhere, time: [maxTime - 8, maxTime] }, sort: "elims" },
    { title: "Off spawn", body: "Which players fought off spawn the most?", filter: { distance: closeRange, time: [0, 3] }, sort: "damage" },
  ]
}

type Totals = { name: string; elims: number; knocks: number; damage: number; contribution: number }

// A player's totals within the filter. Events come in 30-second and 5 m steps
// (see StatsDemo). Damage contribution has no distance, so only time filters
// it, as on the players tab.
function totals(player: StatsDemoPlayer, { distance, time }: Filter): Totals {
  const inTime = (when: number) => when / 2 >= time[0] && when / 2 < time[1]
  const within = (when: number, step: number) => inTime(when) && step * 5 >= distance[0] && step * 5 <= distance[1]
  let elims = 0
  let knocks = 0
  let damage = 0
  let contribution = 0
  for (let i = 0; i < player.elims.length; i += 2) if (within(player.elims[i], player.elims[i + 1])) elims++
  for (let i = 0; i < player.knocks.length; i += 2) if (within(player.knocks[i], player.knocks[i + 1])) knocks++
  for (let i = 0; i < player.damage.length; i += 3) if (within(player.damage[i], player.damage[i + 1])) damage += player.damage[i + 2]
  for (let i = 0; i < player.contribution.length; i += 2) if (inTime(player.contribution[i])) contribution += player.contribution[i + 1]
  return { name: player.name, elims, knocks, damage, contribution }
}

// Players ranked by `sort`; elims, then damage, then name break ties.
function rank(players: StatsDemoPlayer[], filter: Filter, sort: SortKey): Map<string, Totals & { rank: number }> {
  const rows = players.map((p) => totals(p, filter))
  rows.sort((a, b) => b[sort] - a[sort] || b.elims - a.elims || b.damage - a.damage || a.name.localeCompare(b.name))
  return new Map(rows.map((row, i) => [row.name, { ...row, rank: i }]))
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step

// The table's columns: rank, player, then the stats; narrower on phones, and
// without knocks, so names keep most of the width.
const GRID =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_2.5rem_3.5rem_3.75rem] gap-x-1 px-3 sm:grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_3.5rem_4.5rem_4.5rem] sm:gap-x-3 sm:px-4"

// The homepage's stats section: questions on the left that play through by
// themselves, each moving the sliders and re-sorting the table on the right.
// Touching a slider, a column or a question stops the playing.
export function StatsSection({ demo }: { demo: StatsDemo }) {
  const maxTime = useMemo(() => {
    const whens = demo.players.flatMap((p) => [
      ...p.elims.filter((_, i) => i % 2 === 0),
      ...p.damage.filter((_, i) => i % 3 === 0),
      ...p.contribution.filter((_, i) => i % 2 === 0),
    ])
    return Math.ceil((Math.max(...whens) + 1) / 2)
  }, [demo.players])
  const qs = useMemo(() => questions(demo.games, maxTime), [demo.games, maxTime])

  const [filter, setFilter] = useState<Filter>(qs[0].filter)
  const [sort, setSort] = useState<SortKey>(qs[0].sort)
  const [question, setQuestion] = useState<number | null>(0)
  const [playing, setPlaying] = useState(true)

  const filterRef = useRef(filter)
  useEffect(() => {
    filterRef.current = filter
  }, [filter])
  const tween = useRef(0)
  const progress = useRef<HTMLSpanElement>(null)
  const section = useRef<HTMLElement>(null)
  const onScreen = useRef(false)
  const advanced = useRef(false)   // has it moved past the first question yet

  const ranked = useMemo(() => rank(demo.players, filter, sort), [demo.players, filter, sort])
  // The arrows compare each player's place against the whole event, by the same stat
  const wholeEvent = useMemo(() => rank(demo.players, qs[0].filter, sort), [demo.players, qs, sort])

  // Show a question: slide the filter to its ranges and sort by its column.
  const show = useCallback(
    (i: number) => {
      const from = filterRef.current
      const to = qs[i].filter
      setQuestion(i)
      setSort(qs[i].sort)
      cancelAnimationFrame(tween.current)
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / TWEEN)
        const ease = 1 - (1 - t) ** 3
        const at = (a: number, b: number) => a + (b - a) * ease
        setFilter({
          distance: [roundTo(at(from.distance[0], to.distance[0]), 5), roundTo(at(from.distance[1], to.distance[1]), 5)],
          time: [roundTo(at(from.time[0], to.time[0]), 0.5), roundTo(at(from.time[1], to.time[1]), 0.5)],
        })
        if (t < 1) tween.current = requestAnimationFrame(step)
      }
      tween.current = requestAnimationFrame(step)
    },
    [qs],
  )

  const stop = () => {
    setPlaying(false)
    cancelAnimationFrame(tween.current)
  }

  // Count down the current question while the section is on screen, then
  // move to the next; the gold bar under it fills meanwhile.
  useEffect(() => {
    if (!playing || question === null) return
    const dwell = advanced.current ? DWELL : FIRST_DWELL
    let elapsed = 0
    let last = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      if (onScreen.current && !document.hidden) elapsed += now - last
      last = now
      if (progress.current) progress.current.style.transform = `scaleX(${Math.min(1, elapsed / dwell)})`
      if (elapsed >= dwell) {
        advanced.current = true
        show((question + 1) % qs.length)
      }
      else frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [playing, question, qs.length, show])

  useEffect(() => {
    const el = section.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => (onScreen.current = entry.isIntersecting), { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={section} className="border-t border-white/[0.06]">
      <div className="section-x grid gap-12 py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-28">
        <div className="flex flex-col gap-8">
          <SectionHeading title="Context-aware stats">
            Powerful filtering by distance and time to answer your most important questions.
          </SectionHeading>
          <ol className="ml-3 flex flex-col gap-1.5 sm:ml-6">
            {qs.map((q, i) => (
              <StepItem
                key={q.title}
                title={q.title}
                body={q.body}
                active={question === i}
                progress={playing ? progress : undefined}
                onSelect={() => {
                  stop()
                  show(i)
                }}
              />
            ))}
          </ol>
          <Link
            href={demo.href}
            className="ml-3 inline-flex items-center gap-1.5 self-start text-[15px] font-semibold text-[var(--accent-gold)] hover:text-[var(--accent-gold-strong)] sm:ml-6"
          >
            Explore the full stats
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="flex flex-col gap-2.5 lg:pt-12">
          <div className="grid gap-3 sm:grid-cols-2">
            <SliderRange
              label="Distance"
              value={filter.distance}
              onValueChange={(distance) => {
                stop()
                setQuestion(null)
                setFilter((f) => ({ ...f, distance }))
              }}
              max={MAX_DISTANCE}
              step={5}
              unit="m"
            />
            <SliderRange
              label="Time Window"
              value={filter.time}
              onValueChange={(time) => {
                stop()
                setQuestion(null)
                setFilter((f) => ({ ...f, time }))
              }}
              max={maxTime}
              step={0.5}
              unit="min"
            />
          </div>

          <div className="overflow-hidden rounded-md bg-[var(--panel)]">
            <div className="border-b border-white/[0.06] px-4 py-4 text-lg font-semibold text-[var(--accent-gold)]">
              {demo.title}
            </div>
            <div className={cn(GRID, "h-10 items-center bg-[var(--panel-raised)] text-[14px] tracking-tight")}>
              <span className="text-slate-400">#</span>
              <span className="text-slate-400">Player</span>
              {COLUMNS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    stop()
                    setQuestion(null)
                    setSort(c.key)
                  }}
                  className={cn(
                    "cursor-pointer text-right leading-tight",
                    c.phones === false && "hidden sm:block",
                    sort === c.key ? "text-[var(--accent-gold)]" : "text-slate-400 hover:text-white",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <ol className="relative" style={{ height: SHOWN * ROW }}>
              {demo.players.map((p) => {
                const row = ranked.get(p.name)!
                const moved = wholeEvent.get(p.name)!.rank - row.rank
                return (
                  <li
                    key={p.name}
                    aria-hidden={row.rank >= SHOWN}
                    className={cn(
                      GRID,
                      "absolute inset-x-0 top-0 items-center border-t border-white/[0.05] text-sm text-slate-300 transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,.75,.2,1)]",
                    )}
                    style={{
                      height: ROW,
                      transform: `translateY(${Math.min(row.rank, SHOWN) * ROW}px)`,
                      opacity: row.rank < SHOWN ? 1 : 0,
                    }}
                  >
                    <span className="tabular-nums text-slate-500">{row.rank + 1}</span>
                    <span className="truncate text-white">
                      {p.name}
                      {moved !== 0 && (
                        <span className={cn("ml-2 text-xs tabular-nums", moved > 0 ? "text-primary" : "text-red-400")}>
                          {moved > 0 ? "▲" : "▼"}
                          {Math.abs(moved)}
                        </span>
                      )}
                    </span>
                    <span className="text-right tabular-nums">{row.elims}</span>
                    <span className="hidden text-right tabular-nums sm:block">{row.knocks}</span>
                    <span className="text-right tabular-nums">{row.damage.toLocaleString("en-US")}</span>
                    <span className="text-right tabular-nums">{row.contribution.toLocaleString("en-US")}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
