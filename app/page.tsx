import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <main className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-20">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent leading-tight">
              Fortnite Competitive Analytics
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              Track player performance, eliminations, and damage statistics across competitive Fortnite tournaments
            </p>
            <Link href="/tournaments">
              <Button size="lg" className="text-lg px-10 py-7 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                View Tournaments
              </Button>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <span className="text-3xl">📊</span>
                  Player Stats
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Detailed elimination and damage statistics for every player
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Comprehensive player performance metrics with real-time filtering capabilities
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <span className="text-3xl">🎯</span>
                  Advanced Filters
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Filter by matches, weapons, distance, and time windows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Customize your view with powerful filtering options to analyze specific scenarios
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <span className="text-3xl">🏆</span>
                  Tournament Data
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Comprehensive data from major Fortnite competitive events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Access detailed statistics from professional tournaments and competitive matches
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
