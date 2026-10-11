// The event-grouping animation's pieces, shared by its versions (see
// EventGrouping.tsx and Reel.tsx): a real fight from above, with no map.
// Players move as they did;
// shots flash as short lines and hits as rings; each interaction between two
// teams leaves a faint link that fades the way the grouping algorithm's
// evidence does. When the evidence says two teams are fighting, their
// players, links and timeline ticks take their team colors and a circle
// closes in around them; it widens when a third team joins.
//
// A version decides which moments of the fight play when (its game clock),
// where the camera goes, and how the timeline is drawn; the world, timeline
// and card here draw whatever moment they're given.
//
// Authored at the size it shows on the page (CSS px), rendered at 2x. Every
// color comes from the site's theme variables (or the card's team colors), so
// a theme change is a re-render.

import { AbsoluteFill, Easing, interpolate } from "remotion"
import { loadFont } from "@remotion/google-fonts/Geist"

import { EngagementDetails, FIGHT_TEAM_COLORS } from "@/components/replay/engagement-details"
import { formatClock } from "@/lib/replay/format"
import {
  CLAIM_S,
  TAU_S,
  compress,
  fightTimes,
  groupedAt,
  playerAt,
  recordWeight,
  teamsByOutcome,
  type FightData,
  type FightPlayer,
  type GroupFrom,
  type PlayerState,
} from "./fight-data"

export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] })

export const WIDTH = 960
export const HEIGHT = 600
export const FPS = 30

export const TIMELINE_H = 58
export const SCENE_H = HEIGHT - TIMELINE_H

export const COLORS = {
  backdrop: "var(--panel-inset)",
  grid: "var(--panel-line)",
  player: "var(--color-slate-500)",
  knocked: "var(--color-orange-400)",
  outline: "var(--accent-gold)",
  shield: "var(--color-blue-500)",
  health: "var(--color-green-500)",
  knockedHealth: "var(--color-red-500)",
  text: "var(--color-slate-100)",
  muted: "var(--color-slate-500)",
  tagBg: "color-mix(in srgb, var(--app-bg) 78%, transparent)",
}
export const mix = (a: string, b: string, k: number) => `color-mix(in srgb, ${a} ${Math.round(clamp01(k) * 100)}%, ${b})`

export type Span = [number, number]

export const ease = Easing.inOut(Easing.cubic)
export const easeOut = Easing.out(Easing.cubic)
// 0 before the span, 1 after it, eased in between.
export function phase(v: number, [a, b]: Span) {
  return interpolate(v, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })
}
export function lerp(a: number, b: number, k: number) { return a + (b - a) * k }
export function clamp01(k: number) { return Math.max(0, Math.min(1, k)) }

// ---- the fight, as the grouping algorithm sees it ----

export function fightFacts(data: FightData, from: GroupFrom = "detection") {
  const times = fightTimes(data)
  const { fight, coreTeams, joiners, entry } = times
  const grouped = groupedAt(data, from)
  // The card's order and colors: the team followed (if any) first, in gold;
  // the rest best to worst.
  const perspective = data.perspective ?? null
  const order = teamsByOutcome(fight)
  const others = order.filter((t) => t !== perspective)
  if (perspective !== null) order.sort((a, b) => Number(b === perspective) - Number(a === perspective))
  const teamColor = (team: number) => {
    if (team === perspective) return COLORS.outline
    const i = others.indexOf(team)
    return i === -1 ? null : FIGHT_TEAM_COLORS[i % FIGHT_TEAM_COLORS.length]
  }
  // How far each team has been taken into the fight (0 to 1) at game time g:
  // over CLAIM_S from when the core teams are grouped (see GroupFrom) or the
  // third team joins.
  const claimedAt = (team: number) => (coreTeams.includes(team) ? grouped : joiners.includes(team) ? entry : Infinity)
  const claim = (team: number, g: number) => easeOut(clamp01((g - claimedAt(team)) / CLAIM_S))
  return { ...times, grouped, order, teamColor, claim }
}

// ---- the world: players, shots, hits, evidence and the group ----

// Where the camera goes, in the version's video seconds: from the wide view
// in to the fight, aside for the card, and back out.
export type CameraTiming = { zoomIn: Span; pan: Span; zoomOut: Span }

type Placed = { p: FightPlayer; s: PlayerState; x: number; y: number; fighter: boolean }
type Circle = { x: number; y: number; r: number }
// Where a fight sits among the wide view's drifting arrows (m from the wide
// view's centre); its own positions are around it.
export type Spot = { x: number; y: number }
const ORIGIN: Spot = { x: 0, y: 0 }

