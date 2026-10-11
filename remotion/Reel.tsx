// The fights as clips, and a reel that plays several back to back.
//
// A clip starts in the wide view, zooms in on its fight (each fight sits at
// its own spot in the wide view, see fights.ts), plays the fight's beats
// (taken from the fight itself, see planBeats) with a crossfade over any long
// lull, steps aside for the fight's card, and zooms back out to the same wide
// view. Under every clip is one backdrop that never cuts: the grid and a
// field of drifting arrows. The fight's players are among them in the wide
// view, plain arrows like the rest; everything else about the fight fades in
// as the camera goes in and out as it comes back. The next fight's players
// appear at their spot as the camera comes out, and the last one's stay until
// it's gone in again, so a clip loops on itself, and one clip's ending is the
// next one's beginning. The first clip takes longer to go in: it's what plays
// as the page loads.
//
// The game plays at real time until the fight's circle has formed, then a
// little faster, easing back down to slower than real time for the last
// elimination, and to real time under the card.

import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction } from "remotion"

import { CLAIM_S, fightTimes, groupedAt, type FightData } from "./fight-data"
import { FIGHTS, type FightKey } from "./fights"
import {
  Backdrop,
  COLORS,
  FPS,
  FightCard,
  FightFromAfar,
  HEIGHT,
  SCENE_H,
  Timeline,
  World,
  blendViews,
  clamp01,
  ease,
  fontFamily,
  lerp,
  linearAxis,
  phase,
  viewOf,
  type CameraTiming,
  type Look,
  type Span,
} from "./scene"

const LOOK = {
  size: 1.25,
  tags: "above",
  fighterTagsOnly: true,
  groupFrom: "first-hit",
  fill: 0.78,
  maxZoom: 40,
  roomIn: "pixels",
  shotLifeV: 0.14,
  linkFadeS: 1.2,
  groupShotsOnly: true,
} satisfies Partial<Look>

// ---- the beats: what a clip plays ----

const ENGAGE_S = 3.5        // after the first shots or damage, before any cut
const QUIET_S = 0.8         // a cut waits (up to SETTLE_S) for this long without shots or hits
const SETTLE_S = 2.0
const KNOCK_S: Span = [1.2, 0.8]   // played either side of each knock (time to settle in after a cut)
const MERGE_S = 4.0         // beats closer than this play through

// `lead`: the game seconds before the first shot (while the camera zooms in).
function planBeats(data: FightData, lead: number): Span[] {
  const { fight, entry, joiners, fighters } = fightTimes(data)
  const grouped = groupedAt(data, LOOK.groupFrom)
  const activity = [...data.shots.filter((s) => fighters.has(s.p)).map((s) => s.t), ...fight.records.map((r) => r.t_s)]
    .sort((a, b) => a - b)
  const first = Math.min(activity.find((t) => t >= fight.start_s - 3) ?? fight.start_s, fight.start_s)
  // The first moment from t on with QUIET_S of quiet after it (at most SETTLE_S later).
  const settle = (t: number) => {
    let at = t
    for (const a of activity) {
      if (a < at) continue
      if (a - at >= QUIET_S || a > t + SETTLE_S) break
      at = a + 0.15
    }
    return Math.min(at, t + SETTLE_S)
  }
  const elims = fight.records.filter((r) => r.kind === "elim").map((r) => r.t_s)
  const windows: Span[] = [
    [first - lead, settle(first + ENGAGE_S)],                       // the first shots, and the fighting they start
    [grouped - 0.5, grouped + CLAIM_S + 0.2],                         // the circle closing in
    ...(joiners.length ? [[entry - 1.0, entry + 1.0] as Span] : []),   // the third team joining
    ...fight.records.filter((r) => r.kind === "knock").map((r) => [r.t_s - KNOCK_S[0], r.t_s + KNOCK_S[1]] as Span),
    [Math.min(elims.at(-1) ?? fight.end_s, fight.end_s) - 1.2, fight.end_s],   // the last elimination and the end
  ]
  windows.sort((a, b) => a[0] - b[0])
  const beats: Span[] = []
  for (const w of windows) {
    const last = beats.at(-1)
    if (last && w[0] - last[1] < MERGE_S) last[1] = Math.max(last[1], w[1])
    else beats.push([...w])
  }
  beats[beats.length - 1][1] = fight.end_s     // the card follows the end
  return beats
}

