import {
  S3Client,
  GetObjectCommand,
  NoSuchKey,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'


const {
  BUCKET_NAME,
  BUCKET_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
} = process.env

if (!BUCKET_NAME || !BUCKET_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  throw new Error('Missing environment variables')
}

const s3Client = new S3Client({
  region: BUCKET_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('matchId')
  const chunkIndexParam = searchParams.get('chunkIndex')

  if (!matchId || chunkIndexParam === null) {
    return NextResponse.json(
      { error: 'Missing matchId or chunkIndex' },
      { status: 400 },
    )
  }

  const chunkIndex = Number(chunkIndexParam)
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json(
      { error: 'chunkIndex must be a non-negative number' },
      { status: 400 },
    )
  }

  const chunkStr = chunkIndex.toString().padStart(5, '0')
  const key = `replays/matches/${matchId}/movement/${chunkStr}.npy`

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }),
    )

    if (!response.Body) {
      throw new Error('No body in response')
    }

    const bytes = await response.Body.transformToByteArray()

    console.log(`✅ Success! Fetched: ${key}`)
    console.log(`Content-Type: ${response.ContentType}`)
    // console.log(`File Size: ${binData.length} bytes`)

    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(bytes.byteLength),
      }
    })
  } catch (caught) {
    if (caught instanceof NoSuchKey) {
      console.error(`❌ Key not found: "${key}" in bucket "${BUCKET_NAME}"`)
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 },
      )
    }

    if (caught instanceof S3ServiceException) {
      console.error(`❌ S3 Error [${caught.name}]: ${caught.message}`)
      return NextResponse.json(
        { error: 'S3 error' },
        { status: 500 },
      )
    }

    console.error('Unexpected error while fetching movement chunk', caught)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
