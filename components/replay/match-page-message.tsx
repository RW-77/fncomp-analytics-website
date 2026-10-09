import Link from "next/link"

// A full-page message in the match page's style, with a way back to the
// tournaments (without a match, the page can't know which one it was in).
export function MatchPageMessage({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center bg-[var(--app-bg)] p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-slate-400">{children}</p>
        <div className="mt-2 flex items-center gap-3">
          {action}
          <Link
            href="/tournaments"
            className="rounded-sm border border-[var(--panel-control)] px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-white/[0.04]"
          >
            Back to tournaments
          </Link>
        </div>
      </div>
    </div>
  )
}