// ---- the pace: game seconds per video second, by game time ----

const FAST = 1.25
const SLOW = 0.75
const smooth = (x: number) => ease(clamp01(x))

function paceOf(data: FightData) {
  const { fight } = fightTimes(data)
  const formed = groupedAt(data, LOOK.groupFrom) + CLAIM_S
  const lastElim = Math.min(fight.records.filter((r) => r.kind === "elim").at(-1)?.t_s ?? fight.end_s, fight.end_s)
  const marks = { faster: formed, slower: lastElim - 2.5, normal: fight.end_s }
  // up to FAST over 1.5 s once the circle has formed; down to SLOW over the
  // 2 s before the last elimination; back to real time over 1 s after the end
  const speed = (g: number) =>
    lerp(lerp(lerp(1, FAST, smooth((g - marks.faster) / 1.5)), SLOW, smooth((g - marks.slower) / 2)), 1, smooth((g - marks.normal) / 1))
  // tau(g): video seconds from the window's start to game time g; at(t) is its inverse
  const [g0, g1] = data.window
  const step = 0.02
  const n = Math.ceil((g1 - g0) / step)
  const tau = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) tau[i + 1] = tau[i] + step / speed(g0 + (i + 0.5) * step)
  return {
    marks,
    tau(g: number) {
      if (g <= g0) return g - g0
      if (g >= g0 + n * step) return tau[n] + (g - g0 - n * step)
      const f = (g - g0) / step, i = Math.floor(f)
      return tau[i] + (tau[i + 1] - tau[i]) * (f - i)
    },
    at(t: number) {
      if (t <= 0) return g0 + t
      if (t >= tau[n]) return g0 + n * step + (t - tau[n])
      let lo = 0, hi = n
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tau[mid] <= t) lo = mid; else hi = mid }
      return g0 + (lo + (t - tau[lo]) / (tau[lo + 1] - tau[lo])) * step
    },
  }
}

// ---- a clip ----

const CROSSFADE_V = 0.5
// The camera's way in: the first clip holds the wide view a moment, then
// takes longer. The first shots come just after it arrives.
const ZOOM_IN: Span = [0, 2.2]
const ZOOM_IN_FIRST: Span = [0.4, 3.4]
// After the fight ends: the camera steps aside for the card and zooms back
// out (seconds after the end); the clip ends once it's out.
const AFTER = { pan: [0.1, 0.8], cardIn: [0.3, 0.9], cardOut: [2.3, 2.7], zoomOut: [2.4, 4.6] }

const clips = { first: new WeakMap<FightData, Clip>(), later: new WeakMap<FightData, Clip>() }
type Clip = ReturnType<typeof makeClip>
function clipOf(data: FightData, first: boolean): Clip {
  const cache = first ? clips.first : clips.later
  let clip = cache.get(data)
  if (!clip) cache.set(data, (clip = makeClip(data, first)))
  return clip
}

