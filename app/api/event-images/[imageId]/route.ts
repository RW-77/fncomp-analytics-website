import {
  GetObjectCommand,
  NoSuchKey,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import { NextResponse } from "next/server"

import { buildEventImageS3Key } from "@/lib/event-images"

const {
  BUCKET_NAME,
  BUCKET_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
} = process.env

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

// The dynamic segment is still named `imageId` to match the route folder name,
// but it now carries the raw `events.image_key` value from the database.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params
  const key = buildEventImageS3Key(imageId)

  if (!key) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 })
  }

  if (!s3Client || !BUCKET_NAME) {
    return NextResponse.json({ error: "Image storage is not configured" }, { status: 500 })
  }

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    )

    if (!response.Body) {
      throw new Error("No body in response")
    }

    const bytes = await response.Body.transformToByteArray()
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer

    return new Response(body, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(bytes.byteLength),
        "Content-Type": response.ContentType ?? "image/jpeg",
      },
    })
  } catch (caught) {
    if (caught instanceof NoSuchKey) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    if (caught instanceof S3ServiceException) {
      console.error(`Failed to fetch event image ${key}: ${caught.message}`)
      return NextResponse.json({ error: "S3 error" }, { status: 500 })
    }

    console.error("Unexpected error while fetching event image", caught)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
