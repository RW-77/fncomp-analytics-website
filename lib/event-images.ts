import "dotenv/config"

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const {
  BUCKET_NAME,
  BUCKET_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
} = process.env

const EVENT_IMAGE_KEYS = {
  eval: "assets/event-images/eval.jpg",
  fncs: "assets/event-images/fncs.jpg",
} as const

const EVENT_IMAGE_URL_TTL_SECONDS = 60 * 60

const s3Client =
  BUCKET_NAME && BUCKET_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
    ? new S3Client({
        region: BUCKET_REGION,
        credentials: {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
      })
    : null

export function getTournamentEventImageKey(groupId: string) {
  if (groupId.includes("FNCSMajor") && groupId.includes("Final")) {
    return EVENT_IMAGE_KEYS.fncs
  }

  if (groupId.includes("PerformanceEvaluation")) {
    return EVENT_IMAGE_KEYS.eval
  }

  return null
}

export async function getEventImageUrl(key: string) {
  if (!s3Client || !BUCKET_NAME) {
    return null
  }

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }),
    { expiresIn: EVENT_IMAGE_URL_TTL_SECONDS }
  )
}
