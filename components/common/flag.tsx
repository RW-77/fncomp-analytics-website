import { cn } from "@/lib/utils"
import { flagCode } from "@/lib/flags"

// Default "no nationality" globe, served from public/. Shown for the special
// global/fortnite tokens, a missing token, and any country we haven't mapped.
const DEFAULT_FLAG_URL = "/flags/global.svg"

// A country flag rendered from a raw fnapi flag token via flag-icons.
//
// `.fi fi-<code>` is flag-icons' 4x3 rectangle, sized in `em` so it tracks the
// surrounding text (≈1.33em wide × 1em tall). When the token maps to no country
// flag, the same `.fi` box is reused with the globe background, so the fallback
// is pixel-identical in size and position to a real flag.
export function Flag({
  token,
  className,
}: {
  token: string | null | undefined
  className?: string
}) {
  const code = flagCode(token)
  if (code) {
    return (
      <span
        className={cn("fi rounded-[2px] ring-1 ring-white/10", `fi-${code}`, className)}
        role="img"
        aria-label={code}
      />
    )
  }
  return (
    <span
      className={cn("fi rounded-[2px] ring-1 ring-white/10", className)}
      style={{ backgroundImage: `url(${DEFAULT_FLAG_URL})` }}
      role="img"
      aria-label="No nationality"
    />
  )
}
