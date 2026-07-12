import type { Metadata } from 'next'
import AccuracyLab from './accuracy-lab'

export const metadata: Metadata = {
  title: 'Accuracy — how it works | FNAnalytics Labs',
  description:
    'An interactive 3D look at how the accuracy stat is computed: shot vectors, ray-vs-hitbox tests, and intent-to-hit attribution.',
}

export default function AccuracyLabPage() {
  return <AccuracyLab />
}
