'use client'

import {
  Stage,
  Layer,
  Image as KonvaImage,
  Circle,
  Group,
  Rect,
  Line,
  Text,
  Shape,
} from 'react-konva'
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Stage as KonvaStage } from 'konva/lib/Stage'
import useImage from 'use-image'
import npyjs from 'npyjs'
import {
  getReplayWorldScale,
  ReplayMapDefinition,
  projectReplayWorldToMapImage,
} from '@/lib/replay/map-projection'
import type { MatchMetadata } from '@/lib/replay/match-data'

// ---------------------------------------------------------------------------
// YAW / DIRECTION TUNING
// ---------------------------------------------------------------------------
// The data stores a `yaw` per player (feature index 3). We turn that into a
// screen rotation (degrees, clockwise, 0 = pointing right/east) for the arrow.
//
// We could NOT verify the exact convention from the data alone, so the mapping
// lives here in three knobs. If the arrows point the wrong way, this is the
// ONLY place you need to touch:
//   - YAW_IS_DEGREES: set false if yaw is stored in radians.
//   - YAW_SIGN:       set to -1 if arrows rotate the wrong direction.
//   - YAW_OFFSET_DEG: add/subtract 90/180 until "forward" looks correct.
const YAW_IS_DEGREES = true
const YAW_SIGN = 1
const YAW_OFFSET_DEG = 0

function yawToScreenDegrees(yawDeg: number): number {
  return YAW_SIGN * yawDeg + YAW_OFFSET_DEG
}


type ChunkData = {
  data: Float32Array
  shape: [number, number, number]
  dtype: string
  fortranOrder: boolean
}

// ---------------------------------------------------------------------------
// Zone data
// ---------------------------------------------------------------------------
// One entry per storm phase, as written by the ETL into zones.json.
// Timestamps are seconds relative to match start (same origin as `timestamp`).
type ZonePhase = {
  phase: number
  shrinkStart: number
  shrinkEnd: number
  prevCX: number
  prevCY: number
  prevR: number
  nextCX: number
  nextCY: number
  nextR: number
}

// Interpolated circle at a specific time — world-space coords, ready to project.
type ZoneCircle = { cx: number; cy: number; r: number }

// HUD info derived from zone phases each frame.
type ZoneHudInfo = {
  // Zone number we're currently inside (1-indexed).
  currentZone: number
  // Total zone circles in this match (= last phase.phase + 1).
  totalZones: number
  // True while the circle is actively shrinking.
  isShrinking: boolean
  // Seconds until the next state change: if shrinking → until it stops;
  // if waiting → until it starts moving. Null after the final zone.
  countdownSeconds: number | null
}

/**
 * Returns the interpolated storm-circle at time `t` (seconds from match start).
 *
 * Zones are sparse: typically ~10 phases per match.  A linear scan is O(10)
 * and completely negligible compared to the 60 Hz render cycle, so we don't
 * bother with a cursor or binary search.  The same approach is used in game
 * engines (Unity AnimationCurve, Unreal UCurves) for small keyframe sets.
 *
 * Timeline model for each phase p:
 *   t < p.shrinkStart  → static circle at p.prev (waiting for next shrink)
 *   t in [shrinkStart, shrinkEnd] → lerp p.prev → p.next
 *   t > shrinkEnd      → advance to next phase (or return last.next)
 */
function getZoneAtTime(t: number, phases: ZonePhase[]): ZoneCircle | null {
  if (!phases.length) return null

  for (const p of phases) {
    if (t < p.shrinkStart) {
      // Before this phase's shrink begins — circle is static at prevZone
      return { cx: p.prevCX, cy: p.prevCY, r: p.prevR }
    }
    if (t <= p.shrinkEnd) {
      // Actively shrinking
      const a = (t - p.shrinkStart) / (p.shrinkEnd - p.shrinkStart)
      return {
        cx: lerp(p.prevCX, p.nextCX, a),
        cy: lerp(p.prevCY, p.nextCY, a),
        r: lerp(p.prevR, p.nextR, a),
      }
    }
    // t > shrinkEnd — check next phase
  }

  // Past all phases: static at the final (innermost) zone
  const last = phases[phases.length - 1]
  return { cx: last.nextCX, cy: last.nextCY, r: last.nextR }
}

/**
 * Returns the static "next" zone circle that the current zone is shrinking
 * toward, or null once we're past all phases (the final zone has no successor).
 *
 * This is always `p.next` for whichever phase p we're currently in (either
 * waiting for or actively shrinking). After the last shrink completes it
 * returns null, which tells the renderer not to draw a preview circle.
 */
