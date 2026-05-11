const EVENT_IMAGE_KEYS = {
  eval: "assets/event-images/eval.jpg",
  fncs: "assets/event-images/fncs.jpg",
} as const

export type EventImageId = keyof typeof EVENT_IMAGE_KEYS

export function getTournamentEventImageId(groupId: string): EventImageId | null {
  if (groupId.includes("FNCSMajor") && groupId.includes("Final")) {
    return "fncs"
  }

  if (groupId.includes("PerformanceEvaluation")) {
    return "eval"
  }

  return null
}

export function getTournamentEventImagePath(groupId: string) {
  const imageId = getTournamentEventImageId(groupId)

  return imageId ? `/api/event-images/${imageId}` : null
}

export function getEventImageKey(imageId: string) {
  return isEventImageId(imageId) ? EVENT_IMAGE_KEYS[imageId] : null
}

function isEventImageId(imageId: string): imageId is EventImageId {
  return imageId in EVENT_IMAGE_KEYS
}
