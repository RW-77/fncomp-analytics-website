'use client'

import { useState } from 'react'
import {
  EVENT_TYPES,
  engagementType,
  type Engagement,
  type InteractionKind,
  type InteractionRecord,
  type Outcome,
  type PlayerOutcome,
  type TeamOutcome,
} from '@/lib/replay/engagements'
import { formatClock, formatClockPrecise, formatDuration } from '@/lib/replay/format'
import type { PlayerSkin } from '@/lib/replay/match-data'
import { OUTCOME_COLORS, OutcomeChip } from '@/components/replay/outcome-chip'
import { DetailsHeader } from '@/components/replay/details-header'
import { SkinIcon } from '@/components/replay/skin-icon'
import { cn } from '@/lib/utils'

// Best to worst, for ordering teams.
const OUTCOME_ORDER: Record<Outcome, number> = { won: 0, favorable: 1, stalemate: 2, unfavorable: 3, lost: 4 }

// Feed labels. shot_attempt records are misses only: shots that landed are
// their own "hit" records.
const KIND_LABEL: Record<InteractionKind, string> = { shot_attempt: 'Miss', hit: 'Hit', knock: 'Knock', elim: 'Elim' }

// The site's gold accent marks the team being viewed; the other teams in the
// fight get these, in table order.
const PERSPECTIVE_COLOR = '#e3c97e'
const PERSPECTIVE_TEXT = 'text-[#e3c97e]'
const TEAM_COLORS = ['#7dd3fc', '#c4b5fd', '#f9a8d4', '#cbd5e1']

// Shared column layouts, so each table's header row lines up with its rows.
const TEAMS_COLS = 'grid grid-cols-[3rem_repeat(3,minmax(0,1fr))]'
const PLAYERS_COLS = 'grid grid-cols-[minmax(0,1fr)_2rem_2.25rem_2.25rem_2.25rem_2.25rem] gap-x-0.5'

// The stat that decided a team's outcome, shown under the verdict.
function reasonText(o: TeamOutcome, teamCount: number): string | null {
  switch (o.reason) {
    case 'wiped':
      return 'Team eliminated'
    case 'last_standing':
      return teamCount === 2 ? 'Opponent eliminated' : 'Last team standing'
    case 'net_elims':
      return `On elims (${o.elims_dealt} vs ${o.elims_received})`
    case 'damage_ratio':
      return `On damage (${Math.round(o.damage_dealt)} vs ${Math.round(o.damage_received)})`
    case 'even':
      return null
  }
}

type Verdict = {
  outcome: Outcome
  teamId: number | null    // the team it belongs to, when the header has to name it
  reason: string | null
}

// The verdict in the header. Viewing as a team: that team's own outcome.
// All teams: the one team that came out ahead, if there's exactly one and every
// other team came out behind (always the case for two teams that didn't draw);
// "Stalemate" when every team drew; otherwise no verdict.
function headerVerdict(outcomes: TeamOutcome[], perspectiveTeamId: number | null): Verdict | null {
  const n = outcomes.length
  if (perspectiveTeamId !== null) {
    const own = outcomes.find((o) => o.team_id === perspectiveTeamId)
    return own ? { outcome: own.label, teamId: null, reason: reasonText(own, n) } : null
  }
  if (outcomes.every((o) => o.label === 'stalemate')) return { outcome: 'stalemate', teamId: null, reason: null }

  const ahead = outcomes.filter((o) => o.label === 'won' || o.label === 'favorable')
  const behind = outcomes.filter((o) => o.label === 'lost' || o.label === 'unfavorable')
  if (ahead.length !== 1 || behind.length !== n - 1) return null

  const winner = ahead[0]
  let reason = reasonText(winner, n)
  // Three or more teams: every team's figure for the deciding stat, winner first.
  if (n > 2 && (winner.reason === 'net_elims' || winner.reason === 'damage_ratio')) {
    const byElims = winner.reason === 'net_elims'
    const figures = [winner, ...behind].map((o) => (byElims ? o.elims_dealt : Math.round(o.damage_dealt)))
    reason = `On ${byElims ? 'elims' : 'damage'} (${figures.join(' vs ')})`
  }
  return { outcome: winner.label, teamId: winner.team_id, reason }
}

