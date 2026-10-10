'use client'

// ---------------------------------------------------------------------------
// React hooks for the replay engine (lib/replay/engine.ts).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  ReplayEngine,
  type AssetStatus,
  type InventoryItem,
  type MatchTotals,
  type ReplaySnapshot,
} from '@/lib/replay/engine'
import type { MatchMetadata } from '@/lib/replay/match-data'

// A file-backed value: its data once loaded, otherwise why there isn't any.
// One variant per status, so checking them in turn narrows to 'ready'.
export type Loadable<T> =
  | { status: 'ready'; data: T }
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }

// TypeScript can't split `{ status }` over the union's variants by itself.
function notReady(status: Exclude<AssetStatus, 'ready'>): Loadable<never> {
  return { status } as Loadable<never>
}

// Creates the engine for a match and runs it while the component is mounted.
// A different metadata object makes a new engine (and stops the old one).
export function useReplayEngine(metadata: MatchMetadata): ReplayEngine {
  // Creating the engine does nothing yet (no fetches, no loop) ...
  const engine = useMemo(() => new ReplayEngine(metadata), [metadata])
  // ... start() and stop() do, so they belong in an effect.
  useEffect(() => {
    engine.start()
    return () => engine.stop()
  }, [engine])
  return engine
}

// Reads part of the engine's snapshot and re-renders the component only when
// that part changes. `select` must return either a plain value (number,
// string, boolean) or an object that's already in the snapshot, never a new
// object built on the spot, or React would see a "change" on every check:
//
//   useReplay(engine, (s) => s.paused)             fine
//   useReplay(engine, (s) => Math.floor(s.time))   fine (a number)
//   useReplay(engine, (s) => s.vitals[id])         fine (kept while unchanged)
//   useReplay(engine, (s) => ({ t: s.time }))      wrong (new object each time)
export function useReplay<T>(engine: ReplayEngine, select: (snapshot: ReplaySnapshot) => T): T {
  const read = () => select(engine.getSnapshot())
  // subscribe: how React hears about changes. read: how it gets the value.
  // The third argument is for server rendering, where it's the same thing.
  return useSyncExternalStore(engine.subscribe, read, read)
}

// A player's inventory at the current replay time, recomputed when the time
// (0.1 s steps) or the inventory's status changes.
export function useInventory(engine: ReplayEngine, playerId: string): Loadable<InventoryItem[]> {
  const time = useReplay(engine, (s) => s.time)
  const status = useReplay(engine, (s) => s.inventory)
  return useMemo(
    (): Loadable<InventoryItem[]> =>
      status === 'ready' ? { status, data: engine.inventoryAt(playerId, time) } : notReady(status),
    [engine, playerId, time, status],
  )
}

// Whole-match totals at the current replay time, summed over `playerIds` (one
// player, or a team). Like useInventory it recomputes only when the time
// (0.1 s steps) or the stats' status changes.
export function useMatchTotals(engine: ReplayEngine, playerIds: string[]): Loadable<MatchTotals> {
  const time = useReplay(engine, (s) => s.time)
  const status = useReplay(engine, (s) => s.stats)
  // A string key: callers pass a new array each render.
  const key = playerIds.join(',')
  return useMemo((): Loadable<MatchTotals> => {
    if (status !== 'ready') return notReady(status)
    const total: MatchTotals = { elims: 0, knocks: 0, dealt: 0, taken: 0 }
    for (const id of key ? key.split(',') : []) {
      const t = engine.statsAt(id, time)
      total.elims += t.elims
      total.knocks += t.knocks
      total.dealt += t.dealt
      total.taken += t.taken
    }
    return { status, data: total }
  }, [engine, key, time, status])
}
