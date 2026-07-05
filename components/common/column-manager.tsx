"use client"

import * as React from "react"
import type { Column, Table } from "@tanstack/react-table"
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Info, Lock, Search, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

function labelOf<TData>(column: Column<TData, unknown>): string {
  return column.columnDef.meta?.label ?? column.id
}

const ctlBtn =
  "h-8 border-white/[0.08] bg-[#1c2942] text-xs text-slate-200 shadow-none hover:bg-[#26354f] dark:bg-[#1c2942] dark:hover:bg-[#26354f]"

export function ColumnManager<TData>({ table }: { table: Table<TData> }) {
  const [mode, setMode] = React.useState<"toggle" | "reorder">("toggle")
  const [query, setQuery] = React.useState("")

  const visibleCount = table.getVisibleLeafColumns().length
  const totalCount = table.getAllLeafColumns().length

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="border-0 bg-[#e3c97e] font-semibold text-[#20180a] shadow-none hover:bg-[#ecd699] dark:bg-[#e3c97e] dark:hover:bg-[#ecd699]"
        >
          <SlidersHorizontal className="size-4" />
          Columns
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-white/[0.06] bg-[#141d30] p-0 text-slate-100 sm:max-w-[420px]"
      >
        <SheetHeader className="gap-1 px-5 pt-5 pb-3">
          <SheetTitle className="text-lg font-semibold text-white">Columns</SheetTitle>
          <SheetDescription className="text-slate-400">
            {visibleCount} of {totalCount} shown
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 pb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.toggleAllColumnsVisible(true)}
              className={ctlBtn}
            >
              Show all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.toggleAllColumnsVisible(false)}
              className={ctlBtn}
            >
              Hide all
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={mode === "reorder"}
              onClick={() => setMode((m) => (m === "reorder" ? "toggle" : "reorder"))}
              className={cn(
                "ml-auto h-8 border-white/[0.08] text-xs shadow-none",
                mode === "reorder"
                  ? "bg-sky-500/15 text-sky-200 hover:bg-sky-500/20 dark:bg-sky-500/15 dark:hover:bg-sky-500/20"
                  : "bg-[#1c2942] text-slate-200 hover:bg-[#26354f] dark:bg-[#1c2942] dark:hover:bg-[#26354f]"
              )}
            >
              Reorder
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search columns…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 border-white/[0.08] bg-[#0b1220] pl-9 text-slate-100 placeholder:text-slate-500 shadow-none focus-visible:border-sky-400/30 focus-visible:ring-sky-400/15 dark:bg-[#0b1220]"
            />
          </div>
        </div>

        <TooltipProvider delayDuration={200}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {mode === "toggle" ? (
              <ToggleList table={table} query={query.trim().toLowerCase()} />
            ) : (
              <ReorderList table={table} query={query.trim().toLowerCase()} />
            )}
          </div>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Toggle mode — grouped checkboxes (visibility)
// ---------------------------------------------------------------------------

function ToggleList<TData>({ table, query }: { table: Table<TData>; query: string }) {
  const matches = (label: string) => label.toLowerCase().includes(query)

  const pinned = table
    .getAllColumns()
    .filter((c) => !c.getCanHide() && matches(labelOf(c)))

  // Group hideable columns by meta.group, preserving first-appearance order.
  const groups: { name: string; columns: Column<TData, unknown>[] }[] = []
  const index = new Map<string, number>()
  for (const column of table.getAllColumns()) {
    if (!column.getCanHide() || !matches(labelOf(column))) continue
    const name = column.columnDef.meta?.group ?? "Other"
    if (!index.has(name)) {
      index.set(name, groups.length)
      groups.push({ name, columns: [] })
    }
    groups[index.get(name)!].columns.push(column)
  }

  if (pinned.length === 0 && groups.length === 0) {
    return <p className="px-2 text-sm text-slate-500">No matching columns.</p>
  }

  return (
    <div className="space-y-5">
      {pinned.length > 0 && (
        <div className="space-y-0.5">
          {pinned.map((column) => {
            const Icon = column.columnDef.meta?.icon
            return (
              <div
                key={column.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-slate-400"
              >
                <Lock className="size-3.5 shrink-0 text-slate-600" />
                {Icon ? <Icon className="size-4 shrink-0 text-slate-500" /> : null}
                <span className="text-sm">{labelOf(column)}</span>
                <span className="ml-auto text-[11px] text-slate-600">pinned</span>
              </div>
            )
          })}
        </div>
      )}

      {groups.map((group) => (
        <div key={group.name} className="space-y-0.5">
          <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
            {group.name}
          </div>
          {group.columns.map((column) => (
            <ColumnToggleRow key={column.id} column={column} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ColumnToggleRow<TData>({ column }: { column: Column<TData, unknown> }) {
  const Icon = column.columnDef.meta?.icon
  const description = column.columnDef.meta?.description
  const id = `col-toggle-${column.id}`

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#1c2942]">
      <Checkbox
        id={id}
        checked={column.getIsVisible()}
        onCheckedChange={(v) => column.toggleVisibility(!!v)}
        className="size-4 border-white/25 shadow-none data-[state=checked]:border-sky-500 data-[state=checked]:bg-sky-500 data-[state=checked]:text-white"
      />
      {Icon ? <Icon className="size-4 shrink-0 text-slate-400" /> : null}
      <label htmlFor={id} className="flex-1 cursor-pointer text-sm text-slate-200 select-none">
        {labelOf(column)}
      </label>
      {description ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-slate-500 transition-colors hover:text-slate-300 focus-visible:text-sky-300 focus-visible:outline-none"
              aria-label={`About ${labelOf(column)}`}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="left"
            className="max-w-56 border border-white/[0.08] bg-[#1f2c49] text-slate-100"
          >
            {description}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reorder mode — flat drag-and-drop list of visible columns
// ---------------------------------------------------------------------------

function ReorderList<TData>({ table, query }: { table: Table<TData>; query: string }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const order = table.getState().columnOrder.length
    ? table.getState().columnOrder
    : table.getAllLeafColumns().map((c) => c.id)

  const reorderable = table.getVisibleLeafColumns().filter((c) => c.getCanHide())
  const shown = query
    ? reorderable.filter((c) => labelOf(c).toLowerCase().includes(query))
    : reorderable
  const items = shown.map((c) => c.id)

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    table.setColumnOrder(arrayMove(order, from, to))
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">
          Reorder columns{query ? "" : ` (${reorderable.length})`}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">Drag the handle to change column order.</p>
      </div>

      {shown.length === 0 ? (
        <p className="px-2 text-sm text-slate-500">No matching columns.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {shown.map((column) => (
                <SortableRow
                  key={column.id}
                  id={column.id}
                  label={labelOf(column)}
                  Icon={column.columnDef.meta?.icon}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function SortableRow({
  id,
  label,
  Icon,
}: {
  id: string
  label: string
  Icon?: React.ComponentType<{ className?: string }>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg bg-[#1c2942] px-3 py-2.5",
        isDragging && "relative z-10 shadow-lg ring-1 ring-sky-400/30"
      )}
    >
      <button
        type="button"
        aria-label={`Drag ${label}`}
        className="cursor-grab touch-none text-slate-500 transition-colors hover:text-slate-300 focus-visible:text-sky-300 focus-visible:outline-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      {Icon ? <Icon className="size-4 shrink-0 text-slate-400" /> : null}
      <span className="text-sm text-slate-200">{label}</span>
    </div>
  )
}