// Damage dealt ÷ taken. ∞ when nothing was taken; — when neither.
function damageRatio(dealt: number, taken: number): string {
  if (taken === 0) return dealt > 0 ? '∞' : '—'
  return (dealt / taken).toFixed(2)
}

export function EngagementDetails({
  engagement,
  number,
  perspectiveTeamId,
  teamLabels,
  teamRosters,
  playerNames,
  playerSkins,
  onInspect,
  onClose,
  onBack,
}: {
  engagement: Engagement
  number: number                               // same number as the list row and the map circle
  perspectiveTeamId: number | null             // the team being viewed, or null for all teams
  teamLabels: Record<number, string>           // team id -> "player + player"
  teamRosters: Record<number, string[]>        // team id -> its players' names
  playerNames: Record<string, string>          // player id -> username
  playerSkins: Record<string, PlayerSkin>      // player id -> outfit
  onInspect: (record: InteractionRecord) => void
  onClose: () => void
  onBack?: () => void                          // set when a team is being viewed
}) {
  const type = EVENT_TYPES.find((t) => t.id === engagementType(engagement))
  const teamCount = engagement.teams.length
  const teamName = (id: number) => teamLabels[id] ?? `Team ${id}`
  const playerName = (id: string) => playerNames[id] ?? id.slice(0, 8)

  // The viewed team first, then best to worst. Copied before sorting because
  // the engagement object is shared with the list and the map.
  const outcomes = [...engagement.outcomes].sort(
    (a, b) =>
      Number(b.team_id === perspectiveTeamId) - Number(a.team_id === perspectiveTeamId) ||
      OUTCOME_ORDER[a.label] - OUTCOME_ORDER[b.label],
  )
  const teamColors: Record<number, string> = {}
  outcomes
    .filter((o) => o.team_id !== perspectiveTeamId)
    .forEach((o, i) => (teamColors[o.team_id] = TEAM_COLORS[i % TEAM_COLORS.length]))
  if (perspectiveTeamId !== null) teamColors[perspectiveTeamId] = PERSPECTIVE_COLOR

  const verdict = headerVerdict(outcomes, perspectiveTeamId)

  return (
    <div className="flex flex-col gap-6">
      <DetailsHeader
        title={type?.title ?? 'Fight'}
        meta={
          `#${number} · ${formatClock(engagement.start_s)}–${formatClock(engagement.end_s)} · ` +
          `${formatDuration(engagement.end_s - engagement.start_s)} · Zone ${engagement.zone}` +
          (teamCount > 2 ? ` · ${teamCount} teams` : '')
        }
        onClose={onClose}
        back={onBack ? { label: 'Back to team', onClick: onBack } : undefined}
      >
        {verdict && <VerdictLine verdict={verdict} teamName={teamName} />}
      </DetailsHeader>

      <TeamsTable
        outcomes={outcomes}
        teamColors={teamColors}
        perspectiveTeamId={perspectiveTeamId}
        roster={(id) => teamRosters[id] ?? [teamName(id)]}
      />

      <PlayersTable
        outcomes={outcomes}
        players={engagement.players}
        teamColors={teamColors}
        playerName={playerName}
      />

      {/* key: a new fight gets a fresh feed (resets its scroll and highlight) */}
      <EventFeed
        key={engagement.id}
        records={engagement.records}
        playerName={playerName}
        playerSkins={playerSkins}
        onInspect={onInspect}
      />
    </div>
  )
}

