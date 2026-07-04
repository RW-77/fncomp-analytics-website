import { NextRequest, NextResponse } from "next/server"

import { getMatchData, getMapAssets } from "@/lib/replay/match-data"
import { getMatchBuildVersion } from "@/lib/stats"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params
  try {
    const [metadata, buildVersion] = await Promise.all([
      getMatchData(matchId),
      getMatchBuildVersion(matchId),
    ])

    const mapAssets = buildVersion
      ? await getMapAssets(buildVersion.build_major, buildVersion.build_minor)
      : null

    return NextResponse.json({
      metadata,
      mapDefinition: mapAssets?.definition ?? null,
      mapImageUrl: mapAssets?.imageUrl ?? null,
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
