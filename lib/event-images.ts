/**
 * Helpers for rendering the event image associated with a tournament.
 *
 * `image_key` lives on the `events` table and stores the full S3 object
 * basename (including extension), e.g. `epicgames_S40_FNCSMajor1_Final_EU.jpg`.
 * The website resolves that to `assets/event-images/<image_key>` inside the
 * configured S3 bucket (BUCKET_NAME, expected to be `fortnite-tournament-objects`
 * in production).
 *
 * When S3 is not configured (typical local dev), the image falls back to
 * `/images/<image_key>` so the asset can also be checked into `/public/images`.
 */

const EVENT_IMAGE_S3_PREFIX = "assets/event-images/"

// Allow letters, digits, underscores, and hyphens, with optional dot-separated
// suffixes (e.g. a file extension). Rejects empty tokens so `..`, `.foo`, and
// `foo.` cannot match — important because the value is used in an S3 object key.
const IMAGE_KEY_PATTERN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/

const hasEventImageStorage = Boolean(
  process.env.BUCKET_NAME &&
    process.env.BUCKET_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
)

/**
 * Validates that an image_key is safe to use as a URL segment and an S3 key
 * suffix. Disallows path separators and parent-directory traversal.
 */
export function isValidImageKey(imageKey: string): boolean {
  return IMAGE_KEY_PATTERN.test(imageKey)
}

/**
 * Builds the S3 object key for a tournament image. The image_key column
 * already includes the file extension, so it is used verbatim under the
 * `assets/event-images/` prefix. Returns null if the input fails validation.
 */
export function buildEventImageS3Key(imageKey: string): string | null {
  if (!isValidImageKey(imageKey)) {
    return null
  }
  return `${EVENT_IMAGE_S3_PREFIX}${imageKey}`
}

/**
 * Resolves the path the browser should load for a tournament image. Returns
 * null when no image_key is set or it fails validation, so the UI can render
 * a placeholder.
 */
export function getTournamentImagePath(imageKey: string | null | undefined): string | null {
  if (!imageKey || !isValidImageKey(imageKey)) {
    return null
  }

  return hasEventImageStorage
    ? `/api/event-images/${encodeURIComponent(imageKey)}`
    : `/images/${imageKey}`
}
