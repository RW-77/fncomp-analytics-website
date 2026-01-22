'use client'
import { Stage, Layer, Image as KonvaImage } from 'react-konva'
import { useState, useRef } from 'react'
import React from 'react'
import useImage from 'use-image'
import Konva from 'konva'

function ReplayClient({
   matchId,
   mapId,
   matchData,
}: { 
  matchId: string,
  mapId: string,
  matchData: any,
 }) {
  const [timestamp, setTimestamp] = useState(0);
  const [paused, setPaused] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center bg-blue-500">
        <ReplayViewport timestamp={timestamp} />
        <ReplayControls />
    </div>
  )
}

function ReplayViewport({
  timestamp,
}: {
  timestamp: number,
}) {

  // camera
  const [scale, setScale] = useState(0.25);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const [mapImage] = useImage(`/maps/v39/level-0/0-0.png`);
  const stageRef = useRef<Konva.Stage>(null);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    let direction = e.evt.deltaY > 0 ? 1 : -1;

    const scaleBy = 1.1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({x: newScale, y: newScale});

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }
    stage.position(newPos);
  }

  return (
    <div className="flex-1 w-full">
      <Stage 
        ref={stageRef}
        width={1000} 
        height={700}
        onWheel={handleWheel}
      >
        <Layer>
          <KonvaImage
            image={mapImage}
            x={position.x}
            y={position.y}
            scaleX={scale}
            scaleY={scale}
          />
        </Layer>
      </Stage>
    </div>
  )
}

function ReplayControls() {
  return (
      <div className="bg-green-500">
          <h1>Replay Controls</h1>
      </div>
  )
}

export default ReplayClient;