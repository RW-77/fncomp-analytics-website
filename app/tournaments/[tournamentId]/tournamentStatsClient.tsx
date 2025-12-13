"use client"
// tournamentStatsClient.tsx
import { useState } from "react"
import * as React from "react"

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

import { columns } from "./columns"
import { getFilteredEliminations, getFilteredDamageDealt } from "@/lib/actions"
import { get } from "http"


type Checked = boolean | "indeterminate"

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
    <div className="w-[60%] space-y-3">
      <div className="text-sm font-medium">{label}</div>
      <Slider
        value={value}
        onValueChange={(newValue) => onValueChange(newValue as [number, number])}
        min={min}
        max={max}
        step={step}
      />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{value[0]} {unit}</span>
        <span>{value[1]} {unit}</span>
      </div>
    </div>
  )
}

interface Props {
  tournamentId: string
  matches: Array<{ id: string, label: string }>
  weapons: Array<{ id: string, label: string }>
  initialData: any[]
}

export default function TournamentStatsClient({ tournamentId, matches, weapons, initialData }: Props) {
  const [selectedMatches, setSelectedMatches] = useState<string[]>(matches.map(m => m.id));
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>(weapons.map(m => m.id));
  const [distanceRange, setDistanceRange] = useState<[number, number]>([0, 400]);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 25]);
  const [data, setData] = useState<any[]>(initialData)

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
    
    const [elimResults, damageResults] = await Promise.all([
      getFilteredEliminations({
        selectedMatches: newMatches,
        weaponTypes: newWeapons,
        distanceRange: newDistance,
        timeRange: newTime,
      }),
      getFilteredDamageDealt({
        selectedMatches: newMatches,
        weaponTypes: newWeapons,
        distanceRange: newDistance,
        timeRange: newTime,
      })
    ])

    console.log("Eliminations results length:", elimResults?.length)
    console.log("Damage results length:", damageResults?.length)

    // Merge: create a map with elim + damage data
    const playerMap = new Map<string, any>();
    
    // Add eliminations
    elimResults?.forEach(stat => {
      playerMap.set(stat.player, { ...stat, damageDealt: 0 });
    });
    
    // Add/merge damage
    damageResults?.forEach(stat => {
      const existing = playerMap.get(stat.player);
      if (existing) {
        existing.damageDealt = stat.damageDealt;
      } else {
        playerMap.set(stat.player, stat);
      }
    });

    const mergedData = Array.from(playerMap.values());
    console.log("Merged data length:", mergedData.length)
    setData(mergedData)
  }

  const handleMatchesChange = (newMatches: string[]) => {
    setSelectedMatches(newMatches)
    fetchData(newMatches, selectedWeapons, distanceRange, timeRange)
  }

  const handleWeaponsChange = (newWeapons: string[]) => {
    setSelectedWeapons(newWeapons)
    fetchData(selectedMatches, newWeapons, distanceRange, timeRange)
  }

  const handleDistanceChange = (newDistance: [number, number]) => {
    setDistanceRange(newDistance)
    fetchData(selectedMatches, selectedWeapons, newDistance, timeRange)
  }

  const handleTimeChange = (newTime: [number, number]) => {
    setTimeRange(newTime)
    fetchData(selectedMatches, selectedWeapons, distanceRange, newTime)
  }

  return (
    <div className="space-y-6">
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
        label="Time Window (seconds)"
        value={timeRange}
        onValueChange={handleTimeChange}
        min={0}
        max={26.5}
        step={0.5}
        unit={"min"}
      />
      <DataTable columns={columns} data={data} />
    </div>
  )
}