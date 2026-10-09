'use client'

import { useEffect, useRef, useState } from 'react'
import ReplayClient from '@/app/replay/replay-client'
import type { ReplayEngine } from '@/lib/replay/engine'
import type { EngagementOverlay } from '@/lib/replay/engagements'
import type { ReplayMapDefinition } from '@/lib/replay/map-projection'
import { CenteredStatus } from '@/components/replay/load-state'

// The replay area: measures its box and gives the replay that size (the
// canvas needs pixel dimensions). Says so when the match has no map.
export function ReplayStage({
  engine,
  mapDefinition,
  mapImageUrl,
  onPlayerClick,
  engagements,
  selectedEngagementId,
  onEngagementClick,
  onFollowChange,
}: {
  engine: ReplayEngine
  mapDefinition: ReplayMapDefinition | null
  mapImageUrl: string | null
  onPlayerClick: (playerId: string) => void
  engagements: EngagementOverlay[]
  selectedEngagementId: number | null
  onEngagementClick: (id: number) => void
  onFollowChange: (playerIds: string[] | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect
      setSize({ width: Math.round(box.width), height: Math.round(box.height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="size-full overflow-hidden bg-[var(--panel)]">
      {!mapDefinition || !mapImageUrl ? (
        <CenteredStatus>This match&apos;s map isn&apos;t available, so its replay can&apos;t be shown.</CenteredStatus>
      ) : size.width > 0 && size.height > 0 ? (
        <ReplayClient
          engine={engine}
          mapDefinition={mapDefinition}
          mapImageUrl={mapImageUrl}
          stageWidth={size.width}
          stageHeight={size.height}
          onPlayerClick={onPlayerClick}
          engagements={engagements}
          selectedEngagementId={selectedEngagementId}
          onEngagementClick={onEngagementClick}
          onFollowChange={onFollowChange}
        />
      ) : (
        // the first frame, before the box is measured
        <CenteredStatus loading>Loading map…</CenteredStatus>
      )}
    </div>
  )
}