const TAG_M = 5            // room left above each player for its nametag
const PAD_M = 3
// The circle and camera average the moments around now, every frame for half
// a second either side, weighted toward now: a player dropping out of the
// group (or a third team arriving) eases the camera rather than stepping it.
const SMOOTH = Array.from({ length: 31 }, (_, i) => ({ dv: (i - 15) / FPS, w: 1 + Math.cos((Math.PI * (i - 15)) / 16) }))
const HIT_LIFE_V = 0.4

// How a version draws the world. The defaults are the original EventGrouping's.
export type Look = {
  size: number               // players, nametags, shots, hits and the group's label scale by this
  tags: "fade" | "above"     // overlapping nametags: the lower-ranked fades out, or all stay, the lower on top
  fighterTagsOnly: boolean   // nametags for the fight's players only, not passers-by
  groupFrom: GroupFrom       // when the circle closes in on the core teams
  fill: number               // zoomed in, the group's circle spans this much of the scene's height...
  maxZoom: number            // ...up to this many px per metre
  shotLifeV: number          // a shot's line fades over this many video seconds
  linkFadeS: number          // evidence links fade by e every this many game seconds
  groupShotsOnly: boolean    // zoomed in, only the group's teams' shots show
  // The room around the players inside the circle (for their arrows and
  // nametags): in metres, which grows with the zoom, or in screen pixels,
  // which doesn't, so a tight fight can be framed much closer.
  roomIn: "metres" | "pixels"
  sceneH: number             // the scene's height (px): above the timeline, or the whole frame without one
}
const ORIGINAL_LOOK: Look = {
  size: 1, tags: "fade", fighterTagsOnly: false, groupFrom: "detection",
  fill: 0.6, maxZoom: 9, shotLifeV: 0.27, linkFadeS: TAU_S, groupShotsOnly: false, roomIn: "metres", sceneH: SCENE_H,
}
const ROOM_PX = { above: 24, around: 22 }   // per unit of size: for the nametags, and around everything

// What the camera sees at a moment: where it points, how far in, and the
// group it's framing. sx and sy put a position in the wide view (m) on
// screen (px); a fight's own positions are offset by its Spot.
export type View = {
  zoom: number; cx: number; cy: number; anchorX: number; anchorY: number
  h: number                  // the scene's height (px)
  toFight: number            // 0 in the wide view, 1 zoomed in on the fight
  zoomOut: number            // 0 until the camera starts back out, 1 once it's out
  ring: Circle               // the circle drawn around the fighting teams, on screen (px)
  sx: (x: number) => number; sy: (y: number) => number
}
// The wide view every version starts and ends in: the same for every fight
// (each fight sits at its own Spot in it), so one fight's wide view is the
// next one's. It's 520 m tall, whatever the scene's height.
const WIDE = { x: 0, y: -40, height: 520 }

// A fight's positions on screen, with the fight at `spot` in the wide view.
function placed(view: View, spot: Spot) {
  return { sx: (x: number) => view.sx(x + spot.x), sy: (y: number) => view.sy(y + spot.y) }
}

function placeAt(data: FightData, fighters: Set<string>, g: number, players = data.players): Placed[] {
  return players.flatMap((p) => {
    const s = playerAt(data, p, g)
    if (!s || !s.alive) return []
    const [x, y] = compress(s.x, s.y)
    return [{ p, s, x, y, fighter: fighters.has(p.id) }]
  })
}

