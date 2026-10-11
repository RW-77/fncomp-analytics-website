import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// A homepage section's heading and lead, in the same style everywhere.
// `size="lg"` sets the heading larger, for the section that leads the rest.
export function SectionHeading({
  title,
  size = "md",
  children,
  className,
}: {
  title: string
  size?: "md" | "lg"
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex max-w-xl flex-col gap-4", className)}>
      <h2
        className={cn(
          "font-[family-name:var(--font-sora)] font-bold tracking-[-0.02em] text-white",
          size === "lg" ? "text-4xl sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]" : "text-3xl sm:text-4xl",
        )}
      >
        {title}
      </h2>
      {children && <div className="text-base leading-7 text-slate-300">{children}</div>}
    </div>
  )
}