// "Won  On elims (2 vs 1)" when viewing as a team; "Won by A + B" with the
// reason on its own line when the team has to be named.
function VerdictLine({ verdict, teamName }: { verdict: Verdict; teamName: (id: number) => string }) {
  const colors = OUTCOME_COLORS[verdict.outcome]
  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className={cn('text-2xl font-semibold tracking-tight', colors.text)}>{colors.label}</span>
        {verdict.teamId !== null ? (
          <span className="text-[15px] text-slate-400">
            {verdict.outcome === 'won' ? 'by' : 'for'}{' '}
            <span className="font-medium text-slate-100">{teamName(verdict.teamId)}</span>
          </span>
        ) : (
          verdict.reason && <span className="text-sm tabular-nums text-slate-300">{verdict.reason}</span>
        )}
      </p>
      {verdict.teamId !== null && verdict.reason && (
        <p className="text-sm tabular-nums text-slate-300">{verdict.reason}</p>
      )}
    </div>
  )
}

// One block per team: its name, its outcome, then what it dealt and took.
function TeamsTable({
  outcomes,
  teamColors,
  perspectiveTeamId,
  roster,
}: {
  outcomes: TeamOutcome[]
  teamColors: Record<number, string>
  perspectiveTeamId: number | null
  roster: (id: number) => string[]
}) {
  return (
    <section>
      <div className={cn(TEAMS_COLS, 'items-baseline border-b border-white/10 pb-1.5')}>
        <h3 className="text-[15px] font-semibold text-white">Teams</h3>
        <span className="text-right text-xs text-slate-500" title="Eliminations">Elims</span>
        <span className="text-right text-xs text-slate-500">Knocks</span>
        <span className="text-right text-xs text-slate-500">Damage</span>
      </div>
      {outcomes.map((o) => (
        <div key={o.team_id} className="border-b border-white/[0.06] py-2.5">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: teamColors[o.team_id] }} />
            {/* "A + B" on one line when it fits. Each name (with its "+") stays
                whole, so a wrap only ever falls between players. */}
            <span
              className={cn(
                'min-w-0 flex-1 text-sm font-medium leading-snug',
                o.team_id === perspectiveTeamId && PERSPECTIVE_TEXT,
              )}
            >
              {roster(o.team_id).map((name, i) => (
                <span key={name}>
                  {i > 0 && ' '}
                  <span className="whitespace-nowrap">{i > 0 ? `+ ${name}` : name}</span>
                </span>
              ))}
            </span>
            <OutcomeChip outcome={o.label} />
          </div>
          <div className={cn(TEAMS_COLS, 'mt-1.5 items-baseline tabular-nums')}>
            <span className="text-xs text-slate-500">Dealt</span>
            <span className="text-right text-[15px] font-semibold">{o.elims_dealt}</span>
            <span className="text-right text-[15px] font-semibold">{o.knocks_dealt}</span>
            <span className="text-right text-[15px] font-semibold">{Math.round(o.damage_dealt)}</span>
            <span className="text-xs text-slate-500">Taken</span>
            <span className="text-right text-sm text-slate-400">{o.elims_received}</span>
            <span className="text-right text-sm text-slate-400">{o.knocks_received}</span>
            <span className="text-right text-sm text-slate-400">{Math.round(o.damage_received)}</span>
          </div>
        </div>
      ))}
    </section>
  )
}

