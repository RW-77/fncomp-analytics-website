'use client'

// ---------------------------------------------------------------------------
// Replay Lab — prototype of the single-match page.
//
// Mounts one ReplayClient for a fixed match, loads its engagements file, and
// lays out the target page: match header, "Viewing as", event-type filter and
// event list (left), replay
// (center), and a details panel (right) that is closed until something opens
// it. The page owns the selection and follow state; the panels get data as
// props and report clicks through callbacks. The replay runs in a ReplayEngine
// the page creates: the page sends it commands (seek, play, follow, ...), the
// map draws from it, and the panels read live health and time from it.
//
// A collapsible dev strip under the map keeps raw engine commands and an
// event log for testing. The page is deliberately not linked from anywhere;
// reach it directly at /replay-lab.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react'
import ReplayClient from '@/app/replay/replay-client'
import type { ReplayEngine } from '@/lib/replay/engine'
import { useReplayEngine } from '@/lib/replay/use-replay'
import type { ReplayMapDefinition } from '@/lib/replay/map-projection'
import type { MatchMetadata } from '@/lib/replay/match-data'
import {
  EVENT_TYPES,
  buildTeamLabels,
  buildTeamMembers,
  buildTeamRosters,
  engagementType,
  toOverlay,
  type Engagement,
  type EngagementOverlay,
  type EventType,
  type InteractionRecord,
  type MatchEngagements,
} from '@/lib/replay/engagements'
import { formatClockPrecise } from '@/lib/replay/format'
import { cn } from '@/lib/utils'
import { MatchHeader } from '@/components/replay/match-header'
import { TeamFilter } from '@/components/replay/team-filter'
import { EventTypeFilter } from '@/components/replay/event-type-filter'
import { EngagementList } from '@/components/replay/engagement-list'
import { EngagementDetails } from '@/components/replay/engagement-details'
import { TeamDetails } from '@/components/replay/team-details'
import { PlayerDetails } from '@/components/replay/player-details'
import { panelFont } from '@/components/replay/panel-font'

// The match we develop against.
const LAB_MATCH_ID = '5674a001837b816a2b800cbdeba1e5ad'
// Shown in the left panel's header. The real page gets these from the
// database: the tournament's display title, and "Match {n}" for the match's
// position (by start time) among its event window's matches, which is how the
// matches list numbers them. Looked up once for the lab match.
const LAB_TOURNAMENT_TITLE = 'Division 1 Finals - Week 2'
const LAB_MATCH_TITLE = 'Match 6'
const LAB_BACK_HREF = '/tournaments/S42_FNCSDivisionalCup_Division1_Week2Final/matches'

// Until the engagements file arrives (and for a match the pipeline hasn't
// processed for engagements yet): no events. One shared array so memos that
// depend on it don't recompute.
const NO_ENGAGEMENTS: Engagement[] = []

// Page themes to try (dev strip). Navy is the lab's original look; the others
// are the experimental themes in globals.css ("Tournament pages" is built on
// the tournament pages' dark backdrop).
const LAB_THEMES = [
  { id: 'black', label: 'Black' },
  { id: 'gray-dark', label: 'Dark gray' },
  { id: 'gray', label: 'Gray' },
  { id: 'tournament', label: 'Tournament pages' },
  { id: 'navy', label: 'Navy' },
] as const
type LabTheme = (typeof LAB_THEMES)[number]['id']

// A followed fight stops being followed this long after it ends; otherwise the
// camera would keep zooming out as its teams spread across the map.
const FIGHT_FOLLOW_TAIL_S = 3

type MetadataResponse = {
  metadata: MatchMetadata
  mapDefinition: ReplayMapDefinition | null
  mapImageUrl: string | null
}

// What the details panel shows (it shows one thing at a time).
type Details =
  | { kind: 'team' }
  | { kind: 'player'; playerId: string; fromTeam: boolean }
  | { kind: 'engagement'; id: number }

// What the camera is following. Mirrors the engine's follow so the page knows
// when to offer "Follow team"; cleared when the follow ends (onFollowChange).
type FollowTarget =
  | { kind: 'team'; teamId: number }
  | { kind: 'player'; playerId: string }
  | { kind: 'fight'; id: number }

