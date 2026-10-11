"use client"

import { useEffect, useRef, type CSSProperties } from "react"

// The fight-grouping animation (remotion/Reel.tsx, rendered from its
// Fights-NoTimeline composition at 2x): four real fights, each picked out of
// a field of drifting players, looping seamlessly. A mask fades its edges
// into the page, so it reads as part of the page rather than a video in a
// box; blend it with mix-blend-lighten to drop its own dark background
// entirely. The fade is widest on the left, where the headline sits: the
// fights play in the video's middle, but while the card shows (on its right)
// the fight moves left, under the headline, and fades there.
//
// It plays (muted) only where that's cheap: a wide screen, no data saving,
// and only while it's on screen. It plays whatever the reduced-motion
// setting, by choice. Anywhere else it's the poster (the video's first
// frame), and the video itself isn't downloaded.
const SOURCES = [{ src: "/videos/fights.mp4", type: "video/mp4" }]
const POSTER = "/videos/fights-poster.webp"
const PLAYS_WHERE = "(min-width: 1024px)"

// The fade across (on a wrapper) and down (on the video): two masks on two
// elements multiply, with no need for mask-composite.
const fade = (gradient: string): CSSProperties => ({ maskImage: gradient, WebkitMaskImage: gradient })
const ACROSS = fade("linear-gradient(to right, transparent, #000 42%, #000 94%, transparent)")
const DOWN = fade("linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)")

export function FightsVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (!video || connection?.saveData) return
    const where = window.matchMedia(PLAYS_WHERE)
    let onScreen = false
    const update = () => {
      if (onScreen && where.matches) {
        video.muted = true
        video.preload = "auto"
        video.play().catch(() => {})   // blocked autoplay leaves the poster
      } else {
        video.pause()
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      update()
    })
    observer.observe(video)
    where.addEventListener("change", update)
    return () => {
      observer.disconnect()
      where.removeEventListener("change", update)
    }
  }, [])

  return (
    <div aria-hidden className={className} style={ACROSS}>
      <video ref={ref} muted loop playsInline preload="none" poster={POSTER} className="aspect-[16/10] w-full object-cover" style={DOWN}>
        {SOURCES.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
      </video>
    </div>
  )
}
