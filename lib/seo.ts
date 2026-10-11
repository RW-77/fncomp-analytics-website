import { cache } from "react"
import type { Metadata } from "next"

import { prisma } from "@/lib/prisma"
import { getTournamentDisplayTitle } from "@/lib/tournaments"

// The site's canonical address and the copy search engines and link previews
// show for it.
export const SITE_URL = "https://www.fnanalytics.gg"
export const SITE_NAME = "FNAnalytics"
export const SITE_TITLE = "FNAnalytics: Competitive Fortnite Analytics"
export const SITE_DESCRIPTION =
  "Competitive Fortnite analytics for every FNCS game: a 2D replay viewer with fight detection and grading, " +
  "player stats you can filter by distance and time, tournament leaderboards, and advanced stats like " +
  "true accuracy and damage contribution."

// A tournament's display title, looked up once per request however many
// pieces of metadata ask for it. null when the tournament doesn't exist.
export const getTournamentTitle = cache(async (tournamentId: string): Promise<string | null> => {
  const tournament = await prisma.tournaments.findUnique({
    where: { tournament_id: tournamentId },
    select: { title: true },
  })
  return tournament ? getTournamentDisplayTitle({ tournament_id: tournamentId, title: tournament.title }) : null
})

const TABS = {
  leaderboard: { label: "Leaderboard", about: "team standings, points and placements game by game" },
  players: { label: "Player Stats", about: "every player's eliminations, damage, accuracy and more, filterable by game, distance and time" },
  matches: { label: "Matches", about: "every game, with a 2D replay of each" },
} as const

// Metadata for one of a tournament's tabs: its title, a description naming
// the tournament, and the tab's address as the canonical one.
export async function tournamentTabMetadata(tournamentId: string, tab: keyof typeof TABS): Promise<Metadata> {
  const title = await getTournamentTitle(tournamentId)
  if (!title) return { title: "Tournament not found" }
  const { label, about } = TABS[tab]
  const description = `${title} ${label.toLowerCase()} on FNAnalytics: ${about}.`
  return {
    title: `${title} ${label}`,
    description,
    alternates: { canonical: `/tournaments/${tournamentId}/${tab}` },
    openGraph: { title: `${title} ${label}`, description, url: `/tournaments/${tournamentId}/${tab}` },
  }
}
