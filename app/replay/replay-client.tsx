'use client'

import { Stage, Layer, Image as KonvaImage, Circle, Text } from 'react-konva'
import { useState, useRef, useEffect } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Stage as KonvaStage } from 'konva/lib/Stage'
import useImage from 'use-image'
import npyjs from 'npyjs'

type MatchMetadata = {
  schema_version?: number
  match_id: string
  hz: number
  interval_seconds: number
  index_to_player?: Record<string, string>
  player_to_index?: Record<string, number>
}

type ChunkData = {
  data: Float32Array
  shape: [number, number, number]
  dtype: string
  fortranOrder: boolean
}

type ReplayClientProps = {
  mapId: string
  matchMetadata: MatchMetadata
  stageWidth?: number
  stageHeight?: number
}

const FIXED_WORLD_BOUNDS = {
  minX: -130000,
  maxX: 130000,
  minY: -130000,
  maxY: 130000,
} as const

function getFrameSlice(chunk: ChunkData, frameInChunk: number): Float32Array {
  const [frameCount, playerCount, featureCount] = chunk.shape
  if (frameInChunk < 0 || frameInChunk >= frameCount) {
    throw new Error(`frameInChunk ${frameInChunk} out of bounds`)
  }
  const frameStride = playerCount * featureCount
  const frameOffset = frameInChunk * frameStride

  return chunk.data.subarray(frameOffset, frameOffset + frameStride)
}

type PlayerState = {
  playerIndex: number
  playerId: string | null
  x: number
  y: number
  z: number
  yaw: number
  hp: number
  shield: number
  alive: boolean
  dbno: boolean
}

function getPlayerState(
  frameSlice: Float32Array,
  playerIndex: number,
  playerId: string | null,
  featureCount = 8,
): PlayerState | null {
  const playerOffset = playerIndex * featureCount

  if (playerOffset + featureCount > frameSlice.length) {
    return null
  }
  return {
    playerIndex,
    playerId,
    x: frameSlice[playerOffset + 0],
    y: frameSlice[playerOffset + 1],
    z: frameSlice[playerOffset + 2],
    yaw: frameSlice[playerOffset + 3],
    hp: frameSlice[playerOffset + 4],
    shield: frameSlice[playerOffset + 5],
    alive: frameSlice[playerOffset + 6] > 0.5,
    dbno: frameSlice[playerOffset + 7] > 0.5,
  }
}

function getAllPlayerStates(
  chunk: ChunkData,
  frameInChunk: number,
  indexToPlayer?: Record<string, string>,
): PlayerState[] {
  const frameSlice = getFrameSlice(chunk, frameInChunk)
  const [, playerCount, featureCount] = chunk.shape
  const players: PlayerState[] = []

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    const playerId = indexToPlayer?.[String(playerIndex)] ?? null
    const state = getPlayerState(frameSlice, playerIndex, playerId, featureCount)
    if (state) {
      players.push(state)
    }
  }
  return players
}

function projectWorldToMap({
  state,
  mapWidth,
  mapHeight,
}: {
  state: PlayerState
  mapWidth: number
  mapHeight: number
}) {
  const padding = 32
  const usableWidth = mapWidth - padding * 2
  const usableHeight = mapHeight - padding * 2
  const worldWidth = Math.max(1, FIXED_WORLD_BOUNDS.maxX - FIXED_WORLD_BOUNDS.minX)
  const worldHeight = Math.max(1, FIXED_WORLD_BOUNDS.maxY - FIXED_WORLD_BOUNDS.minY)

  const normalizedX = (state.x - FIXED_WORLD_BOUNDS.minX) / worldWidth
  const normalizedY = (state.y - FIXED_WORLD_BOUNDS.minY) / worldHeight

  return {
    x: normalizedX * usableWidth + padding - mapWidth / 2,
    y: normalizedY * usableHeight + padding - mapHeight / 2,
  }
}

