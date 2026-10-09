import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getReplayPayload } from "@/lib/replay/replay-payload"
import { getMatchSummary, type MatchSummary } from "@/lib/stats"
import { MatchWorkspace, type MatchHeaderInfo } from "@/components/replay/match-workspace"

type PageProps = {
  params: Promise<{ matchId: string }>
}

// Osirion match ids: 32 lowercase hex characters, unique across tournaments.
const MATCH_ID = /^[0-9a-f]{32}$/

// Cached so the page and its metadata share one lookup per request.
const findMatch = cache(async (matchId: string): Promise<MatchSummary | null> =>
  MATCH_ID.test(matchId) ? getMatchSummary(matchId) : null,
)

function matchTitle(match: MatchSummary): string {
  return match.number === null ? "Match" : `Match ${match.number}`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchId } = await params
  const match = await findMatch(matchId)
  if (!match) return { title: "Match not found" }
  return { title: [matchTitle(match), match.tournamentTitle].filter(Boolean).join(" · ") }
}

export default async function MatchPage({ params }: PageProps) {
  const { matchId } = await params
  // The replay payload doesn't depend on the lookup, so both load at once.
  const [match, replay] = await Promise.all([
    findMatch(matchId),
    MATCH_ID.test(matchId) ? getReplayPayload(matchId) : null,
  ])
  if (!match) notFound()

  // Back to the matches list showing this match's region and day.
  const back = new URLSearchParams()
  if (match.regionCode) back.set("region", match.regionCode)
  if (match.dayIndex !== null) back.set("day", String(match.dayIndex))

  const header: MatchHeaderInfo = {
    tournament: match.tournamentTitle,
    details: [match.regionCode, match.dayIndex !== null ? `Day ${match.dayIndex}` : null].filter(
      (d): d is string => d !== null,
    ),
    startTime: match.startTime?.toISOString() ?? null,
    title: matchTitle(match),
    backHref: match.tournamentId
      ? `/tournaments/${match.tournamentId}/matches${back.size ? `?${back}` : ""}`
      : "/tournaments",
  }

  // Keyed by match, so moving to another match starts a fresh replay rather
  // than carrying this one's state over.
  return <MatchWorkspace key={matchId} matchId={matchId} header={header} replay={replay} />
}
