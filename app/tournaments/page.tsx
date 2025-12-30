import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function TournamentsPage() {
  const eventWindows = await prisma.event_windows.findMany({
    orderBy: { discovered_at: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold mb-8 font-[family-name:var(--font-geist-sans)] text-[#333333]">
        Tournaments
      </h1>
      <div className="max-w-6xl mx-auto">
        {eventWindows.length === 0 ? (
          <p className="text-gray-600">No tournaments found.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {eventWindows.map((eventWindow) => (
              <Link key={eventWindow.event_window_id} href={`/tournaments/${eventWindow.event_window_id}`}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg truncate">{eventWindow.event_window_id}</CardTitle>
                    <CardDescription>
                      Matches: {eventWindow.total_matches} · Processed: {eventWindow.processed_matches}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    {eventWindow.start_time && (
                      <div>Start: {new Date(eventWindow.start_time).toLocaleString()}</div>
                    )}
                    {eventWindow.end_time && (
                      <div>End: {new Date(eventWindow.end_time).toLocaleString()}</div>
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
