"use client"
// tournamentStatsClient.tsx
import { useState } from "react"
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

import { columns, PlayerRow } from "./columns"
import { getFilteredStats } from "@/lib/actions"


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
      onSelectionChange(selectedIds.filter(id => id !== itemId))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{title}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.id}
            checked={selectedIds.includes(item.id)}
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
  unit = ""
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
    <div className="w-full space-y-3">
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <Slider
        value={value}
        onValueChange={(newValue) => onValueChange(newValue as [number, number])}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
      <div className="flex justify-between text-sm font-medium">
        <span className="text-primary">{value[0]} {unit}</span>
        <span className="text-primary">{value[1]} {unit}</span>
      </div>
    </div>
  )
}

interface Props {
  matches: Array<{ id: string, label: string }>
  weapons: Array<{ id: string, label: string }>
  initialData: PlayerRow[]
}

export default function TournamentStatsClient({ 
  matches, 
  weapons, 
  initialData 
}: Props ) {
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>(weapons.map(m => m.id));
  const [selectedMatches, setSelectedMatches] = useState<string[]>(matches.map(m => m.id));
  const [distanceRange, setDistanceRange] = useState<[number, number]>([0, 400]);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 30]);
  const [data, setData] = useState<PlayerRow[]>(initialData)

  const fetchData = async (
    newMatches: string[] = selectedMatches,
    newWeapons: string[] = selectedWeapons,
    newDistance: [number, number] = distanceRange,
    newTime: [number, number] = timeRange
  ) => {

    console.log("Fetching data with filters:", {
      selectedMatches: newMatches,
      weaponTypes: newWeapons,
      distanceRange: newDistance,
      timeRange: newTime,
    })
    // simple server action call to fetch filtered stats
    const rows: PlayerRow[] = await getFilteredStats({
      selectedMatches: newMatches,
      weaponTypes: newWeapons,
      distanceRange: newDistance,
      timeRange: newTime,
    });
    setData(rows);
  };

  const handleMatchesChange = (newMatches: string[]) => {
    setSelectedMatches(newMatches)
    fetchData(newMatches, selectedWeapons, distanceRange, timeRange)
  };

  const handleWeaponsChange = (newWeapons: string[]) => {
    setSelectedWeapons(newWeapons)
    fetchData(selectedMatches, newWeapons, distanceRange, timeRange)
  };

  const debouncedFetchDistance = useDebouncedCallback((newDistance: [number, number]) => {
    fetchData(selectedMatches, selectedWeapons, newDistance, timeRange)
  }, 300);

  const debouncedFetchTime = useDebouncedCallback((newTime: [number, number]) => {
    fetchData(selectedMatches, selectedWeapons, distanceRange, newTime)
  }, 300);

  const handleDistanceChange = (newDistance: [number, number]) => {
    setDistanceRange(newDistance)
    debouncedFetchDistance(newDistance)
  };

  const handleTimeChange = (newTime: [number, number]) => {
    setTimeRange(newTime)
    debouncedFetchTime(newTime)
  };

  return (
    <div className="w-full space-y-6">
      <DropdownMenuCheckboxes 
        title="Select Matches"
        items={matches}
        selectedIds={selectedMatches}
        onSelectionChange={handleMatchesChange}
      />            
      <DropdownMenuCheckboxes
        title="Weapon Type"
        items={weapons}
        selectedIds={selectedWeapons}
        onSelectionChange={handleWeaponsChange}
      />            
      <SliderRange 
        label="Distance (meters)"
        value={distanceRange}
        onValueChange={handleDistanceChange}
        min={0}
        max={400}
        step={5}
        unit={"m"}
      />
      <SliderRange
        label="Time Window (minutes)"
        value={timeRange}
        onValueChange={handleTimeChange}
        min={0}
        max={30}
        step={0.5}
        unit={"min"}
      />
      <DataTable columns={columns} data={data} />
    </div>
  )
}