export function viewOf({ data, clockAt, camV, camera, look: lookIn = {}, spot = ORIGIN }: {
  data: FightData; clockAt: (dv: number) => number; camV: number; camera: CameraTiming; look?: Partial<Look>; spot?: Spot
}): View {
  const look = { ...ORIGINAL_LOOK, ...lookIn }
  const h = look.sceneH
  const { fight, coreTeams, entry, fighters } = fightFacts(data, look.groupFrom)
  const fighterPlayers = data.players.filter((p) => fighters.has(p.id))
  // The group: a circle around the fighting teams' living players (centred on
  // their extent, with room for the nametags above them; frozen once the
  // fight is over; averaged over a few moments so it doesn't jitter).
  const metres = look.roomIn === "metres"
  const tagM = metres ? TAG_M : 0
  const circleOf = (placed: Placed[], teams: number[]): Circle => {
    const pts = placed.filter((st) => st.fighter && teams.includes(st.p.team))
    if (pts.length === 0) return { x: 0, y: 0, r: 30 }
    const xs = pts.map((st) => st.x)
    const ys = pts.flatMap((st) => [st.y, st.y - tagM])
    const x = (Math.min(...xs) + Math.max(...xs)) / 2
    const y = (Math.min(...ys) + Math.max(...ys)) / 2
    const r = Math.max(...pts.map((st) => Math.max(Math.hypot(st.x - x, st.y - y), Math.hypot(st.x - x, st.y - tagM - y))))
    return metres ? { x, y, r: Math.max(12, r + PAD_M) } : { x, y, r: Math.max(3, r) }
  }
  const blend = (a: Circle, b: Circle, k: number): Circle => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), r: lerp(a.r, b.r, k) })
  const total = SMOOTH.reduce((a, s) => a + s.w, 0)
  const average = (cs: Circle[]): Circle => ({
    x: cs.reduce((a, c, i) => a + c.x * SMOOTH[i].w, 0) / total,
    y: cs.reduce((a, c, i) => a + c.y * SMOOTH[i].w, 0) / total,
    r: cs.reduce((a, c, i) => a + c.r * SMOOTH[i].w, 0) / total,
  })
  const samples = SMOOTH.map(({ dv }) => {
    const g = Math.min(clockAt(dv), fight.end_s)
    const placed = placeAt(data, fighters, g, fighterPlayers)
    const core = circleOf(placed, coreTeams)
    const all = circleOf(placed, fight.teams)
    return {
      group: blend(core, all, ease(clamp01((g - entry) / 0.8))),
      // the camera takes the arriving team in a little before it joins
      framed: blend(core, all, ease(clamp01((g - (entry - 4)) / 4))),
    }
  })
  const group = average(samples.map((s) => s.group))
  const framed = average(samples.map((s) => s.framed))

  const zoomIn = phase(camV, camera.zoomIn)
  const zoomOut = phase(camV, camera.zoomOut)
  const toFight = zoomIn * (1 - zoomOut)
  const pan = phase(camV, camera.pan) * (1 - phase(camV, [camera.zoomOut[0] - 0.2, camera.zoomOut[0] + 0.6]))
  // the room (px) the circle keeps above and around the players
  const above = metres ? 0 : ROOM_PX.above * look.size
  const around = metres ? 0 : ROOM_PX.around * look.size
  const wideZoom = h / WIDE.height
  const fightZoom = Math.min(look.maxZoom, Math.max(2.5, ((h * look.fill) / 2 - above - around) / framed.r))
  const zoom = Math.exp(lerp(Math.log(wideZoom), Math.log(fightZoom), toFight))
  const anchorX = lerp(WIDTH / 2, WIDTH * 0.3, pan)
  const anchorY = h / 2
  // The camera heads for the circle's centre (a little above the players'):
  // that point slides across the screen from where the wide view shows it to
  // the anchor as the camera zooms, so it stays in view the whole way in.
  const tx = spot.x + framed.x, ty = spot.y + framed.y - above / fightZoom
  const px = lerp((tx - WIDE.x) * wideZoom + WIDTH / 2, anchorX, toFight)
  const py = lerp((ty - WIDE.y) * wideZoom + h / 2, anchorY, toFight)
  const cx = tx - (px - anchorX) / zoom
  const cy = ty - (py - anchorY) / zoom
  const sx = (x: number) => (x - cx) * zoom + anchorX
  const sy = (y: number) => (y - cy) * zoom + anchorY
  return {
    zoom, cx, cy, anchorX, anchorY, h, toFight, zoomOut, sx, sy,
    ring: { x: sx(spot.x + group.x), y: sy(spot.y + group.y) - above, r: group.r * zoom + above + around },
  }
}

// Between two views (a dissolve from one moment to another), for what's
// drawn under both.
export function blendViews(a: View, b: View, k: number): View {
  const zoom = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k))
  const cx = lerp(a.cx, b.cx, k), cy = lerp(a.cy, b.cy, k)
  const anchorX = lerp(a.anchorX, b.anchorX, k), anchorY = lerp(a.anchorY, b.anchorY, k)
  return {
    zoom, cx, cy, anchorX, anchorY, h: b.h,
    toFight: lerp(a.toFight, b.toFight, k), zoomOut: lerp(a.zoomOut, b.zoomOut, k), ring: b.ring,
    sx: (x) => (x - cx) * zoom + anchorX,
    sy: (y) => (y - cy) * zoom + anchorY,
  }
}

