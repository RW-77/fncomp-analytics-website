'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { demos } from './demos'

// The R3F canvas is browser-only — load it without SSR.
const ShotViz = dynamic(() => import('./shot-viz'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-[#0a0e17] text-sm text-muted-foreground">
      Loading shot geometry…
    </div>
  ),
})

export default function AccuracyLab() {
  const [demoId] = useState(demos[0].id)
  const demo = demos.find((d) => d.id === demoId) ?? demos[0]
  return <ShotViz demo={demo} />
}
