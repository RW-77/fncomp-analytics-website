"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/tournaments", label: "Tournaments" },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#08111f]/88 backdrop-blur-xl supports-[backdrop-filter]:bg-[#08111f]/72">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-300">
            <BarChart3 className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-[0.18em] text-white">
              FNANALYTICS
            </span>
            <span className="block truncate text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Competitive Fortnite
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-white/8 bg-white/[0.03] p-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-colors",
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <Link
            href="/tournaments"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "hidden border-white/10 bg-white/[0.04] text-slate-100 shadow-none transition-colors hover:bg-sky-400/10 hover:text-sky-200 sm:inline-flex"
            )}
          >
            Open Dashboard
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
