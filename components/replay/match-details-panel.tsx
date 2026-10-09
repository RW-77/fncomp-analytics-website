'use client'

import type { ReplayEngine } from '@/lib/replay/engine'
import type { InteractionRecord, MatchRoster, NumberedEngagement } from '@/lib/replay/engagements'
import type { PlayerSkin } from '@/lib/replay/match-data'
import { EngagementDetails } from '@/components/replay/engagement-details'
import { PlayerDetails } from '@/components/replay/player-details'
import { TeamDetails } from '@/components/replay/team-details'

// What the details panel shows: one thing at a time.
export type DetailsPanelContent =
  | { kind: 'engagement'; engagement: NumberedEngagement }
  | { kind: 'team'; teamId: number }
  | { kind: 'player'; playerId: string }

// The details panel's content, picked by kind. Names, skins and placements
// come in as props; the team and player views read live state from the engine.
export function MatchDetailsPanel({
  content,
  engine,
  perspectiveTeamId,
  roster,
  skins,
  pickaxes,
  placements,
  onInspect,
  onOpenPlayer,
  onGoToTeam,
  onBackToTeam,
  onClose,
}: {
  content: DetailsPanelContent
  engine: ReplayEngine
  perspectiveTeamId: number | null
  roster: MatchRoster
  skins: Record<string, PlayerSkin>
  pickaxes: Record<string, PlayerSkin>
  placements: Record<string, number>
  onInspect: (record: InteractionRecord) => void
  onOpenPlayer: (playerId: string) => void
  onGoToTeam: (teamId: number) => void
  onBackToTeam?: () => void          // offered on a fight while viewing as a team
  onClose: () => void
}) {
  const teamName = (id: number) => roster.teamLabels[id] ?? `Team ${id}`
  const playerName = (id: string) => roster.playerNames[id] ?? id.slice(0, 8)

  switch (content.kind) {
    case 'engagement':
      return (
        <EngagementDetails
          engagement={content.engagement.engagement}
          number={content.engagement.number}
          perspectiveTeamId={perspectiveTeamId}
          teamLabels={roster.teamLabels}
          teamRosters={roster.teamRosters}
          playerNames={roster.playerNames}
          playerSkins={skins}
          onInspect={onInspect}
          onClose={onClose}
          onBack={onBackToTeam}
        />
      )
    case 'team':
      return (
        <TeamDetails
          engine={engine}
          label={teamName(content.teamId)}
          placement={placements[String(content.teamId)]}
          members={(roster.teamMembers[content.teamId] ?? []).map((id) => ({
            id,
            name: playerName(id),
            skin: skins[id],
            pickaxe: pickaxes[id],
          }))}
          onOpenPlayer={onOpenPlayer}
          onClose={onClose}
        />
      )
    case 'player': {
      const team = roster.teamOfPlayer[content.playerId]
      return (
        <PlayerDetails
          engine={engine}
          playerId={content.playerId}
          name={playerName(content.playerId)}
          skin={skins[content.playerId]}
          pickaxe={pickaxes[content.playerId]}
          teamLabel={team !== undefined ? teamName(team) : ''}
          onClose={onClose}
          onGoToTeam={team !== undefined ? () => onGoToTeam(team) : undefined}
        />
      )
    }
  }
}
