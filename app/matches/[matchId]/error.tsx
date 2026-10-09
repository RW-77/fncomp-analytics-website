"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import { Spinner } from "@/components/replay/load-state"
import { MatchPageMessage } from "@/components/replay/match-page-message"

// The server couldn't load the match (the database or S3 failed). Retrying
// refreshes the server data, then re-renders the page with it.
export default function MatchError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  const [retrying, startTransition] = useTransition()

  const retry = () =>
    startTransition(() => {
      router.refresh()
      reset()
    })

  return (
    <MatchPageMessage
      title="Couldn't load this match"
      action={
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="flex items-center gap-2 rounded-sm bg-sky-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-70"
        >
          {retrying && <Spinner className="size-3.5 border-white/30 border-t-white" />}
          Try again
        </button>
      }
    >
      Something went wrong on our end. Try again in a moment.
    </MatchPageMessage>
  )
}