export default function ReplayLabPage() {
  // ---- loaded data ----
  const [payload, setPayload] = useState<MetadataResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allEngagements, setAllEngagements] = useState<Engagement[]>(NO_ENGAGEMENTS) // every fight, in time order

  // The replay for this match; null until the metadata arrives.
  const engine = useReplayEngine(payload?.metadata)

  // ---- page-owned state ----
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)  // null = all teams
  const [hiddenTypes, setHiddenTypes] = useState<EventType[]>([])            // unchecked event types
  const [details, setDetails] = useState<Details | null>(null)               // null = panel closed
  const [followTarget, setFollowTarget] = useState<FollowTarget | null>(null)

  // Dev strip: a running log of what the client reports outward.
  const [events, setEvents] = useState<string[]>([])
  const logEvent = (msg: string) =>
    setEvents((prev) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...prev].slice(0, 50))

  // Dev strip: theme experiment. Set on <html> so the nav and the body change
  // with the page (see the experimental themes in globals.css).
  const [theme, setTheme] = useState<LabTheme>('black')
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'navy') delete root.dataset.theme
    else root.dataset.theme = theme
    return () => {
      delete root.dataset.theme
    }
  }, [theme])

  // ---- derived: recomputed from state + data, never stored separately ----

  // How many engagements each team appears in (for the team filter's counts).
  const engagementCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const e of allEngagements) {
      for (const t of e.teams) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return counts
  }, [allEngagements])

  // The viewed team's engagements (every engagement when viewing all teams),
  // numbered in time order. Numbers come from this list, so the type filter
  // hides rows and circles without renumbering the rest.
  const teamEngagements = useMemo(
    () =>
      selectedTeamId === null
        ? allEngagements
        : allEngagements.filter((e) => e.teams.includes(selectedTeamId)),
    [selectedTeamId, allEngagements],
  )
  const numbered = useMemo(
    () => teamEngagements.map((engagement, i) => ({ engagement, number: i + 1 })),
    [teamEngagements],
  )
  // What the list and the map show: the above, minus unchecked event types.
  // Both get this same array, so a row and its circle carry the same number.
  const visible = useMemo(
    () => numbered.filter(({ engagement }) => !hiddenTypes.includes(engagementType(engagement))),
    [numbered, hiddenTypes],
  )
  const overlays = useMemo(
    () => visible.map(({ engagement, number }) => toOverlay(engagement, number, selectedTeamId)),
    [visible, selectedTeamId],
  )
  // The type filter's rows, counted over the viewed team's engagements.
  const typeOptions = useMemo(
    () =>
      EVENT_TYPES.map((t) => ({
        id: t.id,
        label: t.label,
        count: teamEngagements.filter((e) => engagementType(e) === t.id).length,
      })),
    [teamEngagements],
  )

  const selectedEngagementId = details?.kind === 'engagement' ? details.id : null
  // Looked up in the unfiltered list, so unchecking its type doesn't close it.
  const selected = numbered.find((x) => x.engagement.id === selectedEngagementId) ?? null

  // Lookups from the replay metadata; empty until it arrives.
  const teamMembers = useMemo(() => (payload ? buildTeamMembers(payload.metadata) : {}), [payload])
  const teamRosters = useMemo(() => (payload ? buildTeamRosters(payload.metadata) : {}), [payload])
  const teamLabels = useMemo(() => (payload ? buildTeamLabels(payload.metadata) : {}), [payload])
  const playerNames = useMemo(() => payload?.metadata.id_to_username ?? {}, [payload])
  const teamOfPlayer = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [team, ids] of Object.entries(teamMembers)) for (const id of ids) out[id] = Number(team)
    return out
  }, [teamMembers])
  const teamName = (id: number) => teamLabels[id] ?? `Team ${id}`
  const playerName = (id: string) => playerNames[id] ?? id.slice(0, 8)

  // Teams that appear in at least one engagement, busiest first.
  const teamOptions = useMemo(
    () =>
      [...engagementCounts]
        .map(([id, engagementCount]) => ({ id, label: teamLabels[id] ?? `Team ${id}`, engagementCount }))
        .sort((a, b) => b.engagementCount - a.engagementCount || a.label.localeCompare(b.label)),
    [teamLabels, engagementCounts],
  )

  // ---- actions: the one place each user intent is handled ----

  const follow = (playerIds: string[], target: FollowTarget, opts?: { until?: number }) => {
    engine?.follow(playerIds, opts)
    setFollowTarget(target)
  }
  const followTeam = (teamId: number) => follow(teamMembers[teamId] ?? [], { kind: 'team', teamId })

  // Viewing as: a team opens its details and follows it (picking the same team
  // again resumes following); All teams closes the panel and frees the camera.
  const pickTeam = (teamId: number | null) => {
    setSelectedTeamId(teamId)
    if (teamId === null) {
      setDetails(null)
      engine?.follow(null)
      setFollowTarget(null)
      return
    }
    setDetails({ kind: 'team' })
    followTeam(teamId)
  }

  // The left panel's "Follow team" button: reopen the team panel and follow.
  const showTeam = () => {
    if (selectedTeamId === null) return
    setDetails({ kind: 'team' })
    followTeam(selectedTeamId)
  }

  // A map circle or list row: open the fight, jump to its start, and follow its
  // players until shortly after it ends (the engine ends that follow itself and
  // reports it through onFollowChange). Clicking it again resumes following.
  const selectEngagement = (id: number) => {
    const e = allEngagements.find((x) => x.id === id)
    if (!e) return
    setDetails({ kind: 'engagement', id })
    engine?.seek(e.start_s)
    follow(
      e.participants.map((p) => p.player_id),
      { kind: 'fight', id },
      { until: e.end_s + FIGHT_FOLLOW_TAIL_S },
    )
    logEvent(`engagement selected: #${id}`)
  }

  // A player arrow on the map, or a name in the team panel: open that player
  // and follow them. Doesn't change Viewing as.
  const openPlayer = (playerId: string, fromTeam: boolean) => {
    setDetails({ kind: 'player', playerId, fromTeam })
    follow([playerId], { kind: 'player', playerId })
    logEvent(`player: ${playerName(playerId)}`)
  }

  // An event-feed row: replay one action from half a second before. The focus
  // takes the camera, so the engine reports the follow as ended.
  const inspect = (r: InteractionRecord) => {
    engine?.seek(Math.max(0, r.t_s - 0.5))
    // frame both players: the one acting and the one on the receiving end
    engine?.focusOnPoints([{ x: r.ax, y: r.ay }, { x: r.rx, y: r.ry }])
    engine?.play()
    logEvent(`inspect: ${r.kind} at ${formatClockPrecise(r.t_s)}`)
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/replay/${LAB_MATCH_ID}/metadata`)
      .then((res) => {
        if (!res.ok) throw new Error(`metadata ${res.status}`)
        return res.json() as Promise<MetadataResponse>
      })
      .then((data) => {
        if (!cancelled) setPayload(data)
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
    // Engagements load separately: the replay still works without them, so a
    // failure here only leaves the event list empty.
    fetch(`/api/replay/${LAB_MATCH_ID}/engagements`)
      .then((res) => {
        if (res.status === 404) return null // not processed for engagements yet
        if (!res.ok) throw new Error(`engagements ${res.status}`)
        return res.json() as Promise<MatchEngagements>
      })
      .then((data) => {
        if (!cancelled && data) setAllEngagements(data.engagements)
      })
      .catch((err) => console.error('Failed to load engagements:', err))
    return () => {
      cancelled = true
    }
  }, [])

  const followingTeam =
    details?.kind === 'team' && followTarget?.kind === 'team' && followTarget.teamId === selectedTeamId
  const closeDetails = () => setDetails(null)
  const backToTeam = selectedTeamId !== null ? () => setDetails({ kind: 'team' }) : undefined

  // The details panel's content, or null when it's closed. The team and player
  // panels read live data from the engine, so they wait for it.
  let panel: React.ReactNode = null
  if (details?.kind === 'engagement' && selected) {
    panel = (
      <EngagementDetails
        engagement={selected.engagement}
        number={selected.number}
        perspectiveTeamId={selectedTeamId}
        teamLabels={teamLabels}
        teamRosters={teamRosters}
        playerNames={playerNames}
        onInspect={inspect}
        onClose={closeDetails}
        onBack={backToTeam}
      />
    )
  } else if (details?.kind === 'team' && selectedTeamId !== null && engine) {
    panel = (
      <TeamDetails
        engine={engine}
        teamId={selectedTeamId}
        label={teamName(selectedTeamId)}
        members={(teamMembers[selectedTeamId] ?? []).map((id) => ({ id, name: playerName(id) }))}
        engagements={teamEngagements}
        onOpenPlayer={(id) => openPlayer(id, true)}
        onClose={closeDetails}
      />
    )
  } else if (details?.kind === 'player' && engine) {
    const team = teamOfPlayer[details.playerId]
    panel = (
      <PlayerDetails
        engine={engine}
        playerId={details.playerId}
        name={playerName(details.playerId)}
        teamLabel={team !== undefined ? teamName(team) : ''}
        engagements={allEngagements}
        onClose={closeDetails}
        onBack={details.fromTeam ? backToTeam : undefined}
      />
    )
  }

  return (
    // 3.5rem = the site navigation bar above every page. Side panels scale with
    // the window (between their min and max widths) so the replay in the middle
    // gets as much width as possible; the details column exists only while open.
    <div
      className={cn(
        'grid h-[calc(100dvh-3.5rem)] w-full bg-[var(--app-bg)] text-slate-200',
        panel
          ? 'grid-cols-[clamp(264px,19vw,288px)_minmax(0,1fr)_clamp(344px,25vw,400px)]'
          : 'grid-cols-[clamp(264px,19vw,288px)_minmax(0,1fr)]',
      )}
    >
      {/* Left: the match, Viewing as, the event-type filter, then the events.
          Only the event list scrolls. */}
      <aside
        className={cn(
          'flex min-h-0 flex-col border-r border-white/[0.06] bg-[var(--panel)] font-medium',
          panelFont.className,
        )}
      >
        <MatchHeader tournament={LAB_TOURNAMENT_TITLE} title={LAB_MATCH_TITLE} matchId={LAB_MATCH_ID} backHref={LAB_BACK_HREF} />

        <div className="flex flex-col gap-2.5 border-y border-[var(--panel-line)] bg-[var(--panel-raised)] px-4 pb-4 pt-3.5">
          <TeamFilter
            teams={teamOptions}
            totalEngagements={allEngagements.length}
            value={selectedTeamId}
            onChange={pickTeam}
          />
          {selectedTeamId !== null && !followingTeam && (
            <button
              type="button"
              onClick={showTeam}
              className="self-start rounded-sm border border-[var(--panel-control)] px-2.5 py-1 text-[13px] text-sky-300 hover:bg-white/[0.04]"
            >
              Follow team
            </button>
          )}
        </div>

        <div className="px-3 pt-3">
          <EventTypeFilter types={typeOptions} hidden={hiddenTypes} onChange={setHiddenTypes} />
        </div>

        <h2 className="flex items-baseline justify-between px-4 pb-1 pt-3.5 text-sm font-bold text-white">
          Events <span className="font-medium tabular-nums text-slate-500">{visible.length}</span>
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EngagementList
            items={visible}
            selectedId={selectedEngagementId}
            perspectiveTeamId={selectedTeamId}
            teamRosters={teamRosters}
            onSelect={selectEngagement}
          />
        </div>
      </aside>

      {/* Center: the replay, and the dev strip under it */}
      <main className="flex min-h-0 min-w-0 flex-col gap-3 p-3">
        <div className="min-h-0 flex-1">
          <MeasuredReplay
            payload={payload}
            engine={engine}
            error={error}
            onPlayerClick={(id) => openPlayer(id, false)}
            engagements={overlays}
            selectedEngagementId={selectedEngagementId}
            onEngagementClick={selectEngagement}
            onFollowChange={(ids) => {
              if (ids === null) setFollowTarget(null)
            }}
          />
        </div>

        <details open className="shrink-0 rounded-xl bg-[var(--panel)] px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-300">
            Dev tools <span className="font-mono text-xs text-slate-500">{LAB_MATCH_ID}</span>
          </summary>
          <div className="mt-3 grid grid-cols-3 gap-6">
            <Section title="Look">
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex flex-wrap gap-1">
                  {LAB_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={theme === t.id}
                      onClick={() => setTheme(t.id)}
                      className={cn(
                        'rounded-sm px-2.5 py-1',
                        theme === t.id ? 'bg-sky-500/90 text-white' : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </Section>
            <Section title="Replay commands">
              <div className="grid grid-cols-2 gap-2">
                <LabButton onClick={() => engine?.seek(60)}>Seek 1:00</LabButton>
                <LabButton onClick={() => engine?.play()}>Play</LabButton>
                <LabButton onClick={() => engine?.pause()}>Pause</LabButton>
                <LabButton
                  onClick={() => {
                    const c = payload?.mapDefinition?.minimapCenterLocation
                    if (c) engine?.focusOnWorld(c.x, c.y, { zoom: 6 })
                  }}
                >
                  Focus center
                </LabButton>
                <LabButton
                  onClick={() => {
                    const firstId = Object.keys(payload?.metadata.player_to_index ?? {})[0]
                    if (firstId) engine?.focusOnPlayer(firstId)
                  }}
                >
                  Focus P0
                </LabButton>
                <LabButton
                  onClick={() => {
                    const firstId = Object.keys(payload?.metadata.player_to_index ?? {})[0]
                    if (firstId) engine?.follow([firstId])
                  }}
                >
                  Follow P0
                </LabButton>
                <LabButton
                  onClick={() =>
                    engine?.focusOnPoints([
                      { x: 22707.56, y: 24385.51 },
                      { x: 38154, y: 46123 },
                    ])
                  }
                >
                  Frame points
                </LabButton>
              </div>
            </Section>

            <Section title="Events from the replay">
              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  className="rounded bg-white/[0.06] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.1]"
                  onClick={() => logEvent('test event')}
                >
                  Log test event
                </button>
                <button
                  type="button"
                  className="rounded bg-white/[0.06] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.1]"
                  onClick={() => setEvents([])}
                >
                  Clear log
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto rounded bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
                {events.length === 0 ? (
                  <span className="text-slate-600">no events yet…</span>
                ) : (
                  events.map((e, i) => (
                    <div key={i} className="whitespace-pre-wrap">
                      {e}
                    </div>
                  ))
                )}
              </div>
            </Section>
          </div>
        </details>
      </main>

      {/* Right: the details panel, only while something is open in it */}
      {panel && (
        <aside className="min-h-0 overflow-y-auto border-l border-white/[0.06] bg-[var(--panel)] p-4">
          {panel}
        </aside>
      )}
    </div>
  )
}

// Measures its box and feeds pixel dimensions into ReplayClient's size props —
// same responsive-container pattern used on the tournaments page.
function MeasuredReplay({
  payload,
  engine,
  error,
  onPlayerClick,
  engagements,
  selectedEngagementId,
  onEngagementClick,
  onFollowChange,
}: {
  payload: MetadataResponse | null
  engine: ReplayEngine | null
  error: string | null
  onPlayerClick?: (playerId: string) => void
  engagements?: EngagementOverlay[]
  selectedEngagementId?: number | null
  onEngagementClick?: (id: number) => void
  onFollowChange?: (playerIds: string[] | null) => void
}) {

  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect
      setSize({ width: Math.round(box.width), height: Math.round(box.height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-[var(--panel)]"
    >
      {error ? (
        <p className="text-sm text-rose-400">Failed to load match: {error}</p>
      ) : !payload || !engine ? (
        <p className="text-sm text-slate-500">Loading match data…</p>
      ) : !payload.mapDefinition || !payload.mapImageUrl ? (
        <p className="text-sm text-slate-500">Map assets not available for this match.</p>
      ) : size.width > 0 && size.height > 0 ? (
        <ReplayClient
          engine={engine}
          mapDefinition={payload.mapDefinition}
          mapImageUrl={payload.mapImageUrl}
          stageWidth={size.width}
          stageHeight={size.height}
          onPlayerClick={onPlayerClick}
          engagements={engagements}
          selectedEngagementId={selectedEngagementId}
          onEngagementClick={onEngagementClick}
          onFollowChange={onFollowChange}
        />
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-slate-400">{title}</h2>
      {children}
    </section>
  )
}

function LabButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded bg-sky-500/90 px-2 py-1.5 text-xs font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-600"
    >
      {children}
    </button>
  )
}
