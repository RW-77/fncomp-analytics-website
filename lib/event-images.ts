const EVENT_IMAGE_KEYS = {
  eval: "assets/event-images/eval.jpg",
  fncs: "assets/event-images/fncs.jpg",
  globals: "assets/event-images/globals.jpg",
} as const

const EVENT_IMAGE_FALLBACK_PATHS = {
  div: "/images/div.jpg",
  eval: "/images/eval.jpg",
  fncs: "/images/fncs.jpg",
  globals: "/images/globals.jpg",
} as const

export type EventImageId = keyof typeof EVENT_IMAGE_FALLBACK_PATHS

const hasEventImageStorage = Boolean(
  process.env.BUCKET_NAME &&
    process.env.BUCKET_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
)

export function getTournamentEventImageId(groupId: string): EventImageId | null {
  if (groupId.includes("Dinosauron_Day")) {
    return "globals"
  }

  if (groupId.includes("FNCSDivisionalCup") && groupId.includes("Final")) {
    return "div"
  }

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

  const s3ImageKey = getEventImageKey(imageId)

  return hasEventImageStorage && s3ImageKey
    ? `/api/event-images/${imageId}`
    : EVENT_IMAGE_FALLBACK_PATHS[imageId]
}

export function getEventImageKey(imageId: string) {
  return isS3BackedEventImageId(imageId) ? EVENT_IMAGE_KEYS[imageId] : null
}

function isS3BackedEventImageId(imageId: string): imageId is keyof typeof EVENT_IMAGE_KEYS {
  return imageId in EVENT_IMAGE_KEYS
}
