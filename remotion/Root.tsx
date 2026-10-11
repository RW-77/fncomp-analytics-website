import "../app/globals.css"

import { Composition, staticFile, type CalculateMetadataFunction } from "remotion"

import { DURATION_S, EventGrouping, FPS, HEIGHT, WIDTH } from "./EventGrouping"
import type { FightData } from "./fight-data"
import { FIGHTS, REEL, type FightKey } from "./fights"
import { Reel, loadReel } from "./Reel"

type Props = { data: FightData | null }

const loadFight: CalculateMetadataFunction<Props> = async ({ props }) => ({
  props: { ...props, data: props.data ?? ((await (await fetch(staticFile("fight.json"))).json()) as FightData) },
})

const size = { fps: FPS, width: WIDTH, height: HEIGHT }

export function RemotionRoot() {
  return (
    <>
      {/* the first version: one clock, quick between the key moments */}
      <Composition id="EventGrouping" component={EventGrouping} durationInFrames={DURATION_S * FPS}
        defaultProps={{ data: null }} calculateMetadata={loadFight} {...size} />

      {/* each fight on its own (see Reel.tsx), then all of them back to back,
          looping; each with the timeline under it and without (-NoTimeline).
          The length comes from the fights. */}
      {[...(Object.keys(FIGHTS) as FightKey[]).map((f) => ({ id: f as string, fights: [f] })), { id: "Fights", fights: REEL }].flatMap(({ id, fights }) =>
        [true, false].map((timeline) => (
          <Composition key={`${id}-${timeline}`} id={timeline ? id : `${id}-NoTimeline`} component={Reel} durationInFrames={1}
            defaultProps={{ fights, timeline, data: null }} calculateMetadata={loadReel} {...size} />
        )),
      )}
    </>
  )
}
