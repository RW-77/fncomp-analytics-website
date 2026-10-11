import type { Metadata } from 'next'
import AccuracyLab from './accuracy-lab'

export const metadata: Metadata = {
  title: 'Accuracy Lab: How Accuracy Is Calculated in 3D',
  description:
    'An interactive 3D look at how the accuracy stat is computed: shot vectors, ray-vs-hitbox tests, and intent-to-hit attribution.',
  alternates: { canonical: '/labs/accuracy' },
}

export default function AccuracyLabPage() {
  return <AccuracyLab />
}
