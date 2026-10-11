"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { StepItem } from "@/components/home/step-item"

type Step = { at: number; title: string; body: string }   // at: seconds into the clip
type Demo = { title: string; src: string; poster: string; aspect: string; steps: Step[] }

// Two screen recordings of the match page, each with the steps it walks
// through. `at` is when each step begins in its clip; `aspect` is the clip's
// own shape, so each shows at its size, with no bars.
const DEMOS: Demo[] = [
  {
    title: "Analyze every early and midgame fight",
    src: "/videos/replay-fights.mp4",
    poster: "/videos/replay-fights-poster.webp",
    aspect: "1920 / 1004",
    steps: [
      { at: 0, title: "Follow a team", body: "Pick a team to see the key events that shaped their game." },
      { at: 5, title: "Open a fight", body: "Jump to an early or midgame fight to see who won it, and how each team and player did." },
      { at: 16, title: "Step through every action", body: "See the individual shots, hits, knocks, and elims within a fight. Click any of them to step through it." },
    ],
  },
  {
    title: "View the state of players and teams, at any moment",
    src: "/videos/replay-players.mp4",
    poster: "/videos/replay-players-poster.webp",
    aspect: "1920 / 1228",
    steps: [
      { at: 0.5, title: "Click a player", body: "View any player's health, shields, inventory, and stats at any point in a match." },
      { at: 5, title: "Team views", body: "Get a collective view of a team and all its players." },
      { at: 8, title: "Navigate within a team", body: "Move from teammate to teammate via the team and player panels." },
    ],
  },
]

// The step playing at `time`: the last one to have begun (the first before any has).
const stepAt = (steps: Step[], time: number) => Math.max(0, steps.findLastIndex((s) => s.at <= time))

// The replay section's walkthrough. On wide screens the videos stay pinned on
// the left while the two demos' steps scroll past on the right; whichever demo
// is mid-screen plays, and its steps light up in time with it.
// Clicking a step seeks there. On phones the videos pin under the nav instead.
export function ReplayDemos({ className }: { className?: string }) {
  const [active, setActive] = useState(0)
  const [step, setStep] = useState(0)
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const groups = useRef<(HTMLDivElement | null)[]>([])
  const progress = useRef<HTMLSpanElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  const seekTo = useRef<number | null>(null)

  // Which demo is mid-screen
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(groups.current.indexOf(entry.target as HTMLDivElement))
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    )
    groups.current.forEach((g) => g && observer.observe(g))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Play the active demo from the start (or the clicked step) while the
  // section is on screen; pause the other. Data saver keeps the posters.
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    videos.current.forEach((video, i) => {
      if (!video) return
      if (i === active && onScreen && !saveData) {
        if (seekTo.current !== null) {
          video.currentTime = seekTo.current
          seekTo.current = null
        }
        video.play().catch(() => {})   // blocked autoplay leaves the poster
      } else {
        video.pause()
        if (i !== active) video.currentTime = 0
      }
    })
  }, [active, onScreen])

  // Follow the playing video: light its current step and fill that step's bar.
  useEffect(() => {
    const video = videos.current[active]
    const { steps } = DEMOS[active]
    let frame = requestAnimationFrame(function tick() {
      // Before the video has loaded, the first step, unfilled
      const loaded = Boolean(video?.duration)
      const time = loaded ? video!.currentTime : 0
      const i = stepAt(steps, time)
      setStep(i)
      const end = steps[i + 1]?.at ?? (loaded ? video!.duration : Infinity)
      const fill = (time - steps[i].at) / (end - steps[i].at)
      if (progress.current) progress.current.style.transform = `scaleX(${Math.min(1, Math.max(0, fill))})`
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [active])

  const select = (demo: number, i: number) => {
    const at = DEMOS[demo].steps[i].at
    if (demo === active) {
      const video = videos.current[demo]
      if (video) {
        video.currentTime = at
        video.play().catch(() => {})
      }
    } else {
      seekTo.current = at
      setActive(demo)
      groups.current[demo]?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  return (
    <div ref={root} className={cn("grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14", className)}>
      {/* The pinned videos, stacked in one cell and centered on the same line;
          the active one fades in. Under the nav on phones, centered on screen
          on wide screens. */}
      <div className="sticky top-14 z-10 -mx-[var(--page-gutter)] self-start bg-[var(--app-bg)] px-[var(--page-gutter)] py-3 lg:mx-0 lg:flex lg:h-[calc(100dvh-3.5rem)] lg:items-center lg:bg-transparent lg:p-0">
        <div className="grid w-full">
          {DEMOS.map((demo, i) => (
            <video
              key={demo.src}
              ref={(el) => {
                videos.current[i] = el
              }}
              muted
              loop
              playsInline
              preload={i === active ? "metadata" : "none"}
              poster={demo.poster}
              aria-label={demo.title}
              style={{ aspectRatio: demo.aspect }}
              className={cn(
                "w-full self-center rounded-md transition-opacity duration-500 [grid-area:1/1]",
                i === active ? "opacity-100" : "opacity-0",
              )}
            >
              <source src={demo.src} type="video/mp4" />
            </video>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        {DEMOS.map((demo, d) => (
          <div
            key={demo.title}
            ref={(el) => {
              groups.current[d] = el
            }}
            className="flex flex-col justify-center gap-6 py-6 lg:min-h-[calc(100dvh-3.5rem)] lg:py-0"
          >
            <h3 className="font-[family-name:var(--font-sora)] text-2xl font-bold tracking-[-0.02em] text-[var(--accent-gold)] sm:text-3xl">
              {demo.title}
            </h3>
            <ol className="ml-3 flex flex-col gap-1.5 sm:ml-6">
              {demo.steps.map((s, i) => (
                <StepItem
                  key={s.title}
                  title={s.title}
                  body={s.body}
                  active={d === active && i === step}
                  progress={d === active && i === step ? progress : undefined}
                  onSelect={() => select(d, i)}
                />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
