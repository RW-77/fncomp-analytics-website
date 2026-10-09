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

  if (!matchId) {
    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
  }

  const key = `replays/matches/${matchId}/shots.json`

  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    )

    if (!response.Body) throw new Error('No body in response')

    const text = await response.Body.transformToString()
    const data = JSON.parse(text)

    return NextResponse.json(data, {
      status: 200,
      headers: {
        // shots.json is immutable per match — safe to cache aggressively
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (caught) {
    if (caught instanceof NoSuchKey) {
      console.warn(`shots.json not found for match ${matchId}`)
      return NextResponse.json({ error: 'Shots not found' }, { status: 404 })
    }

    if (caught instanceof S3ServiceException) {
      console.error(`S3 error fetching shots for ${matchId}: ${caught.message}`)
      return NextResponse.json({ error: 'S3 error' }, { status: 500 })
    }

    console.error('Unexpected error fetching shots', caught)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