function getNextZoneAtTime(t: number, phases: ZonePhase[]): ZoneCircle | null {
  if (!phases.length) return null

  for (const p of phases) {
    if (t <= p.shrinkEnd) {
      return { cx: p.nextCX, cy: p.nextCY, r: p.nextR }
    }
  }
  // Past all phases — final circle, no next zone
  return null
}

/**
 * Derives HUD info from the zone phases at time `t`.
 *
 * Zone numbering: each phase p describes the shrink from zone p.phase to the
 * next zone. So while we're in / waiting for phase p we're "inside zone p".
 * After the last phase completes there's no more shrinking; currentZone jumps
 * to totalZones (= last phase.phase + 1), which is the final safe circle.
 *
 * Examples for phases = [{ phase:1, shrinkStart:60, shrinkEnd:120 }, { phase:2, … }]:
 *   t=30  → zone 1, NOT shrinking, countdown = 30 s until shrink starts
 *   t=90  → zone 1, IS shrinking,  countdown = 30 s until shrink ends
 *   t=150 → zone 2, NOT shrinking, countdown = … s until next shrink
 */
function getZoneHudInfo(t: number, phases: ZonePhase[]): ZoneHudInfo | null {
  if (!phases.length) return null

  const totalZones = phases[phases.length - 1].phase + 1

  for (const p of phases) {
    if (t < p.shrinkStart) {
      return {
        currentZone: p.phase,
        totalZones,
        isShrinking: false,
        countdownSeconds: Math.max(0, p.shrinkStart - t),
      }
    }
    if (t <= p.shrinkEnd) {
      return {
        currentZone: p.phase,
        totalZones,
        isShrinking: true,
        countdownSeconds: Math.max(0, p.shrinkEnd - t),
      }
    }
  }

  // Past all phases — resting in the final zone.
  return {
    currentZone: totalZones,
    totalZones,
    isShrinking: false,
    countdownSeconds: null,
  }
}

type ReplayClientProps = {
  mapDefinition: ReplayMapDefinition
  mapImageUrl: string
  matchMetadata: MatchMetadata
  stageWidth?: number
  stageHeight?: number
}

const FEATURE_COUNT = 8

function getFrameSlice(chunk: ChunkData, frameInChunk: number): Float32Array {
  const [frameCount, playerCount, featureCount] = chunk.shape
  if (frameInChunk < 0 || frameInChunk >= frameCount) {
    throw new Error(`frameInChunk ${frameInChunk} out of bounds`)
  }
  const frameStride = playerCount * featureCount
  const frameOffset = frameInChunk * frameStride

  return chunk.data.subarray(frameOffset, frameOffset + frameStride)
}

type PlayerState = {
  playerIndex: number
  playerId: string | null
  username: string | null
  x: number
  y: number
  z: number
  // Stored already converted to DEGREES (see getPlayerState).
  yawDeg: number
  hp: number
  shield: number
  alive: boolean
  dbno: boolean
  // False before a player's first telemetry, when the ETL fills position with
  // the (0,0,0) sentinel (e.g. while still on the battle bus). Such players
  // should not be drawn (otherwise they stack at the map origin).
  known: boolean
}

function getPlayerState(
  frameSlice: Float32Array,
  playerIndex: number,
  playerId: string | null,
  username: string | null,
  featureCount = FEATURE_COUNT,
): PlayerState | null {
  const playerOffset = playerIndex * featureCount

  if (playerOffset + featureCount > frameSlice.length) {
    return null
  }
  const rawYaw = frameSlice[playerOffset + 3]
  const x = frameSlice[playerOffset + 0]
  const y = frameSlice[playerOffset + 1]
  const z = frameSlice[playerOffset + 2]
  return {
    playerIndex,
    playerId,
    username,
    x,
    y,
    z,
    // Exactly (0,0,0) is the ETL's "position not yet known" sentinel; a real
    // in-world position landing on the exact origin is effectively impossible.
    known: !(x === 0 && y === 0 && z === 0),
    // Normalize to degrees right here so every downstream consumer
    // (interpolation, rendering) works in one unit.
    yawDeg: YAW_IS_DEGREES ? rawYaw : (rawYaw * 180) / Math.PI,
    hp: frameSlice[playerOffset + 4],
    shield: frameSlice[playerOffset + 5],
    alive: frameSlice[playerOffset + 6] > 0.5,
    dbno: frameSlice[playerOffset + 7] > 0.5,
  }
}

function getFrame({
  absoluteFrame,
  chunkCache,
  framesPerChunk,
}: {
  absoluteFrame: number
  chunkCache: Map<number, ChunkData>
  framesPerChunk: number
}): Float32Array | null {
  if (absoluteFrame < 0) {
    return null
  }
  const chunkIndex = Math.floor(absoluteFrame / framesPerChunk)
  const frameInChunk = absoluteFrame % framesPerChunk
  const chunk = chunkCache.get(chunkIndex)
  if (!chunk) {
    return null
  }
  // The last chunk is often shorter than a full chunk. Guard here so
  // getFrameSlice never sees an out-of-bounds index (nextFrame at end-of-match).
  if (frameInChunk >= chunk.shape[0]) {
    return null
  }
  return getFrameSlice(chunk, frameInChunk)
}

