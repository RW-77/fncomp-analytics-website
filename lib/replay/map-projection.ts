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
  const pixelX =
    ((x - mapDefinition.minimapCenterLocation.x) / mapDefinition.sizeCm + 0.5) *
    imageWidth
  const pixelY =
    (0.5 + (y - mapDefinition.minimapCenterLocation.y) / mapDefinition.sizeCm) *
    imageHeight

  return {
    x: pixelX - imageWidth / 2,
    y: pixelY - imageHeight / 2,
  }
}
