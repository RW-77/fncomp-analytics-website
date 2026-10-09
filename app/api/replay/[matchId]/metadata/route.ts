import { NextRequest, NextResponse } from "next/server"

import { getReplayPayload } from "@/lib/replay/replay-payload"

// Never statically cache: this returns per-request presigned S3 URLs (1h TTL)
// and live DB reads. Without this, a response computed before the map assets
// existed (falling back to BR) is cached and served indefinitely.
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params
  try {
    const payload = await getReplayPayload(matchId)
    if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(payload)
  } catch (err) {
    console.error(`Failed to load replay for match ${matchId}`, err)
    return NextResponse.json({ error: "Failed to load replay" }, { status: 500 })
  }
}
