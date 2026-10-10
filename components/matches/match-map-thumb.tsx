import type { ZonePhase } from '@/lib/replay/engine'
import {
  getReplayWorldScale,
  projectReplayWorldToMapImage,
  type ReplayMapDefinition,
} from '@/lib/replay/map-projection'

// The SVG's map units: the map image spans 0..SIZE on both axes.
const SIZE = 1000

// How a match ended, as a static picture: the map cropped to its last storm
// circles, with the storm (everything outside the final circle) tinted.
// Strokes don't scale with the crop, so every card reads the same.
export function MatchMapThumb({
  imageUrl,
  definition,
  zones,
  className,
}: {
  imageUrl: string
  definition: ReplayMapDefinition
  zones: ZonePhase[]
  className?: string
}) {
  const scale = getReplayWorldScale({ imageWidth: SIZE, mapDefinition: definition })
  const circles = zones
    .filter((z) => z.nextR > 0)
    .map((z) => {
      const p = projectReplayWorldToMapImage({ x: z.nextCX, y: z.nextCY, imageWidth: SIZE, imageHeight: SIZE, mapDefinition: definition })
      return { cx: p.x + SIZE / 2, cy: p.y + SIZE / 2, r: z.nextR * scale }
    })
  const last = circles.at(-1)

  // Frame the last few circles with some map around them; the whole island
  // when the match has no storm data.
  let viewBox = `0 0 ${SIZE} ${SIZE}`
  if (last) {
    const half = Math.max(...circles.slice(-5).map((c) => Math.hypot(c.cx - last.cx, c.cy - last.cy) + c.r)) * 1.15
    viewBox = `${last.cx - half} ${last.cy - half} ${half * 2} ${half * 2}`
  }

  return (
    <svg viewBox={viewBox} className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <image href={imageUrl} width={SIZE} height={SIZE} preserveAspectRatio="none" />
      {last && (
        <path
          fillRule="evenodd"
          fill="rgb(76 29 149 / 0.35)"
          d={`M-${SIZE} -${SIZE}H${SIZE * 2}V${SIZE * 2}H-${SIZE}Z M${last.cx - last.r} ${last.cy}a${last.r} ${last.r} 0 1 0 ${last.r * 2} 0a${last.r} ${last.r} 0 1 0 -${last.r * 2} 0Z`}
        />
      )}
      {circles.map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill={i === circles.length - 1 ? 'rgb(255 255 255 / 0.25)' : 'none'}
          stroke="white"
          strokeOpacity={0.35 + (0.65 * (i + 1)) / circles.length}
          strokeWidth={i === circles.length - 1 ? 2 : 1.25}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}