function makeClip(data: FightData, first: boolean) {
  const zoomIn = first ? ZOOM_IN_FIRST : ZOOM_IN
  const pace = paceOf(data)
  const beats = planBeats(data, zoomIn[1] + 0.1)
  const start = [0]                                     // video time each beat starts...
  beats.forEach(([a, b], i) => { if (i < beats.length - 1) start.push(start[i] + pace.tau(b) - pace.tau(a) + CROSSFADE_V) })
  const end = beats.map(([a, b], i) => start[i] + pace.tau(b) - pace.tau(a))   // ...and ends
  // each beat's clock, running on (at the fight's pace) either side of it
  const clocks = beats.map(([a], i) => (v: number) => pace.at(pace.tau(a) + v - start[i]))
  const fightEnd = end[beats.length - 1]
  const after = (s: number[]): Span => [fightEnd + s[0], fightEnd + s[1]]
  const duration = Math.round((fightEnd + AFTER.zoomOut[1]) * FPS) / FPS
  // the crossfade under way at v, if any: from beat i to i + 1, 0 to 1
  const fadeAt = (v: number) => {
    const i = end.findIndex((e, i) => i < beats.length - 1 && v >= e && v < start[i + 1])
    return i === -1 ? null : { i, k: ease((v - end[i]) / CROSSFADE_V) }
  }
  const beatAt = (v: number) => Math.max(0, start.findLastIndex((s) => s <= v))
  // when a moment of the game shows, on whichever beat shows it
  const videoAt = (g: number) => {
    const i = beats.findIndex(([a, b]) => g >= a && g <= b)
    return i === -1 ? null : start[i] + pace.tau(g) - pace.tau(beats[i][0])
  }
  return {
    duration,
    camera: { zoomIn, pan: after(AFTER.pan), zoomOut: after(AFTER.zoomOut) } as CameraTiming,
    cardIn: after(AFTER.cardIn),
    cardOut: after(AFTER.cardOut),
    axis: linearAxis(clocks[0](0), clocks[beats.length - 1](duration)),
    // the beats on screen at v (two during a crossfade), each with its clock and opacity
    layers(v: number) {
      const f = fadeAt(v)
      return f
        ? [{ beat: f.i, opacity: 1 - f.k }, { beat: f.i + 1, opacity: f.k }]
        : [{ beat: beatAt(v), opacity: 1 }]
    },
    clocks,
    // the game time at v outside a crossfade (and before or after the clip)
    clock: (v: number) => clocks[beatAt(v)](v),
    // the timeline's game time: the current clock, gliding across a crossfade
    playhead(v: number) {
      const f = fadeAt(v)
      return f ? lerp(clocks[f.i](v), clocks[f.i + 1](v), f.k) : clocks[beatAt(v)](v)
    },
    // when everything happens, for reading back (video seconds)
    timing(): Moment[] {
      const { fight, entry, joiners } = fightTimes(data)
      const grouped = groupedAt(data, LOOK.groupFrom)
      const firstHit = fight.records.find((r) => r.kind !== "shot_attempt")?.t_s
      const events: [number, string][] = [
        ...(firstHit !== undefined ? [[firstHit, "first hit"] as [number, string]] : []),
        [grouped, "circle closes in"],
        [grouped + CLAIM_S, "circle formed"],
        [pace.marks.faster + 0.75, `speeding up to ${FAST}x`],
        ...(joiners.length ? [[entry, "third team joins"] as [number, string]] : []),
        ...fight.records.filter((r) => r.kind === "knock" || r.kind === "elim").map((r) => [r.t_s, r.kind] as [number, string]),
        [pace.marks.slower + 1, `slowing to ${SLOW}x`],
        [fight.end_s, "fight ends"],
      ]
      const out: Moment[] = [{ at: zoomIn[0], until: zoomIn[1], what: "zoom in from the wide view" }]
      beats.forEach(([a, b], i) => {
        out.push({ at: start[i], until: end[i], what: `beat: game ${a.toFixed(1)}–${b.toFixed(1)}` })
        if (i < beats.length - 1) {
          const skipped = beats[i + 1][0] - b - 2 * CROSSFADE_V * FAST
          out.push({ at: end[i], until: start[i + 1], what: `crossfade, skipping about ${skipped.toFixed(0)} s of game` })
        }
      })
      for (const [g, what] of events) {
        const at = videoAt(g)
        if (at !== null) out.push({ at, what })
      }
      out.push({ at: fightEnd + AFTER.pan[0], until: fightEnd + AFTER.cardIn[1], what: "pan, card in" })
      out.push({ at: fightEnd + AFTER.cardOut[0], until: fightEnd + AFTER.cardOut[1], what: "card out" })
      out.push({ at: fightEnd + AFTER.zoomOut[0], until: duration, what: "zoom out to the wide view" })
      return out.sort((a, b) => a.at - b.at)
    },
  }
}

type Moment = { at: number; until?: number; what: string }

