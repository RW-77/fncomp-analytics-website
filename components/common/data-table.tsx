"use client"
/* eslint-disable react-hooks/incompatible-library */

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  initialSorting?: SortingState
}

export function DataTable<TData, TValue>({
  columns,
  data,
  initialSorting = [],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])

  const table = useReactTable({
    data,
    columns,
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
    <div className="overflow-hidden rounded-md bg-[#141d30]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-[112px]">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Player Stats
            </div>
            <div className="mt-1 text-sm text-slate-300">
              <span className="font-semibold text-white tabular-nums">{rowCount}</span> results
            </div>
          </div>

          <Input
            placeholder="Search players..."
            value={(table.getColumn("player")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("player")?.setFilterValue(event.target.value)}
            className="h-9 max-w-md border-white/[0.08] bg-[#1c2942] text-slate-100 placeholder:text-slate-500 shadow-none focus-visible:border-sky-400/30 focus-visible:ring-sky-400/15"
          />
        </div>

        <ColumnManager table={table} />
      </div>

      <TooltipProvider delayDuration={200}>
      <Table className="w-auto table-fixed" containerClassName="max-h-[72vh] overflow-y-auto">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-white/[0.06] hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta
                const headerEl = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())
                const description = header.isPlaceholder ? undefined : meta?.description

                return (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#1c2942]/95 px-2 py-1 align-middle backdrop-blur supports-[backdrop-filter]:bg-[#1c2942]/85 first:pl-4 last:pr-4"
                  >
                    {description ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">{headerEl}</span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs rounded-lg border border-white/[0.08] bg-[#0f1729] p-4 text-left text-slate-300 shadow-xl"
                        >
                          <p className="text-sm font-semibold text-white">{meta?.label}</p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-300 [text-wrap:wrap]">
                            {description}
                          </p>
                          {meta?.advanced ? (
                            <p className="mt-2 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-[var(--accent-gold)]">
                              <span aria-hidden>*</span> Advanced metric
                            </p>
                          ) : null}
                          {/* Future: methodology/documentation link goes here */}
                          <p className="mt-2 text-xs text-slate-500 italic">Click to sort</p>
                        </TooltipContent>
                      </Tooltip>
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
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="border-white/[0.05] hover:bg-white/[0.03]"
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
      </TooltipProvider>
    </div>
  )
}
