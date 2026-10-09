'use client'

// ---------------------------------------------------------------------------
// ReplayClient — the replay map, HUD and playback controls for one match.
//
// The replay itself runs in a ReplayEngine (lib/replay/engine.ts): the clock,
// the data, and where every player is right now. This file only shows it:
//   - ReplayViewport draws the map and, on top, one Konva Shape whose draw
//     function paints the storm, fight circles, shots and players straight from
//     the engine. The engine asks for a redraw every frame something moved, so
//     React isn't involved in playback at all.
//   - ZoneHud, ReplayStatusOverlay and ReplayControls are normal React components
//     that read the engine's snapshot with useReplay(), so they re-render only
//     when the numbers they show change (a few times a second at most).
//
// Pass `engine` to drive the replay from outside (the page calls engine.seek(),
// engine.follow(), ...). Without one, ReplayClient makes its own from
// `matchMetadata`.
// ---------------------------------------------------------------------------

import { Stage, Layer, Image as KonvaImage, Shape } from 'react-konva'
import { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Stage as KonvaStage } from 'konva/lib/Stage'
import type { Layer as KonvaLayer } from 'konva/lib/Layer'
import type { Context as KonvaContext } from 'konva/lib/Context'
import { Tween } from 'konva/lib/Tween'
import useImage from 'use-image'
import {
  getReplayWorldScale,
  ReplayMapDefinition,
  projectReplayWorldToMapImage,
} from '@/lib/replay/map-projection'
import type { MatchMetadata } from '@/lib/replay/match-data'
import { OUTCOME_HEX, type EngagementOverlay } from '@/lib/replay/engagements'
import { SHOT_FLASH_SECONDS, type ReplayCamera, type ReplayEngine, type ZoneHudInfo } from '@/lib/replay/engine'
import { useReplay, useReplayEngine } from '@/lib/replay/use-replay'
import { formatClock } from '@/lib/replay/format'
import { CenteredStatus, Spinner } from '@/components/replay/load-state'

// ---------------------------------------------------------------------------
// YAW / DIRECTION TUNING
// ---------------------------------------------------------------------------
// The engine gives each player a yaw in degrees. We turn that into a screen
// rotation (degrees, clockwise, 0 = pointing right/east) for the arrow.
// If the arrows point the wrong way, these two knobs are the place to touch
// (YAW_IS_DEGREES lives in the engine):
//   - YAW_SIGN:       set to -1 if arrows rotate the wrong direction.
//   - YAW_OFFSET_DEG: add/subtract 90/180 until "forward" looks correct.
const YAW_SIGN = 1
const YAW_OFFSET_DEG = 0

// The map projection rotates world positions by (rotationOffset - 90); the
// heading arrow must rotate by the same amount or it points the wrong way on
// rotated maps (Reload). BR (rotationOffset 90) adds 0, so it is unchanged.
function yawToScreenDegrees(yawDeg: number, rotationOffsetDeg: number): number {
  return YAW_SIGN * yawDeg + YAW_OFFSET_DEG + (rotationOffsetDeg - 90)
}

// Team colors
// Teams cycle through this palette; both player arrows and shot lines use it so
// a shot reads as "team X fired". A match can have more teams than colors, so
// distant team numbers may collide — acceptable, and rare within one fight.
const TEAM_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
  '#84cc16', '#06b6d4', '#8b5cf6', '#f43f5e',
  '#10b981', '#6366f1', '#d946ef', '#facc15',
]
// Fallback arrow color when the match has no team map (schema_version < 2).
const NEUTRAL_ARROW = '#4ade80'

function teamColor(team: number | null | undefined): string {
  if (team == null) return NEUTRAL_ARROW
  const n = TEAM_COLORS.length
  return TEAM_COLORS[((team % n) + n) % n]
}

// Screen-space cap (px) on a shotgun line's drawn length, so shotguns read as
// short-range regardless of where the pellet endpoint landed.
const SHOTGUN_CAP_SCREEN_PX = 42

// ---------------------------------------------------------------------------
// Player marker layout (on-screen px; bump these to resize everything)
// ---------------------------------------------------------------------------
// A direction arrowhead with a dark box above it holding the name and the
// shield/health bars. Everything is in SCREEN pixels: the draw code scales by
// 1/zoom, so markers stay the same size however far you zoom.
const FONT_SIZE = 13
const NAME_FONT = `bold ${FONT_SIZE}px Arial`
const MIN_CONTENT_WIDTH = 60 // floor for the bars/box so short names aren't tiny
const BAR_HEIGHT = 7
const BAR_GAP = 2            // vertical gap between the shield and health bars
const NAME_BAR_GAP = 3       // gap between the name and the top (shield) bar
const BOX_PADDING = 4        // inner padding of the dark box
const BOX_GAP = 16           // gap between the box bottom and the arrow
const BOX_HEIGHT = FONT_SIZE + NAME_BAR_GAP + BAR_HEIGHT + BAR_GAP + BAR_HEIGHT + BOX_PADDING * 2
const BOX_TOP = -BOX_GAP - BOX_HEIGHT
const NAME_Y = BOX_TOP + BOX_PADDING
const SHIELD_Y = NAME_Y + FONT_SIZE + NAME_BAR_GAP
const HEALTH_Y = SHIELD_Y + BAR_HEIGHT + BAR_GAP

