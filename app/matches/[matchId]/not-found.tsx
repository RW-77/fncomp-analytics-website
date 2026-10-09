import { MatchPageMessage } from "@/components/replay/match-page-message"

// A malformed or unknown match id.
export default function MatchNotFound() {
  return <MatchPageMessage title="Match not found">This match doesn&apos;t exist.</MatchPageMessage>
}
