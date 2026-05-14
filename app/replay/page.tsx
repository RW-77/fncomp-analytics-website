import ReplayClient from "./replay-client"


export default function ReplayPage() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<ReplayClient
				mapId="default"
				stageWidth={1400}
				stageHeight={900}
				matchMetadata={{
					schema_version: 1,
					match_id: "832ceecc424df110d58e3e96d3dff834",
					hz: 20,
					interval_seconds: 5,
					index_to_player: {},
					player_to_index: {},
				}}
			/>
		</div>
	)
}
