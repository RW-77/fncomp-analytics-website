// Time formatting shared by the replay panels. Inputs are replay seconds
// (seconds since bus launch), e.g. an engagement's start_s / end_s.

// 223.4 -> "3:43"
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds)
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// 246.37 -> "4:06.3" (tenths, for lining up individual actions)
export function formatClockPrecise(seconds: number): string {
  const s = Math.max(0, seconds)
  const whole = Math.floor(s)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${Math.floor((s - whole) * 10)}`
}

// 91.3 -> "1m 31s", 42.6 -> "43s"
export function formatDuration(seconds: number): string {
  const total = Math.round(Math.max(0, seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