function getPlayerStatesFromFrame(
  frameSlice: Float32Array,
  indexToPlayer?: Record<string, string>,
  idToUsername?: Record<string, string>,
): PlayerState[] {
  const playerCount = Math.floor(frameSlice.length / FEATURE_COUNT)
  const players: PlayerState[] = []

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    const playerId = indexToPlayer?.[String(playerIndex)] ?? null
    const username = playerId ? idToUsername?.[playerId] ?? null : null
    const state = getPlayerState(frameSlice, playerIndex, playerId, username)
    if (state) {
      players.push(state)
    }
  }
  return players
}

function lerp(a: number, b: number, alpha: number) {
  return a + (b - a) * alpha
}

// Shortest-path angular interpolation in DEGREES. Plain lerp would spin the
// long way around (e.g. 350 -> 10 would sweep backwards through 180); this
// always takes the <=180 path so arrows turn naturally.
function lerpAngleDeg(a: number, b: number, alpha: number) {
  const diff = ((b - a + 540) % 360) - 180
  return a + diff * alpha
}

function interpolatePlayerStates(
  currentStates: PlayerState[],
  nextStates: PlayerState[],
  alpha: number,
): PlayerState[] {
  if (!nextStates.length) {
    return currentStates
  }

  return currentStates.map((currentState, playerIndex) => {
    const nextState = nextStates[playerIndex]

    if (!nextState || nextState.playerIndex !== currentState.playerIndex) {
      return currentState
    }

    // If either endpoint is the not-yet-known sentinel, hold the current state
    // instead of tweening — otherwise a player would streak across the map from
    // (0, 0) on the frame they first appear. They stay hidden (the filter checks
    // `known`) until the current frame itself has a real position.
    if (!currentState.known || !nextState.known) {
      return currentState
    }

    return {
      ...currentState,
      x: lerp(currentState.x, nextState.x, alpha),
      y: lerp(currentState.y, nextState.y, alpha),
      z: lerp(currentState.z, nextState.z, alpha),
      // yaw is interpolated too now that we draw direction arrows, otherwise
      // arrows would snap between the (low) sample-rate frames.
      yawDeg: lerpAngleDeg(currentState.yawDeg, nextState.yawDeg, alpha),
    }
  })
}

function projectWorldToMap({
  state,
  mapDefinition,
  mapWidth,
  mapHeight,
}: {
  state: PlayerState
  mapDefinition: ReplayMapDefinition
  mapWidth: number
  mapHeight: number
}) {
  return projectReplayWorldToMapImage({
    x: state.x,
    y: state.y,
    imageWidth: mapWidth,
    imageHeight: mapHeight,
    mapDefinition,
  })
}

// Measures the actual rendered pixel width of a string using a cached 2D canvas
// context, so the nametag box hugs the text instead of relying on a per-char
// estimate (which over-pads names with spaces/narrow letters). The font string
// must match the Konva Text node (default family is Arial). Falls back to a
// rough estimate during SSR where `document` doesn't exist.
let measureCtx: CanvasRenderingContext2D | null = null
function measureTextWidth(
  text: string,
  fontSize: number,
  fontStyle = 'bold',
  fontFamily = 'Arial',
) {
  if (typeof document === 'undefined') {
    return text.length * fontSize * 0.6
  }
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')
  }
  if (!measureCtx) {
    return text.length * fontSize * 0.6
  }
  measureCtx.font = `${fontStyle} ${fontSize}px ${fontFamily}`
  return measureCtx.measureText(text).width
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds)
  const mins = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const npy = new npyjs()

// ---------------------------------------------------------------------------
// Zone HUD icons (inline SVG, 14×14 design units)
// ---------------------------------------------------------------------------

function PersonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="3.5" r="2.5" fill="white" opacity="0.9" />
      <path
        d="M1.5 13c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  )
}

