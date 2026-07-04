"use client"

import { useState } from "react"
import { ChevronDown, Filter } from "lucide-react"
import { useDebouncedCallback } from "use-debounce"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/common/data-table"
import { getFilteredStats } from "@/lib/actions"

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
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border-0 bg-[#141d30] px-4 shadow-none hover:bg-[#1c2942] dark:bg-[#141d30] dark:hover:bg-[#1c2942]"
        >
          <Filter className="size-3.5 shrink-0 text-slate-500" />
          <span className="text-sm font-medium text-slate-200">{title}</span>
          <ChevronDown className="size-4 shrink-0 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      {/* Opens as an overlay so expanding the list never grows the page height. */}
      <DropdownMenuContent
        align="start"
        className="w-72 border-white/[0.08] bg-[#1f2c49] text-slate-100"
      >
        <DropdownMenuLabel className="text-xs font-medium text-slate-300">
          {formatFilterCount(selectedIds.length, items.length)}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/[0.08]" />
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
  return (
    <div>
      {/* Compact caption — kept small so the slider below is the dominant element. */}
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="text-xs tabular-nums text-slate-400">
          {value[0]}–{value[1]}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>

      {/* Rectangular (rounded-lg) track to match the other filter controls; tall
          so the slider dominates. Sky fill = selected range; full-height white
          vertical bars = draggable handles. No ring/shadow (they produced a stray
          light bar at the handle edge while dragging) — focus tints the handle. */}
      <SliderPrimitive.Root
        value={value}
        onValueChange={(newValue) => onValueChange(newValue as [number, number])}
        min={min}
        max={max}
        step={step}
        className="relative flex h-11 w-full touch-none items-center select-none rounded-lg border-x-[6px] border-transparent bg-[#141d30]"
      >
        <SliderPrimitive.Track className="relative h-full w-full grow overflow-hidden rounded-md bg-[#141d30]">
          <SliderPrimitive.Range className="absolute h-full bg-[#39496a]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={`${label} minimum`}
          className="block h-11 w-1.5 rounded-[2px] bg-white outline-none transition-colors focus-visible:bg-sky-200"
        />
        <SliderPrimitive.Thumb
          aria-label={`${label} maximum`}
          className="block h-11 w-1.5 rounded-[2px] bg-white outline-none transition-colors focus-visible:bg-sky-200"
        />
      </SliderPrimitive.Root>
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

  // Floating primary filters — all on one horizontal row (lg+), fixed-size and
  // left-aligned so they don't span the table width. Bottoms align so the
  // Matches pill and the two slider tracks share a baseline.
  const filters = (
    <div className="mb-2.5 flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="w-full lg:w-40 lg:shrink-0">
        <DropdownMenuCheckboxes
          title="Matches"
          items={matches}
          selectedIds={selectedMatches}
          onSelectionChange={handleMatchesChange}
        />
      </div>

      <div className="w-full lg:w-64 lg:shrink-0">
        <SliderRange
          label="Distance"
          value={distanceRange}
          onValueChange={handleDistanceChange}
          min={0}
          max={400}
          step={5}
          unit="m"
        />
      </div>

      <div className="w-full lg:w-64 lg:shrink-0">
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
  )

  return (
    <>
      {filters}
      <DataTable
        columns={columns}
        data={data}
        initialSorting={[{ id: "eliminations", desc: true }]}
      />
    </>
  )
}
