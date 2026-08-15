"use client"
/* eslint-disable react-hooks/incompatible-library */

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { ColumnManager } from "@/components/common/column-manager"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

type DataTableRowProps<TData> = {
  row: Row<TData>
  isSelected: boolean
  onRowClick?: (row: TData) => void
}

function DataTableRowImpl<TData>({ row, isSelected, onRowClick }: DataTableRowProps<TData>) {
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
      className={cn(
        "border-white/[0.05] hover:bg-white/[0.03]",
        onRowClick && "cursor-pointer",
        isSelected && "bg-[var(--accent-gold)]/[0.10] hover:bg-[var(--accent-gold)]/[0.14]"
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className="truncate px-2 py-2.5 text-sm text-slate-300 first:pl-4 last:pr-4"
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

// React.memo erases the generic call signature, so cast it back to the original
// generic function type (TData still infers from props at each call site). With
// this, a selection change re-renders only the rows whose `isSelected` flipped —
// provided `onRowClick` is referentially stable (see the leaderboard call site).
const DataTableRow = React.memo(DataTableRowImpl) as typeof DataTableRowImpl

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  initialSorting?: SortingState
  label?: string
  showResultsCount?: boolean
  searchColumnId?: string
  searchPlaceholder?: string
  showColumnManager?: boolean
  fullWidth?: boolean
  // Fill the parent's height and let the row area scroll within it, instead of
  // the default self-sizing card capped at max-h-[72vh]. Used where the table
  // shares a fixed-height row with a sibling (see the leaderboard).
  fillHeight?: boolean
  getRowId?: (row: TData) => string
  selectedRowId?: string
  onRowClick?: (row: TData) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  initialSorting = [],
  label,
  showResultsCount = true,
  searchColumnId = "player",
  searchPlaceholder = "Search players...",
  showColumnManager = true,
  fullWidth = false,
  fillHeight = false,
  getRowId,
  selectedRowId,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])

  const table = useReactTable({
    data,
    columns,
    getRowId,
    defaultColumn: { size: 88 },
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
    },
  })

  const rowCount = table.getFilteredRowModel().rows.length

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md bg-[#141d30]",
        fillHeight && "lg:flex lg:h-full lg:min-h-0 lg:flex-col"
      )}
    >
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {(label || showResultsCount) && (
            <div className="min-w-[112px]">
              {label && (
                <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  {label}
                </div>
              )}
              {showResultsCount && (
                <div className={`text-sm text-slate-300${label ? " mt-1" : ""}`}>
                  <span className="font-semibold text-white tabular-nums">{rowCount}</span> results
                </div>
              )}
            </div>
          )}

          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchColumnId)?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn(searchColumnId)?.setFilterValue(event.target.value)}
            className="h-9 max-w-md border-white/[0.08] bg-[#1c2942] text-slate-100 placeholder:text-slate-500 shadow-none focus-visible:border-sky-400/30 focus-visible:ring-sky-400/15"
          />
        </div>

        {showColumnManager && <ColumnManager table={table} />}
      </div>

      <Table
        className={cn("table-fixed", fullWidth ? "w-full" : "w-auto")}
        containerClassName={cn(
          "max-h-[72vh] overflow-y-auto",
          fillHeight && "lg:max-h-none lg:min-h-0 lg:flex-1"
        )}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-white/[0.06] hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta
                const headerEl = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())
                const description = header.isPlaceholder ? undefined : meta?.description

                // Shared card body (title + description + optional advanced note),
                // reused whether or not the card links out to docs.
                const cardBody = description ? (
                  <>
                    <p className="text-sm font-semibold text-white">{meta?.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300 [text-wrap:wrap]">
                      {description}
                    </p>
                    {meta?.advanced ? (
                      <p className="mt-2 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-[var(--accent-gold)]">
                        <span aria-hidden>*</span> Advanced metric
                      </p>
                    ) : null}
                  </>
                ) : null

                return (
                  <TableHead
                    key={header.id}
                    style={meta?.flex ? undefined : { width: header.getSize() }}
                    className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#1c2942]/95 px-2 py-1 align-middle backdrop-blur supports-[backdrop-filter]:bg-[#1c2942]/85 first:pl-4 last:pr-4"
                  >
                    {description ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span className="inline-flex">{headerEl}</span>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="top"
                          className="max-w-xs rounded-lg border border-white/[0.08] bg-[#0f1729] p-0 text-left text-slate-300 shadow-xl"
                        >
                          {meta?.docHref ? (
                            <Link
                              href={meta.docHref}
                              className="block rounded-lg p-4 transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none"
                            >
                              {cardBody}
                              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-sky-400">
                                View documentation
                                <ArrowUpRight className="size-3.5" />
                              </p>
                            </Link>
                          ) : (
                            <div className="p-4">
                              {cardBody}
                              <p className="mt-2 text-xs text-slate-500 italic">Click to sort</p>
                            </div>
                          )}
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      headerEl
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <DataTableRow
                key={row.id}
                row={row}
                isSelected={selectedRowId !== undefined && row.id === selectedRowId}
                onRowClick={onRowClick}
              />
            ))
          ) : (
            <TableRow className="border-white/[0.05] hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-24 px-4 text-center text-sm text-slate-400"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
