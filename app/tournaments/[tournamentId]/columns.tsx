"use client"
 
import { ColumnDef } from "@tanstack/react-table"
 
// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type PlayerRow = {
  player: string
  epicId: string
} & Record<string, number>
 
export const columns: ColumnDef<PlayerRow>[] = [
  {
    accessorKey: "player",
    header: "Player",
    cell: ({ row }) => `${row.original.player} (${row.original.epicId})`,
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