'use client'

// ---------------------------------------------------------------------------
// React hooks for the replay engine (lib/replay/engine.ts).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { ReplayEngine, type ReplaySnapshot } from '@/lib/replay/engine'
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
