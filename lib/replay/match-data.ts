import {
    S3Client,
    GetObjectCommand,
    NoSuchKey,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ReplayMapDefinition } from '@/lib/replay/map-projection'
import type { MatchEngagements } from '@/lib/replay/engagements'
import type { ZonePhase } from '@/lib/replay/engine'

const {
    BUCKET_NAME,
    BUCKET_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
} = process.env;

if (!BUCKET_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('Missing environment variables');
}

const s3Client = new S3Client({
    region: BUCKET_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
});

export type MatchMetadata = {
    schema_version?: number
    match_id: string
    hz: number
    interval_seconds: number
    total_frames?: number
    total_chunks?: number
    duration_seconds?: number
    player_count?: number
    index_to_player?: Record<string, string>
    player_to_index?: Record<string, number>
    index_to_team?: Record<string, number>
    id_to_username?: Record<string, string>
    // The ETL's TIMELINE_VERSION when this timeline was built (absent before
    // v2). The engine adds it to chunk/zone/shot URLs, which are cached as
    // immutable, so a rebuilt timeline isn't served from a stale cache.
    timeline_version?: number
}

export type MapAssets = {
    definition: ReplayMapDefinition
    imageUrl: string
}

// Leaderboard placements keyed by the replay's own team ids (metadata
// index_to_team), matched through the teams' members.
export function placementsByReplayTeam(
    metadata: MatchMetadata,
    placements: { placement: number; memberIds: string[] }[],
): Record<string, number> {
    const out: Record<string, number> = {}
    for (const { placement, memberIds } of placements) {
        for (const id of memberIds) {
            const index = metadata.player_to_index?.[id]
            const team = index === undefined ? undefined : metadata.index_to_team?.[String(index)]
            if (team !== undefined) {
                out[String(team)] = placement
                break
            }
        }
    }
    return out
}

// A player's equipped cosmetic (outfit or pickaxe), as the metadata route
// returns it. imageUrl is a presigned S3 URL (see signImageKeys); null when the
// cosmetic has no image in the catalog.
export type PlayerSkin = {
    cosmeticId: string
    name: string | null
    imageUrl: string | null
}

// One change in a player's inventory, as the ETL writes inventory.json:
// [t, slot, item, count, ammo?] puts items[item] in the slot (ammo = loaded
// magazine, omitted when 0); [t, slot, -1] empties it. t is replay seconds.
export type InventoryChange = [number, number, number, number?, number?]

export type MatchInventory = {
    schema_version: number
    match_id: string
    items: string[]                               // item ids, indexed by the changes
    players: Record<string, InventoryChange[]>    // player id -> changes in time order
}

// An inventory item for display (see getItemCatalog in lib/stats.ts for the
// categories). imageUrl is presigned; null when the item has no image.
export type ItemInfo = {
    name: string | null
    category: string
    rarity: string | null
    ammo: string | null
    imageUrl: string | null
}

// What /api/replay/inventory returns: the match's inventory plus display info
// for every item id in it.
export type InventoryPayload = MatchInventory & { itemInfo: Record<string, ItemInfo> }

// Icon URLs last long: an icon may first be shown hours into a session (a
// panel opened late), and the browser only fetches it then.
const IMAGE_URL_TTL_S = 12 * 3600

// Presigns each distinct S3 key once. Signing is computed locally (no request
// to S3), so a match's worth of icons is cheap.
export async function signImageKeys(keys: Iterable<string | null>): Promise<Map<string, string>> {
    const urls = new Map<string, string>()
    for (const key of keys) {
        if (!key || urls.has(key)) continue
        urls.set(key, await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
            { expiresIn: IMAGE_URL_TTL_S },
        ))
    }
    return urls
}

// Presigns each player's cosmetic image. Players with the same one share a URL.
export async function signPlayerSkins(
    skins: Record<string, { cosmeticId: string; name: string | null; imageKey: string | null }>,
): Promise<Record<string, PlayerSkin>> {
    const urls = await signImageKeys(Object.values(skins).map((s) => s.imageKey))
    const signed: Record<string, PlayerSkin> = {}
    for (const [playerId, skin] of Object.entries(skins)) {
        signed[playerId] = {
            cosmeticId: skin.cosmeticId,
            name: skin.name,
            imageUrl: skin.imageKey ? urls.get(skin.imageKey) ?? null : null,
        }
    }
    return signed
}

