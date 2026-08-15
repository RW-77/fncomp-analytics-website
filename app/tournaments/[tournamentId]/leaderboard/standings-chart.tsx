"use client"

import { useState } from "react"

// One game's slice of a team's tournament run. `standing` is the team's
// cumulative rank *after* this game (null before their first game); the rest
// describe the individual game and are null for games they didn't play.
export type StandingGame = {
  game: number
  standing: number | null
  placement: number | null
  points: number | null
  kills: number | null
  win: boolean
  played: boolean
}

// Fixed drawing space; the wrapper scales it to the panel width.
const VB_W = 480
const VB_H = 150
const PAD = { left: 26, right: 8, top: 14, bottom: 22 }

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function StandingsChart({ games }: { games: StandingGame[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const plotLeft = PAD.left
  const plotRight = VB_W - PAD.right
  const plotTop = PAD.top
  const plotBottom = VB_H - PAD.bottom

  const standings = games
    .map((g) => g.standing)
    .filter((s): s is number => s != null)

  if (standings.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-500">
        No games played yet.
      </div>
    )
  }

  // Data-driven y-axis: span the range of standings the team actually held
  // (1 = top). Pad a flat run so it doesn't collapse to a single line.
  let top = Math.min(...standings)
  let bottom = Math.max(...standings)
  if (top === bottom) {
    top = Math.max(1, top - 1)
    bottom = bottom + 1
  }

  const n = games.length
  const x = (i: number) =>
    n <= 1 ? (plotLeft + plotRight) / 2 : plotLeft + (i / (n - 1)) * (plotRight - plotLeft)
  const y = (s: number) => plotTop + ((s - top) / (bottom - top)) * (plotBottom - plotTop)

  // Best / middle / worst integer ticks, de-duplicated for small ranges.
  const ticks = Array.from(new Set([top, Math.round((top + bottom) / 2), bottom]))

  // Connect every game with a standing; leading nulls (before entry) drop out.
  const linePoints = games
    .map((g, i) => (g.standing != null ? `${x(i)},${y(g.standing)}` : null))
    .filter((p): p is string => p != null)
    .join(" ")

  const hovered = hover != null ? games[hover] : null
  // Flip the tooltip's horizontal anchor near the plot edges so it never spills
  // past the panel edge (the scrollable aside clips overflow): centered normally,
  // right of the leftmost point, left of the rightmost.
  const hoverFrac = hover != null ? x(hover) / VB_W : 0.5
  const tooltipAnchorX = hoverFrac < 0.2 ? "0%" : hoverFrac > 0.8 ? "-100%" : "-50%"

  return (
    <div className="relative w-full" style={{ paddingBottom: `${(VB_H / VB_W) * 100}%` }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={plotLeft} y1={y(t)} x2={plotRight} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
            <text x={plotLeft - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#64748b">
              {ordinal(t)}
            </text>
          </g>
        ))}

        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--accent-gold)"
          strokeWidth="2"
          strokeOpacity="0.55"
          strokeLinejoin="round"
        />

        {games.map((g, i) => {
          if (g.standing == null) return null
          const active = hover === i
          const r = g.win ? (active ? 8 : 6) : active ? 7 : 5
          return (
            <circle
              key={g.game}
              cx={x(i)}
              cy={y(g.standing)}
              r={r}
              fill={g.win ? "var(--accent-gold)" : "#141d30"}
              stroke="var(--accent-gold)"
              strokeWidth="2"
              className="cursor-pointer"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}

        {games.map((g, i) => (
          <text key={g.game} x={x(i)} y={VB_H - 6} textAnchor="middle" fontSize="10" fill="#64748b">
            {g.game}
          </text>
        ))}
      </svg>

      {hovered?.standing != null && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-[#0c1424] px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-nowrap text-slate-200"
          style={{
            left: `${(x(hover!) / VB_W) * 100}%`,
            top: `${(y(hovered.standing) / VB_H) * 100}%`,
            transform: `translate(${tooltipAnchorX}, -118%)`,
            border: "1px solid rgba(227,201,126,0.3)",
          }}
        >
          <div className="font-bold text-[var(--accent-gold)]">
            Standing: {ordinal(hovered.standing).toUpperCase()}
          </div>
          <div>
            {hovered.played
              ? `${hovered.points} PTS · ${ordinal(hovered.placement!)} place · ${hovered.kills} elims`
              : "Did not play"}
          </div>
        </div>
      )}
    </div>
  )
}
