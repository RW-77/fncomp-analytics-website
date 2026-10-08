import { NextRequest, NextResponse } from "next/server"

import { getMatchPlayerEvents } from "@/lib/stats"

// Live DB reads (a reprocess can change them), so never statically cached.
export const dynamic = "force-dynamic"

// Each player's eliminations, knocks and damage as event times, for the replay
// panels' whole-match totals (see getMatchPlayerEvents). A match not processed
// yet just has no events.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params
  try {
    return NextResponse.json({ players: await getMatchPlayerEvents(matchId) })
  } catch (err) {
    console.error(`Failed to load player stats for match ${matchId}`, err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
