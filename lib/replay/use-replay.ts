'use client'

// ---------------------------------------------------------------------------
// React hooks for the replay engine (lib/replay/engine.ts).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { ReplayEngine, type InventoryItem, type MatchTotals, type ReplaySnapshot } from '@/lib/replay/engine'
import type { MatchMetadata } from '@/lib/replay/match-data'

// Creates the engine for a match and runs it while the component is mounted.
// Returns null until there's metadata. A different metadata object makes a new
// engine (and stops the old one).
export function useReplayEngine(metadata: MatchMetadata | null | undefined): ReplayEngine | null {
  // Creating the engine does nothing yet (no fetches, no loop) ...
  const engine = useMemo(() => (metadata ? new ReplayEngine(metadata) : null), [metadata])
  // ... start() and stop() do, so they belong in an effect.
  useEffect(() => {
    if (!engine) return
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
// (0.1 s steps) or the loaded data changes. null until the inventory loads.
export function useInventory(engine: ReplayEngine, playerId: string): InventoryItem[] | null {
  const time = useReplay(engine, (s) => s.time)
  const loaded = useReplay(engine, (s) => s.inventoryLoaded)
  return useMemo(
    () => (loaded ? engine.inventoryAt(playerId, time) : null),
    [engine, playerId, time, loaded],
  )
}

// Whole-match totals at the current replay time, summed over `playerIds` (one
// player, or a team). Like useInventory it subscribes to the snapshot's time
// and recomputes only when that (0.1 s steps) or the loaded data changes; null
// until the stats load.
export function useMatchTotals(engine: ReplayEngine, playerIds: string[]): MatchTotals | null {
  const time = useReplay(engine, (s) => s.time)
  const loaded = useReplay(engine, (s) => s.statsLoaded)
  // A string key: callers pass a new array each render.
  const key = playerIds.join(',')
  return useMemo(() => {
    if (!loaded) return null
    const total: MatchTotals = { elims: 0, knocks: 0, dealt: 0, taken: 0 }
    for (const id of key ? key.split(',') : []) {
      const t = engine.statsAt(id, time)
      total.elims += t.elims
      total.knocks += t.knocks
      total.dealt += t.dealt
      total.taken += t.taken
    }
    return total
  }, [engine, key, time, loaded])
}
