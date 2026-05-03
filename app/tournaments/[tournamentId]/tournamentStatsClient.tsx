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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

  const selectionLabel =
    selectedIds.length === items.length
      ? `All ${items.length} selected`
      : `${selectedIds.length} of ${items.length} selected`

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
              {selectionLabel}
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
  return (
    <div className="w-full max-w-[420px] space-y-3 rounded-xl border border-white/8 bg-[#09111d] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {min}
            {unit} to {max}
            {unit}
          </div>
        </div>
        <div className="rounded-md border border-sky-400/15 bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-200 tabular-nums">
          {value[0]}
          {unit} - {value[1]}
          {unit}
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
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
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
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>(weapons.map((weapon) => weapon.id))
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

  const handleWeaponsChange = (newWeapons: string[]) => {
    setSelectedWeapons(newWeapons)
    fetchData(selectedMatches, newWeapons, distanceRange, timeRange)
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
    <div className="w-full space-y-5">
      <Card className="gap-0 border-white/8 bg-[#0b1321]/80 py-0 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <CardHeader className="gap-2 border-b border-white/8 px-5 py-4">
          <CardTitle className="text-base font-semibold text-white">Filters</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            Narrow the table without changing the underlying sorting or stat calculations.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 px-5 py-5">
          <div className="grid gap-3 lg:grid-cols-2">
            <DropdownMenuCheckboxes
              title="Matches"
              items={matches}
              selectedIds={selectedMatches}
              onSelectionChange={handleMatchesChange}
            />
            <DropdownMenuCheckboxes
              title="Weapons"
              items={weapons}
              selectedIds={selectedWeapons}
              onSelectionChange={handleWeaponsChange}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2 xl:justify-between">
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
              unit=" min"
            />
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={data} />
    </div>
  )
}
