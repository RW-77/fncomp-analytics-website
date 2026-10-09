'use client'

import { cn } from '@/lib/utils'

// Placeholder for content that's loading. Size it like what it stands in for,
// so nothing shifts when the content arrives.
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn('animate-pulse rounded-sm bg-white/[0.06]', className)} style={style} />
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-5 animate-spin rounded-full border-2 border-white/15 border-t-sky-400', className)}
    />
  )
}

// A status centered in a large area (the replay): a spinner and what's
// loading, or why there's nothing to show (with Retry when that could help).
export function CenteredStatus({
  loading = false,
  onRetry,
  children,
}: {
  loading?: boolean
  onRetry?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="grid size-full place-items-center p-6 text-center">
      <div
        role={loading ? 'status' : onRetry ? 'alert' : undefined}
        className="flex max-w-xs flex-col items-center gap-3 rounded-sm bg-[var(--panel)] px-5 py-4 text-sm text-slate-300"
      >
        {loading && <Spinner />}
        <p>{children}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-sm border border-[var(--panel-control)] px-3 py-1 font-medium text-sky-300 hover:bg-white/[0.04]"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

// A short note in place of content that isn't there, with a Retry button
// when trying again could help (a failed load, not a file that doesn't exist).
export function LoadNote({
  children,
  onRetry,
  className,
}: {
  children: React.ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <p role={onRetry ? 'alert' : undefined} className={cn('text-sm text-slate-500', className)}>
      {children}
      {onRetry && (
        <>
          {' '}
          <button type="button" onClick={onRetry} className="font-medium text-sky-400 hover:text-sky-300">
            Retry
          </button>
        </>
      )}
    </p>
  )
}
