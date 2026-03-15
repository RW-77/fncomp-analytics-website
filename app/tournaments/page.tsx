import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  compareTournamentRegions,
  formatTournamentLabel,
  getEventWindowGroupId,
  getEventWindowRegion,
} from "@/lib/tournaments"

export default async function TournamentsPage() {
  const eventWindows = await prisma.event_windows.findMany({
    orderBy: { discovered_at: "desc" },
  });

  const groupedEventWindowsMap = eventWindows.reduce((groups, eventWindow) => {
      const groupId = getEventWindowGroupId(eventWindow.event_window_id)
      const region = getEventWindowRegion(eventWindow.event_window_id)

      const existingGroup = groups.get(groupId)
      if (!existingGroup) {
        groups.set(groupId, {
          groupId,
          primaryEventWindowId: eventWindow.event_window_id,
          regions: region ? [region] : [],
          startTime: eventWindow.start_time,
          endTime: eventWindow.end_time,
          totalMatches: eventWindow.total_matches,
          processedMatches: eventWindow.processed_matches,
          discoveredAt: eventWindow.discovered_at,
        })
        return groups
      }

      if (region && !existingGroup.regions.includes(region)) {
        existingGroup.regions.push(region)
        existingGroup.regions.sort(compareTournamentRegions)
      }

      const eventWindowStart = eventWindow.start_time?.getTime()
      const groupStart = existingGroup.startTime?.getTime()
      if (eventWindowStart !== undefined && eventWindowStart !== null) {
        if (groupStart === undefined || groupStart === null || eventWindowStart < groupStart) {
          existingGroup.startTime = eventWindow.start_time
        }
      }

      const eventWindowEnd = eventWindow.end_time?.getTime()
      const groupEnd = existingGroup.endTime?.getTime()
      if (eventWindowEnd !== undefined && eventWindowEnd !== null) {
        if (groupEnd === undefined || groupEnd === null || eventWindowEnd > groupEnd) {
          existingGroup.endTime = eventWindow.end_time
        }
      }

      existingGroup.totalMatches = Math.max(existingGroup.totalMatches, eventWindow.total_matches)
      existingGroup.processedMatches = Math.max(existingGroup.processedMatches, eventWindow.processed_matches)

      return groups
    }, new Map<string, {
      groupId: string
      primaryEventWindowId: string
      regions: string[]
      startTime: Date | null
      endTime: Date | null
      totalMatches: number
      processedMatches: number
      discoveredAt: Date
    }>())

  const groupedEventWindows = Array.from(groupedEventWindowsMap.values()).sort(
    (left, right) => right.discoveredAt.getTime() - left.discoveredAt.getTime()
  )

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold mb-8 font-[family-name:var(--font-geist-sans)] text-[#333333]">
        Tournaments
      </h1>
      <div className="max-w-6xl mx-auto">
        {groupedEventWindows.length === 0 ? (
          <p className="text-gray-600">No tournaments found.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupedEventWindows.map((eventWindowGroup) => (
              <Link
                key={eventWindowGroup.groupId}
                href={`/tournaments/${eventWindowGroup.primaryEventWindowId}`}
              >
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg truncate">
                      {formatTournamentLabel(eventWindowGroup.groupId)}
                    </CardTitle>
                    <CardDescription>
                      {eventWindowGroup.regions.length > 0
                        ? `Regions: ${eventWindowGroup.regions.join(", ")}`
                        : eventWindowGroup.primaryEventWindowId}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    <div>
                      Matches / Region: {eventWindowGroup.totalMatches} · Processed: {eventWindowGroup.processedMatches}
                    </div>
                    {eventWindowGroup.startTime && (
                      <div>Start: {new Date(eventWindowGroup.startTime).toLocaleString()}</div>
                    )}
                    {eventWindowGroup.endTime && (
                      <div>End: {new Date(eventWindowGroup.endTime).toLocaleString()}</div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
