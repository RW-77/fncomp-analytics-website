'use client'

import type { AssetStatus } from '@/lib/replay/engine'
import type { EventType, NumberedEngagement } from '@/lib/replay/engagements'
import { EngagementList } from '@/components/replay/engagement-list'
import { EventTypeFilter, type EventTypeOption } from '@/components/replay/event-type-filter'
import { LoadNote } from '@/components/replay/load-state'
import { EventsSkeleton } from '@/components/replay/workspace-layout'

// The left panel's events: the type filter, then the events in time order.
// On wide screens only the list scrolls.
export function EventsPanel({
  status,
  onRetry,
  items,
  typeOptions,
  hiddenTypes,
  onHiddenTypesChange,
  selectedId,
  perspectiveTeamId,
  teamRosters,
  onSelect,
}: {
  status: AssetStatus                  // the engagements file's
  onRetry: () => void
  items: NumberedEngagement[]          // what's shown (after the type filter)
  typeOptions: EventTypeOption[]
  hiddenTypes: EventType[]
  onHiddenTypesChange: (hidden: EventType[]) => void
  selectedId: number | null
  perspectiveTeamId: number | null
  teamRosters: Record<number, string[]>
  onSelect: (id: number) => void
}) {
  if (status === 'loading') return <EventsSkeleton />

  return (
    <>
      {status === 'ready' && (
        <div className="px-3 pt-3">
          <EventTypeFilter types={typeOptions} hidden={hiddenTypes} onChange={onHiddenTypesChange} />
        </div>
      )}
      <h2 className="flex items-baseline justify-between px-4 pb-1 pt-3.5 text-sm font-bold text-white">
        Events {status === 'ready' && <span className="font-medium tabular-nums text-slate-500">{items.length}</span>}
      </h2>
      <div className="pb-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-0">
        {status === 'ready' ? (
          <EngagementList
            items={items}
            selectedId={selectedId}
            perspectiveTeamId={perspectiveTeamId}
            teamRosters={teamRosters}
            onSelect={onSelect}
          />
        ) : status === 'missing' ? (
          <LoadNote className="px-4 py-3">No events for this match yet.</LoadNote>
        ) : (
          <LoadNote className="px-4 py-3" onRetry={onRetry}>Couldn&apos;t load the events.</LoadNote>
        )}
      </div>
    </>
  )
}
