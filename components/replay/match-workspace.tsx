'use client'

// ---------------------------------------------------------------------------
// The match page's client side. The server hands it the light data: the
// header, and the replay payload (metadata, map, skins, placements). The
// browser loads the heavy data from here: the engine loads the movement,
// zones, shots, inventory and stats, and useMatchEngagements the fights.
//
// ReplayWorkspace owns the page state (the viewed team, hidden event types,
// what the details panel shows, what the camera follows) and handles each
// user action in one place. Panels get data as props and report clicks
// through callbacks; the engine is the one source for anything that changes
// with replay time.
// ---------------------------------------------------------------------------

import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  buildMatchRoster,
  type Engagement,
  type EventType,
  type InteractionRecord,
} from '@/lib/replay/engagements'
import type { ReplayPayload } from '@/lib/replay/replay-payload'
import { useEngagementView, useMatchEngagements } from '@/lib/replay/use-engagements'
import { useReplayEngine } from '@/lib/replay/use-replay'
import { EventsPanel } from '@/components/replay/events-panel'
import { CenteredStatus, LoadNote } from '@/components/replay/load-state'
import { MatchDetailsPanel, type DetailsPanelContent } from '@/components/replay/match-details-panel'
import { MatchHeader } from '@/components/replay/match-header'
import { ReplayStage } from '@/components/replay/replay-stage'
import { ViewingAs } from '@/components/replay/viewing-as'
import { WorkspaceLayout } from '@/components/replay/workspace-layout'

export type MatchHeaderInfo = {
  tournament: string | null
  details: string[]          // ["NAC", "Day 2"]: whichever apply
  startTime: string | null   // ISO
  title: string              // "Match 2"
  backHref: string
}

// A followed fight stops being followed this long after it ends; otherwise the
// camera would keep zooming out as its teams spread across the map.
const FIGHT_FOLLOW_TAIL_S = 3

// Until the engagements load (or when the match has none). One shared array
// so the memos that depend on it don't recompute.
const NO_ENGAGEMENTS: Engagement[] = []

// What the details panel was asked to show. A fight is resolved against the
// viewed team's list, and the team view needs a viewed team.
type Details = { kind: 'team' } | { kind: 'player'; playerId: string } | { kind: 'engagement'; id: number }

// What the camera is following, mirrored from the engine so the page knows
// when to offer "Follow team". Cleared when the follow ends (onFollowChange).
type FollowTarget =
  | { kind: 'team'; teamId: number }
  | { kind: 'player'; playerId: string }
  | { kind: 'fight'; id: number }

export function MatchWorkspace({
  matchId,
  header,
  replay,
}: {
  matchId: string
  header: MatchHeaderInfo
  replay: ReplayPayload | null     // null: the match has no timeline yet
}) {
  const headerNode = <MatchHeader matchId={matchId} {...header} />
  if (!replay) {
    return (
      <WorkspaceLayout
        top={headerNode}
        events={<LoadNote className="px-4 py-3">No events: this match hasn&apos;t been processed yet.</LoadNote>}
        stage={<CenteredStatus>This match&apos;s replay isn&apos;t available yet.</CenteredStatus>}
        details={null}
      />
    )
  }
  return <ReplayWorkspace matchId={matchId} header={headerNode} replay={replay} />
}

