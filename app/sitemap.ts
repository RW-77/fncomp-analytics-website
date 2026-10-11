import type { MetadataRoute } from "next"

import { prisma } from "@/lib/prisma"
import { SITE_URL } from "@/lib/seo"
import { source } from "@/lib/source"

// Regenerated at most once an hour, like the tournaments list.
export const revalidate = 3600

// The site's pages: the fixed ones, every docs page, each tournament's tabs
// and every match's replay.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tournaments, matches] = await Promise.all([
    prisma.event_windows.findMany({
      where: { tournament_id: { not: null } },
      select: { tournament_id: true, end_time: true },
    }),
    prisma.matches.findMany({ select: { match_id: true, end_time: true } }),
  ])

  // Each tournament once, dated by its latest event window
  const tournamentEnds = new Map<string, Date | undefined>()
  for (const { tournament_id, end_time } of tournaments) {
    const known = tournamentEnds.get(tournament_id!)
    if (!known || (end_time && end_time > known)) tournamentEnds.set(tournament_id!, end_time ?? known)
  }

  const page = (path: string, lastModified?: Date | null, priority?: number): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    ...(lastModified ? { lastModified } : {}),
    ...(priority !== undefined ? { priority } : {}),
  })

  return [
    page("/", null, 1),
    page("/tournaments", null, 0.9),
    page("/labs/accuracy", null, 0.5),
    ...source.getPages().map((doc) => page(doc.url, null, 0.6)),
    ...[...tournamentEnds].flatMap(([id, ended]) =>
      ["leaderboard", "players", "matches"].map((tab) => page(`/tournaments/${id}/${tab}`, ended, 0.8)),
    ),
    ...matches.map((m) => page(`/matches/${m.match_id}`, m.end_time, 0.5)),
  ]
}