// Every participant, grouped by team in the same order as above (the dot is
// their team's), highest damage first within a team.
function PlayersTable({
  outcomes,
  players,
  teamColors,
  playerName,
}: {
  outcomes: TeamOutcome[]
  players: PlayerOutcome[]
  teamColors: Record<number, string>
  playerName: (id: string) => string
}) {
  return (
    <section>
      <div className={cn(PLAYERS_COLS, 'items-baseline border-b border-white/10 pb-1.5 text-xs text-slate-500')}>
        <h3 className="text-[15px] font-semibold text-white">Players</h3>
        <span className="text-center" title="Eliminations">Elim</span>
        <span className="text-center" title="Knocks">Knock</span>
        <span className="text-center" title="Damage dealt">Dealt</span>
        <span className="text-center" title="Damage taken">Taken</span>
        <span className="text-center" title="Damage dealt ÷ damage taken">Ratio</span>
      </div>
      {outcomes.map((o) =>
        players
          .filter((p) => p.team_id === o.team_id)
          .sort((a, b) => b.damage_dealt - a.damage_dealt)
          .map((p, i) => (
            <div
              key={p.player_id}
              className={cn(
                PLAYERS_COLS,
                'items-baseline border-t py-1.5 text-[13px] tabular-nums',
                i === 0 ? 'border-white/10' : 'border-white/[0.05]',
              )}
            >
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="size-1.5 shrink-0 -translate-y-px rounded-full" style={{ background: teamColors[p.team_id] }} />
                <span className="truncate" title={playerName(p.player_id)}>{playerName(p.player_id)}</span>
                {p.elims_received > 0 ? (
                  <span className="shrink-0 text-[11px] font-medium text-red-400">dead</span>
                ) : p.knocks_received > 0 ? (
                  <span className="shrink-0 text-[11px] font-medium text-orange-400">knocked</span>
                ) : null}
              </span>
              <span className="text-center">{p.elims_dealt}</span>
              <span className="text-center">{p.knocks_dealt}</span>
              <span className="text-center">{Math.round(p.damage_dealt)}</span>
              <span className="text-center text-slate-400">{Math.round(p.damage_received)}</span>
              <span className="text-center">{damageRatio(p.damage_dealt, p.damage_received)}</span>
            </div>
          )),
      )}
    </section>
  )
}

// Every action in the fight, in order. Clicking one asks the page to replay it.
function EventFeed({
  records,
  playerName,
  playerSkins,
  onInspect,
}: {
  records: InteractionRecord[]
  playerName: (id: string) => string
  playerSkins: Record<string, PlayerSkin>
  onInspect: (record: InteractionRecord) => void
}) {
  // The last row clicked, only for highlighting. This is the feed's own UI
  // state, so it lives here rather than on the page.
  const [inspected, setInspected] = useState<number | null>(null)

  return (
    <section>
      <h3 className="mb-2 text-[15px] font-semibold text-white">
        Event feed <span className="text-sm font-normal text-slate-500">· {records.length} actions</span>
      </h3>
      <ol className="max-h-80 overflow-y-auto border border-white/[0.06]">
        {records.map((r, i) => {
          const decisive = r.kind === 'knock' || r.kind === 'elim'
          return (
            // The records never reorder within a fight, so the position is a stable key.
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  setInspected(i)
                  onInspect(r)
                }}
                // Columns just fit their widest content (a late "21:37.5", a
                // bold "Knock", 3-digit damage) with small gaps, so the names
                // get the rest. The time is right-aligned so the gap after it
                // doesn't vary.
                className={cn(
                  'grid w-full grid-cols-[3.125rem_2.375rem_minmax(0,1fr)_1.625rem] items-center gap-x-1.5 px-2 py-1 text-left text-[13px] tabular-nums hover:bg-white/[0.05]',
                  decisive && 'bg-red-400/[0.07]',
                  inspected === i && 'bg-sky-400/15 hover:bg-sky-400/15',
                )}
              >
                <span className="text-right text-slate-400">{formatClockPrecise(r.t_s)}</span>
                <span
                  className={cn(
                    'text-xs',
                    r.kind === 'elim' ? 'font-semibold text-red-400'
                      : r.kind === 'knock' ? 'font-semibold text-orange-400'
                      : 'text-slate-500',
                  )}
                >
                  {KIND_LABEL[r.kind]}
                </span>
                {/* Each side gets its skin; the names truncate, the icons and arrow don't. */}
                <span className={cn('flex min-w-0 items-center gap-1', decisive && 'font-medium')}>
                  <SkinIcon skin={playerSkins[r.actor_id]} size={24} />
                  <span className="min-w-0 truncate">{playerName(r.actor_id)}</span>
                  <span className="shrink-0 text-slate-500">→</span>
                  <SkinIcon skin={playerSkins[r.recipient_id]} size={24} />
                  <span className="min-w-0 truncate">{playerName(r.recipient_id)}</span>
                </span>
                <span className="text-right text-slate-400">
                  {r.kind === 'hit' && r.damage > 0 ? Math.round(r.damage) : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-1.5 text-xs text-slate-500">Click an action to watch it back in the replay viewer.</p>
    </section>
  )
}
