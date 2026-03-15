// app/tournaments/[tournamentId]/page.tsx

import TournamentStatsClient from "./tournamentStatsClient"
import { getMatches, getWeaponIds, getFilteredStats } from "@/lib/actions"
import { StatFilters } from "@/lib/types"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
	formatTournamentLabel,
	getEventWindowGroupId,
	getEventWindowRegion,
	getTournamentSeriesId,
} from "@/lib/tournaments"

type PageProps = {
	params: Promise<{ tournamentId: string }>
}

export default async function TournamentPage({ params }: PageProps) {
	const { tournamentId } = await params;
	const currentEventWindow = await prisma.event_windows.findUnique({
		where: { event_window_id: tournamentId },
	});

	if (!currentEventWindow) {
		notFound();
	}

	const region = getEventWindowRegion(tournamentId);
	const eventWindowGroupId = getEventWindowGroupId(tournamentId);
	const tournamentSeriesId = getTournamentSeriesId(tournamentId);

	const regionEventWindows = region
		? (await prisma.event_windows.findMany({
				where: {
					event_window_id: {
						startsWith: `${eventWindowGroupId}_`,
					},
				},
				orderBy: { event_window_id: "asc" },
			})).filter((eventWindow) => getEventWindowGroupId(eventWindow.event_window_id) === eventWindowGroupId)
		: [currentEventWindow];

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
				Tournament: {formatTournamentLabel(eventWindowGroupId)}
			</h1>
			<div className="mb-8 space-y-3">
				<div className="text-sm text-muted-foreground">
					Series: {formatTournamentLabel(tournamentSeriesId)}
					{region ? ` · Region: ${region}` : ""}
				</div>
				{regionEventWindows.length > 1 && (
					<div className="flex flex-wrap gap-3">
						{regionEventWindows.map((eventWindow) => {
							const eventWindowRegion = getEventWindowRegion(eventWindow.event_window_id) ?? eventWindow.event_window_id;
							const isActive = eventWindow.event_window_id === tournamentId;

							return (
								<Button asChild key={eventWindow.event_window_id} variant={isActive ? "default" : "outline"}>
									<Link href={`/tournaments/${eventWindow.event_window_id}`}>
										{eventWindowRegion}
									</Link>
								</Button>
							);
						})}
					</div>
				)}
			</div>

			<TournamentStatsClient
				matches={matches}
				weapons={weapons}
				initialData={initialData}
			/>
		</div>
	);
}
