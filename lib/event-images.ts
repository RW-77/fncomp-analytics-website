const EVENT_IMAGE_KEYS = {
  eval: "assets/event-images/eval.jpg",
  fncs: "assets/event-images/fncs.jpg",
} as const

const EVENT_IMAGE_FALLBACK_PATHS = {
  eval: "/images/eval.jpg",
  fncs: "/images/fncs.jpg",
} as const

export type EventImageId = keyof typeof EVENT_IMAGE_KEYS

const hasEventImageStorage = Boolean(
  process.env.BUCKET_NAME &&
    process.env.BUCKET_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
)

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

  if (!imageId) {
    return null
  }

  return hasEventImageStorage
    ? `/api/event-images/${imageId}`
    : EVENT_IMAGE_FALLBACK_PATHS[imageId]
}

export function getEventImageKey(imageId: string) {
  return isEventImageId(imageId) ? EVENT_IMAGE_KEYS[imageId] : null
}

function isEventImageId(imageId: string): imageId is EventImageId {
  return imageId in EVENT_IMAGE_KEYS
}