// A click within this many screen px of a player's position hits their arrow.
const ARROW_HIT_RADIUS = 12

// Measures the rendered pixel width of a name, so the nametag box hugs the
// text. Each name is measured once and remembered.
let measureCtx: CanvasRenderingContext2D | null = null
const nameWidths = new Map<string, number>()
function nameWidth(text: string): number {
  const cached = nameWidths.get(text)
  if (cached !== undefined) return cached
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * FONT_SIZE * 0.6
  measureCtx.font = NAME_FONT
  const width = measureCtx.measureText(text).width
  nameWidths.set(text, width)
  return width
}

// Fight badges (screen px): a slightly see-through dark gray disc with the
// fight's number. No edge in the all-teams view; viewing as a team, the edge is
// that team's outcome color; the selected fight's is amber.
const BADGE_RADIUS = 13
const BADGE_FILL = 'rgba(24, 24, 26, 0.8)'
const SELECTED_RING = '#fbbf24'
const PULSE_COLOR = 'rgba(255, 255, 255, 0.9)'
const FADED_ALPHA = 0.25       // the other fights while one is selected
const IN_PROGRESS_ALPHA = 0.4  // the selected fight while the replay is inside it, so it doesn't hide the action
const PULSE_PERIOD_MS = 1800   // one pulse of an ongoing fight

