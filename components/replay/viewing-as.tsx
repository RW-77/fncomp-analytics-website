'use client'

import { TeamFilter } from '@/components/replay/team-filter'
import type { TeamOption } from '@/lib/replay/use-engagements'

// The left panel's "Viewing as" band: the team picker, and a "Follow team"
// button while the viewed team isn't being followed.
export function ViewingAs({
  teams,
  totalEngagements,
  value,
  onChange,
  onFollowTeam,
}: {
  teams: TeamOption[]
  totalEngagements: number
  value: number | null
  onChange: (teamId: number | null) => void
  onFollowTeam?: () => void      // omit to hide the button
}) {
  return (
    <div className="flex flex-col gap-2.5 border-y border-[var(--panel-line)] bg-[var(--panel-raised)] px-4 py-3.5">
      <TeamFilter teams={teams} totalEngagements={totalEngagements} value={value} onChange={onChange} />
      {onFollowTeam && (
        <button
          type="button"
          onClick={onFollowTeam}
          className="self-start rounded-sm border border-[var(--panel-control)] px-2.5 py-1 text-[13px] text-sky-300 hover:bg-white/[0.04]"
        >
          Follow team
        </button>
      )}
    </div>
  )
}
