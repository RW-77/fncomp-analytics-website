import type { Spot } from "./scene"

// The fights the animation plays, by the name its compositions use. Each
// file is in remotion/public, written by remotion/data/extract_fight.py;
// adding a fight is a new entry here.
//
// `spot` is where the fight sits among the wide view's drifting arrows (m
// from its centre; the wide view spans about ±460 m by -300 to 220 m), so
// each clip zooms in somewhere else. `perspective` follows one team: the
// card then gives that team's verdict.
type Fight = { file: string; about: string; spot: Spot; perspective?: number }

export const FIGHTS: Record<"Fight13" | "Fight25" | "Fight16" | "Fight23", Fight> = {
  Fight13: { file: "fights/eb28d3ce-13.json", about: "FNCS Major 3 Final EU Day 1, game 5: two knocks, then the wipe", spot: { x: -240, y: -150 } },
  Fight25: {
    file: "fights/b472357d-25.json", about: "FNCS Major 1 Final NAC Day 1, game 6: three knocks in two seconds", spot: { x: 230, y: 90 },
    perspective: 16,   // FEK Rekorcholis + shk dummy + teramcrazy, who lose it: "Lost"
  },
  Fight16: { file: "fights/3b23ef48-16.json", about: "FNCS Major 2 Final NAC Day 1, game 4: a knock, a long lull, the wipe", spot: { x: 270, y: -170 } },
  Fight23: { file: "fight.json", about: "PE Finals 6 NAC, Match 2: a third party joins", spot: { x: -190, y: 110 } },
}
export type FightKey = keyof typeof FIGHTS

// The combined reel's order; it loops from the last back to the first.
export const REEL: FightKey[] = ["Fight13", "Fight25", "Fight16", "Fight23"]
