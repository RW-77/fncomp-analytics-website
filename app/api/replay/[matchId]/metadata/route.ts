import { NextRequest, NextResponse } from "next/server"

import { getMatchData, getMapAssets } from "@/lib/replay/match-data"
import { getMatchBuildVersion } from "@/lib/stats"

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
    const [metadata, buildVersion] = await Promise.all([
      getMatchData(matchId),
      getMatchBuildVersion(matchId),
    ])

    const mapAssets = buildVersion
      ? await getMapAssets(
          buildVersion.build_major,
          buildVersion.build_minor,
          buildVersion.mode_id ?? undefined,
        )
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
