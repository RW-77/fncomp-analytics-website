import type { ReplayMapDefinition } from '@/lib/replay/map-projection'
import {
    getMapAssets,
    getMatchMetadata,
    placementsByReplayTeam,
    signPlayerSkins,
    type MatchMetadata,
    type PlayerSkin,
} from '@/lib/replay/match-data'
import { getMatchBuildVersion, getMatchLoadouts, getMatchPlacements } from '@/lib/stats'

// Everything a replay needs before it can start: the timeline metadata, the
// map, and what the panels show about each player and team. Small (a few
// KB), so it's loaded up front; the heavy files (movement chunks, shots,
// inventory, engagements) load in the browser.
export type ReplayPayload = {
    metadata: MatchMetadata
    mapDefinition: ReplayMapDefinition | null
    mapImageUrl: string | null            // presigned
    skins: Record<string, PlayerSkin>     // player id -> outfit; empty when the match has no loadout data
    pickaxes: Record<string, PlayerSkin>  // player id -> pickaxe cosmetic; likewise
    placements: Record<string, number>    // replay team id -> placement (1 = won); empty when not on the leaderboard
}

// null when the match has no timeline (yet). Skins and placements are
// decoration: if they fail to load, the replay comes without them.
export async function getReplayPayload(matchId: string): Promise<ReplayPayload | null> {
    const [metadata, buildVersion, loadouts, placements] = await Promise.all([
        getMatchMetadata(matchId),
        getMatchBuildVersion(matchId),
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
    if (!metadata) return null

    const mapAssets = buildVersion
        ? await getMapAssets(buildVersion.build_major, buildVersion.build_minor, buildVersion.mode_id ?? undefined)
        : null

    return {
        metadata,
        mapDefinition: mapAssets?.definition ?? null,
        mapImageUrl: mapAssets?.imageUrl ?? null,
        skins: loadouts.skins,
        pickaxes: loadouts.pickaxes,
        placements: placementsByReplayTeam(metadata, placements),
    }
}
