import { redirect } from "next/navigation"

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

  redirect(`/tournaments/${tournamentId}/players${query ? `?${query}` : ""}`)
}
