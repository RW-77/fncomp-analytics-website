"use client"

import { useSyncExternalStore } from "react"

const FORMATS = {
  time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }),          // 9:38 PM
  date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }), // Oct 1, 2026
}

const noSubscribe = () => () => {}

// A time in the viewer's time zone. The server can't know that zone, so it
// renders nothing and the browser fills the text in on hydration (the server
// snapshot is null), with no hydration mismatch.
export function LocalTime({ iso, format }: { iso: string; format: keyof typeof FORMATS }) {
  const text = useSyncExternalStore(
    noSubscribe,
    () => FORMATS[format].format(new Date(iso)),
    () => null,
  )
  return <time dateTime={iso}>{text}</time>
}
