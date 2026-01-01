import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navigation() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              FNAnalytics
            </span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/tournaments">
              <Button variant="ghost" className="font-medium">
                Tournaments
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="font-medium">
                Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

