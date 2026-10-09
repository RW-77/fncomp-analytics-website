// ---------------------------------------------------------------------------
// ReplayEngine — runs one match's replay outside of React.
//
// The engine owns the replay clock (time, paused), loads the match data
// (movement chunks, zones, shots), and every animation frame works out where
// everything is at the current time. It has no React in it: `time` is a plain
// field, so moving it forward 60 times a second doesn't re-render anything.
//
// Inventories (inventory.json) and whole-match stats load the same way; panels
// ask for a player's at the current time with inventoryAt() / statsAt().
//
// Three kinds of code talk to it:
//   - The canvas (ReplayViewport) registers onFrame() and redraws from the
//     engine's per-frame fields (players, zone, shots) when they change.
//   - React components read a small snapshot (clock, HUD numbers, health) via
//     useReplay(), which uses useSyncExternalStore. The snapshot is replaced a
//     few times a second at most, so only those components re-render.
//   - The page sends commands: play(), pause(), seek(), and the camera ones
//     (follow(), focusOnPoints(), ...), which the viewport carries out.
//
// The picture is still a function of time, like when `timestamp` was React
// state; the engine just calls that function itself instead of asking React.
// ---------------------------------------------------------------------------

import npyjs from 'npyjs'
import type { InventoryChange, InventoryPayload, ItemInfo, MatchMetadata } from '@/lib/replay/match-data'
import type { PlayerEventTimes } from '@/lib/stats'

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

type ChunkData = {
  data: Float32Array
  shape: [number, number, number]   // [frames, players, features]
}

