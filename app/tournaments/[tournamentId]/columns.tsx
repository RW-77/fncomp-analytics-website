"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PlayerRow = {
  player: string
  epicId: string
} & Record<string, number>

function formatStatValue(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function SortableHeader({
  label,
  onClick,
  align = "left",
}: {
  label: string
  onClick: () => void
  align?: "left" | "right"
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "h-8 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 hover:bg-transparent hover:text-white",
        align === "right" ? "ml-auto w-full justify-end" : "-ml-2 justify-start"
      )}
    >
      {label}
      <ArrowUpDown className="size-3.5 text-slate-500" />
    </Button>
  )
}

export const columns: ColumnDef<PlayerRow>[] = [
  {
    accessorKey: "player",
    header: ({ column }) => (
      <SortableHeader
        label="Player"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
    header: ({ column }) => (
      <SortableHeader
        label="Eliminations"
        align="right"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-right font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "damageDealt",
    header: ({ column }) => (
      <SortableHeader
        label="Damage Dealt"
        align="right"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-right font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
  {
    accessorKey: "damageReceived",
    header: ({ column }) => (
      <SortableHeader
        label="Damage Received"
        align="right"
        onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-right font-medium text-slate-200 tabular-nums">
        {formatStatValue(getValue<number>())}
      </div>
    ),
  },
]
