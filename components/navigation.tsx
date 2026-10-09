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
  // Match the wider tournament workspace so the nav aligns with the page below it.
  const wide = pathname.startsWith("/tournaments/")
  // On docs pages, mirror fumadocs' centered layout so the logo tracks the
  // sidebar header ("FNAnalytics Docs") at every width. Fumadocs centers its
  // grid (sidebar 268 + content 1016 + toc 268 = 1552px) and right-aligns the
  // sidebar content against the left gutter; matching max-w + px-4 puts our
  // logo on that same gutter+16px line.
  const docs = pathname.startsWith("/docs")

  return (
    <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#08111f]/88 backdrop-blur-xl supports-[backdrop-filter]:bg-[#08111f]/72">
      <div
        className={cn(
          "flex h-14 items-center gap-[1.6rem] sm:gap-[2.8rem]",
          fullBleed
            ? "px-4"
            : docs
            ? "mx-auto max-w-[1552px] px-4"
            : wide
              ? "mx-auto max-w-[1800px] px-4 md:px-14"
              : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
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
