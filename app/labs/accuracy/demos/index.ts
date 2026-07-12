import type { Demo } from '../types'
import coldDemo from './cold-850.json'

// Registry of bundled demos. Add new packed JSON files here to make them
// selectable in the viewer.
export const demos: Demo[] = [coldDemo as unknown as Demo]

export function getDemo(id: string): Demo {
  return demos.find((d) => d.id === id) ?? demos[0]
}
