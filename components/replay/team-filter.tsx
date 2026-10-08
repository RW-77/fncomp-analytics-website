'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { panelFont } from '@/components/replay/panel-font'

export type TeamOption = {
  id: number
  label: string            // "player + player"
  engagementCount: number
  placement?: number       // where the team finished, from the leaderboard
}

// "Viewing as": picks the team whose perspective the page shows. A button that
// opens a searchable list of teams; search matches player names.
export function TeamFilter({
  teams,
  totalEngagements,
  value,
  onChange,
}: {
  teams: TeamOption[]                  // teams that appear in at least one fight
  totalEngagements: number             // for the "All teams" option
  value: number | null                 // selected team id, or null for all teams
  onChange: (teamId: number | null) => void
}) {
  // Whether the list is open. Only this component cares, so the state lives here.
  const [open, setOpen] = useState(false)
  const current = value === null ? null : (teams.find((t) => t.id === value) ?? null)

  const pick = (teamId: number | null) => {
    onChange(teamId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Radix adds aria-expanded / aria-controls to the trigger itself. */}
        {/* Sits in the panel's Viewing-as band, so it has no box of its own.
            The team in the site's gold accent, and the boxed up/down icon,
            mark it as something to click. */}
        <button type="button" className="group flex w-full items-center gap-2.5 text-left">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-xs text-slate-400">Viewing as</span>
            <span className="text-[17px] font-bold leading-snug text-[var(--accent-gold)] [overflow-wrap:anywhere] group-hover:text-[var(--accent-gold-strong)]">
              {current ? current.label : 'All teams'}
            </span>
          </span>
          <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-[var(--panel-control)] text-[var(--accent-gold)] group-hover:border-[var(--accent-gold)]/60">
            <ChevronsUpDown className="size-4" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-72 rounded-sm p-0 font-medium', panelFont.className)}>
        <Command className="rounded-sm">
          <CommandInput placeholder="Search players…" />
          <CommandList>
            <CommandEmpty>No team has a player by that name.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="All teams" onSelect={() => pick(null)}>
                <span className="flex-1">All teams</span>
                <span className="text-xs tabular-nums text-slate-500">{totalEngagements}</span>
                <Check className={cn('size-4', value === null ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>
              {teams.map((t) => (
                // value is what the search box matches against; the id keeps it unique.
                <CommandItem key={t.id} value={`${t.label} #${t.id}`} onSelect={() => pick(t.id)}>
                  <span className="w-7 shrink-0 text-xs tabular-nums text-slate-500" title="Placement">
                    {t.placement !== undefined ? `#${t.placement}` : ''}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                  <span className="text-xs tabular-nums text-slate-500">{t.engagementCount}</span>
                  <Check className={cn('size-4', value === t.id ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
