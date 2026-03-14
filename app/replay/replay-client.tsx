'use client'
import { Stage, Layer, Image as KonvaImage, Circle } from 'react-konva'
import { useState, useRef, useEffect } from 'react'
import React from 'react'
import useImage from 'use-image'
import Konva from 'konva'

function ReplayClient({
  mapId,
  matchMetadata,
}: { 
  mapId: string,
  matchMetadata: any,
 }) {
  const [timestamp, setTimestamp] = useState(0);
  const [paused, setPaused] = useState(false);

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // load match metadata
  const {
    schema_version: schemaVersion,
    match_id: matchId,
    hz,
    interval_seconds: intervalSeconds,
    index_to_player: indexToPlayer,
    player_to_index: playerToIndex,
  } = matchMetadata;

  // RAF loop for timestamp
  useEffect(() => {
    if (paused) return;

    function loop(now: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now
      }

      const delta = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      setTimestamp(t => t + delta)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    }
  }, [paused])

  const frame = Math.floor(timestamp * hz);
  const framesPerChunk = hz * intervalSeconds;
  const chunkIndex = Math.floor(frame / framesPerChunk)

  type ChunkData = {
    data: any,
    shape: any,
  }
  const chunkCache = useRef<Map<number, ChunkData>>(new Map());

  useEffect(() => {
    async function ensureChunkLoaded(chunkIndex: number) {
      if (chunkCache.current.has(chunkIndex)) return;

      const params = new URLSearchParams({
        matchId,
        chunkIndex: chunkIndex.toString(),
      })
      const response = await fetch(
        `/api/replay/movement-chunk?${params.toString()}`,
      )
      if (!response.ok) {
        console.error('Failed to fetch movement chunk', await response.text())
        return
      }
      const chunk: ChunkData = await response.json()
      if (!chunk) return;
      chunkCache.current.set(chunkIndex, chunk);
    }
    ensureChunkLoaded(chunkIndex);
    ensureChunkLoaded(chunkIndex + 1);
  }, [chunkIndex])

  // placeholder
  const playerPositions = {}

  function onPlayPauseClick() {
    setPaused(p => !p);
    lastTimeRef.current = null;
  }

  return (
    <div 
      className="flex flex-col items-center justify-center" 
      style={{ backgroundColor: '#2f3136' }}
    >
      <ReplayViewport playerPositions={playerPositions} />
      <ReplayControls onPlayPauseClick={onPlayPauseClick} timestamp={timestamp} paused={paused} />
    </div>
  )
}

function ReplayViewport({
  playerPositions,
}: {
  playerPositions: any
}) {
  // match data should be passed in

  const [mapImage] = useImage(`/maps/v39/12/level-0/0-0.png`);
  const stageRef = useRef<Konva.Stage>(null);

  const STAGE_WIDTH = 1000;
  const STAGE_HEIGHT = 700; 

  const MIN_SCALE = 0.35;
  const MAX_SCALE = 15.0;

  useEffect(() => {
    if (!mapImage || !stageRef.current) return;

    const stage = stageRef.current;
    const scale = 0.35;

    stage.scale({ x: scale, y: scale });
    stage.position({
      x: 1000 / 2,
      y: 700 / 2,
    });

    stage.batchDraw();
  }, [mapImage]);

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

    let direction = e.evt.deltaY < 0 ? 1 : -1;

    const scaleBy = 1.1;
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));
    if (newScale === oldScale) 
      return;

    stage.scale({x: newScale, y: newScale});

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }
    stage.position(newPos);
    stage.batchDraw();
  }
  if (!mapImage) return null;

  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const stage = stageRef.current;
    if (!stage || !mapImage) return pos;
  
    const scale = stage.scaleX();
  
    const mapW = mapImage.width * scale;
    const mapH = mapImage.height * scale;
  
    const minX = STAGE_WIDTH / 2 - mapW / 2;
    const maxX = STAGE_WIDTH / 2 + mapW / 2;
    const minY = STAGE_HEIGHT / 2 - mapH / 2;
    const maxY = STAGE_HEIGHT / 2 + mapH / 2;
  
    return {
      x: Math.min(maxX, Math.max(minX, pos.x)),
      y: Math.min(maxY, Math.max(minY, pos.y)),
    };
  };

  return (
    <div className="flex-1 w-full">
      <Stage 
        ref={stageRef}
        width={STAGE_WIDTH} 
        height={STAGE_HEIGHT}
        onWheel={handleWheel}
        draggable
        dragBoundFunc={dragBoundFunc}
      >
        <Layer>
          <KonvaImage
            image={mapImage}
            offsetX={mapImage.width / 2}
            offsetY={mapImage.height / 2}
          />
          <Circle
            x={0}
            y={0}
            radius={5}
            fill="red"
          />
        </Layer>
      </Stage>
    </div>
  )
}

function ReplayControls({
  onPlayPauseClick, 
  timestamp, 
  paused
}: {
  onPlayPauseClick: () => void, 
  timestamp: number, 
  paused: boolean
}) {
  return (
      <div className="bg-green-500">
        <button onClick={onPlayPauseClick}>
          {paused ? "Play" : "Pause"}
        </button>
        <div className="text-white text-lg">
          Time: {timestamp.toFixed(2)}s
        </div>
      </div>
  )
}

export default ReplayClient;