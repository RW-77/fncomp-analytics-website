// app/tournaments/[tournamentId]/page.tsx

import { columns, PlayerStat } from "./columns"
import { prisma } from "@/lib/primsa"
import TournamentStatsClient from "./tournamentStatsClient"
import { getMatches, getWeaponIds, getFilteredEliminations, Filters } from "@/lib/actions"

type PageProps = {
	params: Promise<{ tournamentId: string }>
}

export default async function TournamentPage({ params }: PageProps) {
	const { tournamentId } = await params;

	const matches = await getMatches(tournamentId);
	const weapons = await getWeaponIds(tournamentId);
	
	const initialFilters: Filters = {
		selectedMatches: matches.map(m => m.id),
		weaponTypes: weapons.map(w => w.id),
		distanceRange: [0, 400],
		timeRange: [0, 25],
	};
	const initialData = await getFilteredEliminations(initialFilters);

	return (
		<div className="container mx-auto py-10">
			<h1 className="text-4xl font-bold mb-8 font-[family-name:var(--font-geist-sans)] text-[#333333]">
				Tournament: {tournamentId}
			</h1>

			<TournamentStatsClient
				tournamentId={tournamentId}
				matches={matches} 
				weapons={weapons}
				initialData={initialData}
			/>
		</div>
	);
}