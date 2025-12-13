"use client"
 
import { ColumnDef } from "@tanstack/react-table"
 
// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type PlayerStat = {
  player: string
  eliminations: number
  damageDealt: number
}
 
export const columns: ColumnDef<PlayerStat>[] = [
  {
    accessorKey: "player",
    header: "Player",
  },
  {
    accessorKey: "eliminations",
    header: "Eliminations",
  },
  {
    accessorKey: "damageDealt",
    header: "Damage Dealt",
  },
]