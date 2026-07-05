"use client"

import { ColumnDef, RowData } from "@tanstack/react-table"
import {
  ArrowUpDown,
  Crosshair,
  HandHeart,
  Hammer,
  HeartPulse,
  type LucideIcon,
  PersonStanding,
  Percent,
  PieChart,
  RotateCcw,
  Scale,
  Shield,
  Skull,
  Sword,
  Target,
  Timer,
  User,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Display metadata for the column manager (label, category, help text, icon).
// Lives on TanStack's `column.meta` — the idiomatic home — and is read by both
// the header and the column-manager drawer.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label: string
    group?: string
    description?: string
    icon?: LucideIcon
  }
}

export type PlayerRow = {
  player: string
  epicId: string
  damageRatio: number | null
  accuracy: number | null
} & Record<string, number>

function formatStatValue(value: number | null | undefined) {
  // Guard against a column whose backing field isn't populated yet — the
  // `Record<string, number>` cast on PlayerRow lets that slip past the compiler,
  // so render a muted dash instead of crashing the whole table.
  if (value == null || Number.isNaN(value)) {
    return <span className="text-slate-500">—</span>
  }
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function formatDuration(value: number | null | undefined) {
  // Time alive is stored as seconds; render as e.g. "1 hr 36 min". Muted dash
  // when the backing field isn't populated (same guard as formatStatValue).
  if (value == null || Number.isNaN(value)) {
    return <span className="text-slate-500">—</span>
  }
  const total = Math.round(value)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) {
    return `${hours}hr ${minutes}min`
  }
  if (minutes > 0) {
    return `${minutes}min`
  }
  return `${total}sec`
}

function SortableHeader({
  label,
  onClick,
  align = "left",
  sorted = false,
}: {
  label: string
  onClick: () => void
  align?: "left" | "center" | "right"
  sorted?: false | "asc" | "desc"
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "h-auto min-h-8 gap-1 px-2 py-1 text-[14px] leading-tight tracking-tight whitespace-normal hover:bg-transparent",
        sorted
          ? "text-[var(--accent-gold)] hover:text-[var(--accent-gold)]"
          : "text-slate-400 hover:text-white",
        align === "right" ? "ml-auto w-full justify-end text-right" :
        align === "center" ? "w-full justify-center text-center" :
        "-ml-2 justify-start text-left"
      )}
    >
      <span>{label}</span>
      <ArrowUpDown
        className={cn("size-3.5 shrink-0", sorted ? "text-[var(--accent-gold)]" : "text-slate-500")}
      />
    </Button>
  )
}

export const columns: ColumnDef<PlayerRow>[] = [
  {
    accessorKey: "player",
    enableHiding: false,
    size: 190,
    meta: { label: "Player", description: "Player name.", icon: User },
    header: ({ column }) => (
      <SortableHeader
        label="Player"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[280px]" title={row.original.player}>
        <div className="truncate font-medium text-white">{row.original.player}</div>
      </div>
    ),
  },
  {
    accessorKey: "eliminations",
    meta: { label: "Elims", group: "Combat", description: "Total eliminations.", icon: Skull },
    header: ({ column }) => (
      <SortableHeader
        label="Elims"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "damageDealt",
    meta: { label: "DMG Dealt", group: "Damage", description: "Total damage dealt to opponents.", icon: Sword },
    header: ({ column }) => (
      <SortableHeader
        label="DMG Dealt"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "damageReceived",
    meta: { label: "DMG Received", group: "Damage", description: "Total damage taken.", icon: Shield },
    header: ({ column }) => (
      <SortableHeader
        label="DMG Received"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "damageRatio",
    meta: { label: "DMG Ratio", group: "Damage", description: "Damage dealt divided by damage received.", icon: Scale },
    header: ({ column }) => (
      <SortableHeader
        label="DMG Ratio"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      return (
        <div className="text-center font-medium text-slate-200 tabular-nums">
          {value === null ? <span className="text-slate-500">—</span> : value.toFixed(2)}
        </div>
      )
    },
  },
  {
    accessorKey: "shotsTaken",
    meta: { label: "Shots", group: "Accuracy", description: "Shots that landed on opponents.", icon: Crosshair },
    header: ({ column }) => (
      <SortableHeader
        label="Shots"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "damageContribution",
    meta: { label: "DMG Contribution", group: "Damage", description: "Player's share of the team's damage.", icon: PieChart },
    header: ({ column }) => (
      <SortableHeader
        label="DMG Contrib"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "assists",
    meta: { label: "Assists", group: "Combat", description: "Elimination assists.", icon: Users },
    header: ({ column }) => (
      <SortableHeader
        label="Assists"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "shotAttempts",
    meta: { label: "Shots Attempts", group: "Accuracy", description: "Total shots fired.", icon: Target },
    header: ({ column }) => (
      <SortableHeader
        label="Shot Attempts"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "accuracy",
    meta: { label: "Accuracy", group: "Accuracy", description: "Percentage of shots that landed.", icon: Percent },
    header: ({ column }) => (
      <SortableHeader
        label="Accuracy"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => {
      const value = getValue<number | null>()
      return (
        <div className="text-center font-medium text-slate-200 tabular-nums">
          {value === null ? <span className="text-slate-500">—</span> : `${value.toFixed(1)}%`}
        </div>
      )
    },
  },
  {
    accessorKey: "timeAlive",
    meta: { label: "Time Alive", group: "Utility", description: "Total time spent alive, summed across matches.", icon: Timer },
    header: ({ column }) => (
      <SortableHeader
        label="Time Alive"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatDuration(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "rebooted",
    meta: { label: "Rebooted", group: "Utility", description: "Times this player was rebooted back into the match.", icon: RotateCcw },
    header: ({ column }) => (
      <SortableHeader
        label="Rebooted"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "rebootedOthers",
    meta: { label: "Rebooted Others", group: "Utility", description: "Times this player rebooted a teammate.", icon: HeartPulse },
    header: ({ column }) => (
      <SortableHeader
        label="Rebooted Others"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "revived",
    meta: { label: "Revived", group: "Utility", description: "Times this player was revived from a knockdown.", icon: PersonStanding },
    header: ({ column }) => (
      <SortableHeader
        label="Revived"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "revivedOthers",
    meta: { label: "Revived Others", group: "Utility", description: "Times this player revived a knocked teammate.", icon: HandHeart },
    header: ({ column }) => (
      <SortableHeader
        label="Revived Others"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "buildsPlaced",
    meta: { label: "Builds Placed", group: "Utility", description: "Structures placed.", icon: Hammer },
    header: ({ column }) => (
      <SortableHeader
        label="Builds Placed"
        align="center"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        sorted={column.getIsSorted()}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-center font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
]
