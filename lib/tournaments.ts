/**
 * Tournament view helpers.
 *
 * The grouping of event_windows into events and tournaments is now owned by the
 * parser / database (see the `events` and `tournaments` tables). The helpers in
 * this file are only concerned with presenting tournament views in the UI:
 *
 *   - region sort order
 *   - resolving the URL ?region and ?day query params against what's actually
 *     available for a tournament
 *   - a title fallback for tournaments missing a curated title
 */

export const KNOWN_REGION_CODES = [
    "ASIA",
    "BR",
    "EU",
    "ME",
    "NAC",
    "NAE",
    "NAW",
    "OCE",
] as const

export type RegionCode = (typeof KNOWN_REGION_CODES)[number]

export const DEFAULT_REGION: RegionCode = "NAC"

export const CUMULATIVE_DAY = "cumulative" as const

export type DaySelection = number | typeof CUMULATIVE_DAY

const REGION_SORT_ORDER = KNOWN_REGION_CODES.reduce<Record<string, number>>(
    (order, region, index) => {
        order[region] = index
        return order
    },
    {}
)

export function compareTournamentRegions(left: string, right: string): number {
    const leftOrder = REGION_SORT_ORDER[left] ?? Number.MAX_SAFE_INTEGER
    const rightOrder = REGION_SORT_ORDER[right] ?? Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
    }

    return left.localeCompare(right)
}

/**
 * Resolves the effective region for a tournament view given the requested
 * region (from the ?region query param) and the regions actually available for
 * the tournament. Prefers the requested region, then the default (NAC), then
 * the first available region in sort order.
 *
 * Returns null only when the tournament has no event_windows with a region.
 */
export function resolveRegion(
    requestedRegion: string | undefined,
    availableRegions: string[]
): string | null {
    if (availableRegions.length === 0) {
        return null
    }

    if (requestedRegion && availableRegions.includes(requestedRegion)) {
        return requestedRegion
    }

    if (availableRegions.includes(DEFAULT_REGION)) {
        return DEFAULT_REGION
    }

    return [...availableRegions].sort(compareTournamentRegions)[0]
}

/**
 * Resolves the effective day selection for a tournament view.
 *
 * - When the tournament/region has no numbered days (all event_windows have
 *   day_index = null), returns null and no day toggle should be shown.
 * - When numbered days exist, returns the requested day if valid, falls back
 *   to "cumulative" otherwise.
 */
export function resolveDay(
    requestedDay: string | undefined,
    availableDays: number[]
): DaySelection | null {
    if (availableDays.length === 0) {
        return null
    }

    if (requestedDay) {
        if (requestedDay === CUMULATIVE_DAY) {
            return CUMULATIVE_DAY
        }
        const parsed = Number.parseInt(requestedDay, 10)
        if (Number.isFinite(parsed) && availableDays.includes(parsed)) {
            return parsed
        }
    }

    return CUMULATIVE_DAY
}

/**
 * Returns the display title for a tournament. Falls back to a humanised form
 * of the tournament_id when a curated title isn't set yet.
 */
export function getTournamentDisplayTitle(tournament: {
    tournament_id: string
    title: string | null
}): string {
    return tournament.title ?? tournament.tournament_id.replaceAll("_", " ")
}
