import ReplayClient from "./replay-client"
import { getMatchData } from "@/lib/replay/match-data"

// Hardcoded for the standalone prototype page. Later this will come from the
// route param (e.g. /replay/[matchId]).
const MATCH_ID = "32099e01a370309ab052848c21e9c2f0"

// This is a Server Component (no "use client"), so it can be async and read
// from S3 directly. We fetch the REAL metadata.json the ETL wrote instead of
// hardcoding hz/duration. Using the real `hz` is what keeps playback 1:1 with
// in-game time, and `duration_seconds` / `total_chunks` let us build a proper
// scrubber and stop cleanly at the end of the match.
export default async function ReplayPage() {
	const matchMetadata = await getMatchData(MATCH_ID)

	return (
		<div className="flex min-h-screen items-center justify-center">
			<ReplayClient
				mapId="br"
				stageWidth={1400}
				stageHeight={900}
				matchMetadata={matchMetadata}
			/>
		</div>
	)
}