function ReplayWorkspace({ matchId, header, replay }: { matchId: string; header: ReactNode; replay: ReplayPayload }) {
  const engine = useReplayEngine(replay.metadata)
  const { engagements, retry: retryEngagements } = useMatchEngagements(matchId)
  const roster = useMemo(() => buildMatchRoster(replay.metadata), [replay.metadata])

  // ---- page state ----
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)  // null = all teams
  const [hiddenTypes, setHiddenTypes] = useState<EventType[]>([])            // unchecked event types
  const [details, setDetails] = useState<Details | null>(null)               // null = panel closed
  const [followTarget, setFollowTarget] = useState<FollowTarget | null>(null)
  const stageRef = useRef<HTMLElement>(null)

  // ---- derived ----
  const allEngagements = engagements.status === 'ready' ? engagements.data : NO_ENGAGEMENTS
  const view = useEngagementView({
    engagements: allEngagements,
    teamId: selectedTeamId,
    hiddenTypes,
    roster,
    placements: replay.placements,
  })
  const selectedEngagementId = details?.kind === 'engagement' ? details.id : null
  // Looked up in the unfiltered list, so unchecking its type doesn't close it.
  const selected = view.numbered.find((x) => x.engagement.id === selectedEngagementId) ?? null
  const panel: DetailsPanelContent | null =
    details?.kind === 'engagement' ? (selected && { kind: 'engagement', engagement: selected })
      : details?.kind === 'team' ? (selectedTeamId === null ? null : { kind: 'team', teamId: selectedTeamId })
      : details
  const followingTeam = followTarget?.kind === 'team' && followTarget.teamId === selectedTeamId

  // ---- actions: the one place each user intent is handled ----

  const follow = (playerIds: string[], target: FollowTarget, opts?: { until?: number }) => {
    engine.follow(playerIds, opts)
    setFollowTarget(target)
  }
  const followTeam = (teamId: number) => follow(roster.teamMembers[teamId] ?? [], { kind: 'team', teamId })

  // On narrow screens the replay sits above the panels: bring it into view
  // when an action there moves the camera.
  const revealReplay = () => {
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Viewing as: a team opens its details and follows it (picking the same team
  // again resumes following); All teams closes the panel and frees the camera.
  const pickTeam = (teamId: number | null) => {
    setSelectedTeamId(teamId)
    if (teamId === null) {
      setDetails(null)
      engine.follow(null)
      setFollowTarget(null)
      return
    }
    setDetails({ kind: 'team' })
    followTeam(teamId)
  }

  // "Follow team": reopen the team panel and follow.
  const showTeam = () => {
    if (selectedTeamId === null) return
    setDetails({ kind: 'team' })
    followTeam(selectedTeamId)
  }

  // A map circle or list row: open the fight, jump to its start, and follow its
  // players until shortly after it ends (the engine ends that follow itself and
  // reports it through onFollowChange). Selecting it again resumes following.
  const selectEngagement = (id: number) => {
    const e = allEngagements.find((x) => x.id === id)
    if (!e) return
    setDetails({ kind: 'engagement', id })
    engine.seek(e.start_s)
    follow(
      e.participants.map((p) => p.player_id),
      { kind: 'fight', id },
      { until: e.end_s + FIGHT_FOLLOW_TAIL_S },
    )
    revealReplay()
  }

  // A player arrow on the map, or a name in the team panel: open that player
  // and follow them. Doesn't change Viewing as ("Go to team" does).
  const openPlayer = (playerId: string) => {
    setDetails({ kind: 'player', playerId })
    follow([playerId], { kind: 'player', playerId })
  }

  // An event-feed row: replay one action from half a second before, framing
  // both players. The focus takes the camera, so the engine ends the follow.
  const inspect = (r: InteractionRecord) => {
    engine.seek(Math.max(0, r.t_s - 0.5))
    engine.focusOnPoints([{ x: r.ax, y: r.ay }, { x: r.rx, y: r.ry }])
    engine.play()
    revealReplay()
  }

  return (
    <WorkspaceLayout
      stageRef={stageRef}
      top={
        <>
          {header}
          <ViewingAs
            teams={view.teamOptions}
            totalEngagements={allEngagements.length}
            value={selectedTeamId}
            onChange={pickTeam}
            onFollowTeam={selectedTeamId !== null && !(details?.kind === 'team' && followingTeam) ? showTeam : undefined}
          />
        </>
      }
      events={
        <EventsPanel
          status={engagements.status}
          onRetry={retryEngagements}
          items={view.visible}
          typeOptions={view.typeOptions}
          hiddenTypes={hiddenTypes}
          onHiddenTypesChange={setHiddenTypes}
          selectedId={selectedEngagementId}
          perspectiveTeamId={selectedTeamId}
          teamRosters={roster.teamRosters}
          onSelect={selectEngagement}
        />
      }
      stage={
        <ReplayStage
          engine={engine}
          mapDefinition={replay.mapDefinition}
          mapImageUrl={replay.mapImageUrl}
          onPlayerClick={openPlayer}
          engagements={view.overlays}
          selectedEngagementId={selectedEngagementId}
          onEngagementClick={selectEngagement}
          onFollowChange={(ids) => {
            if (ids === null) setFollowTarget(null)
          }}
        />
      }
      details={
        panel && (
          <MatchDetailsPanel
            content={panel}
            engine={engine}
            perspectiveTeamId={selectedTeamId}
            roster={roster}
            skins={replay.skins}
            pickaxes={replay.pickaxes}
            placements={replay.placements}
            onInspect={inspect}
            onOpenPlayer={openPlayer}
            onGoToTeam={pickTeam}
            onBackToTeam={selectedTeamId !== null ? () => setDetails({ kind: 'team' }) : undefined}
            onClose={() => setDetails(null)}
          />
        )
      }
    />
  )
}
