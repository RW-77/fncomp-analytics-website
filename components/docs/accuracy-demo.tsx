'use client'

// Embeddable version of the /labs/accuracy viewer, for use inside MDX docs.
// Registered globally in mdx-components.tsx, so pages can just write
// <AccuracyDemo /> without importing anything.

import dynamic from 'next/dynamic'
import { demos } from '@/app/labs/accuracy/demos'

// three.js is browser-only and heavy — load it on demand, never on the server.
const ShotViz = dynamic(() => import('@/app/labs/accuracy/shot-viz'), {
  ssr: false,
  loading: () => (
    <div className="not-prose flex h-[520px] w-full items-center justify-center rounded-xl border border-white/10 bg-[#0a0e17] text-sm text-muted-foreground">
      Loading interactive demo…
    </div>
  ),
})

export default function AccuracyDemo({
  demoId,
  height = '520px',
}: {
  demoId?: string
  height?: string
}) {
  const demo = (demoId && demos.find((d) => d.id === demoId)) || demos[0]
  return <ShotViz demo={demo} embedded height={height} />
}
