export type ReplayPoi = {
  locationTag: string
  name: string
  position: {
    x: number
    y: number
    z: number
  }
}

export type ReplayMapDefinition = {
  id: string
  minimapCenterLocation: {
    x: number
    y: number
    z: number
  }
  sizeCm: number
  rotationOffset: number
  pois?: ReplayPoi[]
}

/**
 * Returns the pixels-per-world-unit scale for the given map.
 * Use this to convert a world-space radius (e.g. zone radius) to image pixels:
 *   pixelRadius = worldRadius * getReplayWorldScale({ imageWidth, mapDefinition })
 */
export function getReplayWorldScale({
  imageWidth,
  mapDefinition,
}: {
  imageWidth: number
  mapDefinition: ReplayMapDefinition
}): number {
  return imageWidth / mapDefinition.sizeCm
}

export function projectReplayWorldToMapImage({
  x,
  y,
  imageWidth,
  imageHeight,
  mapDefinition,
}: {
  x: number
  y: number
  imageWidth: number
  imageHeight: number
  mapDefinition: ReplayMapDefinition
}) {
  const dx = x - mapDefinition.minimapCenterLocation.x
  const dy = y - mapDefinition.minimapCenterLocation.y

  // The minimap image is oriented per `rotationOffset` (degrees). The bare
  // linear projection below is only correct when the world axes already line up
  // with the image, which is the case at rotationOffset = 90 (e.g. BR). For any
  // other map — notably the Reload maps at rotationOffset 0 — the world offset
  // must be rotated by (rotationOffset - 90) first, or players land rotated off
  // the island (e.g. into the ocean). BR is unchanged: 90 - 90 = 0.
  const theta = ((mapDefinition.rotationOffset - 90) * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const rx = dx * cos - dy * sin
  const ry = dx * sin + dy * cos

  const pixelX = (rx / mapDefinition.sizeCm + 0.5) * imageWidth
  const pixelY = (0.5 + ry / mapDefinition.sizeCm) * imageHeight

  return {
    x: pixelX - imageWidth / 2,
    y: pixelY - imageHeight / 2,
  }
}
