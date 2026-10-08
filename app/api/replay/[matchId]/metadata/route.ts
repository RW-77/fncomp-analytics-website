import { NextRequest, NextResponse } from "next/server"

import { getMatchData, getMapAssets, placementsByReplayTeam, signPlayerSkins } from "@/lib/replay/match-data"
import { getMatchBuildVersion, getMatchLoadouts, getMatchPlacements } from "@/lib/stats"

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
    const [metadata, buildVersion, loadouts, placements] = await Promise.all([
      getMatchData(matchId),
      getMatchBuildVersion(matchId),
      // Skins and pickaxes are decoration: a failed lookup leaves them out
      // rather than failing the whole replay.
      getMatchLoadouts(matchId)
        .then(async ({ skins, pickaxes }) => ({
          skins: await signPlayerSkins(skins),
          pickaxes: await signPlayerSkins(pickaxes),
        }))
        .catch((err) => {
          console.error(`Failed to load loadouts for match ${matchId}`, err)
          return { skins: {}, pickaxes: {} }
        }),
      getMatchPlacements(matchId).catch((err) => {
        console.error(`Failed to load placements for match ${matchId}`, err)
        return []
      }),
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
      skins: loadouts.skins,
      pickaxes: loadouts.pickaxes,
      // replay team id -> placement (1 = won); empty when the match isn't on the leaderboard
      placements: placementsByReplayTeam(metadata, placements),
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
