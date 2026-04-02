'use client'

import { Stage, Layer, Image as KonvaImage, Circle } from 'react-konva'
import { useState, useRef, useEffect } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Stage as KonvaStage } from 'konva/lib/Stage'
import useImage from 'use-image'

type MatchMetadata = {
  schema_version?: number
  match_id: string
  hz: number
  interval_seconds: number
  index_to_player?: Record<string, string>
  player_to_index?: Record<string, number>
}

type ChunkData = {
  data: number[]
  shape: number[]
}

type ReplayClientProps = {
  mapId: string
  matchMetadata: MatchMetadata
  stageWidth?: number
  stageHeight?: number
}


function ReplayClient({
  mapId,
  matchMetadata,
  stageWidth = 1000,
  stageHeight = 700,
}: ReplayClientProps) {
  const [timestamp, setTimestamp] = useState(0)
  const [paused, setPaused] = useState(false)
  const [chunkCache, setChunkCache] = useState<Map<number, ChunkData>>(
    () => new Map(),
  )

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const loadingChunksRef = useRef<Set<number>>(new Set())

  const { match_id: matchId, hz, interval_seconds: intervalSeconds } =
    matchMetadata

  const frame = Math.floor(timestamp * hz)
  const framesPerChunk = hz * intervalSeconds
  const chunkIndex = Math.floor(frame / framesPerChunk)

  // RAF loop for timestamp
  useEffect(() => {
    if (paused) return

    function loop(now: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now
      }

      const delta = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      setTimestamp((value) => value + delta)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      lastTimeRef.current = null
    }
  }, [paused])

  useEffect(() => {
    if (!matchId) return

    async function ensureChunkLoaded(nextChunkIndex: number) {
      if (
        nextChunkIndex < 0 ||
        chunkCache.has(nextChunkIndex) ||
        loadingChunksRef.current.has(nextChunkIndex)
      ) {
        return
      }

      loadingChunksRef.current.add(nextChunkIndex)

      try {
        const params = new URLSearchParams({
          matchId,
          chunkIndex: nextChunkIndex.toString(),
        })
        const response = await fetch(
          `/api/replay/movement-chunk?${params.toString()}`,
        )
        if (!response.ok) {
          console.error('Failed to fetch movement chunk', await response.text())
          return
        }

        const movementChunk: ChunkData = await response.json()
        if (!movementChunk) return

        setChunkCache((previous) => {
          if (previous.has(nextChunkIndex)) {
            return previous
          }

          const next = new Map(previous)
          next.set(nextChunkIndex, movementChunk)
          return next
        })
      } finally {
        loadingChunksRef.current.delete(nextChunkIndex)
      }
    }

    void ensureChunkLoaded(chunkIndex)
    void ensureChunkLoaded(chunkIndex + 1)
  }, [chunkCache, chunkIndex, matchId])

  // This will be derived from chunkCache + timestamp once movement sampling is added.
  const playerPositions = chunkCache.get(chunkIndex)

  function onPlayPauseClick() {
    setPaused((value) => !value)
    lastTimeRef.current = null
  }

  return (
    <div 
      className="flex flex-col items-center justify-center" 
      style={{ backgroundColor: '#2f3136' }}
      data-map-id={mapId}
    >
      <ReplayViewport
        playerPositions={playerPositions}
        stageWidth={stageWidth}
        stageHeight={stageHeight}
      />
      <ReplayControls 
        onPlayPauseClick={onPlayPauseClick} 
        timestamp={timestamp} 
        paused={paused} 
      />
    </div>
  )
}

function ReplayViewport({
  playerPositions,
  stageWidth,
  stageHeight,
}: {
  playerPositions: Record<string, unknown>
  stageWidth: number
  stageHeight: number
}) {
  void playerPositions

  const [mapImage] = useImage(`/maps/v39/12/level-0/0-0.png`);
  const stageRef = useRef<KonvaStage>(null);

  const MIN_SCALE = 0.35;
  const MAX_SCALE = 15.0;

  useEffect(() => {
    if (!mapImage || !stageRef.current) return;

    const stage = stageRef.current;
    const scale = 0.35;

    stage.scale({ x: scale, y: scale });
    stage.position({
      x: stageWidth / 2,
      y: stageHeight / 2,
    });

    stage.batchDraw();
  }, [mapImage, stageHeight, stageWidth]);

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
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

    const direction = e.evt.deltaY < 0 ? 1 : -1;

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
  
    const minX = stageWidth / 2 - mapW / 2;
    const maxX = stageWidth / 2 + mapW / 2;
    const minY = stageHeight / 2 - mapH / 2;
    const maxY = stageHeight / 2 + mapH / 2;
  
    return {
      x: Math.min(maxX, Math.max(minX, pos.x)),
      y: Math.min(maxY, Math.max(minY, pos.y)),
    };
  };

  return (
    <div className="flex-1 w-full">
      <Stage 
        ref={stageRef}
        width={stageWidth} 
        height={stageHeight}
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
