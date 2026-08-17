"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Flag } from "@/components/common/flag"
import { cn } from "@/lib/utils"

// One teammate's identity for rendering a flag next to their name.
export type TeamPlayer = {
  epicId: string
  name: string
  // Raw fnapi flag token (or null); the Flag component maps it to an icon.
  flag: string | null
}

export type LeaderboardRow = {
  // Stable identity for row selection; carried on the row, not rendered.
  teamId: string
  rank: number
  // Joined in-game display names ("A & B & C"). Also the search/filter value.
  team: string
  // Per-teammate identities for the Team cell's flags. Empty when the window
  // has no leaderboard player rows (e.g. all members privacy-hidden).
  players: TeamPlayer[]
  points: number
  matches: number
  wins: number
  kills: number
}

function SortableHeader({
  label,
  onClick,
  sorted = false,
}: {
  label: string
  onClick: () => void
  sorted?: false | "asc" | "desc"
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "h-auto min-h-8 w-full justify-center gap-1 px-2 py-1 text-center text-[14px] leading-tight tracking-tight whitespace-normal hover:bg-transparent",
        sorted
          ? "text-[var(--accent-gold)] hover:text-[var(--accent-gold)]"
          : "text-slate-400 hover:text-white"
      )}
    >
      <span>{label}</span>
      <ArrowUpDown
        className={cn("size-3.5 shrink-0", sorted ? "text-[var(--accent-gold)]" : "text-slate-500")}
      />
    </Button>
  )
}

function StatCell({ value }: { value: number }) {
  return (
    <div className="text-center font-medium text-slate-200 tabular-nums">
      {value.toLocaleString()}
    </div>
  )
}

export const leaderboardColumns: ColumnDef<LeaderboardRow>[] = [
  {
    accessorKey: "rank",
    enableSorting: false,
    size: 56,
    header: () => <div className="px-2 text-left text-[14px] text-slate-400">#</div>,
    cell: ({ row }) => (
      <div className="pl-2 font-semibold tabular-nums text-slate-400">{row.original.rank}</div>
    ),
  },
  {
    accessorKey: "team",
    enableSorting: false,
    meta: { label: "Team", flex: true },
    header: () => <div className="px-2 text-left text-[14px] text-slate-400">Team</div>,
    cell: ({ row }) => (
      <div className="min-w-0 truncate font-medium text-white" title={row.original.team}>
        {row.original.players.length > 0
          ? row.original.players.map((p, i) => (
              <span key={p.epicId} className="whitespace-nowrap">
                {i > 0 && <span className="text-slate-500"> &amp; </span>}
                <Flag token={p.flag} className="mx-1 align-[0.0em]" />
                {p.name}
              </span>
            ))
          : row.original.team}
      </div>
    ),
  },
  {
    accessorKey: "points",
    size: 96,
    // Break points ties by total eliminations (higher = better), matching the
    // official leaderboard order and how the standings rank is computed.
    sortingFn: (a, b) =>
      a.original.points - b.original.points ||
      a.original.kills - b.original.kills,
    header: ({ column }) => (
      <SortableHeader
        label="Points"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => <StatCell value={getValue<number>()} />,
  },
  {
    accessorKey: "matches",
    size: 96,
    header: ({ column }) => (
      <SortableHeader
        label="Matches"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => <StatCell value={getValue<number>()} />,
  },
  {
    accessorKey: "wins",
    size: 88,
    header: ({ column }) => (
      <SortableHeader
        label="Wins"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => <StatCell value={getValue<number>()} />,
  },
  {
    accessorKey: "kills",
    size: 88,
    header: ({ column }) => (
      <SortableHeader
        label="Kills"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => <StatCell value={getValue<number>()} />,
  },
]
