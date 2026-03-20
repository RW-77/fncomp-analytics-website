const KNOWN_REGION_CODES = [
    "ASIA",
    "BR",
    "EU",
    "ME",
    "MENA",
    "NAC",
    "NAE",
    "NAW",
    "OCE",
] as const

const REGION_SORT_ORDER = KNOWN_REGION_CODES.reduce<Record<string, number>>((order, region, index) => {
    order[region] = index
    return order
}, {})

function getTrailingToken(value: string): string | null {
    const parts = value.split("_")
    return parts.length > 0 ? parts[parts.length - 1] : null
}

export function getEventWindowRegion(eventWindowId: string): string | null {
    const trailingToken = getTrailingToken(eventWindowId)
    if (!trailingToken) {
        return null
    }

    return KNOWN_REGION_CODES.includes(trailingToken as (typeof KNOWN_REGION_CODES)[number])
        ? trailingToken
        : null
}

export function getEventWindowGroupId(eventWindowId: string): string {
    const region = getEventWindowRegion(eventWindowId)
    if (!region) {
        return eventWindowId
    }

    return eventWindowId.slice(0, -(region.length + 1))
}

export function getTournamentSeriesId(eventWindowId: string): string {
    return getEventWindowGroupId(eventWindowId).replace(/_Day\d+$/i, "")
}

export function formatTournamentLabel(identifier: string): string {
    return identifier.replaceAll("_", " ")
}

export function compareTournamentRegions(left: string, right: string): number {
    const leftOrder = REGION_SORT_ORDER[left] ?? Number.MAX_SAFE_INTEGER
    const rightOrder = REGION_SORT_ORDER[right] ?? Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
    }

    return left.localeCompare(right)
}
