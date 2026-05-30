"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useDebouncedCallback } from "use-debounce"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/common/data-table"
import { getFilteredStats } from "@/lib/actions"
import { cn } from "@/lib/utils"

import { columns, PlayerRow } from "./columns"

type CheckboxItem = {
  id: string
  label: string
}

interface DropDownMenuCheckboxesProps {
  title: string
  items: CheckboxItem[]
  selectedIds: string[]
  onSelectionChange: (selectedIds: string[]) => void
}

function formatFilterCount(selectedCount: number, totalCount: number) {
  return selectedCount === totalCount
    ? `All ${totalCount} selected`
    : `${selectedCount} of ${totalCount} selected`
}

export function DropdownMenuCheckboxes({
  title,
  items,
  selectedIds,
  onSelectionChange,
}: DropDownMenuCheckboxesProps) {
  const handleCheckedChange = (itemId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, itemId])
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== itemId))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-auto w-full justify-between rounded-xl border-white/10 bg-[#09111d] px-4 py-3 text-left shadow-none hover:bg-[#101a2d]"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              {title}
            </span>
            <span className="mt-1 block truncate text-sm font-medium text-slate-100">
              {formatFilterCount(selectedIds.length, items.length)}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 border-white/10 bg-[#0c1320] text-slate-100">
        <DropdownMenuLabel className="text-xs uppercase tracking-[0.18em] text-slate-400">
          {title}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/8" />
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.id}
            checked={selectedIds.includes(item.id)}
            className="py-2 text-sm text-slate-200 focus:bg-white/[0.06] focus:text-white"
            onCheckedChange={(checked) => handleCheckedChange(item.id, checked)}
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SliderRange({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
}: {
  label: string
  value: [number, number]
  onValueChange: (value: [number, number]) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}) {
  const formatValue = (amount: number) => (unit ? `${amount} ${unit}` : `${amount}`)

  return (
    <div className="w-full space-y-3 rounded-xl border border-white/8 bg-[#09111d] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {formatValue(min)} to {formatValue(max)}
          </div>
        </div>
        <div className="rounded-md border border-sky-400/15 bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-200 tabular-nums">
          {formatValue(value[0])} - {formatValue(value[1])}
        </div>
      </div>

      <Slider
        value={value}
        onValueChange={(newValue) => onValueChange(newValue as [number, number])}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />

      <div className="flex justify-between text-xs text-slate-500 tabular-nums">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  )
}

interface Props {
  matches: Array<{ id: string; label: string }>
  weapons: Array<{ id: string; label: string }>
  initialData: PlayerRow[]
}

export default function TournamentStatsClient({ matches, weapons, initialData }: Props) {
  const [selectedWeapons] = useState<string[]>(weapons.map((weapon) => weapon.id))
  const [selectedMatches, setSelectedMatches] = useState<string[]>(matches.map((match) => match.id))
  const [distanceRange, setDistanceRange] = useState<[number, number]>([0, 400])
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 30])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [data, setData] = useState<PlayerRow[]>(initialData)

  const fetchData = async (
    newMatches: string[] = selectedMatches,
    newWeapons: string[] = selectedWeapons,
    newDistance: [number, number] = distanceRange,
    newTime: [number, number] = timeRange
  ) => {
    const rows: PlayerRow[] = await getFilteredStats({
      selectedMatches: newMatches,
      weaponTypes: newWeapons,
      distanceRange: newDistance,
      timeRange: newTime,
    })
    setData(rows)
  }

  const handleMatchesChange = (newMatches: string[]) => {
    setSelectedMatches(newMatches)
    fetchData(newMatches, selectedWeapons, distanceRange, timeRange)
  }

  const debouncedFetchDistance = useDebouncedCallback((newDistance: [number, number]) => {
    fetchData(selectedMatches, selectedWeapons, newDistance, timeRange)
  }, 300)

  const debouncedFetchTime = useDebouncedCallback((newTime: [number, number]) => {
    fetchData(selectedMatches, selectedWeapons, distanceRange, newTime)
  }, 300)

  const handleDistanceChange = (newDistance: [number, number]) => {
    setDistanceRange(newDistance)
    debouncedFetchDistance(newDistance)
  }

  const handleTimeChange = (newTime: [number, number]) => {
    setTimeRange(newTime)
    debouncedFetchTime(newTime)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-white/8 bg-[#0b1321]/80 shadow-[0_20px_60px_rgba(2,6,23,0.24)]",
          filtersOpen ? "w-full max-w-[520px]" : "w-fit max-w-full"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
          className={cn(
            "flex h-auto items-center justify-between rounded-none px-4 py-3.5 text-left hover:bg-white/[0.02]",
            filtersOpen ? "w-full" : "w-auto min-w-[180px]"
          )}
        >
          <span className="text-sm font-medium text-slate-200">Filters</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-slate-500 transition-transform duration-200",
              filtersOpen && "rotate-180"
            )}
          />
        </Button>

        {filtersOpen && (
          <div className="border-t border-white/8 px-4 py-4">
            <div className="grid gap-3">
              <DropdownMenuCheckboxes
                title="Matches"
                items={matches}
                selectedIds={selectedMatches}
                onSelectionChange={handleMatchesChange}
              />

              {/* Temporarily hidden while weapon-group UX is being reworked. */}
              {/* <DropdownMenuCheckboxes
                title="Weapons"
                items={weapons}
                selectedIds={selectedWeapons}
                onSelectionChange={handleWeaponsChange}
              /> */}
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <SliderRange
                label="Distance"
                value={distanceRange}
                onValueChange={handleDistanceChange}
                min={0}
                max={400}
                step={5}
                unit="m"
              />
              <SliderRange
                label="Time Window"
                value={timeRange}
                onValueChange={handleTimeChange}
                min={0}
                max={30}
                step={0.5}
                unit="min"
              />
            </div>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        initialSorting={[{ id: "eliminations", desc: true }]}
      />
    </div>
  )
}
