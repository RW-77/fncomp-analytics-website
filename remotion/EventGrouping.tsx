// Event grouping, animated (the pieces are in scene.tsx). This version plays
// the fight on one continuous clock, quick between its key moments. The
// camera zooms in, steps aside for the fight's card, and zooms back out to
// where it began, so the clip loops.

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion"

import type { FightData } from "./fight-data"
import {
  COLORS,
  FightCard,
  Timeline,
  World,
  fontFamily,
  linearAxis,
  phase,
  type CameraTiming,
  type Span,
} from "./scene"

export { FPS, HEIGHT, WIDTH } from "./scene"
export const DURATION_S = 12

// ---- timing ----

// The game clock, keyed to the video: [video s, game s, game s per video s].
// Brisk while the teams converge, slow as the fight is detected and as the
// third team joins, quick through the rest of the fight, near real time
// under the card. Between keys it's a smooth (monotone) curve.
const KEYS: [number, number, number][] = [
  [0, 771, 5],
  [2.6, 784, 5],
  [3.5, 788.9, 2.5],    // the fight is detected
  [4.2, 790.6, 2.5],
  [5.4, 808, 3.5],
  [6.1, 811.3, 3.5],    // the third team joins
  [6.6, 812.7, 2.8],
  [8.1, 837.6, 1.5],    // the fight ends
  [DURATION_S, 843.45, 1.5],
]

// Game time at video time v (straight lines past either end, so the loop's
// crossfade can run the opening back in time).
function gameAt(v: number): number {
  const first = KEYS[0], last = KEYS[KEYS.length - 1]
  if (v <= first[0]) return first[1] + (v - first[0]) * first[2]
  if (v >= last[0]) return last[1] + (v - last[0]) * last[2]
  const i = KEYS.findIndex((k, j) => v >= k[0] && v < KEYS[j + 1][0])
  const [v0, g0, m0] = KEYS[i]
  const [v1, g1, m1] = KEYS[i + 1]
  const h = v1 - v0
  const t = (v - v0) / h
  const t2 = t * t, t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * g0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * g1 + (t3 - t2) * h * m1
}

const CAMERA: CameraTiming = { zoomIn: [1.0, 2.6], pan: [8.1, 8.8], zoomOut: [10.3, 11.5] }
const CARD_IN: Span = [8.3, 8.9]
const CARD_OUT: Span = [10.2, 10.6]
const LOOP_FADE: Span = [11.1, DURATION_S]   // crossfade into the opening frame

type Props = { data: FightData | null }

export function EventGrouping({ data }: Props) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (!data) return <AbsoluteFill style={{ background: COLORS.backdrop }} />
  const v = frame / fps
  const loop = phase(v, LOOP_FADE)
  return (
    <AbsoluteFill style={{ background: COLORS.backdrop, fontFamily, ["--font-geist-sans" as string]: fontFamily }}>
      <Scene data={data} v={v} />
      {/* the opening, run back in time, fading in over the end */}
      {loop > 0 && (
        <AbsoluteFill style={{ opacity: loop, background: COLORS.backdrop }}>
          <Scene data={data} v={v - DURATION_S} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

function Scene({ data, v }: { data: FightData; v: number }) {
  const game = gameAt(v)
  return (
    <AbsoluteFill>
      <World data={data} game={game} clockAt={(dv) => gameAt(v + dv)} camV={v} camera={CAMERA} />
      <Timeline data={data} game={game} x={linearAxis(gameAt(0), gameAt(DURATION_S))} />
      <FightCard data={data} shown={phase(v, CARD_IN) * (1 - phase(v, CARD_OUT))} />
    </AbsoluteFill>
  )
}
