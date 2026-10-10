import Link from "next/link"
import { Clock, Crosshair, Trophy, Users } from "lucide-react"

import type { MatchCard as MatchCardData } from "@/lib/replay/match-cards"
import type { MapAssets } from "@/lib/replay/match-data"
import { formatClock } from "@/lib/replay/format"
import { LocalTime } from "@/components/local-time"
import { MatchMapThumb } from "@/components/matches/match-map-thumb"

const badge = "rounded-[2px] bg-[#0a0f1a]/85 px-2 py-1"

// One game in the matches grid: where it ended, who won, and how it went.
// The whole card opens the match page.
export function MatchCard({ card, map }: { card: MatchCardData; map: MapAssets | null }) {
  return (
    <Link
      href={`/matches/${card.matchId}`}
      className="group flex flex-col overflow-hidden rounded-[3px] bg-[var(--panel)] ring-1 ring-white/[0.06] transition hover:ring-sky-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <div className="relative">
        {map ? (
          <MatchMapThumb
            imageUrl={map.imageUrl}
            definition={map.definition}
            zones={card.zones}
            className="aspect-[4/3] w-full bg-white/[0.04]"
          />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center bg-white/[0.04] text-xs text-slate-500">
            No map for this match
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-baseline justify-between px-3 pt-2.5">
          <span className={`${badge} text-sm font-bold text-white`}>
            {card.number === null ? "Match" : `Match ${card.number}`}
          </span>
          {card.startTime && (
            <span className={`${badge} text-xs text-slate-300`}>
              <LocalTime iso={card.startTime} format="time" />
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2.5 p-3.5">
        {card.winner ? (
          <div className="flex items-start gap-2" aria-label={`Won by ${card.winner.join(", ")}`}>
            <Trophy className="mt-0.5 size-3.5 shrink-0 text-slate-500" aria-hidden />
            <div className="flex min-w-0 flex-col text-sm font-semibold leading-snug text-slate-100">
              {card.winner.map((name) => (
                <span key={name} className="truncate">{name}</span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No result on the leaderboard</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-slate-400">
          {card.durationS !== null && (
            <span className="inline-flex items-center gap-1" title="Length">
              <Clock className="size-3.5" aria-hidden />{formatClock(card.durationS)}
            </span>
          )}
          {card.playerCount !== null && (
            <span className="inline-flex items-center gap-1" title="Players">
              <Users className="size-3.5" aria-hidden />{card.playerCount}
            </span>
          )}
          <span className="inline-flex items-center gap-1" title="Eliminations">
            <Crosshair className="size-3.5" aria-hidden />{card.elims} elims
          </span>
        </div>
      </div>
    </Link>
  )
}