// ---- the reel ----

export type ReelProps = {
  fights: FightKey[]
  timeline: boolean      // the game clock under the scene; without it the scene fills the frame
  data: Partial<Record<FightKey, FightData>> | null
  timing?: Moment[]
}

// Loads the fights and sets the length; `timing` lists when everything
// happens (the Studio's props panel shows it).
export const loadReel: CalculateMetadataFunction<ReelProps> = async ({ props }) => {
  const data: Partial<Record<FightKey, FightData>> = { ...props.data }
  for (const f of props.fights) {
    data[f] ??= { ...((await (await fetch(staticFile(FIGHTS[f].file))).json()) as FightData), perspective: FIGHTS[f].perspective ?? null }
  }
  let offset = 0
  const timing: Moment[] = []
  for (const [j, f] of props.fights.entries()) {
    const clip = clipOf(data[f]!, j === 0)
    const round = (x: number) => Math.round((offset + x) * 100) / 100
    for (const m of clip.timing()) timing.push({ at: round(m.at), until: m.until === undefined ? undefined : round(m.until), what: `${f}: ${m.what}` })
    offset += clip.duration
  }
  return { props: { ...props, data, timing }, durationInFrames: Math.round(offset * FPS) }
}

export function Reel({ fights, timeline, data }: ReelProps) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  if (!data || fights.some((f) => !data[f])) return <AbsoluteFill style={{ background: COLORS.backdrop }} />
  const v = frame / fps
  const period = durationInFrames / fps
  const look = { ...LOOK, sceneH: timeline ? SCENE_H : HEIGHT }
  // the clip playing now, and how far into it; and the ones either side (round the loop)
  const all = fights.map((f, j) => ({ fight: data[f]!, clip: clipOf(data[f]!, j === 0), spot: FIGHTS[f].spot }))
  let i = 0, u = v
  while (i < all.length - 1 && u >= all[i].clip.duration) u -= all[i++].clip.duration
  const { fight, clip, spot } = all[i]
  const prev = all[(i + all.length - 1) % all.length]
  const next = all[(i + 1) % all.length]

  const layers = clip.layers(u).map((l) => {
    const clockAt = (dv: number) => clip.clocks[l.beat](u + dv)
    return { ...l, clockAt, view: viewOf({ data: fight, clockAt, camV: u, camera: clip.camera, look, spot }) }
  })
  const view = layers.length === 2 ? blendViews(layers[0].view, layers[1].view, layers[1].opacity) : layers[0].view
  // the fight (all but its players' arrows) fades in as the camera goes in, and out as it leaves
  const presence = smooth(view.toFight / 0.45)

  return (
    <AbsoluteFill style={{ background: COLORS.backdrop, fontFamily, ["--font-geist-sans" as string]: fontFamily }}>
      <Backdrop view={view} v={v} period={period} size={LOOK.size} />
      <FightFromAfar data={prev.fight} game={prev.clip.clock(prev.clip.duration + u)} view={view} spot={prev.spot}
        opacity={1 - phase(u, [0.2, clip.camera.zoomIn[1] * 0.7])} size={LOOK.size} />
      <FightFromAfar data={next.fight} game={next.clip.clock(u - clip.duration)} view={view} spot={next.spot}
        opacity={phase(u, [clip.camera.zoomOut[0] + 0.6, clip.duration])} size={LOOK.size} />
      {layers.map((l) => (
        <AbsoluteFill key={`${i}-${l.beat}`} style={{ opacity: l.opacity }}>
          <World data={fight} game={l.clockAt(0)} clockAt={l.clockAt} camV={u} camera={clip.camera} look={look}
            view={l.view} grid={false} spot={spot} presence={presence} />
        </AbsoluteFill>
      ))}
      {timeline && <Timeline data={fight} game={clip.playhead(u)} x={clip.axis} size={LOOK.size} groupFrom={LOOK.groupFrom} presence={presence} />}
      <FightCard data={fight} shown={phase(u, clip.cardIn) * (1 - phase(u, clip.cardOut))} />
    </AbsoluteFill>
  )
}