function ClockIcon({ shrinking }: { shrinking: boolean }) {
  // Hands turn orange while the zone is actively closing so it's clear the
  // countdown means "closing in" rather than "next storm".
  const handColor = shrinking ? '#fb923c' : 'white'
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" opacity="0.9" />
      <path
        d="M7 4.5V7l1.75 1.25"
        stroke={handColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StormIcon() {
  return (
    <svg width="11" height="14" viewBox="0 0 11 14" fill="none" aria-hidden>
      <path d="M6.5 1L1 8h4.5L4 13l6.5-7H6L6.5 1z" fill="white" opacity="0.9" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Zone HUD overlay (HTML, absolutely positioned over the canvas)
// ---------------------------------------------------------------------------

function ZoneHud({
  playersAlive,
  totalPlayers,
  zoneInfo,
}: {
  playersAlive: number
  totalPlayers: number
  zoneInfo: ZoneHudInfo | null
}) {
  const pill =
    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white tabular-nums'
  const bg = 'bg-[#1e1f22]/80 backdrop-blur-sm'

  const countdown = zoneInfo?.countdownSeconds
  const countdownStr = countdown != null ? formatClock(countdown) : '—'
  const shrinking = zoneInfo?.isShrinking ?? false

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2">
      {/* Players alive */}
      <div className={`${pill} ${bg}`}>
        <PersonIcon />
        <span>
          {playersAlive}
          <span className="opacity-50">/{totalPlayers}</span>
        </span>
      </div>

      {/* Countdown — orange clock while shrinking, white while waiting */}
      <div className={`${pill} ${bg}`}>
        <ClockIcon shrinking={shrinking} />
        <span className={shrinking ? 'text-orange-400' : 'text-white'}>
          {countdownStr}
        </span>
      </div>

      {/* Zone number */}
      {zoneInfo && (
        <div className={`${pill} ${bg}`}>
          <StormIcon />
          <span>
            {zoneInfo.currentZone}
            <span className="opacity-50">/{zoneInfo.totalZones}</span>
          </span>
        </div>
      )}
    </div>
  )
}

function ReplayClient({
  mapDefinition,
  mapImageUrl,
  matchMetadata,
  stageWidth = 1000,
  stageHeight = 700,
}: ReplayClientProps) {
  const [timestamp, setTimestamp] = useState(0)
  const [paused, setPaused] = useState(false)
  const [chunkCache, setChunkCache] = useState<Map<number, ChunkData>>(
    () => new Map(),
  )
  const [zonePhases, setZonePhases] = useState<ZonePhase[]>([])

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const loadingChunksRef = useRef<Set<number>>(new Set())

  const {
    match_id: matchId,
    hz,
    interval_seconds: intervalSeconds,
    total_frames: totalFrames,
    total_chunks: totalChunks,
    duration_seconds: durationFromMeta,
    index_to_player: indexToPlayerFromMeta,
    player_to_index: playerToIndex,
    id_to_username: idToUsername,
  } = matchMetadata

  // The ETL now guarantees player_to_index but not index_to_player, so invert
  // it once (memoized) to map a player's array index back to their id/name.
  const indexToPlayer = useMemo(() => {
    if (indexToPlayerFromMeta && Object.keys(indexToPlayerFromMeta).length) {
      return indexToPlayerFromMeta
    }
    const inverted: Record<string, string> = {}
    if (playerToIndex) {
      for (const [playerId, index] of Object.entries(playerToIndex)) {
        inverted[String(index)] = playerId
      }
    }
    return inverted
  }, [indexToPlayerFromMeta, playerToIndex])

  // Total match length in seconds. Prefer the explicit field; fall back to
  // total_frames / hz; finally fall back to Infinity if neither exists.
  const durationSeconds =
    durationFromMeta ??
    (totalFrames ? totalFrames / hz : Number.POSITIVE_INFINITY)

  const exactFrame = timestamp * hz
  // Clamp the frame so we never index past the last real frame of data.
  const maxFrame = totalFrames ? totalFrames - 1 : Number.POSITIVE_INFINITY
  const frame = Math.min(Math.floor(exactFrame), maxFrame)
  const alpha = exactFrame - Math.floor(exactFrame)
  const framesPerChunk = chunkCache.get(0)?.shape[0] ?? hz * intervalSeconds
  const chunkIndex = Math.floor(frame / framesPerChunk)

  const atEnd = timestamp >= durationSeconds

  // RAF loop for timestamp. delta is REAL elapsed seconds, and frame =
  // timestamp * hz, so 1 real second always advances exactly `hz` frames =
  // 1 second of game time. This is the 1:1 playback guarantee.
  useEffect(() => {
    if (paused) return

    function loop(now: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now
      }

      const delta = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      setTimestamp((value) => {
        const next = value + delta
        // Stop exactly at the end of the match instead of running past it.
        return next >= durationSeconds ? durationSeconds : next
      })

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      lastTimeRef.current = null
    }
  }, [paused, durationSeconds])

  // When we reach the end, pause so the RAF loop stops churning.
  useEffect(() => {
    if (atEnd && !paused) {
      setPaused(true)
    }
  }, [atEnd, paused])

  useEffect(() => {
    if (!matchId) return

    async function ensureChunkLoaded(nextChunkIndex: number) {
      if (nextChunkIndex < 0) return
      // End-of-match guard: don't request chunks that don't exist in S3.
      // This fixes the 404s after the last chunk played out.
      if (totalChunks !== undefined && nextChunkIndex >= totalChunks) return
      if (chunkCache.has(nextChunkIndex)) return
      if (loadingChunksRef.current.has(nextChunkIndex)) return

      loadingChunksRef.current.add(nextChunkIndex)

      try {
        const params = new URLSearchParams({
          matchId,
          chunkIndex: nextChunkIndex.toString(),
        })
        const response = await fetch(
          `/api/replay/movement-chunk?${params.toString()}`,
        )
        if (!response.ok) {
          console.error('Failed to fetch movement chunk', await response.text())
          return
        }

        const buffer = await response.arrayBuffer()
        const parsed = await npy.load(buffer)

        if (!(parsed.data instanceof Float32Array)) {
          throw new Error(
            `Expected Float32Array chunk data, got ${parsed.data.constructor.name}`,
          )
        }
        if (parsed.shape.length !== 3) {
          throw new Error(
            `Expected 3D chunk shape, got [${parsed.shape.join(', ')}]`,
          )
        }

        const movementChunk: ChunkData = {
          data: parsed.data,
          shape: parsed.shape as [number, number, number],
          dtype: parsed.dtype,
          fortranOrder: parsed.fortranOrder,
        }

        setChunkCache((previous) => {
          if (previous.has(nextChunkIndex)) {
            return previous
          }
          const next = new Map(previous)
          next.set(nextChunkIndex, movementChunk)
          return next
        })
      } finally {
        loadingChunksRef.current.delete(nextChunkIndex)
      }
    }

    void ensureChunkLoaded(chunkIndex)
    void ensureChunkLoaded(chunkIndex + 1)
  }, [chunkCache, chunkIndex, matchId, totalChunks])

  // Fetch zones.json once on mount. Zones are sparse JSON (one record per
  // phase, ~10 per match) — nothing like the dense 30 Hz movement chunks.
  useEffect(() => {
    if (!matchId) return
    const params = new URLSearchParams({ matchId })
    fetch(`/api/replay/zones?${params}`)
      .then((res) => {
        if (!res.ok) {
          // 404 is expected for matches processed before zone ETL was added.
          if (res.status !== 404) console.error('Failed to fetch zones', res.status)
          return null
        }
        return res.json() as Promise<ZonePhase[]>
      })
      .then((data) => {
        if (data) setZonePhases(data)
      })
      .catch((err) => console.error('Zone fetch error', err))
  }, [matchId])

  const currentFrame = getFrame({
    absoluteFrame: frame,
    chunkCache,
    framesPerChunk,
  })
  const nextFrame = getFrame({
    absoluteFrame: frame + 1,
    chunkCache,
    framesPerChunk,
  })
  const currentChunk = chunkCache.get(chunkIndex)
  const currentPlayerStates = currentFrame
    ? getPlayerStatesFromFrame(currentFrame, indexToPlayer, idToUsername)
    : []
  const nextPlayerStates = nextFrame
    ? getPlayerStatesFromFrame(nextFrame, indexToPlayer, idToUsername)
    : []
  const playerStates = interpolatePlayerStates(
    currentPlayerStates,
    nextPlayerStates,
    alpha,
  )

  // Compute the current zone circle from sparse phase data. Pure function —
  // no state, re-evaluated every render frame (same pattern as player lerp).
  const zone = getZoneAtTime(timestamp, zonePhases)
  const nextZone = getNextZoneAtTime(timestamp, zonePhases)
  const zoneHudInfo = getZoneHudInfo(timestamp, zonePhases)

  // Players alive: count alive flags in the current interpolated frame.
  // At very start (before first chunk) this is 0; that's acceptable.
  const playersAlive = playerStates.filter((p) => p.alive).length
  // Total player count — prefer explicit metadata field, fall back to the
  // size of the player-index map (built from player_to_index in metadata).
  const totalPlayers =
    matchMetadata.player_count ?? Object.keys(playerToIndex ?? {}).length

  function onPlayPauseClick() {
    // If we're sitting at the end, replay from the start.
    if (atEnd) {
      setTimestamp(0)
      setPaused(false)
      lastTimeRef.current = null
      return
    }
    setPaused((value) => !value)
    lastTimeRef.current = null
  }

  function onScrub(nextSeconds: number) {
    setTimestamp(nextSeconds)
    // Reset the RAF clock so playback doesn't "catch up" with a huge delta
    // after a seek.
    lastTimeRef.current = null
  }

  return (
    <div
      className="relative inline-flex flex-col overflow-hidden rounded-lg"
      style={{ backgroundColor: '#2f3136' }}
      data-map-id={mapDefinition.id}
    >
      {!currentChunk && (
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-sm text-white">
          Loading chunk {chunkIndex}…
        </div>
      )}

      <ZoneHud
        playersAlive={playersAlive}
        totalPlayers={totalPlayers}
        zoneInfo={zoneHudInfo}
      />

      <ReplayViewport
        mapDefinition={mapDefinition}
        mapImageUrl={mapImageUrl}
        playerStates={playerStates}
        zone={zone}
        nextZone={nextZone}
        stageWidth={stageWidth}
        stageHeight={stageHeight}
      />

      {/* Floating controls overlaid on the bottom of the map. */}
      <ReplayControls
        onPlayPauseClick={onPlayPauseClick}
        onScrub={onScrub}
        timestamp={Math.min(timestamp, durationSeconds)}
        durationSeconds={durationSeconds}
        paused={paused}
        atEnd={atEnd}
      />
    </div>
  )
}

// Renders one player: a direction arrowhead plus a stacked shield/health bar
// and a nametag floating above it. Everything except the world position is
// drawn in SCREEN pixels by scaling the group by 1/stageScale, so markers stay
// a constant on-screen size no matter how far you zoom in or out.
function PlayerMarker({
  x,
  y,
  directionDeg,
  hp,
  shield,
  label,
  dbno,
  invScale,
}: {
  x: number
  y: number
  directionDeg: number
  hp: number
  shield: number
  label: string
  dbno: boolean
  invScale: number
}) {
  const color = dbno ? '#facc15' : '#4ade80'
  const hpRatio = Math.max(0, Math.min(1, hp / 100))
  const shieldRatio = Math.max(0, Math.min(1, shield / 100))

  // ----- Layout constants (in on-screen px; bump these to resize everything) --
  const FONT_SIZE = 13
  const MIN_CONTENT_WIDTH = 60 // floor for the bars/box so short names aren't tiny
  const BAR_HEIGHT = 7
  const BAR_GAP = 2 // vertical gap between the shield and health bars
  const NAME_BAR_GAP = 3 // gap between the nametag and the top (shield) bar
  const BOX_PADDING = 4 // inner padding of the dark box
  const BOX_GAP = 16 // gap between the box bottom and the player/arrow

  // The content width grows to fit a long username (measured to the exact
  // rendered pixel width) but never drops below MIN_CONTENT_WIDTH. The bars span
  // this full content width, so they always reach the box edges and long names
  // get no extra padding.
  const contentWidth = Math.max(
    MIN_CONTENT_WIDTH,
    measureTextWidth(label, FONT_SIZE),
  )
  const boxWidth = contentWidth + BOX_PADDING * 2
  const contentHeight =
    FONT_SIZE + NAME_BAR_GAP + BAR_HEIGHT + BAR_GAP + BAR_HEIGHT
  const boxHeight = contentHeight + BOX_PADDING * 2
  const boxLeft = -boxWidth / 2
  const boxBottom = -BOX_GAP
  const boxTop = boxBottom - boxHeight

  const nameY = boxTop + BOX_PADDING
  const shieldY = nameY + FONT_SIZE + NAME_BAR_GAP
  const healthY = shieldY + BAR_HEIGHT + BAR_GAP
  const barLeft = -contentWidth / 2

  return (
    <Group x={x} y={y} scaleX={invScale} scaleY={invScale} listening={false}>
      {/* Arrowhead. Drawn pointing east (+x) at rotation 0, then rotated to the
          player's view direction. The 4th point pulls the back edge inward
          (the notch) so it reads as an arrowhead, not a plain triangle.
          Rotating the INNER group keeps the box/bars/name upright. */}
      <Group rotation={directionDeg}>
        <Line
          points={[10, 0, -8, -7, -3.5, 0, -8, 7]}
          closed
          fill={color}
          stroke="#0b0b0b"
          strokeWidth={1.5}
        />
      </Group>

      {/* Translucent backing box so the name + bars stay readable over any map
          terrain. */}
      <Rect
        x={boxLeft}
        y={boxTop}
        width={boxWidth}
        height={boxHeight}
        fill="rgba(0, 0, 0, 0.6)"
        stroke="rgba(255, 255, 255, 0.18)"
        strokeWidth={1}
      />

      {/* Nametag */}
      <Text
        x={boxLeft}
        y={nameY}
        width={boxWidth}
        align="center"
        text={label}
        fill="white"
        fontSize={FONT_SIZE}
        fontStyle="bold"
        wrap="none"
      />

      {/* Shield bar (top) */}
      <Rect
        x={barLeft}
        y={shieldY}
        width={contentWidth}
        height={BAR_HEIGHT}
        fill="#1f2937"
      />
      <Rect
        x={barLeft}
        y={shieldY}
        width={contentWidth * shieldRatio}
        height={BAR_HEIGHT}
        fill="#3b82f6"
      />

      {/* Health bar (below shield) */}
      <Rect
        x={barLeft}
        y={healthY}
        width={contentWidth}
        height={BAR_HEIGHT}
        fill="#1f2937"
      />
      <Rect
        x={barLeft}
        y={healthY}
        width={contentWidth * hpRatio}
        height={BAR_HEIGHT}
        fill="#22c55e"
      />
    </Group>
  )
}

function ReplayViewport({
  mapDefinition,
  mapImageUrl,
  playerStates,
  zone,
  nextZone,
  stageWidth,
  stageHeight,
}: {
  mapDefinition: ReplayMapDefinition
  mapImageUrl: string
  playerStates: PlayerState[]
  zone: ZoneCircle | null
  nextZone: ZoneCircle | null
  stageWidth: number
  stageHeight: number
}) {
  const replayPois = mapDefinition.pois ?? []
  const [mapImage] = useImage(mapImageUrl)
  const stageRef = useRef<KonvaStage>(null)

  // fitScale is derived — no effect needed. MIN_SCALE equals fitScale so the
  // user can never zoom out further than "map fills the viewport".
  // "cover" fit: image fills the entire viewport in both dimensions.
  // min() would letterbox (gray bars); max() overflows the short axis instead,
  // which the drag/zoom bounds then clamp so gray never shows.
  const fitScale = mapImage
    ? Math.max(stageWidth / mapImage.width, stageHeight / mapImage.height)
    : 0.5
  const MAX_SCALE = 10.0

  // We mirror the stage's zoom in React state so the markers can inverse-scale
  // and stay a constant on-screen size. Konva owns the actual transform; this
  // is just a copy we read for sizing.
  const [stageScale, setStageScale] = useState(fitScale)

  // useLayoutEffect fires before the browser paints, so the stage is at the
  // correct scale on the very first frame — no gray-border flash.
  useLayoutEffect(() => {
    if (!mapImage || !stageRef.current) return

    const stage = stageRef.current
    const scale = Math.max(stageWidth / mapImage.width, stageHeight / mapImage.height)

    stage.scale({ x: scale, y: scale })
    stage.position({ x: stageWidth / 2, y: stageHeight / 2 })
    stage.batchDraw()
    // setStageScale(scale)
  }, [mapImage, stageHeight, stageWidth])

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()

    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const direction = e.evt.deltaY < 0 ? 1 : -1
    const scaleBy = 1.1
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    newScale = Math.max(fitScale, Math.min(newScale, MAX_SCALE))
    if (newScale === oldScale) return

    stage.scale({ x: newScale, y: newScale })

    // After clamping scale, clamp the new position too so zooming out near the
    // edge doesn't expose the gray border.
    const scaledW = mapImage ? mapImage.width * newScale : 0
    const scaledH = mapImage ? mapImage.height * newScale : 0
    const rawPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }
    const newPos = {
      x: Math.max(stageWidth - scaledW / 2, Math.min(scaledW / 2, rawPos.x)),
      y: Math.max(stageHeight - scaledH / 2, Math.min(scaledH / 2, rawPos.y)),
    }
    stage.position(newPos)
    stage.batchDraw()
    setStageScale(newScale)
  }

  if (!mapImage) return null

  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const stage = stageRef.current
    if (!stage) return pos

    const scale = stage.scaleX()
    const scaledW = mapImage.width * scale
    const scaledH = mapImage.height * scale

    // The image is centered on the stage origin (offsetX/offsetY = half image
    // dims). For the image to fully cover the viewport, the stage origin must
    // stay within these bounds:
    //   left edge of image ≤ 0  →  stage.x ≤ scaledW / 2
    //   right edge ≥ stageWidth →  stage.x ≥ stageWidth - scaledW / 2
    return {
      x: Math.max(stageWidth - scaledW / 2, Math.min(scaledW / 2, pos.x)),
      y: Math.max(stageHeight - scaledH / 2, Math.min(scaledH / 2, pos.y)),
    }
  }

  // 1 / stageScale: markers live inside the (scaled) world layer, so we
  // pre-divide their sizes to cancel out the zoom and keep them
  // screen-constant.
  const invScale = 1 / stageScale

  return (
    <Stage
      ref={stageRef}
      width={stageWidth}
      height={stageHeight}
      onWheel={handleWheel}
      draggable
      dragBoundFunc={dragBoundFunc}
    >
      <Layer>
        <KonvaImage
          image={mapImage}
          offsetX={mapImage.width / 2}
          offsetY={mapImage.height / 2}
        />

        {/* Storm — drawn in world space (projected to map-image pixel coords).
            Three elements stacked:
              1. Storm overlay: purple fill everywhere OUTSIDE the current zone.
                 Achieved with a full-map rect + counterclockwise circle hole
                 (nonzero winding rule punches the safe zone out of the fill).
              2. Next zone: white circle showing where the storm will settle.
                 Hidden once we're on the final phase (getNextZoneAtTime → null).
              3. Current zone border: purple ring at the storm edge. */}
        {zone && (() => {
          const worldScale = getReplayWorldScale({
            imageWidth: mapImage.width,
            mapDefinition,
          })
          const projected = projectReplayWorldToMapImage({
            x: zone.cx,
            y: zone.cy,
            imageWidth: mapImage.width,
            imageHeight: mapImage.height,
            mapDefinition,
          })
          const pixelRadius = zone.r * worldScale

          const nextProjected = nextZone
            ? projectReplayWorldToMapImage({
                x: nextZone.cx,
                y: nextZone.cy,
                imageWidth: mapImage.width,
                imageHeight: mapImage.height,
                mapDefinition,
              })
            : null
          const nextPixelRadius = nextZone ? nextZone.r * worldScale : 0

          return (
            <>
              {/* Storm overlay */}
              <Shape
                sceneFunc={(ctx, shape) => {
                  ctx.beginPath()
                  // Full map rectangle — clockwise (winding +1)
                  ctx.rect(
                    -mapImage.width / 2,
                    -mapImage.height / 2,
                    mapImage.width,
                    mapImage.height,
                  )
                  // Safe zone circle — counterclockwise (winding -1 = hole)
                  ctx.arc(projected.x, projected.y, pixelRadius, 0, Math.PI * 2, true)
                  ctx.closePath()
                  ctx.fillStrokeShape(shape)
                }}
                fill="rgba(130, 60, 210, 0.42)"
                listening={false}
              />

              {/* Next zone preview (white) */}
              {nextProjected && (
                <Circle
                  x={nextProjected.x}
                  y={nextProjected.y}
                  radius={nextPixelRadius}
                  stroke="rgba(255, 255, 255, 0.75)"
                  strokeWidth={2 / stageScale}
                  listening={false}
                />
              )}

              {/* Current zone border (purple) */}
              <Circle
                x={projected.x}
                y={projected.y}
                radius={pixelRadius}
                stroke="rgba(180, 80, 255, 0.9)"
                strokeWidth={2.5 / stageScale}
                listening={false}
              />
            </>
          )
        })()}

        {/*
        {replayPois.map((poi) => {
          const projected = projectReplayWorldToMapImage({
            x: poi.position.x,
            y: poi.position.y,
            imageWidth: mapImage.width,
            imageHeight: mapImage.height,
            mapDefinition,
          })

          return (
            <Circle
              key={poi.locationTag}
              x={projected.x}
              y={projected.y}
              radius={18}
              fill="#f43f5e"
              stroke="white"
              strokeWidth={3}
              opacity={0.95}
            />
          )
        })}
        */}

        {playerStates
          .filter((player) => player.alive && player.known)
          .map((player) => {
            const projected = projectWorldToMap({
              state: player,
              mapDefinition,
              mapWidth: mapImage.width,
              mapHeight: mapImage.height,
            })

            return (
              <PlayerMarker
                key={player.playerId ?? `player-${player.playerIndex}`}
                x={projected.x}
                y={projected.y}
                directionDeg={yawToScreenDegrees(player.yawDeg)}
                hp={player.hp}
                shield={player.shield}
                label={player.username ?? `P${player.playerIndex}`}
                dbno={player.dbno}
                invScale={invScale}
              />
            )
          })}
      </Layer>
    </Stage>
  )
}

function ReplayControls({
  onPlayPauseClick,
  onScrub,
  timestamp,
  durationSeconds,
  paused,
  atEnd,
}: {
  onPlayPauseClick: () => void
  onScrub: (seconds: number) => void
  timestamp: number
  durationSeconds: number
  paused: boolean
  atEnd: boolean
}) {
  const hasDuration = Number.isFinite(durationSeconds)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-black/70 px-4 py-2 backdrop-blur">
        <button
          className="rounded bg-white px-3 py-1 text-sm font-medium text-black"
          onClick={onPlayPauseClick}
        >
          {atEnd ? 'Replay' : paused ? 'Play' : 'Pause'}
        </button>

        <span className="w-12 text-right font-mono text-xs text-white">
          {formatClock(timestamp)}
        </span>

        <input
          type="range"
          className="flex-1 accent-green-400"
          min={0}
          max={hasDuration ? durationSeconds : 0}
          step={0.1}
          value={timestamp}
          disabled={!hasDuration}
          onChange={(e) => onScrub(Number(e.target.value))}
        />

        <span className="w-12 font-mono text-xs text-white">
          {hasDuration ? formatClock(durationSeconds) : '--:--'}
        </span>
      </div>
    </div>
  )
}

export default ReplayClient
