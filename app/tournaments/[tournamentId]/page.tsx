// app/tournaments/[tournamentId]/page.tsx

import TournamentStatsClient from "./tournamentStatsClient"
import { getMatches, getWeaponIds, getFilteredStats } from "@/lib/actions"
import { StatFilters } from "@/lib/types"

type PageProps = {
	params: Promise<{ tournamentId: string }>
}

export default async function TournamentPage({ params }: PageProps) {
	const { tournamentId } = await params;

	const matches = await getMatches(tournamentId);
	const weapons = await getWeaponIds(tournamentId);
	
	const initialFilters: StatFilters = {
		selectedMatches: matches.map(m => m.id),
		weaponTypes: weapons.map(w => w.id),
		distanceRange: [0, 400],
		timeRange: [0, 30],
	};
	const initialData = await getFilteredStats(initialFilters);

	return (
		<div className="container mx-auto px-4 py-10">
			<h1 className="text-4xl font-bold mb-8 font-[family-name:var(--font-geist-sans)] text-[#333333]">
				Tournament: {tournamentId}
			</h1>

			<TournamentStatsClient
				matches={matches}
				weapons={weapons}
				initialData={initialData}
			/>
		</div>
	);
}
