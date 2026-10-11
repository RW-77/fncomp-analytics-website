"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Home" },
  // Match pages (/matches/<id>) belong to a tournament, so they count as this section.
  { href: "/tournaments", label: "Tournaments", alsoActiveUnder: "/matches/" },
  { href: "/docs", label: "Docs" },
]

export function Navigation() {
  const pathname = usePathname()
  // A match page runs edge to edge, so the nav does too: no max width, and the
  // same 16px inset as the left panel's content, so the logo lines up with it.
  const fullBleed = pathname.startsWith("/matches/")
  // Docs pages run edge to edge too (see --fd-layout-width in globals.css),
  // with the sidebar on the left edge; px-4 lines the logo up with its header.
  const docs = pathname.startsWith("/docs")

  return (
    <nav className="sticky top-0 z-50 border-b border-white/8 bg-[color-mix(in_srgb,var(--app-bg)_92%,transparent)] backdrop-blur-xl supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--app-bg)_80%,transparent)]">
      <div
        className={cn(
          "flex h-14 items-center gap-[1.6rem] sm:gap-[2.8rem]",
          // Everywhere else, the shared page frame, so the logo lines up
          // with the page's content.
          fullBleed || docs ? "px-4" : "page-x"
        )}
      >
        <Link href="/" className="flex min-w-0 items-center gap-0.5">
          <Image
            src="/fnanalytics_logo.png"
            alt="FNAnalytics"
            width={38}
            height={38}
            className="size-9 shrink-0 -translate-y-[3px]"
            priority
          />
          <span className="font-[family-name:var(--font-sora)] truncate text-xl font-bold text-white">
            FNAnalytics
          </span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-[1.6rem]">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`) ||
                  (item.alsoActiveUnder !== undefined && pathname.startsWith(item.alsoActiveUnder))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-1 py-1.5 text-base font-semibold transition-colors",
                  isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
