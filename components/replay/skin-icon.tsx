'use client'

import { User } from 'lucide-react'
import type { PlayerSkin } from '@/lib/replay/match-data'
import { cn } from '@/lib/utils'

// A player's outfit icon: a small square image, the skin's name on hover. The
// catalog's icons have transparent backgrounds, so the image sits straight on
// the panel. A player with no skin data (an older match, or a skin without an
// image) gets a faint placeholder box of the same size, so rows line up either
// way.
export function SkinIcon({
  skin,
  size = 20,
  className,
}: {
  skin: PlayerSkin | undefined
  size?: number          // css px, square
  className?: string
}) {
  if (!skin?.imageUrl) {
    return (
      <span
        className={cn('grid shrink-0 place-items-center rounded-[3px] bg-white/[0.06] text-slate-500', className)}
        style={{ width: size, height: size }}
        title={skin?.name ?? undefined}
        aria-hidden
      >
        <User style={{ width: size * 0.6, height: size * 0.6 }} />
      </span>
    )
  }
  return (
    // A plain <img>: the URL is a presigned S3 link that changes per page load,
    // so routing it through next/image's optimizer would only add a hop.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={skin.imageUrl}
      alt={skin.name ?? ''}
      title={skin.name ?? undefined}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn('shrink-0 object-contain', className)}
    />
  )
}
