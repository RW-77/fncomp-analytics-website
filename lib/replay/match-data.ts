import {
    S3Client,
    GetObjectCommand,
    NoSuchKey,
    S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ReplayMapDefinition } from '@/lib/replay/map-projection'

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
    id_to_username?: Record<string, string>
}

export type MapAssets = {
    definition: ReplayMapDefinition
    imageUrl: string
}

export async function getMapAssets(
    buildMajor: number,
    buildMinor: number,
    modeId: string = 'br',
): Promise<MapAssets | null> {
    const versionPath = `${buildMajor}.${String(buildMinor).padStart(2, '0')}`
    const definitionKey = `maps/versions/${versionPath}/${modeId}.json`
    const imageKey = `maps/versions/${versionPath}/${modeId}.webp`

    try {
        // Fetch definition JSON
        const defCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: definitionKey })
        const defResponse = await s3Client.send(defCommand)
        if (!defResponse.Body) return null
        const definition = JSON.parse(await defResponse.Body.transformToString()) as ReplayMapDefinition

        // Presigned URL for image (1 hour TTL — plenty for a replay session)
        const imgCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: imageKey })
        const imageUrl = await getSignedUrl(s3Client, imgCommand, { expiresIn: 3600 })

        return { definition, imageUrl }
    } catch (e) {
        if (e instanceof NoSuchKey) return null
        throw e
    }
}

export async function getMatchData(matchId: string): Promise<MatchMetadata> {
    const key = `replays/matches/${matchId}/metadata.json`;
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
        throw new Error("No body in response");
    }
    const str = await response.Body.transformToString();
    return JSON.parse(str);
}
