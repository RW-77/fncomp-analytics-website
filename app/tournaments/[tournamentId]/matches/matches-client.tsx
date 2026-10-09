"use client"

import { useEffect, useRef, useState } from "react"
import { Clock, MapPin, Users, X } from "lucide-react"

import ReplayClient from "@/app/replay/replay-client"
import type { ReplayMapDefinition } from "@/lib/replay/map-projection"
import type { MatchMetadata } from "@/lib/replay/match-data"
import { cn } from "@/lib/utils"

type Match = {
  match_id: string
  start_time: Date | null
  player_count: number | null
  map_path: string | null
}

type ReplayPayload = {
  metadata: MatchMetadata
  mapDefinition: ReplayMapDefinition | null
  mapImageUrl: string | null
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

export function MatchesClient({ matches }: { matches: Match[] }) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [payload, setPayload] = useState<ReplayPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMatchClick(matchId: string) {
    if (matchId === selectedMatchId) return
    setSelectedMatchId(matchId)
    setPayload(null)
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/replay/${encodeURIComponent(matchId)}/metadata`)
      if (!res.ok) throw new Error("No replay data")
      const data: ReplayPayload = await res.json()
      setPayload(data)
    } catch {
      setError("No replay data available for this match.")
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setSelectedMatchId(null)
    setPayload(null)
    setError(null)
    setLoading(false)
  }

  const selectedIndex = matches.findIndex((m) => m.match_id === selectedMatchId)

  // Persistent list-detail: the rail and the viewer are BOTH always mounted, so
  // selecting a match only swaps the viewer's content — no layout shift, and the
  // list never moves. Desktop = two-column grid; mobile = a single stacked column.
  return (
    <div className="grid grid-cols-1 gap-4 lg:h-[calc(100dvh-8rem)] lg:min-h-[800px] lg:max-h-[1400px] lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Match rail — scrollable column of cards */}
      <div className="flex min-h-0 flex-col gap-2 lg:overflow-y-auto lg:pr-1">
        {matches.length === 0 ? (
          <div className="rounded-xl bg-[#141d30] px-4 py-8 text-center text-sm text-slate-500">
            No matches found.
          </div>
        ) : (
          matches.map((match, index) => {
            const isSelected = match.match_id === selectedMatchId
            return (
              <button
                key={match.match_id}
                type="button"
                onClick={() => handleMatchClick(match.match_id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex flex-col gap-1.5 rounded-xl px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "bg-[#1c2942] ring-1 ring-sky-400/40"
                    : "bg-[#141d30] hover:bg-[#1c2942]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-white" : "text-slate-100"
                    )}
                  >
                    Match {index + 1}
                  </span>
                  {isSelected && loading && (
                    <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-sky-400" />
                  )}
                </div>
                <span className="truncate font-mono text-[11px] text-slate-500">
                  {match.match_id}
                </span>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  {match.start_time && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3 text-slate-500" />
                      {timeFormatter.format(match.start_time)}
                    </span>
                  )}
                  {match.player_count != null && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3 text-slate-500" />
                      {match.player_count} players
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Replay viewer — always mounted; placeholder until a match is picked */}
      <div className="flex min-h-[280px] flex-col overflow-hidden rounded-xl bg-[#141d30] lg:min-h-0">
        {selectedMatchId ? (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex min-w-0 items-baseline gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Replay
                </span>
                <span className="shrink-0 text-sm font-medium text-slate-200">
                  Match {selectedIndex + 1}
                </span>
                <span className="hidden truncate font-mono text-xs text-slate-500 sm:inline">
                  {selectedMatchId}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="ml-3 shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
                aria-label="Close replay"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="aspect-[4/3] min-h-0 lg:aspect-auto lg:flex-1">
              {loading ? (
                <CenteredNote>
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <div className="size-6 animate-spin rounded-full border-2 border-white/10 border-t-sky-400" />
                    <span className="text-xs">Loading match data…</span>
                  </div>
                </CenteredNote>
              ) : error ? (
                <CenteredNote>
                  <p className="text-sm text-slate-500">{error}</p>
                </CenteredNote>
              ) : payload?.mapDefinition && payload.mapImageUrl ? (
                <ResponsiveReplay
                  key={selectedMatchId}
                  mapDefinition={payload.mapDefinition}
                  mapImageUrl={payload.mapImageUrl}
                  matchMetadata={payload.metadata}
                />
              ) : payload ? (
                <CenteredNote>
                  <p className="text-sm text-slate-500">
                    Map assets not available for this match.
                  </p>
                </CenteredNote>
              ) : null}
            </div>
          </>
        ) : (
          <ReplayPlaceholder count={matches.length} />
        )}
      </div>
    </div>
  )
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center px-6">{children}</div>
}

function ReplayPlaceholder({ count }: { count: number }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[#1c2942] text-slate-500">
        <MapPin className="size-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300">Select a match to watch its replay</p>
        <p className="mt-1 text-xs text-slate-500">
          {count} {count === 1 ? "match" : "matches"} available in this view.
        </p>
      </div>
    </div>
  )
}

// Responsive-container pattern: measure the available box and feed the pixel
// dimensions into ReplayClient's existing size props. No changes to ReplayClient.
function ResponsiveReplay({
  mapDefinition,
  mapImageUrl,
  matchMetadata,
}: {
  mapDefinition: ReplayMapDefinition
  mapImageUrl: string
  matchMetadata: MatchMetadata
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect
      setSize({ width: Math.round(box.width), height: Math.round(box.height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="h-full w-full">
      {size.width > 0 && size.height > 0 && (
        <ReplayClient
          mapDefinition={mapDefinition}
          mapImageUrl={mapImageUrl}
          matchMetadata={matchMetadata}
          stageWidth={size.width}
          stageHeight={size.height}
        />
      )}
    </div>
  )
}
