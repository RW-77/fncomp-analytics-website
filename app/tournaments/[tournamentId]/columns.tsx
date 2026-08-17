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
import { Flag } from "@/components/common/flag"
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
    // Flags a derived/composite metric (vs. a raw count) so the header renders a
    // gold asterisk and the tooltip an "Advanced metric" line.
    advanced?: boolean
    // Fumadocs page explaining this stat, e.g. "/docs/accuracy". When set, the
    // header hover-card becomes a link to it. Omit for stats without a doc page.
    docHref?: string
    // Give this column no fixed width so it absorbs the table's remaining space
    // (used with the table's `fullWidth` mode).
    flex?: boolean
  }
}

export type PlayerRow = {
  player: string
  epicId: string
  // Raw fnapi flag token (e.g. "GroupIdentity_GeoIdentity_mexico") or null; the
  // Flag component maps it to an icon. null renders no flag.
  country: string | null
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
  advanced = false,
}: {
  label: string
  onClick: () => void
  align?: "left" | "center" | "right"
  sorted?: false | "asc" | "desc"
  advanced?: boolean
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
      <span>
        {label}
        {advanced && (
          <sup
            aria-hidden
            className="ml-0.5 align-super text-[0.7em] font-semibold text-[var(--accent-gold)]"
          >
            *
          </sup>
        )}
      </span>
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
      <div className="flex min-w-0 max-w-[280px] items-center gap-2" title={row.original.player}>
        <Flag token={row.original.country} className="shrink-0" />
        <span className="truncate font-medium text-white">{row.original.player}</span>
      </div>
    ),
  },
  {
    accessorKey: "eliminations",
    meta: { label: "Elims", group: "Combat", description: "Total eliminations.", icon: Skull, docHref: "/docs/basic-statistics" },
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
    meta: { label: "DMG Dealt", group: "Damage", description: "Total damage dealt to opponents.", icon: Sword, docHref: "/docs/basic-statistics" },
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
    meta: { label: "DMG Received", group: "Damage", description: "Total damage taken.", icon: Shield, docHref: "/docs/basic-statistics" },
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
    meta: { label: "DMG Ratio", group: "Damage", description: "Damage dealt divided by damage received.", icon: Scale, docHref: "/docs/basic-statistics" },
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
    meta: { label: "Shots", group: "Accuracy", description: "Total shots taken.", icon: Crosshair, docHref: "/docs/basic-statistics" },
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
    meta: {
      label: "DMG Contribution",
      group: "Damage",
      description: "Total damage contribution onto team eliminations.",
      icon: PieChart,
      advanced: true,
      docHref: "/docs/dce",
    },
    header: ({ column }) => (
      <SortableHeader
        label="DMG Contrib"
        align="center"
        advanced={column.columnDef.meta?.advanced}
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
    meta: {
      label: "Assists",
      group: "Combat",
      description: "Assists onto team eliminations.",
      icon: Users,
      advanced: true,
      docHref: "/docs/assists"
    },
    header: ({ column }) => (
      <SortableHeader
        label="Assists"
        align="center"
        advanced={column.columnDef.meta?.advanced}
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
    meta: {
      label: "Shots Attempts",
      group: "Accuracy",
      description: "Total shots attempted onto exposed enemy players.",
      icon: Target,
      advanced: true,
      docHref: "/docs/shot-attempts",
    },
    header: ({ column }) => (
      <SortableHeader
        label="Shot Attempts"
        align="center"
        advanced={column.columnDef.meta?.advanced}
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
    meta: {
      label: "Accuracy",
      group: "Accuracy",
      description: "Percentage of shots that landed.",
      icon: Percent,
      advanced: true,
      docHref: "/docs/accuracy",
    },
    header: ({ column }) => (
      <SortableHeader
        label="Accuracy"
        align="center"
        advanced={column.columnDef.meta?.advanced}
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
    meta: { label: "Time Alive", group: "Utility", description: "Total time spent alive, summed across matches.", icon: Timer, docHref: "/docs/basic-statistics" },
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
    accessorKey: "buildsPlaced",
    meta: { label: "Builds Placed", group: "Utility", description: "Structures placed.", icon: Hammer, docHref: "/docs/basic-statistics" },
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
  {
    accessorKey: "rebooted",
    meta: { label: "Rebooted", group: "Utility", description: "Times this player was rebooted back into the match.", icon: RotateCcw, docHref: "/docs/basic-statistics" },
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
    meta: { label: "Rebooted Others", group: "Utility", description: "Times this player rebooted a teammate.", icon: HeartPulse, docHref: "/docs/basic-statistics" },
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
    meta: { label: "Revived", group: "Utility", description: "Times this player was revived from a knockdown.", icon: PersonStanding, docHref: "/docs/basic-statistics" },
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
    meta: { label: "Revived Others", group: "Utility", description: "Times this player revived a knocked teammate.", icon: HandHeart, docHref: "/docs/basic-statistics" },
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
]
