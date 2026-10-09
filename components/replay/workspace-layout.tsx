import type { ReactNode, Ref } from 'react'
import { CenteredStatus, Skeleton } from '@/components/replay/load-state'
import { panelFont } from '@/components/replay/panel-font'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// The match page's layout, shared by the page and its loading skeleton so
// nothing moves when one replaces the other.
//
// Wide screens: three columns filling the window below the site nav (3.5rem).
// The left column is the match and Viewing as (top) over the events (only
// they scroll); the replay is in the middle; the details panel is on the
// right while something is open in it. Side columns scale with the window so
// the replay gets as much width as possible; with the details panel closed,
// an empty right margin keeps the replay off the edge on big screens (none up
// to 1440px wide, 160px at 1920px).
//
// Narrow screens: one column that scrolls — the match and Viewing as, the
// replay, the details, then the events.
// ---------------------------------------------------------------------------

export function WorkspaceLayout({
  top,
  events,
  stage,
  details,
  stageRef,
}: {
  top: ReactNode
  events: ReactNode
  stage: ReactNode
  details: ReactNode | null    // null = the panel is closed
  stageRef?: Ref<HTMLElement>
}) {
  const side = cn('bg-[var(--panel)] font-medium lg:border-r lg:border-white/[0.06]', panelFont.className)
  return (
    <div
      className={cn(
        "grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 bg-[var(--app-bg)] text-slate-200 [grid-template-areas:'top'_'stage'_'details'_'events']",
        "lg:h-[calc(100dvh-3.5rem)] lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)] lg:[grid-template-areas:'top_stage_details'_'events_stage_details']",
        details
          ? 'lg:grid-cols-[clamp(240px,17vw,264px)_minmax(0,1fr)_clamp(320px,23vw,376px)]'
          : 'lg:grid-cols-[clamp(240px,17vw,264px)_minmax(0,1fr)_clamp(0px,calc((100vw_-_1440px)_/_3),160px)]',
      )}
    >
      <div className={cn('[grid-area:top]', side)}>{top}</div>
      <div className={cn('flex flex-col [grid-area:events] lg:min-h-0', side)}>{events}</div>
      {/* scroll-mt: the site nav is sticky, so a scrolled-to replay lands below it */}
      <main
        ref={stageRef}
        className="h-[min(100vw,70dvh)] min-w-0 scroll-mt-14 p-2 [grid-area:stage] lg:h-auto lg:min-h-0"
      >
        {stage}
      </main>
      {details && (
        <aside
          aria-label="Details"
          className="bg-[var(--panel)] p-4 [grid-area:details] lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-white/[0.06]"
        >
          {details}
        </aside>
      )}
    </div>
  )
}

// The page while the server loads the match: the layout with placeholders
// where the header, Viewing as and events go.
export function MatchWorkspaceSkeleton() {
  return (
    <WorkspaceLayout
      top={
        <>
          <div className="flex items-start gap-3 py-3 pl-4 pr-3">
            <Skeleton className="mt-0.5 size-5 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <div className="flex flex-col gap-2 border-y border-[var(--panel-line)] bg-[var(--panel-raised)] px-4 py-3.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-28" />
          </div>
        </>
      }
      events={<EventsSkeleton />}
      stage={<CenteredStatus loading>Loading match…</CenteredStatus>}
      details={null}
    />
  )
}

// The event-type filter and a few rows, as the events panel shows while the
// engagements load.
export function EventsSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-3 pt-3">
      <Skeleton className="h-9" />
      <Skeleton className="mx-1 mt-1 h-4 w-16" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  )
}
