"use client"

import { useState } from "react"
import { X } from "lucide-react"

import ReplayClient from "@/app/replay/replay-client"
import type { ReplayMapDefinition } from "@/lib/replay/map-projection"
import type { MatchMetadata } from "@/lib/replay/match-data"

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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
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

  const isOpen = selectedMatchId !== null

  return (
    <div className="flex min-h-0 gap-3">
      {/* Match list — shrinks to a fixed width when a replay is open */}
      <div
        className={[
          "overflow-hidden rounded-xl border border-white/8 bg-[#0b1321]/80 transition-all duration-300",
          isOpen ? "w-72 shrink-0" : "w-full",
        ].join(" ")}
      >
        <div className="border-b border-white/8 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {matches.length} matches
          </span>
        </div>

        {matches.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No matches found.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {matches.map((match, index) => {
              const isSelected = match.match_id === selectedMatchId
              return (
                <button
                  key={match.match_id}
                  type="button"
                  onClick={() => handleMatchClick(match.match_id)}
                  className={[
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-sky-400/10 text-white"
                      : "text-slate-300 hover:bg-white/[0.03]",
                  ].join(" ")}
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-slate-600">
                    {index + 1}
                  </span>
                  {isOpen ? (
                    // Collapsed view — just show index + selected indicator
                    <span
                      className={[
                        "min-w-0 flex-1 truncate font-mono text-[11px]",
                        isSelected ? "text-sky-400" : "text-slate-500",
                      ].join(" ")}
                    >
                      {match.match_id.slice(0, 8)}…
                    </span>
                  ) : (
                    // Full view
                    <>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-400">
                        {match.match_id}
                      </span>
                      {match.start_time && (
                        <span className="shrink-0 text-xs text-slate-500">
                          {dateFormatter.format(match.start_time)}
                        </span>
                      )}
                      {match.player_count != null && (
                        <span className="shrink-0 text-xs text-slate-500">
                          {match.player_count}p
                        </span>
                      )}
                    </>
                  )}
                  {isSelected && loading && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-sky-400" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Replay panel — slides in from the right */}
      {isOpen && (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/8 bg-[#0b1321]/80">
          {/* Panel header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
            <div className="min-w-0">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Replay
              </span>
              <span className="ml-3 font-mono text-xs text-slate-400 truncate">
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

          {/* Panel body */}
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-sky-400" />
                <span className="text-xs">Loading match data…</span>
              </div>
            ) : error ? (
              <p className="text-sm text-slate-500">{error}</p>
            ) : payload ? (
              payload.mapDefinition && payload.mapImageUrl ? (
                <ReplayClient
                  key={selectedMatchId}
                  mapDefinition={payload.mapDefinition}
                  mapImageUrl={payload.mapImageUrl}
                  matchMetadata={payload.metadata}
                  stageWidth={900}
                  stageHeight={600}
                />
              ) : (
                <p className="text-sm text-slate-500">Map assets not available for this match.</p>
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