// In the all-teams view (no outcome to color by), a fight pulses while the
// replay is inside it.
function isPulsing(engagement: EngagementOverlay, time: number): boolean {
  return engagement.outcome === null && time >= engagement.startS && time <= engagement.endS
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// Where each clickable thing was last drawn, for click detection. x/y are map
// coords (like the drawing); the sizes are screen px.
type HitTarget =
  | { kind: 'player'; id: string; x: number; y: number; boxLeft: number; boxWidth: number }
  | { kind: 'engagement'; id: number; x: number; y: number; r: number }

type SceneArgs = {
  engine: ReplayEngine
  image: HTMLImageElement
  mapDefinition: ReplayMapDefinition
  zoom: number                       // the stage's current scale
  engagements: EngagementOverlay[] | undefined
  selectedEngagementId: number | null | undefined
  hits: HitTarget[]                  // filled in while drawing
}

// Draws everything that moves, in map coords (Konva has already applied the
// pan/zoom to the context). Bottom to top: storm, fight badges, shots,
// players. Runs on every redraw, so it reads the engine's current state.
function drawScene(c: CanvasRenderingContext2D, a: SceneArgs) {
  const { engine, image, mapDefinition, zoom, hits } = a
  const inv = 1 / zoom   // scale by this to draw in screen px
  const project = (x: number, y: number) =>
    projectReplayWorldToMapImage({ x, y, imageWidth: image.width, imageHeight: image.height, mapDefinition })
  hits.length = 0

  // ---- storm ----
  // 1. purple everywhere OUTSIDE the current zone: a full-map rect with the
  //    zone circle drawn the other way round, which cuts it out (nonzero rule)
  // 2. white ring where the storm will settle (none once the last zone formed)
  // 3. purple ring at the storm edge
  if (engine.zone) {
    const worldScale = getReplayWorldScale({ imageWidth: image.width, mapDefinition })
    const center = project(engine.zone.cx, engine.zone.cy)
    const radius = engine.zone.r * worldScale
    c.beginPath()
    c.rect(-image.width / 2, -image.height / 2, image.width, image.height)
    c.arc(center.x, center.y, radius, 0, Math.PI * 2, true)
    c.closePath()
    c.fillStyle = 'rgba(130, 60, 210, 0.42)'
    c.fill()

    if (engine.nextZone) {
      const next = project(engine.nextZone.cx, engine.nextZone.cy)
      c.beginPath()
      c.arc(next.x, next.y, engine.nextZone.r * worldScale, 0, Math.PI * 2)
      c.strokeStyle = 'rgba(255, 255, 255, 0.75)'
      c.lineWidth = 2 * inv
      c.stroke()
    }

    c.beginPath()
    c.arc(center.x, center.y, radius, 0, Math.PI * 2)
    c.strokeStyle = 'rgba(180, 80, 255, 0.9)'
    c.lineWidth = 2.5 * inv
    c.stroke()
  }

  // ---- fight badges: under the players so live action stays on top ----
  // With a fight selected, it's drawn last (on top) and the others fade until
  // the replay passes its end; while the replay is inside it, the selected badge
  // itself goes see-through. The selection itself stays (the page owns it).
  const fights = a.engagements ?? []
  const selectedFight = fights.find((e) => e.id === a.selectedEngagementId) ?? null
  const selectedId = selectedFight?.id ?? null
  const fading = selectedFight !== null && engine.time <= selectedFight.endS
  const ordered = selectedId === null
    ? fights
    : [...fights.filter((e) => e.id !== selectedId), ...fights.filter((e) => e.id === selectedId)]
  const pulse = (performance.now() % PULSE_PERIOD_MS) / PULSE_PERIOD_MS   // 0 → 1
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  for (const engagement of ordered) {
    const p = project(engagement.centroid[0], engagement.centroid[1])
    const selected = engagement.id === selectedId
    const inProgress = engine.time >= engagement.startS && engine.time <= engagement.endS
    const badgeR = selected ? BADGE_RADIUS + 2 : BADGE_RADIUS
    const ring = selected ? SELECTED_RING : engagement.outcome ? OUTCOME_HEX[engagement.outcome] : null
    const alpha = selected ? (inProgress ? IN_PROGRESS_ALPHA : 1) : fading ? FADED_ALPHA : 1

    c.save()
    c.translate(p.x, p.y)
    c.scale(inv, inv)

    // an ongoing fight: a ring that grows out of the badge and fades
    if (isPulsing(engagement, engine.time)) {
      c.globalAlpha = alpha * 0.8 * (1 - pulse)
      c.beginPath()
      c.arc(0, 0, badgeR + 2 + pulse * 14, 0, Math.PI * 2)
      c.lineWidth = 2
      c.strokeStyle = selected ? SELECTED_RING : PULSE_COLOR
      c.stroke()
    }

    // the badge
    c.globalAlpha = alpha
    c.beginPath()
    c.arc(0, 0, badgeR, 0, Math.PI * 2)
    c.shadowColor = 'rgba(0, 0, 0, 0.55)'
    c.shadowBlur = 5
    c.shadowOffsetY = 1
    c.fillStyle = BADGE_FILL
    c.fill()
    c.shadowColor = 'transparent'
    if (ring) {
      c.lineWidth = selected ? 2.5 : 2
      c.strokeStyle = ring
      c.stroke()
    }
    c.font = selected ? 'bold 13px Arial' : 'bold 12px Arial'
    c.fillStyle = 'white'
    c.fillText(String(engagement.number), 0, 0.5)
    c.restore()
    hits.push({ kind: 'engagement', id: engagement.id, x: p.x, y: p.y, r: badgeR + 2 })
  }

  // ---- shots: a brief flash from shooter to endpoint, in the shooter's team color ----
  c.lineCap = 'round'
  for (const shot of engine.shots) {
    const origin = project(shot.ax, shot.ay)
    const end = project(shot.ex, shot.ey)
    let endX = end.x
    let endY = end.y
    if (shot.sg) {
      // Shotguns: cap the drawn length at a screen-constant length.
      const dx = end.x - origin.x
      const dy = end.y - origin.y
      const len = Math.hypot(dx, dy)
      const cap = SHOTGUN_CAP_SCREEN_PX * inv
      if (len > cap && len > 0) {
        endX = origin.x + (dx / len) * cap
        endY = origin.y + (dy / len) * cap
      }
    }
    c.globalAlpha = Math.max(0, 1 - (engine.time - shot.t) / SHOT_FLASH_SECONDS)
    c.beginPath()
    c.moveTo(origin.x, origin.y)
    c.lineTo(endX, endY)
    c.strokeStyle = teamColor(shot.team)
    c.lineWidth = (shot.sg ? 3.5 : 1.5) * inv
    c.stroke()
  }
  c.globalAlpha = 1

  // ---- players ----
  const indexToTeam = engine.metadata.index_to_team
  c.font = NAME_FONT
  for (const player of engine.players) {
    if (!player.alive || !player.known) continue
    const p = project(player.x, player.y)
    const label = player.username ?? `P${player.playerIndex}`
    // The box grows to fit a long name but never drops below MIN_CONTENT_WIDTH;
    // the bars span the full content width.
    const contentWidth = Math.max(MIN_CONTENT_WIDTH, nameWidth(label))
    const boxWidth = contentWidth + BOX_PADDING * 2
    const boxLeft = -boxWidth / 2
    const barLeft = -contentWidth / 2
    // Knocked players are yellow; otherwise the team color.
    const color = player.dbno ? '#facc15' : teamColor(indexToTeam?.[String(player.playerIndex)])

    c.save()
    c.translate(p.x, p.y)
    c.scale(inv, inv)

    // Arrowhead, drawn pointing east and rotated to the view direction. The
    // 4th point pulls the back edge in (the notch).
    c.save()
    c.rotate((yawToScreenDegrees(player.yawDeg, mapDefinition.rotationOffset) * Math.PI) / 180)
    c.beginPath()
    c.moveTo(10, 0)
    c.lineTo(-8, -7)
    c.lineTo(-3.5, 0)
    c.lineTo(-8, 7)
    c.closePath()
    c.fillStyle = color
    c.fill()
    c.strokeStyle = '#0b0b0b'
    c.lineWidth = 1.5
    c.stroke()
    c.restore()

    // Translucent box so the name and bars read over any terrain.
    c.fillStyle = 'rgba(0, 0, 0, 0.6)'
    c.fillRect(boxLeft, BOX_TOP, boxWidth, BOX_HEIGHT)
    c.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    c.lineWidth = 1
    c.strokeRect(boxLeft, BOX_TOP, boxWidth, BOX_HEIGHT)

    c.fillStyle = 'white'
    c.fillText(label, 0, NAME_Y + FONT_SIZE / 2)

    // Shield bar on top, health below.
    c.fillStyle = '#1f2937'
    c.fillRect(barLeft, SHIELD_Y, contentWidth, BAR_HEIGHT)
    c.fillRect(barLeft, HEALTH_Y, contentWidth, BAR_HEIGHT)
    c.fillStyle = '#3b82f6'
    c.fillRect(barLeft, SHIELD_Y, contentWidth * clamp01(player.shield / 100), BAR_HEIGHT)
    // While knocked, hp is the knocked health, drawn red like the details panel.
    c.fillStyle = player.dbno ? '#ef4444' : '#22c55e'
    c.fillRect(barLeft, HEALTH_Y, contentWidth * clamp01(player.hp / 100), BAR_HEIGHT)

    c.restore()
    if (player.playerId) {
      hits.push({ kind: 'player', id: player.playerId, x: p.x, y: p.y, boxLeft, boxWidth })
    }
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

// What's under a screen point: the top-most player arrow or nametag, else the
// top-most fight circle, else nothing. Later entries were drawn on top.
function hitTest(hits: HitTarget[], point: { x: number; y: number }, stage: KonvaStage): HitTarget | null {
  const zoom = stage.scaleX()
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const h = hits[i]
    // offset from the target's on-screen position, in screen px
    const dx = point.x - (stage.x() + zoom * h.x)
    const dy = point.y - (stage.y() + zoom * h.y)
    if (h.kind === 'player') {
      if (dx * dx + dy * dy <= ARROW_HIT_RADIUS * ARROW_HIT_RADIUS) return h
      if (dx >= h.boxLeft && dx <= h.boxLeft + h.boxWidth && dy >= BOX_TOP && dy <= BOX_TOP + BOX_HEIGHT) return h
    } else if (dx * dx + dy * dy <= h.r * h.r) {
      return h
    }
  }
  return null
}

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
// HTML overlays: read the engine's snapshot, re-render only when it changes
// ---------------------------------------------------------------------------

function ZoneHud({ engine }: { engine: ReplayEngine }) {
  const playersAlive = useReplay(engine, (s) => s.playersAlive)
  const zoneInfo: ZoneHudInfo | null = useReplay(engine, (s) => s.zone)

  const pill =
    'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold text-white tabular-nums'
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
          <span className="opacity-50">/{engine.totalPlayers}</span>
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

// What the map shows while the data for the current time isn't there: a
// cover until the first chunk arrives, a small badge while buffering after a
// seek, or the failure with Retry. The clock holds in all three.
function ReplayStatusOverlay({ engine }: { engine: ReplayEngine }) {
  const status = useReplay(engine, (s) => s.replay)
  if (status === 'ready') return null
  if (status === 'buffering') {
    return (
      <div
        role="status"
        className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-sm bg-[var(--panel)]/90 px-3 py-1.5 text-sm text-slate-200"
      >
        <Spinner className="size-3.5" />
        Buffering…
      </div>
    )
  }
  return (
    <div className="absolute inset-0 z-20 bg-[var(--app-bg)]/55">
      {status === 'loading' ? (
        <CenteredStatus loading>Loading replay…</CenteredStatus>
      ) : (
        <CenteredStatus onRetry={() => engine.retry()}>Couldn&apos;t load the replay data.</CenteredStatus>
      )}
    </div>
  )
}

// The map image, with a way to load it again after a failure. use-image
// reloads when its URL changes; a fragment changes the URL without changing
// the request (the presigned S3 URL can't take another query parameter).
function useMapImage(url: string) {
  const [attempt, setAttempt] = useState(0)
  const [image, status] = useImage(attempt ? `${url}#retry-${attempt}` : url)
  return { image, status, retry: () => setAttempt((a) => a + 1) }
}

// Playback speeds the − / + buttons step through, and the jump size.
const PLAYBACK_RATES = [0.25, 0.5, 1, 2, 4, 8]
const JUMP_S = 5

// The playback controls, floating just above the bottom of the map and about
// half its width: play/pause, jump back/forward, speed, then the time, the seek
// track and the length, each its own block. Viewing as a team, its fights are
// marked on the track in its outcome colors (not in the all-teams view, where
// marks would cover most of the bar).
function ReplayControls({
  engine,
  engagements,
}: {
  engine: ReplayEngine
  engagements: EngagementOverlay[] | undefined
}) {
  const time = useReplay(engine, (s) => s.time)
  const paused = useReplay(engine, (s) => s.paused)
  const atEnd = useReplay(engine, (s) => s.atEnd)
  const rate = useReplay(engine, (s) => s.rate)
  const duration = engine.duration
  const hasDuration = Number.isFinite(duration)
  const marks = hasDuration ? (engagements ?? []).filter((e) => e.outcome !== null) : []

  const rateIndex = PLAYBACK_RATES.indexOf(rate)
  // Steps from the engine's live rate, not the rendered one, so quick repeated
  // clicks each take a step.
  const stepRate = (step: number) => {
    const current = PLAYBACK_RATES.indexOf(engine.rate)
    const next = PLAYBACK_RATES[(current === -1 ? PLAYBACK_RATES.indexOf(1) : current) + step]
    if (next !== undefined) engine.setRate(next)
  }

  const block =
    'pointer-events-auto rounded-[4px] border border-white/[0.08] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)]'
  const control = 'grid h-full place-items-center text-white hover:text-sky-300 disabled:text-white/30'

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex h-8 -translate-x-1/2 gap-1.5"
      style={{ width: 'max(520px, 50%)', maxWidth: 'calc(100% - 24px)' }}
    >
      <button
        type="button"
        onClick={() => engine.togglePlay()}
        aria-label={atEnd ? 'Replay' : paused ? 'Play' : 'Pause'}
        className={`${block} ${control} w-9`}
      >
        {atEnd ? (
          <RotateCcw className="size-4" />
        ) : paused ? (
          <Play className="size-4 fill-current" />
        ) : (
          <Pause className="size-4 fill-current" />
        )}
      </button>

      <div className={`${block} flex`}>
        <button
          type="button"
          onClick={() => engine.seek(engine.time - JUMP_S)}
          aria-label={`Back ${JUMP_S} seconds`}
          className={`${control} pl-1.5 pr-0.5 text-xs font-semibold`}
        >
          −{JUMP_S}s
        </button>
        <button
          type="button"
          onClick={() => engine.seek(engine.time + JUMP_S)}
          aria-label={`Forward ${JUMP_S} seconds`}
          className={`${control} pl-0.5 pr-1.5 text-xs font-semibold`}
        >
          +{JUMP_S}s
        </button>
      </div>

      <div className={`${block} flex items-center`}>
        <button
          type="button"
          onClick={() => stepRate(-1)}
          disabled={rateIndex === 0}
          aria-label="Slower"
          className={`${control} w-5`}
        >
          <Minus className="size-3" />
        </button>
        <span className="w-8 text-center text-xs font-semibold tabular-nums text-white" aria-label="Playback speed">
          {rate}x
        </span>
        <button
          type="button"
          onClick={() => stepRate(1)}
          disabled={rateIndex === PLAYBACK_RATES.length - 1}
          aria-label="Faster"
          className={`${control} w-5`}
        >
          <Plus className="size-3" />
        </button>
      </div>

      <div className={`${block} flex min-w-0 flex-1 items-center gap-3 px-3`}>
        <span className="text-[13px] font-semibold tabular-nums text-white">{formatClock(time)}</span>
        <SeekTrack engine={engine} time={time} duration={hasDuration ? duration : 0} marks={marks} />
        <span className="text-[13px] tabular-nums text-white/65">{hasDuration ? formatClock(duration) : '--:--'}</span>
      </div>
    </div>
  )
}

// The seek track: press or drag anywhere on it to seek; the arrow keys step 5
// seconds. A white line marks the current time.
function SeekTrack({
  engine,
  time,
  duration,
  marks,
}: {
  engine: ReplayEngine
  time: number
  duration: number          // 0 while unknown (the track is inert)
  marks: EngagementOverlay[]
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pct = (s: number) => (duration > 0 ? (Math.max(0, Math.min(duration, s)) / duration) * 100 : 0)
  const seekTo = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || duration <= 0) return
    engine.seek(((clientX - rect.left) / rect.width) * duration)
  }

  return (
    <div
      role="slider"
      tabIndex={duration > 0 ? 0 : -1}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      aria-valuetext={formatClock(time)}
      className="relative flex h-full min-w-0 flex-1 cursor-pointer items-center rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-sky-400/60"
      onPointerDown={(e) => {
        if (duration <= 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        seekTo(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekTo(e.clientX)
      }}
      onKeyDown={(e) => {
        const target =
          e.key === 'ArrowLeft' ? time - 5
            : e.key === 'ArrowRight' ? time + 5
            : e.key === 'Home' ? 0
            : e.key === 'End' ? duration
            : null
        if (target === null) return
        e.preventDefault()
        engine.seek(target)
      }}
    >
      <div ref={trackRef} className="relative h-1.5 w-full rounded-sm bg-white/15">
        <div className="absolute inset-y-0 left-0 rounded-sm bg-white/30" style={{ width: `${pct(time)}%` }} />
        {marks.map((m) => (
          <span
            key={m.id}
            title={`#${m.number} · ${formatClock(m.startS)}–${formatClock(m.endS)}`}
            className="absolute -top-[3px] h-3 min-w-[3px] rounded-[1px]"
            style={{
              left: `${pct(m.startS)}%`,
              width: `${pct(m.endS) - pct(m.startS)}%`,
              background: m.outcome ? OUTCOME_HEX[m.outcome] : undefined,
            }}
          />
        ))}
        <span
          className="absolute -top-[6px] h-[18px] w-0.5 -translate-x-1/2 rounded-sm bg-white"
          style={{ left: `${pct(time)}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReplayClient
// ---------------------------------------------------------------------------

type ReplayClientProps = {
  engine?: ReplayEngine           // drive the replay from outside; otherwise one is made here
  matchMetadata?: MatchMetadata   // only needed when no engine is passed
  mapDefinition: ReplayMapDefinition
  mapImageUrl: string
  stageWidth?: number
  stageHeight?: number
  onPlayerClick?: (playerId: string) => void
  engagements?: EngagementOverlay[]
  selectedEngagementId?: number | null
  onEngagementClick?: (id: number) => void
  // Called when following ends without the page asking: the user dragged the
  // map, a focus moved the camera, or a follow's `until` time passed.
  onFollowChange?: (playerIds: string[] | null) => void
}

export default function ReplayClient({
  engine: givenEngine,
  matchMetadata,
  mapDefinition,
  mapImageUrl,
  stageWidth = 1000,
  stageHeight = 700,
  onPlayerClick,
  engagements,
  selectedEngagementId,
  onEngagementClick,
  onFollowChange,
}: ReplayClientProps) {
  const ownEngine = useReplayEngine(givenEngine ? null : matchMetadata)
  const engine = givenEngine ?? ownEngine
  const map = useMapImage(mapImageUrl)
  if (!engine) return null

  return (
    <div
      className="relative overflow-hidden bg-[var(--panel)]"
      style={{ width: stageWidth, height: stageHeight }}
      data-map-id={mapDefinition.id}
    >
      {map.status === 'failed' ? (
        <CenteredStatus onRetry={map.retry}>Couldn&apos;t load the map.</CenteredStatus>
      ) : !map.image ? (
        <CenteredStatus loading>Loading map…</CenteredStatus>
      ) : (
        <>
          <ReplayStatusOverlay engine={engine} />
          <ZoneHud engine={engine} />
          <ReplayViewport
            engine={engine}
            mapDefinition={mapDefinition}
            mapImage={map.image}
            stageWidth={stageWidth}
            stageHeight={stageHeight}
            onPlayerClick={onPlayerClick}
            engagements={engagements}
            selectedEngagementId={selectedEngagementId}
            onEngagementClick={onEngagementClick}
            onFollowChange={onFollowChange}
          />
          {/* Floating controls overlaid on the bottom of the map. */}
          <ReplayControls engine={engine} engagements={engagements} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReplayViewport: the Konva stage, the camera, and click detection
// ---------------------------------------------------------------------------

function clampStagePosition(
  pos: { x: number, y: number },
  scale: number,
  imageWidth: number,
  imageHeight: number,
  stageWidth: number,
  stageHeight: number,
) {
  const scaledW = imageWidth * scale
  const scaledH = imageHeight * scale
  return {
    x: Math.max(stageWidth - scaledW / 2, Math.min(scaledW / 2, pos.x)),
    y: Math.max(stageHeight - scaledH / 2, Math.min(scaledH / 2, pos.y)),
  }
}

const MAX_SCALE = 10.0

// Following: the zoom a follow starts at (unless already zoomed in further),
// the screen-px margin kept around the group, and how fast the camera eases
// toward its target (per second; higher = snappier).
const DEFAULT_FOLLOW_ZOOM = 3.25
const FOLLOW_PADDING = 120
const FOLLOW_EASE = 5

// An active follow: who, until when, the zoom the viewer wants, and the eased
// camera (map coords of the view center + zoom).
type Follow = {
  ids: Set<string>
  until: number | null
  zoom: number
  cam: { x: number; y: number; zoom: number }
}

function ReplayViewport({
  engine,
  mapDefinition,
  mapImage,
  stageWidth,
  stageHeight,
  onPlayerClick,
  engagements,
  selectedEngagementId,
  onEngagementClick,
  onFollowChange,
}: {
  engine: ReplayEngine
  mapDefinition: ReplayMapDefinition
  mapImage: HTMLImageElement
  stageWidth: number
  stageHeight: number
  onPlayerClick?: (playerId: string) => void
  engagements?: EngagementOverlay[]
  selectedEngagementId?: number | null
  onEngagementClick?: (engagementId: number) => void
  onFollowChange?: (playerIds: string[] | null) => void
}) {
  const stageRef = useRef<KonvaStage>(null)
  const sceneLayerRef = useRef<KonvaLayer>(null)
  const hitsRef = useRef<HitTarget[]>([])

  // "cover" fit: the map fills the whole viewport. It's also the minimum zoom,
  // so you can never zoom out past "map fills the viewport".
  const fitScale = mapImage
    ? Math.max(stageWidth / mapImage.width, stageHeight / mapImage.height)
    : 0.5

  // Latest callback for code that runs outside render (camera, frame loop).
  const onFollowChangeRef = useRef(onFollowChange)
  useEffect(() => {
    onFollowChangeRef.current = onFollowChange
  })
  // Latest fights, for the frame loop: while one is pulsing the scene redraws
  // every frame, even when paused.
  const engagementsRef = useRef(engagements)
  useEffect(() => {
    engagementsRef.current = engagements
  })

  // Only one thing moves the camera at a time: a focus animation (tween),
  // following, or the user (drag / wheel). Whichever takes over stops the
  // others; otherwise they fight over the stage position and the view tears.
  const tweenRef = useRef<Tween | null>(null)
  const followRef = useRef<Follow | null>(null)
  const stopTween = () => {
    tweenRef.current?.destroy()
    tweenRef.current = null
  }
  // End following because something else took the camera, and tell the page.
  const breakFollow = () => {
    if (!followRef.current) return
    followRef.current = null
    onFollowChangeRef.current?.(null)
  }
  useEffect(() => () => tweenRef.current?.destroy(), [])

  // ---- the camera, attached to the engine so the page can call engine.follow() etc. ----
  useEffect(() => {
    const stage = stageRef.current
    if (!mapImage || !stage) return

    // world → map coords (the same projection players use)
    const project = (worldX: number, worldY: number) =>
      projectReplayWorldToMapImage({
        x: worldX, y: worldY,
        imageWidth: mapImage.width, imageHeight: mapImage.height,
        mapDefinition,
      })

    // Animate the camera so map point p sits at the viewport center at `zoom`.
    const animateTo = (p: { x: number; y: number }, zoom: number) => {
      // the stage position that centers p (solve center = stagePos + zoom·p),
      // clamped so a near-edge target doesn't reveal the gray border
      const target = clampStagePosition(
        { x: stageWidth / 2 - zoom * p.x, y: stageHeight / 2 - zoom * p.y },
        zoom, mapImage.width, mapImage.height, stageWidth, stageHeight,
      )
      stopTween()
      breakFollow()
      const tween: Tween = new Tween({
        node: stage,
        x: target.x,
        y: target.y,
        scaleX: zoom,
        scaleY: zoom,
        duration: 0.6,
        onFinish: () => {
          if (tweenRef.current === tween) tweenRef.current = null
          tween.destroy()
        },
      })
      tweenRef.current = tween
      tween.play()
    }

    const focusOnWorld: ReplayCamera['focusOnWorld'] = (worldX, worldY, { zoom = 4 } = {}) => {
      animateTo(project(worldX, worldY), zoom)
    }

    // Frame a set of WORLD points: center on their bounding box and zoom so the
    // box, plus `padding` screen px on each side, fits the viewport. A single
    // point (or points on top of each other) zooms straight to maxZoom.
    const focusOnPoints: ReplayCamera['focusOnPoints'] = (points, { padding = 80, maxZoom = 6 } = {}) => {
      if (points.length === 0) return
      const local = points.map((pt) => project(pt.x, pt.y))
      const xs = local.map((pt) => pt.x)
      const ys = local.map((pt) => pt.y)
      const minX = Math.min(...xs), maxX = Math.max(...xs)
      const minY = Math.min(...ys), maxY = Math.max(...ys)
      const fit = Math.min(
        Math.max(1, stageWidth - 2 * padding) / (maxX - minX),
        Math.max(1, stageHeight - 2 * padding) / (maxY - minY),
      )  // Infinity along an axis with zero extent
      const zoom = Math.max(fitScale, Math.min(fit, maxZoom, MAX_SCALE))
      animateTo({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, zoom)
    }

    return engine.attachCamera({
      focusOnWorld,
      focusOnPoints,
      focusOnPlayer: (playerId) => {
        const player = engine.players.find((p) => p.playerId === playerId)
        if (player) focusOnWorld(player.x, player.y)   // WORLD coords, projected inside
      },
      follow: (playerIds, opts) => {
        stopTween()   // follow takes the camera from a running focus animation
        if (!playerIds || playerIds.length === 0) {
          followRef.current = null
          return
        }
        // Start easing from wherever the camera is now, at the viewer's zoom
        // or a useful close-up if they're zoomed out; the follow zooms out
        // further only if the group doesn't fit. Calling follow again with the
        // same players resumes it.
        const k = stage.scaleX()
        followRef.current = {
          ids: new Set(playerIds),
          until: opts?.until ?? null,
          zoom: Math.max(k, DEFAULT_FOLLOW_ZOOM),
          cam: { x: (stageWidth / 2 - stage.x()) / k, y: (stageHeight / 2 - stage.y()) / k, zoom: k },
        }
      },
    })
  }, [engine, mapImage, mapDefinition, stageWidth, stageHeight, fitScale])

  // ---- every frame: move the camera if following, redraw what changed ----
  useEffect(() => {
    const stage = stageRef.current
    const layer = sceneLayerRef.current
    if (!mapImage || !stage || !layer) return

    // One follow step: frame the followed players who are alive and on the
    // map, easing the center and zoom toward that framing. Returns whether the
    // camera moved. Players not on the map yet (bus) or eliminated drop out;
    // if none are left the camera holds still.
    const stepFollow = (dt: number): boolean => {
      const f = followRef.current
      if (!f || stage.isDragging()) return false
      if (f.until !== null && engine.time > f.until) {
        breakFollow()
        return false
      }
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const p of engine.players) {
        if (p.playerId === null || !f.ids.has(p.playerId) || !p.alive || !p.known) continue
        const m = projectReplayWorldToMapImage({
          x: p.x, y: p.y,
          imageWidth: mapImage.width, imageHeight: mapImage.height,
          mapDefinition,
        })
        minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x)
        minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y)
      }
      if (minX === Infinity) return false

      // the framing focusOnPoints would pick, capped at the viewer's zoom
      const fit = Math.min(
        Math.max(1, stageWidth - 2 * FOLLOW_PADDING) / (maxX - minX),
        Math.max(1, stageHeight - 2 * FOLLOW_PADDING) / (maxY - minY),
      )
      const targetZoom = Math.max(fitScale, Math.min(fit, f.zoom, MAX_SCALE))

      // ease (frame-rate independent); zoom eases in log space so it feels even
      const cam = f.cam
      const a = 1 - Math.exp(-dt * FOLLOW_EASE)
      cam.x += ((minX + maxX) / 2 - cam.x) * a
      cam.y += ((minY + maxY) / 2 - cam.y) * a
      cam.zoom = Math.exp(Math.log(cam.zoom) + (Math.log(targetZoom) - Math.log(cam.zoom)) * a)

      const pos = clampStagePosition(
        { x: stageWidth / 2 - cam.zoom * cam.x, y: stageHeight / 2 - cam.zoom * cam.y },
        cam.zoom, mapImage.width, mapImage.height, stageWidth, stageHeight,
      )
      // Settled (less than a twentieth of a pixel off): leave the stage alone,
      // so a paused, followed replay stops redrawing.
      if (
        Math.abs(pos.x - stage.x()) < 0.05 &&
        Math.abs(pos.y - stage.y()) < 0.05 &&
        Math.abs(cam.zoom - stage.scaleX()) < cam.zoom * 1e-4
      ) {
        return false
      }
      stage.scale({ x: cam.zoom, y: cam.zoom })
      stage.position(pos)
      return true
    }

    return engine.onFrame((dt, changed) => {
      // A camera move redraws everything (the map too); otherwise only the
      // scene layer, and only if the engine's state changed.
      if (stepFollow(dt)) stage.batchDraw()
      else if (changed || engagementsRef.current?.some((e) => isPulsing(e, engine.time))) layer.batchDraw()
    })
  }, [engine, mapImage, mapDefinition, stageWidth, stageHeight, fitScale])

  // useLayoutEffect fires before the browser paints, so the stage is at the
  // correct scale on the very first frame — no gray-border flash.
  // The first fit for a map image shows the whole map. Later size changes (a
  // side panel opening or closing) keep what the viewer was looking at: the
  // same map point stays centered and the zoom is kept, raised to the new
  // minimum if the viewport grew.
  const fittedImageRef = useRef<HTMLImageElement | null>(null)
  const lastSizeRef = useRef({ width: stageWidth, height: stageHeight })
  useLayoutEffect(() => {
    if (!mapImage || !stageRef.current) return

    const stage = stageRef.current
    const fit = Math.max(stageWidth / mapImage.width, stageHeight / mapImage.height)
    const prev = lastSizeRef.current
    lastSizeRef.current = { width: stageWidth, height: stageHeight }

    if (fittedImageRef.current !== mapImage) {
      fittedImageRef.current = mapImage
      stage.scale({ x: fit, y: fit })
      stage.position({ x: stageWidth / 2, y: stageHeight / 2 })
    } else {
      const k = stage.scaleX()
      const center = { x: (prev.width / 2 - stage.x()) / k, y: (prev.height / 2 - stage.y()) / k }
      const nk = Math.max(k, fit)
      stage.scale({ x: nk, y: nk })
      stage.position(clampStagePosition(
        { x: stageWidth / 2 - nk * center.x, y: stageHeight / 2 - nk * center.y },
        nk, mapImage.width, mapImage.height, stageWidth, stageHeight,
      ))
    }
    stage.batchDraw()
  }, [mapImage, stageHeight, stageWidth])

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    stopTween()   // user zoom takes the camera from a running focus animation

    const stage = stageRef.current
    if (!stage || !mapImage) return
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
    // Clamp the position too so zooming out near the edge doesn't expose the
    // gray border.
    stage.position(clampStagePosition(
      { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale },
      newScale, mapImage.width, mapImage.height, stageWidth, stageHeight,
    ))
    stage.batchDraw()
    // While following, wheel zoom sets the zoom the follow keeps (it stays
    // centered on the group rather than the pointer).
    const f = followRef.current
    if (f) {
      f.zoom = newScale
      f.cam.zoom = newScale
    }
  }

  // A click (not a drag; Konva doesn't report a click that ended a drag):
  // whatever's drawn under the pointer, if anything.
  const handleClick = () => {
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!stage || !pointer) return
    const hit = hitTest(hitsRef.current, pointer, stage)
    if (hit?.kind === 'player') onPlayerClick?.(hit.id)
    else if (hit?.kind === 'engagement') onEngagementClick?.(hit.id)
  }

  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const stage = stageRef.current
    if (!stage) return pos
    // The image is centered on the stage origin; keep it covering the viewport.
    return clampStagePosition(pos, stage.scaleX(), mapImage.width, mapImage.height, stageWidth, stageHeight)
  }

  // Konva calls this whenever the scene layer redraws. A new function each
  // render (so it sees the latest props); between renders it reads the
  // engine's current state, which is how playback animates without React.
  const sceneFunc = (context: KonvaContext) => {
    const stage = stageRef.current
    if (!stage) return
    drawScene(context._context, {
      engine,
      image: mapImage,
      mapDefinition,
      zoom: stage.scaleX(),
      engagements,
      selectedEngagementId,
      hits: hitsRef.current,
    })
  }

  return (
    <Stage
      ref={stageRef}
      width={stageWidth}
      height={stageHeight}
      onWheel={handleWheel}
      onClick={handleClick}
      onTap={handleClick}
      draggable
      dragBoundFunc={dragBoundFunc}
      onDragStart={() => {
        stopTween()
        // panning is how the viewer stops following
        breakFollow()
      }}
    >
      {/* Nothing on the canvas listens for events: clicks are matched by
          position in handleClick, so Konva doesn't keep a hidden hit canvas. */}
      <Layer listening={false}>
        <KonvaImage
          image={mapImage}
          offsetX={mapImage.width / 2}
          offsetY={mapImage.height / 2}
        />
      </Layer>
      <Layer ref={sceneLayerRef} listening={false}>
        <Shape sceneFunc={sceneFunc} listening={false} perfectDrawEnabled={false} />
      </Layer>
    </Stage>
  )
}