// Presigns each item's image.
export async function signItemCatalog(
    catalog: Record<string, Omit<ItemInfo, 'imageUrl'> & { imageKey: string | null }>,
): Promise<Record<string, ItemInfo>> {
    const urls = await signImageKeys(Object.values(catalog).map((i) => i.imageKey))
    const signed: Record<string, ItemInfo> = {}
    for (const [itemId, { imageKey, ...info }] of Object.entries(catalog)) {
        signed[itemId] = { ...info, imageUrl: imageKey ? urls.get(imageKey) ?? null : null }
    }
    return signed
}

export async function getMapAssets(
    buildMajor: number,
    buildMinor: number,
    modeId: string = 'br',
): Promise<MapAssets | null> {
    const versionPath = `${buildMajor}.${String(buildMinor).padStart(2, '0')}`
    const definitionKey = `maps/versions/${versionPath}/${modeId}.json`

    try {
        const defResponse = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: definitionKey }))
        if (!defResponse.Body) return null
        const definition = JSON.parse(await defResponse.Body.transformToString()) as ReplayMapDefinition
        // Served by /api/replay/map-image at a stable, cacheable URL.
        const imageUrl = `/api/replay/map-image?${new URLSearchParams({ build: versionPath, mode: modeId })}`
        return { definition, imageUrl }
    } catch (e) {
        if (e instanceof NoSuchKey) return null
        throw e
    }
}

// A map image's bytes, streamed from S3; null when the version has none.
export async function getMapImage(versionPath: string, modeId: string): Promise<ReadableStream | null> {
    const key = `maps/versions/${versionPath}/${modeId}.webp`
    try {
        const response = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
        return response.Body?.transformToWebStream() ?? null
    } catch (e) {
        if (e instanceof NoSuchKey) return null
        throw e
    }
}

// The match's timeline metadata, written by the ETL's timeline asset. null
// when the match has no timeline yet, or the file lacks what the replay needs.
export async function getMatchMetadata(matchId: string): Promise<MatchMetadata | null> {
    const key = `replays/matches/${matchId}/metadata.json`;
    try {
        const response = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        if (!response.Body) return null;
        const metadata: unknown = JSON.parse(await response.Body.transformToString());
        return isReplayMetadata(metadata) ? metadata : null;
    } catch (e) {
        if (e instanceof NoSuchKey) return null;
        throw e;
    }
}

function isReplayMetadata(value: unknown): value is MatchMetadata {
    const m = value as Partial<MatchMetadata> | null;
    return (
        typeof m?.match_id === 'string' &&
        typeof m.hz === 'number' && m.hz > 0 &&
        typeof m.interval_seconds === 'number' && m.interval_seconds > 0 &&
        typeof m.player_to_index === 'object' && m.player_to_index !== null
    );
}

// The match's inventory file, written by the ETL's inventory asset. null when
// the match hasn't been processed for inventory yet.
export async function getMatchInventory(matchId: string): Promise<MatchInventory | null> {
    const key = `replays/matches/${matchId}/inventory.json`;
    try {
        const response = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        if (!response.Body) return null;
        return JSON.parse(await response.Body.transformToString()) as MatchInventory;
    } catch (e) {
        if (e instanceof NoSuchKey) return null;
        throw e;
    }
}

// The match's storm phases (zones.json, written with the timeline). null when
// the match has none.
export async function getMatchZones(matchId: string): Promise<ZonePhase[] | null> {
    const key = `replays/matches/${matchId}/zones.json`;
    try {
        const response = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        if (!response.Body) return null;
        const zones: unknown = JSON.parse(await response.Body.transformToString());
        return Array.isArray(zones) ? (zones as ZonePhase[]) : null;
    } catch (e) {
        if (e instanceof NoSuchKey) return null;
        throw e;
    }
}

// The match's engagements file, written by the ETL's engagements asset. null
// when the match hasn't been processed for engagements yet.
export async function getMatchEngagements(matchId: string): Promise<MatchEngagements | null> {
    const key = `replays/matches/${matchId}/engagements.json`;
    try {
        const response = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        if (!response.Body) return null;
        return JSON.parse(await response.Body.transformToString()) as MatchEngagements;
    } catch (e) {
        if (e instanceof NoSuchKey) return null;
        throw e;
    }
}