// One entry per storm phase, as written by the ETL into zones.json.
// Timestamps are seconds relative to match start (same origin as `time`).
export type ZonePhase = {
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

// A storm circle at a specific time — world-space coords, ready to project.
export type ZoneCircle = { cx: number; cy: number; r: number }

// HUD info derived from the zone phases.
export type ZoneHudInfo = {
  // Zone number we're currently inside (1-indexed).
  currentZone: number
  // Total zone circles in this match (== the last phase's number).
  totalZones: number
  // True while the circle is actively shrinking.
  isShrinking: boolean
  // Whole seconds until the next state change: if shrinking → until it stops;
  // if waiting → until it starts moving. Null after the final zone.
  countdownSeconds: number | null
}

// One fired shot, as written by the ETL into shots.json. Coords are world-space.
// `t` is seconds from match start; the shot flashes for SHOT_FLASH_SECONDS.
export type Shot = {
  t: number
  s: number            // shooter's player index
  team: number | null  // shooter's team (for line color)
  ax: number; ay: number  // origin (world)
  ex: number; ey: number  // endpoint (world)
  sg: boolean          // shotgun -> thick, length-clamped line
}

export const SHOT_FLASH_SECONDS = 0.12

// One player at the current time (interpolated between movement frames).
export type PlayerState = {
  playerIndex: number
  playerId: string | null
  username: string | null
  x: number
  y: number
  z: number
  yawDeg: number      // already converted to degrees
  hp: number
  shield: number
  alive: boolean
  dbno: boolean
  // False before a player's first telemetry, when the ETL fills position with
  // the (0,0,0) sentinel (e.g. while still on the battle bus). Such players
  // aren't drawn (otherwise they stack at the map origin).
  known: boolean
}

// One occupied inventory slot at a given time. ammo is the loaded magazine.
export type InventoryItem = {
  slot: number
  itemId: string
  count: number
  ammo: number
}

// A player's whole-match totals up to a time: eliminations and knocks of
// opponents, and damage dealt to / taken from standing opponents.
export type MatchTotals = {
  elims: number
  knocks: number
  dealt: number
  taken: number
}

// One player's events in time order, with running damage sums, for statsAt().
type PlayerStatTimes = {
  elims: number[]
  knocks: number[]
  dealtT: number[]
  dealtSum: number[]   // dealtSum[i] = damage dealt by dealtT[i], inclusive
  takenT: number[]
  takenSum: number[]
}

// What the details panels show for a player. hp and shield are 0–100.
export type PlayerVitals = {
  hp: number
  shield: number
  alive: boolean
  knocked: boolean
}

// Where a loaded file stands. 'missing' is a 404: the pipeline hasn't built
// it for this match, which is not a failure.
export type AssetStatus = 'loading' | 'ready' | 'missing' | 'error'

// Whether the movement data for the current time is there:
//   loading   — waiting for the first chunk (nothing to draw yet)
//   buffering — waiting for the chunk at the current time (after a seek, or
//               playback outran the prefetch); the clock holds meanwhile
//   ready     — playing / drawable
//   error     — that chunk failed; it isn't requested again until retry()
export type ReplayStatus = 'loading' | 'buffering' | 'ready' | 'error'

// What React components can read (through useReplay). A new snapshot object
// is made only when one of these values changes, and the values are rounded so
// that happens a few times a second at most: `time` moves in 0.1 s steps,
// `vitals` refreshes every VITALS_INTERVAL_MS. Unchanged parts keep their
// identity (same `zone` object, same `vitals` object, same per-player entries),
// so a component that reads only one part re-renders only when that part does.
export type ReplaySnapshot = {
  time: number                         // seconds, rounded down to 0.1
  paused: boolean
  atEnd: boolean
  rate: number                         // playback speed; 1 = real time
  replay: ReplayStatus
  playersAlive: number
  zone: ZoneHudInfo | null
  vitals: Record<string, PlayerVitals> // player id -> vitals
  inventory: AssetStatus               // inventoryAt() has data once 'ready'
  stats: AssetStatus                   // statsAt() has data once 'ready'
}

// The files besides the movement chunks. Zones and shots only decorate the
// map, so their status isn't in the snapshot, but retry() reloads them too.
type Asset = 'zones' | 'shots' | 'inventory' | 'stats'

// Camera commands. The engine doesn't move the camera itself; the viewport
// that owns the canvas attaches an implementation (see attachCamera).
export type ReplayCamera = {
  focusOnWorld: (wx: number, wy: number, opts?: { zoom?: number }) => void
  // points are WORLD coords; frames all of them
  focusOnPoints: (points: { x: number; y: number }[], opts?: { padding?: number; maxZoom?: number }) => void
  focusOnPlayer: (playerId: string) => void
  // Keep these players framed as they move; null stops. `until` (replay
  // seconds) ends the follow on its own, e.g. a few seconds after a fight.
  follow: (playerIds: string[] | null, opts?: { until?: number }) => void
}

// Called once per animation frame, after the engine has updated.
// dt = real seconds since the last frame; changed = the per-frame fields
// (players, zone, shots) changed since the last call, so the canvas is stale.
export type FrameListener = (dt: number, changed: boolean) => void

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

const FEATURE_COUNT = 8

// The data stores `yaw` per player (feature index 3). Set false if it turns
// out to be radians; everything downstream works in degrees.
const YAW_IS_DEGREES = true

// The clock moves by the real time between frames, but never more than this per
// frame: when the tab is hidden the browser stops sending frames, and without
// the cap the replay would jump ahead by however long you were away.
const MAX_FRAME_STEP_S = 0.1

// How often the health/shield numbers in the snapshot refresh during playback.
const VITALS_INTERVAL_MS = 250

const npy = new npyjs()

// ---------------------------------------------------------------------------
// Pure helpers: the replay state at a given time
// ---------------------------------------------------------------------------

/**
 * The storm circle at time `t`. Zones are sparse (~10 phases per match), so a
 * linear scan is fine. For each phase p:
 *   t < p.shrinkStart              → static circle at p.prev
 *   t in [shrinkStart, shrinkEnd]  → lerp p.prev → p.next
 *   t > shrinkEnd                  → move on to the next phase
 */
export function getZoneAtTime(t: number, phases: ZonePhase[]): ZoneCircle | null {
  if (!phases.length) return null
  for (const p of phases) {
    if (t < p.shrinkStart) return { cx: p.prevCX, cy: p.prevCY, r: p.prevR }
    if (t <= p.shrinkEnd) {
      const a = (t - p.shrinkStart) / (p.shrinkEnd - p.shrinkStart)
      return { cx: lerp(p.prevCX, p.nextCX, a), cy: lerp(p.prevCY, p.nextCY, a), r: lerp(p.prevR, p.nextR, a) }
    }
  }
  // Past all phases: static at the final (innermost) zone
  const last = phases[phases.length - 1]
  return { cx: last.nextCX, cy: last.nextCY, r: last.nextR }
}

// The circle the storm is heading to, or null once the final zone has formed.
export function getNextZoneAtTime(t: number, phases: ZonePhase[]): ZoneCircle | null {
  for (const p of phases) {
    if (t <= p.shrinkEnd) return { cx: p.nextCX, cy: p.nextCY, r: p.nextR }
  }
  return null
}

// Zone number / shrinking / countdown at time `t` (countdown in whole seconds).
export function getZoneHudInfo(t: number, phases: ZonePhase[]): ZoneHudInfo | null {
  if (!phases.length) return null
  const totalZones = phases[phases.length - 1].phase
  for (const p of phases) {
    if (t < p.shrinkStart) {
      return { currentZone: p.phase, totalZones, isShrinking: false, countdownSeconds: Math.floor(Math.max(0, p.shrinkStart - t)) }
    }
    if (t <= p.shrinkEnd) {
      return { currentZone: p.phase, totalZones, isShrinking: true, countdownSeconds: Math.floor(Math.max(0, p.shrinkEnd - t)) }
    }
  }
  return { currentZone: totalZones, totalZones, isShrinking: false, countdownSeconds: null }
}

// First index whose shot time is >= t, over a t-ascending array (binary search).
function lowerBoundByTime(shots: Shot[], t: number): number {
  let lo = 0
  let hi = shots.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (shots[mid].t < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

// Shots flashing at time `now`: those with t in (now - flash, now].
export function getActiveShots(now: number, shots: Shot[], flash = SHOT_FLASH_SECONDS): Shot[] {
  if (!shots.length) return []
  const active: Shot[] = []
  for (let i = lowerBoundByTime(shots, now - flash); i < shots.length; i += 1) {
    const shot = shots[i]
    if (shot.t > now) break
    if (now - shot.t < flash) active.push(shot)
  }
  return active
}

function getPlayerStatesFromFrame(
  frameSlice: Float32Array,
  indexToPlayer: Record<string, string>,
  idToUsername: Record<string, string>,
): PlayerState[] {
  const playerCount = Math.floor(frameSlice.length / FEATURE_COUNT)
  const players: PlayerState[] = []
  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    const o = playerIndex * FEATURE_COUNT
    const playerId = indexToPlayer[String(playerIndex)] ?? null
    const x = frameSlice[o + 0]
    const y = frameSlice[o + 1]
    const z = frameSlice[o + 2]
    const rawYaw = frameSlice[o + 3]
    players.push({
      playerIndex,
      playerId,
      username: playerId ? idToUsername[playerId] ?? null : null,
      x,
      y,
      z,
      // Exactly (0,0,0) is the ETL's "position not yet known" sentinel.
      known: !(x === 0 && y === 0 && z === 0),
      yawDeg: YAW_IS_DEGREES ? rawYaw : (rawYaw * 180) / Math.PI,
      hp: frameSlice[o + 4],
      shield: frameSlice[o + 5],
      alive: frameSlice[o + 6] > 0.5,
      dbno: frameSlice[o + 7] > 0.5,
    })
  }
  return players
}

function lerp(a: number, b: number, alpha: number) {
  return a + (b - a) * alpha
}

// Shortest-path angular interpolation in degrees (350 -> 10 turns 20°, not 340°).
function lerpAngleDeg(a: number, b: number, alpha: number) {
  const diff = ((b - a + 540) % 360) - 180
  return a + diff * alpha
}

function interpolatePlayerStates(current: PlayerState[], next: PlayerState[], alpha: number): PlayerState[] {
  if (!next.length) return current
  return current.map((c, i) => {
    const n = next[i]
    if (!n || n.playerIndex !== c.playerIndex) return c
    // If either endpoint is the not-yet-known sentinel, hold the current state;
    // otherwise a player would streak across the map from (0, 0).
    if (!c.known || !n.known) return c
    return {
      ...c,
      x: lerp(c.x, n.x, alpha),
      y: lerp(c.y, n.y, alpha),
      z: lerp(c.z, n.z, alpha),
      yawDeg: lerpAngleDeg(c.yawDeg, n.yawDeg, alpha),
    }
  })
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

export class ReplayEngine {
  readonly metadata: MatchMetadata
  readonly duration: number       // seconds; Infinity if the metadata doesn't say
  readonly totalPlayers: number

  // ---- the clock ----
  private _time = 0
  private _paused = false
  private _rate = 1         // playback speed (see setRate)

  // ---- per-frame state: what the canvas draws, updated when the time moves ----
  // Read these from onFrame listeners / draw code; only the engine writes them.
  players: PlayerState[] = []
  zone: ZoneCircle | null = null      // current storm circle
  nextZone: ZoneCircle | null = null  // where it's heading
  shots: Shot[] = []                  // shots flashing right now

  // ---- loaded data ----
  private readonly indexToPlayer: Record<string, string>
  private readonly idToUsername: Record<string, string>
  private chunks = new Map<number, ChunkData>()
  private loadingChunks = new Set<number>()
  // Chunks whose load failed. Not requested again until retry(): without
  // this, playback would re-request a missing chunk every frame.
  private failedChunks = new Set<number>()
  private replayStatus: ReplayStatus = 'loading'
  private zonePhases: ZonePhase[] = []
  private allShots: Shot[] = []
  private inventoryItems: string[] = []
  private inventoryChanges: Record<string, InventoryChange[]> = {}
  // Display info (name, category, rarity, icon) for every item id in the
  // match's inventories; empty until loaded.
  itemInfo: Record<string, ItemInfo> = {}
  private playerStats: Record<string, PlayerStatTimes> = {}
  private assets: Record<Asset, AssetStatus> = { zones: 'loading', shots: 'loading', inventory: 'loading', stats: 'loading' }

  // ---- the loop ----
  private rafId: number | null = null
  private lastFrameAt: number | null = null
  private abort: AbortController | null = null   // cancels in-flight fetches on stop()
  private stale = true        // per-frame state needs recomputing
  private needsDraw = true    // per-frame state changed since listeners last saw it

  // ---- outside listeners ----
  private frameListeners = new Set<FrameListener>()
  private snapshotListeners = new Set<() => void>()
  private snapshot: ReplaySnapshot
  private vitalsAt = 0
  private vitalsStale = true
  private camera: ReplayCamera | null = null

  constructor(metadata: MatchMetadata) {
    this.metadata = metadata
    this.duration =
      metadata.duration_seconds ??
      (metadata.total_frames ? metadata.total_frames / metadata.hz : Number.POSITIVE_INFINITY)
    this.totalPlayers = metadata.player_count ?? Object.keys(metadata.player_to_index ?? {}).length

    // The ETL guarantees player_to_index but not index_to_player; invert it.
    if (metadata.index_to_player && Object.keys(metadata.index_to_player).length) {
      this.indexToPlayer = metadata.index_to_player
    } else {
      this.indexToPlayer = {}
      for (const [playerId, index] of Object.entries(metadata.player_to_index ?? {})) {
        this.indexToPlayer[String(index)] = playerId
      }
    }
    this.idToUsername = metadata.id_to_username ?? {}

    this.snapshot = {
      time: 0,
      paused: false,
      atEnd: false,
      rate: 1,
      replay: 'loading',
      playersAlive: 0,
      zone: null,
      vitals: {},
      inventory: 'loading',
      stats: 'loading',
    }
  }

  // Versions the timeline asset URLs (chunks, zones, shots). The API serves
  // them as immutable, so a rebuilt timeline needs new URLs to bypass
  // browsers' cached copies.
  private get assetVersion(): string {
    return String(this.metadata.timeline_version ?? 1)
  }

  get time() { return this._time }
  get paused() { return this._paused }
  get rate() { return this._rate }

  // ---- lifecycle ---------------------------------------------------------

  // Start the frame loop and load the match data. Safe to call again after
  // stop() (React runs effects twice in development: start, stop, start).
  start() {
    if (this.rafId !== null) return
    this.abort = new AbortController()
    this.loadAssets(this.abort.signal)
    this.lastFrameAt = null
    this.stale = true
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.abort?.abort()
    this.abort = null
    this.loadingChunks.clear()
  }

  // ---- commands ------------------------------------------------------------

  play() {
    // At the end, play starts over.
    if (this._time >= this.duration) this.seek(0)
    this._paused = false
    this.publish()
  }

  pause() {
    this._paused = true
    this.publish()
  }

  togglePlay() {
    if (this._paused) this.play()
    else this.pause()
  }

  // Playback speed: game seconds per real second (1 = real time).
  setRate(rate: number) {
    this._rate = rate
    this.publish()
  }

  seek(seconds: number) {
    this._time = Math.max(0, Math.min(this.duration, seconds))
    this.stale = true
    this.vitalsStale = true
    // Update right away rather than on the next frame, so a dragged scrubber
    // and a paused panel show the new time immediately.
    this.update()
    this.publish()
  }

  // Load again whatever failed: movement chunks and the other files.
  retry() {
    const signal = this.abort?.signal
    if (!signal) return   // not started; start() loads everything anyway
    this.failedChunks.clear()
    this.loadAssets(signal, ['error'])
    this.stale = true
    this.update()
    this.publish()
  }

  // Camera commands go to whichever viewport is attached (none = ignored).
  focusOnWorld: ReplayCamera['focusOnWorld'] = (wx, wy, opts) => this.camera?.focusOnWorld(wx, wy, opts)
  focusOnPoints: ReplayCamera['focusOnPoints'] = (points, opts) => this.camera?.focusOnPoints(points, opts)
  focusOnPlayer: ReplayCamera['focusOnPlayer'] = (id) => this.camera?.focusOnPlayer(id)
  follow: ReplayCamera['follow'] = (ids, opts) => this.camera?.follow(ids, opts)

  // The viewport calls this when it mounts; the returned function detaches.
  attachCamera(camera: ReplayCamera): () => void {
    this.camera = camera
    return () => {
      if (this.camera === camera) this.camera = null
    }
  }

  // ---- listening -----------------------------------------------------------

  // Every animation frame (the canvas). Returns an unsubscribe function.
  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener)
    this.needsDraw = true
    return () => {
      this.frameListeners.delete(listener)
    }
  }

  // useSyncExternalStore's two functions. Arrow properties so their identity
  // never changes (a new subscribe function would make React resubscribe).
  subscribe = (listener: () => void): (() => void) => {
    this.snapshotListeners.add(listener)
    return () => {
      this.snapshotListeners.delete(listener)
    }
  }

  getSnapshot = (): ReplaySnapshot => this.snapshot

  // A player's inventory at time t: their changes up to t, replayed. A
  // player has a few hundred changes, so this is cheap enough to call on
  // every snapshot update. Empty until the inventory loads.
  inventoryAt(playerId: string, t: number): InventoryItem[] {
    const slots = new Map<number, InventoryItem>()
    for (const [ct, slot, item, count = 0, ammo = 0] of this.inventoryChanges[playerId] ?? []) {
      if (ct > t) break
      if (item < 0) slots.delete(slot)
      else slots.set(slot, { slot, itemId: this.inventoryItems[item], count, ammo })
    }
    return [...slots.values()].sort((a, b) => a.slot - b.slot)
  }

  // A player's whole-match totals up to time t: counts of their events with
  // time <= t, and the running damage sums there. Binary searches, so cheap.
  statsAt(playerId: string, t: number): MatchTotals {
    const p = this.playerStats[playerId]
    if (!p) return { elims: 0, knocks: 0, dealt: 0, taken: 0 }
    const dealtN = upperBound(p.dealtT, t)
    const takenN = upperBound(p.takenT, t)
    return {
      elims: upperBound(p.elims, t),
      knocks: upperBound(p.knocks, t),
      dealt: dealtN > 0 ? p.dealtSum[dealtN - 1] : 0,
      taken: takenN > 0 ? p.takenSum[takenN - 1] : 0,
    }
  }

  // ---- the frame loop ------------------------------------------------------

  // Runs once per animation frame. requestAnimationFrame passes `now`, the
  // frame's timestamp in ms (same stopwatch as performance.now()).
  private tick = (now: number) => {
    this.rafId = requestAnimationFrame(this.tick)
    const dt = this.lastFrameAt === null ? 0 : Math.min(MAX_FRAME_STEP_S, (now - this.lastFrameAt) / 1000)
    this.lastFrameAt = now

    // 1. move the clock, unless the data for the current time isn't there:
    // like a video buffering, the replay waits rather than skipping ahead
    if (!this._paused && dt > 0 && this.replayStatus === 'ready') {
      this._time = Math.min(this.duration, this._time + dt * this._rate)
      if (this._time >= this.duration) this._paused = true   // stop at the end
      this.stale = true
    }

    // 2. work out where everything is at the new time
    this.update()

    // 3. tell React about anything it shows (rounded, so rarely)
    this.publish(now)

    // 4. let the canvas redraw
    const changed = this.needsDraw
    this.needsDraw = false
    for (const listener of this.frameListeners) listener(dt, changed)
  }

  // Recompute the per-frame state for the current time, if anything changed.
  private update() {
    if (!this.stale) return
    this.stale = false
    this.needsDraw = true

    const { hz, interval_seconds: intervalSeconds, total_frames: totalFrames } = this.metadata
    const exactFrame = this._time * hz
    // Clamp so we never index past the last real frame of data.
    const frame = Math.min(Math.floor(exactFrame), totalFrames ? totalFrames - 1 : Number.POSITIVE_INFINITY)
    const alpha = exactFrame - Math.floor(exactFrame)
    const framesPerChunk = this.chunks.get(0)?.shape[0] ?? hz * intervalSeconds
    const chunkIndex = Math.floor(frame / framesPerChunk)

    this.ensureChunk(chunkIndex)
    this.ensureChunk(chunkIndex + 1)   // prefetch the next one
    const total = this.metadata.total_chunks
    this.replayStatus =
      this.chunks.has(chunkIndex) ? 'ready'
        // a chunk past the end can't load: the metadata and data disagree
        : this.failedChunks.has(chunkIndex) || (total !== undefined && chunkIndex >= total) ? 'error'
        : this.chunks.size === 0 ? 'loading'
        : 'buffering'

    const current = this.getFrame(frame, framesPerChunk)
    const next = this.getFrame(frame + 1, framesPerChunk)
    const currentStates = current ? getPlayerStatesFromFrame(current, this.indexToPlayer, this.idToUsername) : []
    const nextStates = next ? getPlayerStatesFromFrame(next, this.indexToPlayer, this.idToUsername) : []
    this.players = interpolatePlayerStates(currentStates, nextStates, alpha)

    this.zone = getZoneAtTime(this._time, this.zonePhases)
    this.nextZone = getNextZoneAtTime(this._time, this.zonePhases)
    this.shots = getActiveShots(this._time, this.allShots)
  }

  // Build a new snapshot if anything React shows has changed, and notify.
  private publish(now = performance.now()) {
    const prev = this.snapshot

    const time = Math.floor(this._time * 10) / 10
    const atEnd = this._time >= this.duration
    let playersAlive = 0
    for (const p of this.players) if (p.alive) playersAlive += 1

    const zoneNow = getZoneHudInfo(this._time, this.zonePhases)
    const zone = sameZone(prev.zone, zoneNow) ? prev.zone : zoneNow

    let vitals = prev.vitals
    if (this.vitalsStale || now - this.vitalsAt >= VITALS_INTERVAL_MS) {
      this.vitalsStale = false
      this.vitalsAt = now
      vitals = this.buildVitals(prev.vitals)
    }

    if (
      time === prev.time &&
      this._paused === prev.paused &&
      atEnd === prev.atEnd &&
      this._rate === prev.rate &&
      this.replayStatus === prev.replay &&
      playersAlive === prev.playersAlive &&
      zone === prev.zone &&
      vitals === prev.vitals &&
      this.assets.inventory === prev.inventory &&
      this.assets.stats === prev.stats
    ) {
      return
    }
    this.snapshot = {
      time, paused: this._paused, atEnd, rate: this._rate, replay: this.replayStatus,
      playersAlive, zone, vitals, inventory: this.assets.inventory, stats: this.assets.stats,
    }
    for (const listener of this.snapshotListeners) listener()
  }

  // Every player's vitals, reusing last time's objects where nothing changed
  // (and last time's whole record if no one changed).
  private buildVitals(prev: Record<string, PlayerVitals>): Record<string, PlayerVitals> {
    const next: Record<string, PlayerVitals> = {}
    let changed = false
    let count = 0
    for (const p of this.players) {
      if (p.playerId === null) continue
      count += 1
      const hp = Math.round(p.hp)
      const shield = Math.round(p.shield)
      const old = prev[p.playerId]
      if (old && old.hp === hp && old.shield === shield && old.alive === p.alive && old.knocked === p.dbno) {
        next[p.playerId] = old
      } else {
        next[p.playerId] = { hp, shield, alive: p.alive, knocked: p.dbno }
        changed = true
      }
    }
    if (!changed && count === Object.keys(prev).length) return prev
    return next
  }

  // ---- data loading --------------------------------------------------------

  private getFrame(absoluteFrame: number, framesPerChunk: number): Float32Array | null {
    if (absoluteFrame < 0) return null
    const chunk = this.chunks.get(Math.floor(absoluteFrame / framesPerChunk))
    if (!chunk) return null
    const frameInChunk = absoluteFrame % framesPerChunk
    const [frameCount, playerCount, featureCount] = chunk.shape
    // The last chunk is often shorter than a full chunk.
    if (frameInChunk >= frameCount) return null
    const stride = playerCount * featureCount
    return chunk.data.subarray(frameInChunk * stride, (frameInChunk + 1) * stride)
  }

  private ensureChunk(index: number) {
    const signal = this.abort?.signal
    if (!signal) return   // not started
    if (index < 0) return
    // Don't request chunks past the end of the match (they'd 404).
    const total = this.metadata.total_chunks
    if (total !== undefined && index >= total) return
    if (this.chunks.has(index) || this.loadingChunks.has(index) || this.failedChunks.has(index)) return
    this.loadingChunks.add(index)
    void this.loadChunk(index, signal)
  }

  private async loadChunk(index: number, signal: AbortSignal) {
    try {
      const params = new URLSearchParams({ matchId: this.metadata.match_id, chunkIndex: String(index), v: this.assetVersion })
      const response = await fetch(`/api/replay/movement-chunk?${params}`, { signal })
      if (!response.ok) throw new Error(`movement chunk ${index}: HTTP ${response.status}`)
      const parsed = await npy.load(await response.arrayBuffer())
      if (!(parsed.data instanceof Float32Array) || parsed.shape.length !== 3) {
        throw new Error(`movement chunk ${index}: not a 3D float32 array`)
      }
      if (signal.aborted) return
      this.chunks.set(index, { data: parsed.data, shape: parsed.shape as [number, number, number] })
    } catch {
      // The status ('error' once the replay reaches this chunk) is the report.
      if (!signal.aborted) this.failedChunks.add(index)
    } finally {
      // stop() already cleared the set for aborted loads (and a restarted
      // engine may be loading this chunk again), so only touch our own.
      if (!signal.aborted) {
        this.loadingChunks.delete(index)
        this.stale = true
        this.vitalsStale = true
      }
    }
  }

  // Starts loading every file whose status is one of `which` (by default,
  // everything not loaded yet). Each settles on its own; none blocks another.
  private loadAssets(signal: AbortSignal, which: AssetStatus[] = ['loading', 'error']) {
    const id = encodeURIComponent(this.metadata.match_id)
    const timeline = new URLSearchParams({ matchId: this.metadata.match_id, v: this.assetVersion })
    const loaders: Record<Asset, [string, (data: unknown) => void]> = {
      // Timeline files are served immutable, so they carry the timeline version.
      zones: [`/api/replay/zones?${timeline}`, (data) => this.applyZones(data)],
      shots: [`/api/replay/shots?${timeline}`, (data) => this.applyShots(data)],
      inventory: [`/api/replay/inventory?${new URLSearchParams({ matchId: this.metadata.match_id })}`, (data) => this.applyInventory(data)],
      stats: [`/api/replay/${id}/player-stats`, (data) => this.applyStats(data)],
    }
    for (const asset of Object.keys(loaders) as Asset[]) {
      if (which.includes(this.assets[asset])) void this.loadAsset(asset, ...loaders[asset], signal)
    }
  }

  private async loadAsset(asset: Asset, url: string, apply: (data: unknown) => void, signal: AbortSignal) {
    this.setAssetStatus(asset, 'loading')
    try {
      const res = await fetch(url, { signal })
      if (res.status === 404) return this.setAssetStatus(asset, 'missing')
      if (!res.ok) throw new Error(`${asset}: HTTP ${res.status}`)
      const data: unknown = await res.json()
      if (signal.aborted) return
      apply(data)   // throws on a malformed file
      this.setAssetStatus(asset, 'ready')
    } catch {
      if (!signal.aborted) this.setAssetStatus(asset, 'error')
    }
  }

  private setAssetStatus(asset: Asset, status: AssetStatus) {
    this.assets[asset] = status
    this.stale = true   // zones and shots change what's drawn
    this.publish()
  }

  // zones.json: sparse, one record per storm phase.
  private applyZones(data: unknown) {
    if (!Array.isArray(data)) throw new Error('zones: not an array')
    this.zonePhases = data as ZonePhase[]
  }

  // shots.json: thousands per match. getActiveShots relies on t-ascending order.
  private applyShots(data: unknown) {
    if (!Array.isArray(data)) throw new Error('shots: not an array')
    this.allShots = [...(data as Shot[])].sort((a, b) => a.t - b.t)
  }

  // inventory.json plus display info for every item in it.
  private applyInventory(data: unknown) {
    const d = data as Partial<InventoryPayload> | null
    if (!d || !Array.isArray(d.items) || typeof d.players !== 'object' || d.players === null) {
      throw new Error('inventory: malformed')
    }
    this.inventoryItems = d.items
    this.inventoryChanges = d.players
    this.itemInfo = d.itemInfo ?? {}
  }

  // Whole-match event times per player (eliminations, knocks, damage).
  private applyStats(data: unknown) {
    const players = (data as { players?: Record<string, PlayerEventTimes> } | null)?.players
    if (typeof players !== 'object' || players === null) throw new Error('player stats: malformed')
    const stats: Record<string, PlayerStatTimes> = {}
    for (const [playerId, e] of Object.entries(players)) {
      stats[playerId] = {
        elims: e.elims ?? [],
        knocks: e.knocks ?? [],
        dealtT: (e.dealt ?? []).map(([t]) => t),
        dealtSum: runningSums(e.dealt ?? []),
        takenT: (e.taken ?? []).map(([t]) => t),
        takenSum: runningSums(e.taken ?? []),
      }
    }
    this.playerStats = stats
  }
}

// How many of the ascending `times` are <= t (binary search).
function upperBound(times: number[], t: number): number {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

// Running totals of the [t, amount] pairs' amounts.
function runningSums(pairs: [number, number][]): number[] {
  const sums: number[] = []
  let total = 0
  for (const [, amount] of pairs) {
    total += amount
    sums.push(total)
  }
  return sums
}

function sameZone(a: ZoneHudInfo | null, b: ZoneHudInfo | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.currentZone === b.currentZone &&
    a.totalZones === b.totalZones &&
    a.isShrinking === b.isShrinking &&
    a.countdownSeconds === b.countdownSeconds
  )
}