const npy = new npyjs()

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
  const lastLoggedSampleRef = useRef<string | null>(null)

  const {
    match_id: matchId,
    hz,
    interval_seconds: intervalSeconds,
    index_to_player: indexToPlayer,
  } =
    matchMetadata

  const frame = Math.floor(timestamp * hz)
  const framesPerChunk = chunkCache.get(0)?.shape[0] ?? hz * intervalSeconds
  const chunkIndex = Math.floor(frame / framesPerChunk)
  const frameInChunk = frame % framesPerChunk

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
      if (nextChunkIndex < 0) {
        return
      }

      if (chunkCache.has(nextChunkIndex)) {
        console.log(
          `[ReplayClient] chunk ${nextChunkIndex} already cached for frame ${frame}`,
        )
        return
      }

      if (loadingChunksRef.current.has(nextChunkIndex)) {
        console.log(`[ReplayClient] chunk ${nextChunkIndex} already loading`)
        return
      }

      loadingChunksRef.current.add(nextChunkIndex)

      try {
        console.log(`[ReplayClient] fetching chunk ${nextChunkIndex}`)
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

        const buffer = await response.arrayBuffer()
        const parsed = await npy.load(buffer)

        if (!(parsed.data instanceof Float32Array)) {
          throw new Error(
            `Expected Float32Array chunk data, got ${parsed.data.constructor.name}`,
          )
        }
        if (parsed.shape.length !== 3) {
          throw new Error(
            `Expected 3D chunk shape, got [${parsed.shape.join(', ')}]`,
          )
        }

        const movementChunk: ChunkData = {
          data: parsed.data,
          shape: parsed.shape as [number, number, number],
          dtype: parsed.dtype,
          fortranOrder: parsed.fortranOrder,
        }

        console.log(
          `[ReplayClient] decoded chunk ${nextChunkIndex} shape=[${movementChunk.shape.join(', ')}] dtype=${movementChunk.dtype}`,
        )

        setChunkCache((previous) => {
          if (previous.has(nextChunkIndex)) {
            return previous
          }

          const next = new Map(previous)
          next.set(nextChunkIndex, movementChunk)
          console.log(
            `[ReplayClient] cached chunk ${nextChunkIndex}; cache size=${next.size}`,
          )
          return next
        })
      } finally {
        loadingChunksRef.current.delete(nextChunkIndex)
      }
    }

    void ensureChunkLoaded(chunkIndex)
    void ensureChunkLoaded(chunkIndex + 1)
  }, [chunkCache, chunkIndex, frame, matchId])

  const currentChunk = chunkCache.get(chunkIndex)
  const playerStates = currentChunk
    ? getAllPlayerStates(currentChunk, frameInChunk, indexToPlayer)
    : []

  useEffect(() => {
    if (!currentChunk) {
      console.log(
        `[ReplayClient] waiting for chunk ${chunkIndex} at frame ${frame} (frameInChunk=${frameInChunk})`,
      )
      return
    }

    // Log at a low-noise cadence while still showing indexing progress.
    const shouldLogFrame = frameInChunk === 0 || frame % Math.max(1, hz) === 0
    const logKey = `${chunkIndex}:${frameInChunk}`

    if (!shouldLogFrame || lastLoggedSampleRef.current === logKey) {
      return
    }

    lastLoggedSampleRef.current = logKey

    console.log(
      `[ReplayClient] sampling frame ${frame} from chunk ${chunkIndex} (frameInChunk=${frameInChunk}, players=${playerStates.length})`,
    )
  }, [chunkIndex, currentChunk, frame, frameInChunk, hz, playerStates.length])

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
      {!currentChunk && (
        <div className="mb-2 text-white bg-green-500">
          Loading chunk {chunkIndex} for frame {frame}...
        </div>
      )}
      <ReplayViewport
        playerStates={playerStates}
        framesPerChunk={framesPerChunk}
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
  playerStates,
  framesPerChunk,
  stageWidth,
  stageHeight,
}: {
  playerStates: PlayerState[]
  framesPerChunk: number
  stageWidth: number
  stageHeight: number
}) {
  const [mapImage] = useImage(`/maps/v39/02/39.02.png`);
  const stageRef = useRef<KonvaStage>(null);

  const MIN_SCALE = 0.05;
  const MAX_SCALE = 30.0;

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
          {playerStates
            .filter((player) => player.alive)
            .map((player) => {
              const projected = projectWorldToMap({
                state: player,
                mapWidth: mapImage.width,
                mapHeight: mapImage.height,
              })

              return (
                <Circle
                  key={player.playerId ?? `player-${player.playerIndex}`}
                  x={projected.x}
                  y={projected.y}
                  radius={player.dbno ? 50 : 40}
                  fill={player.dbno ? '#facc15' : '#4ade80'}
                  opacity={0.9}
                />
              )
            })}
          <Text
            x={-mapImage.width / 2 + 24}
            y={-mapImage.height / 2 + 24}
            text={`players on frame: ${playerStates.length}\nframes/chunk: ${framesPerChunk}`}
            fill="white"
            fontSize={18}
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
