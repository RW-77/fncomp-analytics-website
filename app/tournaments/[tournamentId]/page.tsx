import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"

type PageProps = {
  params: Promise<{ tournamentId: string }>
  searchParams: Promise<{ region?: string; day?: string }>
}

export default async function TournamentPage({ params, searchParams }: PageProps) {
  const { tournamentId } = await params
  const { region, day } = await searchParams

  const forwardedParams = new URLSearchParams()
  if (region) forwardedParams.set("region", region)
  if (day) forwardedParams.set("day", day)
  const query = forwardedParams.toString()

  const hasLeaderboard =
    (await prisma.event_window_teams.findFirst({
      where: { event_windows: { tournament_id: tournamentId } },
      select: { id: true },
    })) !== null

  const landingTab = hasLeaderboard ? "leaderboard" : "players"
  redirect(`/tournaments/${tournamentId}/${landingTab}${query ? `?${query}` : ""}`)
}
