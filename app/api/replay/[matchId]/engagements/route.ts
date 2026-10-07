import { NextRequest, NextResponse } from "next/server"

import { getMatchEngagements } from "@/lib/replay/match-data"

// Read from S3 on every request: the file appears (or is rebuilt) when the
// pipeline processes the match, so a cached "not found" would go stale.
export const dynamic = "force-dynamic"

// The match's engagements file, as the ETL wrote it. 404 until the match has
// been processed for engagements.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params
  try {
    const engagements = await getMatchEngagements(matchId)
    if (!engagements) {
      return NextResponse.json({ error: "Not processed yet" }, { status: 404 })
    }
    return NextResponse.json(engagements)
  } catch {
    return NextResponse.json({ error: "Failed to load engagements" }, { status: 500 })
  }
}
