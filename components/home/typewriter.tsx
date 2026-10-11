"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

import { cn } from "@/lib/utils"

const TYPE_MS = 75     // per character typed
const DELETE_MS = 40   // per character deleted
const HOLD_MS = 1900   // a finished word stays this long
const GAP_MS = 350     // pause on the empty word before typing the next

type Phase = "hold" | "delete" | "type"

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"
function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

// Types out each word, holds it, deletes it, then types the next. The word
// keeps its natural width; the caret keeps the line's height when the word
// is empty, so nothing around it moves vertically. Starts with the first word
// already typed, so the server-rendered page reads complete. With reduced
// motion it still types (the text changes; nothing moves), but the caret
// stays solid instead of blinking.
export function Typewriter({ words, className }: { words: string[]; className?: string }) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  )
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(words[0]?.length ?? 0)
  const [phase, setPhase] = useState<Phase>("hold")

  useEffect(() => {
    if (words.length < 2) return
    const word = words[index]
    let timer: ReturnType<typeof setTimeout>
    if (phase === "hold") {
      timer = setTimeout(() => setPhase("delete"), HOLD_MS)
    } else if (phase === "delete") {
      timer =
        length > 0
          ? setTimeout(() => setLength((l) => l - 1), DELETE_MS)
          : setTimeout(() => {
              setIndex((i) => (i + 1) % words.length)
              setPhase("type")
            }, GAP_MS)
    } else {
      timer =
        length < word.length
          ? setTimeout(() => setLength((l) => l + 1), TYPE_MS)
          : setTimeout(() => setPhase("hold"), 0)
    }
    return () => clearTimeout(timer)
  }, [words, index, length, phase])

  const text = words[index].slice(0, length)
  return (
    <span aria-hidden className={cn("whitespace-nowrap", className)}>
      {text}
      <span
        className={cn(
          "ml-[0.04em] inline-block h-[0.82em] w-[0.06em] translate-y-[0.06em] bg-current",
          // blink only while a word is resting, not while typing
          phase === "hold" && !reducedMotion && "animate-caret-blink",
        )}
      />
    </span>
  )
}