// The grid, in world space, so zooms and pans read as movement.
function Grid({ view }: { view: View }) {
  const { cx, cy, zoom, anchorX, anchorY, h, sx, sy } = view
  const step = 25
  const left = cx - anchorX / zoom, right = cx + (WIDTH - anchorX) / zoom
  const top = cy - anchorY / zoom, bottom = cy + (h - anchorY) / zoom
  return (
    <>
      {Array.from({ length: Math.ceil((right - left) / step) + 1 }, (_, i) => {
        const x = sx(Math.floor(left / step) * step + i * step)
        return <line key={`gx${i}`} x1={x} x2={x} y1={0} y2={h} stroke={COLORS.grid} strokeOpacity={0.35} />
      })}
      {Array.from({ length: Math.ceil((bottom - top) / step) + 1 }, (_, i) => {
        const y = sy(Math.floor(top / step) * step + i * step)
        return <line key={`gy${i}`} x1={0} x2={WIDTH} y1={y} y2={y} stroke={COLORS.grid} strokeOpacity={0.35} />
      })}
    </>
  )
}

const ARROW = "M 7.5 0 L -6 -5.25 L -2.6 0 L -6 5.25 Z"

export function World({
  data,
  game,
  clockAt,
  camV,
  camera,
  look: lookIn = {},
  view: viewIn,
  grid = true,
  spot = ORIGIN,
  presence = 1,
}: {
  data: FightData
  game: number                       // the moment shown
  clockAt: (dv: number) => number    // the game time dv video seconds from now, in this shot
  camV: number                       // video seconds, for the camera's moves
  camera: CameraTiming
  look?: Partial<Look>
  view?: View                        // the camera, if already worked out (see viewOf)
  grid?: boolean                     // false when a Backdrop draws it
  spot?: Spot                        // where the fight sits in the wide view
  // How much of the fight shows (0 to 1): everything but the fight's own
  // players fades with it, and they turn into plain arrows like the
  // backdrop's, so in the wide view they're part of the crowd.
  presence?: number
}) {
  const look = { ...ORIGINAL_LOOK, ...lookIn }
  const k = look.size
  const { fight, coreTeams, joiners, entry, order, teamColor, fighters, claim: claimAt } = fightFacts(data, look.groupFrom)
  const claim = (team: number) => claimAt(team, game)
  const view = viewIn ?? viewOf({ data, clockAt, camV, camera, look, spot })
  const { zoom } = view
  const { sx, sy } = placed(view, spot)
  const states = placeAt(data, fighters, game)

  // ---- what's shown ----
  const formed = claim(coreTeams[0])
  const reveal = formed * (1 - phase(camV, [camera.zoomOut[0], camera.zoomOut[0] + 0.6]))
  const ring = { ...view.ring, r: view.ring.r * (1 + 0.6 * (1 - formed)) }    // closes in as the group forms (px)
  const tags = clamp01((zoom - 2.2) / 1.4) * (1 - view.zoomOut) * presence
  const shotSince = clockAt(-look.shotLifeV)
  // zoomed in, a team's shots show once it's part of the group
  const inGroup = (team: number) => coreTeams.includes(team) || (joiners.includes(team) && game >= entry)
  const shots = data.shots.filter((s) => s.t <= game && s.t > shotSince && (!look.groupShotsOnly || inGroup(s.team) || view.toFight < 1))
  const hitSince = clockAt(-HIT_LIFE_V)
  const hits = fight.records.filter((r) => r.kind !== "shot_attempt" && r.t_s <= game && r.t_s > hitSince)
  const links = fight.records.filter((r) => r.t_s <= game && game - r.t_s < 4 * look.linkFadeS)
  const playerColor = (st: Placed) => {
    if (st.s.knocked) return mix(COLORS.knocked, COLORS.player, presence)
    const c = st.fighter ? teamColor(st.p.team) : null
    return c ? mix(c, COLORS.player, claim(st.p.team) * presence) : COLORS.player
  }

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={view.h} style={{ position: "absolute", inset: 0 }}>
        {grid && <Grid view={view} />}

        {/* the fight: its evidence, group, shots and hits */}
        <g opacity={presence}>
          {/* evidence: each interaction links its two players, fading like the
              algorithm's score; gold once the teams are grouped */}
          {links.map((r, i) => {
            const [ax, ay] = compress(r.ax, r.ay)
            const [rx, ry] = compress(r.rx, r.ry)
            const alpha = Math.min(1, recordWeight(r)) * Math.exp(-(game - r.t_s) / look.linkFadeS) * 0.6
            const c = Math.min(claim(r.actor_team), claim(r.recipient_team))
            return (
              <line key={`l${i}`} x1={sx(ax)} y1={sy(ay)} x2={sx(rx)} y2={sy(ry)}
                stroke={mix(COLORS.outline, COLORS.player, c)} strokeOpacity={alpha * (0.6 + 0.4 * c)} strokeWidth={1.25} />
            )
          })}

          {/* the group */}
          {reveal > 0 && (
            <circle cx={ring.x} cy={ring.y} r={ring.r}
              fill={COLORS.outline} fillOpacity={0.045 * reveal}
              stroke={COLORS.outline} strokeOpacity={0.85 * reveal} strokeWidth={1.5} />
          )}

          {/* shots: a brief line from the shooter toward where it went */}
          {shots.map((s, i) => {
            const age = clamp01((game - s.t) / Math.max(1e-6, game - shotSince))
            const [ax, ay] = compress(s.ax, s.ay)
            const [ex, ey] = compress(s.ex, s.ey)
            let x2 = sx(ex), y2 = sy(ey)
            const x1 = sx(ax), y1 = sy(ay)
            const len = Math.hypot(x2 - x1, y2 - y1)
            const cap = (s.sg ? 26 : 140) * k
            if (len > cap) { x2 = x1 + ((x2 - x1) / len) * cap; y2 = y1 + ((y2 - y1) / len) * cap }
            const color = teamColor(s.team)
            const claimed = color ? claim(s.team) : 0
            const outside = look.groupShotsOnly && !inGroup(s.team) ? 1 - view.toFight : 1
            return (
              <line key={`s${i}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeLinecap="round"
                stroke={color ? mix(color, COLORS.player, claimed) : COLORS.player}
                strokeOpacity={(0.55 + 0.4 * claimed) * (1 - age) * outside} strokeWidth={(s.sg ? 2.5 : 1.25) * k} />
            )
          })}

          {/* damage: a ring where each hit landed (larger for knocks and eliminations) */}
          {hits.map((r, i) => {
            const age = clamp01((game - r.t_s) / Math.max(1e-6, game - hitSince))
            const [rx, ry] = compress(r.rx, r.ry)
            const big = r.kind !== "hit"
            const color = teamColor(r.actor_team) ?? COLORS.player
            return (
              <circle key={`h${i}`} cx={sx(rx)} cy={sy(ry)} r={((big ? 4 : 2.5) + (big ? 14 : 8) * easeOut(age)) * k}
                fill="none" stroke={mix(color, COLORS.player, claim(r.actor_team))}
                strokeOpacity={0.9 * (1 - age)} strokeWidth={(big ? 2 : 1.25) * k} />
            )
          })}
        </g>

        {/* players: the replay's arrowhead, in the team's color once grouped;
            passers-by only with the fight */}
        {states.map((st) => (st.fighter || presence > 0) && (
          <g key={st.p.id} transform={`translate(${sx(st.x)} ${sy(st.y)}) rotate(${st.s.yaw})`}
            opacity={st.fighter ? lerp(0.75, 1, presence) : 0.75 * presence}>
            <path d={ARROW} transform={k === 1 ? undefined : `scale(${k})`}
              fill={playerColor(st)} stroke={COLORS.backdrop} strokeWidth={1.25} />
          </g>
        ))}

        {/* nametags, smaller than the replay's, once zoomed in */}
        {tags > 0 && <Nametags states={look.fighterTagsOnly ? states.filter((st) => st.fighter) : states} sx={sx} sy={sy} priority={(team) => {
          const i = order.indexOf(team)
          return i === -1 ? order.length : i
        }} opacity={tags} size={k} layout={look.tags} h={view.h} />}
      </svg>

      {/* the group's label */}
      {reveal > 0 && (
        <div style={{
          position: "absolute", left: ring.x, top: Math.max(10, ring.y - ring.r - 30 * k),
          translate: "-50% 0", opacity: reveal * presence, whiteSpace: "nowrap",
          padding: `${3 * k}px ${8 * k}px`, borderRadius: 3, background: COLORS.tagBg,
          border: `1px solid color-mix(in srgb, ${COLORS.outline} 45%, transparent)`,
          color: COLORS.outline, fontSize: 12 * k, fontWeight: 600,
        }}>
          Fight · {game >= entry ? fight.teams.length : coreTeams.length} teams
        </div>
      )}
    </AbsoluteFill>
  )
}

// ---- the backdrop: what never cuts ----

// A field of arrows drifting about the wide view, standing in for the rest
// of the lobby while the camera is out. Each wanders on a closed path that
// returns to where it began once per `period`, so a clip, or a reel of them,
// loops without a seam. Positions are in the same space as every fight's
// (metres, around the wide view's centre).
const DRIFTERS = (() => {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  return Array.from({ length: 70 }, () => ({
    x: -540 + rand() * 1080, y: -330 + rand() * 590,
    speed: 3 + rand() * 6,                       // m/s along the path, on average
    n1: 1 + Math.floor(rand() * 2), n2: 2 + Math.floor(rand() * 2),
    p1: rand() * Math.PI * 2, p2: rand() * Math.PI * 2, w: 0.35 + rand() * 0.4,
  }))
})()

function drifterAt(d: (typeof DRIFTERS)[number], v: number, period: number) {
  const w1 = (2 * Math.PI * d.n1) / period, w2 = (2 * Math.PI * d.n2) / period
  const r1 = (d.w * d.speed) / w1, r2 = ((1 - d.w) * d.speed) / w2
  const a1 = w1 * v + d.p1, a2 = w2 * v + d.p2
  return {
    x: d.x + r1 * Math.cos(a1) + r2 * Math.cos(a2),
    y: d.y + r1 * Math.sin(a1) - r2 * Math.sin(a2),
    yaw: (Math.atan2(r1 * w1 * Math.cos(a1) - r2 * w2 * Math.cos(a2), -r1 * w1 * Math.sin(a1) - r2 * w2 * Math.sin(a2)) * 180) / Math.PI,
  }
}

// The grid and the drifting arrows, seen through `view`. The arrows fade as
// the camera goes in, where the fight's own players take over.
export function Backdrop({ view, v, period, size = 1 }: { view: View; v: number; period: number; size?: number }) {
  const alpha = 1 - clamp01(view.toFight / 0.5)
  return (
    <svg width={WIDTH} height={view.h} style={{ position: "absolute", inset: 0 }}>
      <Grid view={view} />
      {alpha > 0 && DRIFTERS.map((d, i) => {
        const { x, y, yaw } = drifterAt(d, v, period)
        return <Arrow key={i} x={view.sx(x)} y={view.sy(y)} yaw={yaw} size={size} opacity={0.75 * alpha} />
      })}
    </svg>
  )
}

// Another fight's players as the wide view shows them, plain arrows among the
// drifting ones at its spot: the fight before, until the camera has left it,
// and the one after, before the camera heads for it.
export function FightFromAfar({ data, game, view, spot, opacity, size = 1 }: {
  data: FightData; game: number; view: View; spot: Spot; opacity: number; size?: number
}) {
  if (opacity <= 0) return null
  const { fighters } = fightTimes(data)
  const { sx, sy } = placed(view, spot)
  return (
    <svg width={WIDTH} height={view.h} style={{ position: "absolute", inset: 0 }}>
      {placeAt(data, fighters, game, data.players.filter((p) => fighters.has(p.id))).map((st) => (
        <Arrow key={st.p.id} x={sx(st.x)} y={sy(st.y)} yaw={st.s.yaw} size={size} opacity={0.75 * opacity} />
      ))}
    </svg>
  )
}

function Arrow({ x, y, yaw, size, opacity }: { x: number; y: number; yaw: number; size: number; opacity: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${yaw})`} opacity={opacity}>
      <path d={ARROW} transform={size === 1 ? undefined : `scale(${size})`} fill={COLORS.player} stroke={COLORS.backdrop} strokeWidth={1.25} />
    </g>
  )
}

// The players' nametags, each directly above its player, in one of two ways:
// - fade: where two overlap, the one lower in the fight's order (and further
//   down the roster) fades out, so a stack of teammates shows one tag.
// - above: every tag stays, on a solid backing. Lower tags draw over higher
//   ones, which keeps each name (at the top of its tag) clear of the tag
//   below it; tags in a dense cluster shrink a little.
const TAG_FONT = 10
function tagSize(name: string, size = 1) {
  const font = TAG_FONT * size
  const w = Math.max(44 * size, name.length * font * 0.56) + 8 * size
  return { w, h: font + 3 * size + 3 * size + 1.5 * size + 3 * size + 8 * size }
}
type TagSpot = { st: Placed; x: number; top: number; scale: number; opacity: number }

function Nametags({ states, sx, sy, priority, opacity, size = 1, layout = "fade", h }: {
  states: Placed[]; sx: (x: number) => number; sy: (y: number) => number
  priority: (team: number) => number; opacity: number; size?: number; layout?: "fade" | "above"
  h: number   // the scene's height
}) {
  const ranked = [...states]
    .filter((st) => sx(st.x) > -80 && sx(st.x) < WIDTH + 80 && sy(st.y) > -40 && sy(st.y) < h + 60)
    .sort((a, b) => Number(b.fighter) - Number(a.fighter) || priority(a.p.team) - priority(b.p.team) || a.p.id.localeCompare(b.p.id))
  const spots = layout === "above" ? above(ranked, sx, sy, size) : faded(ranked, sx, sy, size)
  return spots.map((t) => (
    <Nametag key={`n${t.st.p.id}`} x={t.x} top={t.top} name={t.st.p.name} hp={t.st.s.hp} shield={t.st.s.shield}
      knocked={t.st.s.knocked} opacity={opacity * t.opacity} size={size * t.scale} solid={layout === "above"} />
  ))
}

function faded(ranked: Placed[], sx: (x: number) => number, sy: (y: number) => number, size: number): TagSpot[] {
  const placed: { x0: number; y0: number; x1: number; y1: number; a: number }[] = []
  return ranked.flatMap((st) => {
    const { w, h } = tagSize(st.p.name, size)
    const x = sx(st.x), y = sy(st.y)
    const box = { x0: x - w / 2, y0: y - 10 * size - h, x1: x + w / 2, y1: y - 10 * size }
    let covered = 0
    for (const o of placed) {
      const ox = Math.max(0, Math.min(box.x1, o.x1) - Math.max(box.x0, o.x0))
      const oy = Math.max(0, Math.min(box.y1, o.y1) - Math.max(box.y0, o.y0))
      covered = Math.max(covered, ((ox * oy) / (w * h)) * o.a)
    }
    const a = 1 - clamp01((covered - 0.1) / 0.3)
    placed.push({ ...box, a })
    return a <= 0 ? [] : [{ st, x, top: box.y0, scale: 1, opacity: a }]
  })
}

const smoothstep = (t: number) => { const u = clamp01(t); return u * u * (3 - 2 * u) }
function above(ranked: Placed[], sx: (x: number) => number, sy: (y: number) => number, size: number): TagSpot[] {
  const anchors = ranked.map((st) => ({ x: sx(st.x), y: sy(st.y) }))
  // a dense cluster (about three or more players within a tag's width) shrinks its tags, to 80% at most
  const reach = 70 * size
  return ranked
    .map((st, i) => {
      const a = anchors[i]
      const near = anchors.reduce((n, b, j) => (i === j ? n : n + clamp01(1 - Math.hypot(a.x - b.x, a.y - b.y) / reach)), 0)
      const scale = 1 - 0.2 * smoothstep((near - 1) / 2)
      const { h } = tagSize(st.p.name, size * scale)
      return { st, x: a.x, y: a.y, top: a.y - 10 * size - h, scale, opacity: 1 }
    })
    .sort((a, b) => a.y - b.y)
}

function Nametag({ x, top, name, hp, shield, knocked, opacity, size = 1, solid = false }: {
  x: number; top: number; name: string; hp: number; shield: number; knocked: boolean; opacity: number
  size?: number; solid?: boolean    // solid: a darker backing, for tags that may sit over others' lines
}) {
  const { w, h } = tagSize(name, size)
  const font = TAG_FONT * size
  const barW = w - 8 * size
  const bar = 3 * size
  return (
    <g opacity={opacity}>
      <rect x={x - w / 2} y={top} width={w} height={h} fill={solid ? "color-mix(in srgb, var(--app-bg) 90%, transparent)" : COLORS.tagBg}
        stroke="white" strokeOpacity={0.14} />
      <text x={x} y={top + 4 * size + font * 0.8} textAnchor="middle" fill={COLORS.text} fontSize={font} fontWeight={600}>{name}</text>
      <rect x={x - barW / 2} y={top + 4 * size + font + 3 * size} width={barW} height={bar} fill="white" fillOpacity={0.1} />
      <rect x={x - barW / 2} y={top + 4 * size + font + 3 * size} width={barW * clamp01(shield / 100)} height={bar} fill={COLORS.shield} />
      <rect x={x - barW / 2} y={top + 4 * size + font + 7.5 * size} width={barW} height={bar} fill="white" fillOpacity={0.1} />
      <rect x={x - barW / 2} y={top + 4 * size + font + 7.5 * size} width={barW * clamp01(hp / 100)} height={bar}
        fill={knocked ? COLORS.knockedHealth : COLORS.health} />
    </g>
  )
}

// ---- the timeline ----

export const TIMELINE_PAD = 28
// Game time to x along the timeline, evenly from start to end.
export function linearAxis(start: number, end: number) {
  return (t: number) => TIMELINE_PAD + clamp01((t - start) / (end - start)) * (WIDTH - TIMELINE_PAD * 2)
}
// The game clock under the scene: each interaction as a tick (taller for
// hits, tallest for knocks and eliminations), grey until the algorithm takes
// it into the fight. The fight is a gold bracket that appears when it's
// grouped and reaches back to its first interaction, marked where the third
// team joined. `presence` fades everything but the axis itself, so one
// fight's timeline can give way to the next's.
export function Timeline({ data, game, x, size = 1, groupFrom = "detection", presence = 1 }: {
  data: FightData; game: number; x: (t: number) => number
  size?: number    // its text scales by this
  groupFrom?: GroupFrom
  presence?: number
}) {
  const { fight, grouped, entry, joiners, coreTeams, teamColor, claim: claimAt } = fightFacts(data, groupFrom)
  const claim = (team: number) => claimAt(team, game)
  const formed = claim(coreTeams[0])
  const base = 31
  const bracketY = 39
  const tickH = { shot_attempt: 5, hit: 9, knock: 15, elim: 15 }
  const from = lerp(x(grouped), x(fight.start_s), formed)
  const to = x(Math.min(game, fight.end_s))
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: TIMELINE_H, borderTop: `1px solid ${COLORS.grid}` }}>
      <svg width={WIDTH} height={TIMELINE_H} style={{ position: "absolute", inset: 0 }}>
        <line x1={TIMELINE_PAD} x2={WIDTH - TIMELINE_PAD} y1={base} y2={base} stroke={COLORS.grid} strokeWidth={2} />
        {presence > 0 && (
          <g opacity={presence}>
            {fight.records.filter((r) => r.t_s <= game).map((r, i) => {
              const c = teamColor(r.actor_team)
              const k = c ? Math.min(claim(r.actor_team), claim(r.recipient_team)) : 0
              return (
                <line key={i} x1={x(r.t_s)} x2={x(r.t_s)} y1={base} y2={base - tickH[r.kind]}
                  stroke={c ? mix(c, COLORS.muted, k) : COLORS.muted} strokeOpacity={0.55 + 0.35 * k} strokeWidth={1.25} />
              )
            })}
            {game >= grouped && (
              <g opacity={formed}>
                <line x1={from} x2={Math.max(from, to)} y1={bracketY} y2={bracketY} stroke={COLORS.outline} strokeWidth={2} />
                <line x1={from} x2={from} y1={bracketY - 3} y2={bracketY + 3} stroke={COLORS.outline} strokeWidth={2} />
                {game >= fight.end_s && (
                  <line x1={to} x2={to} y1={bracketY - 3} y2={bracketY + 3} stroke={COLORS.outline} strokeWidth={2} />
                )}
              </g>
            )}
            {joiners.length > 0 && game >= entry && (
              <circle cx={x(entry)} cy={bracketY} r={3} fill={COLORS.backdrop} stroke={COLORS.outline} strokeWidth={1.5} />
            )}
            <line x1={x(game)} x2={x(game)} y1={6} y2={46} stroke={COLORS.text} strokeOpacity={0.9} />
          </g>
        )}
      </svg>
      {presence > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: presence }}>
          <span style={{ position: "absolute", left: x(game) + 6, top: 3, fontSize: 11 * size, lineHeight: `${13 * size}px`, color: COLORS.text, fontVariantNumeric: "tabular-nums" }}>
            {formatClock(game)}
          </span>
          {game >= grouped && (
            <span style={{ position: "absolute", left: from, top: bracketY + 4, opacity: formed, fontSize: 10 * size, lineHeight: `${11 * size}px`, color: COLORS.outline, whiteSpace: "nowrap" }}>
              Fight #{fight.number}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ---- the card ----

// The site's own fight card, as a summary: header, verdict, teams. `shown`
// runs 0 (gone) to 1 (in place).
export function FightCard({ data, shown }: { data: FightData; shown: number }) {
  if (shown <= 0) return null
  const labels = Object.fromEntries(Object.entries(data.teamRosters).map(([t, names]) => [t, names.join(" + ")]))
  return (
    <div
      className="font-sans text-slate-200"
      style={{
        position: "absolute", right: 28, top: 24, width: 340,
        opacity: shown, translate: `${(1 - shown) * 24}px 0`,
      }}
    >
      <div className="rounded-[3px] bg-[var(--panel)] p-4 ring-1 ring-white/[0.08]">
        <EngagementDetails
          summary
          engagement={data.fight}
          number={data.fight.number}
          perspectiveTeamId={data.perspective ?? null}
          teamLabels={labels}
          teamRosters={data.teamRosters}
          playerNames={data.playerNames}
          playerSkins={{}}
        />
      </div>
    </div>
  )
}
