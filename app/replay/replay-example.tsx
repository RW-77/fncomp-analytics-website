'use client'

import {
  Arrow,
  Circle,
  Image as KonvaImage,
  Layer,
  Stage,
  Text,
} from 'react-konva'
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import useImage from 'use-image'
import Konva from 'konva'

type MatchMetadata = {
  schema_version?: number
  match_id: string
  hz: number
  interval_seconds: number
  index_to_player?: Record<string, string>
  player_to_index?: Record<string, number>
}

type ReplayClientProps = {
  mapId: string
  matchMetadata: MatchMetadata
  stageWidth?: number
  stageHeight?: number
}

type ChunkData = {
  data: number[]
  shape: number[]
}

type DemoPlayer = {
  id: string
  label: string
  color: string
  x: number
  y: number
  heading: number
}

type CameraMode = 'manual' | 'follow-event'

type FocusEvent = {
  label: string
  playerIds: string[]
  startTime: number
}

const MIN_SCALE = 0.05
const MAX_SCALE = 5
const CAMERA_LERP = 0.16

function ReplayClient({
  mapId,
  matchMetadata,
  stageWidth = 1000,
  stageHeight = 700,
}: ReplayClientProps) {
  const [timestamp, setTimestamp] = useState(0)
  const [paused, setPaused] = useState(false)
  const [cameraMode, setCameraMode] = useState<CameraMode>('manual')
  const [activeFocusEvent, setActiveFocusEvent] = useState<FocusEvent | null>(
    null,
  )

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  const { 
    match_id: matchId, 
    hz, 
    interval_seconds: intervalSeconds 
  } = matchMetadata

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

  const frame = Math.floor(timestamp * hz)
  const framesPerChunk = Math.max(1, hz * intervalSeconds)
  const chunkIndex = Math.floor(frame / framesPerChunk)
  const chunkCache = useRef<Map<number, ChunkData>>(new Map())

  useEffect(() => {
    if (!matchId) return

    async function ensureChunkLoaded(nextChunkIndex: number) {
      if (nextChunkIndex < 0 || chunkCache.current.has(nextChunkIndex)) return

      const params = new URLSearchParams({
        matchId,
        chunkIndex: nextChunkIndex.toString(),
      })
      const response = await fetch(`/api/replay/movement-chunk?${params}`)
      if (!response.ok) {
        console.error('Failed to fetch movement chunk', await response.text())
        return
      }

      const chunk: ChunkData = await response.json()
      chunkCache.current.set(nextChunkIndex, chunk)
    }

    ensureChunkLoaded(chunkIndex)
    ensureChunkLoaded(chunkIndex + 1)
  }, [chunkIndex, matchId])

  const playerPositions = getDemoPlayers(timestamp)

  function onPlayPauseClick() {
    setPaused((value) => !value)
    lastTimeRef.current = null
  }

  function handleManualCameraOverride() {
    setCameraMode('manual')
    setActiveFocusEvent(null)
  }

  function handleDemoFocusEvent() {
    setTimestamp(18)
    setPaused(false)
    setCameraMode('follow-event')
    setActiveFocusEvent({
      label: 'Demo elimination focus',
      playerIds: ['alpha', 'bravo'],
      startTime: 18,
    })
    lastTimeRef.current = null
  }

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-white shadow-2xl"
      data-map-id={mapId}
    >
      <ReplayViewport
        stageWidth={stageWidth}
        stageHeight={stageHeight}
        playerPositions={playerPositions}
        cameraMode={cameraMode}
        activeFocusEvent={activeFocusEvent}
        onManualCameraOverride={handleManualCameraOverride}
      />
      <ReplayControls
        onPlayPauseClick={onPlayPauseClick}
        onDemoFocusEvent={handleDemoFocusEvent}
        timestamp={timestamp}
        paused={paused}
        cameraMode={cameraMode}
        activeFocusLabel={activeFocusEvent?.label ?? null}
      />
    </div>
  )
}

function ReplayViewport({
  stageWidth,
  stageHeight,
  playerPositions,
  cameraMode,
  activeFocusEvent,
  onManualCameraOverride,
}: {
  stageWidth: number
  stageHeight: number
  playerPositions: DemoPlayer[]
  cameraMode: CameraMode
  activeFocusEvent: FocusEvent | null
  onManualCameraOverride: () => void
}) {
  const [mapImage] = useImage('/maps/v39/02/39.02.png')
  const stageRef = useRef<Konva.Stage>(null)

  useEffect(() => {
    if (!mapImage || !stageRef.current) return

    const stage = stageRef.current
    const scale = Math.min(stageWidth / mapImage.width, stageHeight / mapImage.height)

    stage.scale({ x: scale, y: scale })
    stage.position({
      x: stageWidth / 2,
      y: stageHeight / 2,
    })
    stage.batchDraw()
  }, [mapImage, stageHeight, stageWidth])

  useEffect(() => {
    if (
      !mapImage ||
      !stageRef.current ||
      cameraMode !== 'follow-event' ||
      !activeFocusEvent
    ) {
      return
    }

    const focusedPlayers = playerPositions.filter((player) =>
      activeFocusEvent.playerIds.includes(player.id),
    )
    if (!focusedPlayers.length) return

    const targetTransform = getFocusTransform({
      stageWidth,
      stageHeight,
      mapWidth: mapImage.width,
      mapHeight: mapImage.height,
      focusedPlayers,
    })

    const stage = stageRef.current
    const nextScale =
      stage.scaleX() +
      (targetTransform.scale - stage.scaleX()) * CAMERA_LERP
    const nextX = stage.x() + (targetTransform.x - stage.x()) * CAMERA_LERP
    const nextY = stage.y() + (targetTransform.y - stage.y()) * CAMERA_LERP

    stage.scale({ x: nextScale, y: nextScale })
    stage.position({ x: nextX, y: nextY })
    stage.batchDraw()
  }, [
    activeFocusEvent,
    cameraMode,
    mapImage,
    playerPositions,
    stageHeight,
    stageWidth,
  ])

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    onManualCameraOverride()

    const stage = stageRef.current
    if (!stage) return

    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const scaleBy = 1.1
    const direction = e.evt.deltaY < 0 ? 1 : -1
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    newScale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE))

    stage.scale({ x: newScale, y: newScale })
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
    stage.batchDraw()
  }

  function handlePointerDown() {
    if (cameraMode === 'follow-event') {
      onManualCameraOverride()
    }
  }

  if (!mapImage) return null

  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const stage = stageRef.current
    if (!stage) return pos

    const scale = stage.scaleX()
    const mapWidth = mapImage.width * scale
    const mapHeight = mapImage.height * scale
    const minX = stageWidth / 2 - mapWidth / 2
    const maxX = stageWidth / 2 + mapWidth / 2
    const minY = stageHeight / 2 - mapHeight / 2
    const maxY = stageHeight / 2 + mapHeight / 2

    return {
      x: Math.min(maxX, Math.max(minX, pos.x)),
      y: Math.min(maxY, Math.max(minY, pos.y)),
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        draggable
        dragBoundFunc={dragBoundFunc}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onDragStart={handlePointerDown}
      >
        <Layer>
          <KonvaImage
            image={mapImage}
            offsetX={mapImage.width / 2}
            offsetY={mapImage.height / 2}
          />

          {playerPositions.map((player) => {
            const playerX = player.x - mapImage.width / 2
            const playerY = player.y - mapImage.height / 2
            const arrowLength = 36
            const arrowX = Math.cos(player.heading) * arrowLength
            const arrowY = Math.sin(player.heading) * arrowLength

            return (
              <CircleAndArrow
                key={player.id}
                x={playerX}
                y={playerY}
                arrowX={arrowX}
                arrowY={arrowY}
                color={player.color}
                label={player.label}
              />
            )
          })}

          <Text
            x={16}
            y={16}
            text={`camera: ${cameraMode}`}
            fill="white"
            fontSize={18}
          />
          <Text
            x={16}
            y={40}
            text={activeFocusEvent ? activeFocusEvent.label : 'manual camera'}
            fill="#d4d4d8"
            fontSize={14}
          />
        </Layer>
      </Stage>
    </div>
  )
}

function CircleAndArrow({
  x,
  y,
  arrowX,
  arrowY,
  color,
  label,
}: {
  x: number
  y: number
  arrowX: number
  arrowY: number
  color: string
  label: string
}) {
  return (
    <>
      <Arrow
        x={x}
        y={y}
        points={[0, 0, arrowX, arrowY]}
        pointerLength={10}
        pointerWidth={8}
        fill={color}
        stroke={color}
        strokeWidth={4}
      />
      <Circle x={x} y={y} radius={7} fill={color} stroke="white" strokeWidth={2} />
      <Text
        x={x + 12}
        y={y - 10}
        text={label}
        fill="white"
        fontSize={16}
        stroke="black"
        strokeWidth={0.3}
      />
    </>
  )
}

function ReplayControls({
  onPlayPauseClick,
  onDemoFocusEvent,
  timestamp,
  paused,
  cameraMode,
  activeFocusLabel,
}: {
  onPlayPauseClick: () => void
  onDemoFocusEvent: () => void
  timestamp: number
  paused: boolean
  cameraMode: CameraMode
  activeFocusLabel: string | null
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900"
          onClick={onPlayPauseClick}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
        <button
          className="rounded bg-lime-400 px-3 py-2 text-sm font-medium text-zinc-900"
          onClick={onDemoFocusEvent}
        >
          Focus Demo Event
        </button>
      </div>

      <div className="text-right text-sm text-zinc-200">
        <div>time: {timestamp.toFixed(2)}s</div>
        <div>camera: {cameraMode}</div>
        <div>{activeFocusLabel ?? 'no active focus event'}</div>
      </div>
    </div>
  )
}

function getFocusTransform({
  stageWidth,
  stageHeight,
  mapWidth,
  mapHeight,
  focusedPlayers,
}: {
  stageWidth: number
  stageHeight: number
  mapWidth: number
  mapHeight: number
  focusedPlayers: DemoPlayer[]
}) {
  const padding = 140
  const xs = focusedPlayers.map((player) => player.x)
  const ys = focusedPlayers.map((player) => player.y)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const contentWidth = Math.max(160, maxX - minX)
  const contentHeight = Math.max(160, maxY - minY)
  const scaleX = (stageWidth - padding * 2) / contentWidth
  const scaleY = (stageHeight - padding * 2) / contentHeight
  const scale = Math.max(
    MIN_SCALE,
    Math.min(MAX_SCALE, Math.min(scaleX, scaleY)),
  )

  const focusCenterX = (minX + maxX) / 2
  const focusCenterY = (minY + maxY) / 2
  const worldX = focusCenterX - mapWidth / 2
  const worldY = focusCenterY - mapHeight / 2

  return {
    scale,
    x: stageWidth / 2 - worldX * scale,
    y: stageHeight / 2 - worldY * scale,
  }
}

function getDemoPlayers(timestamp: number): DemoPlayer[] {
  return [
    {
      id: 'alpha',
      label: 'Alpha',
      color: '#ef4444',
      x: 1180 + Math.cos(timestamp * 0.35) * 220,
      y: 1450 + Math.sin(timestamp * 0.45) * 180,
      heading: timestamp * 0.8,
    },
    {
      id: 'bravo',
      label: 'Bravo',
      color: '#38bdf8',
      x: 1320 + Math.cos(timestamp * 0.42 + 1.2) * 210,
      y: 1520 + Math.sin(timestamp * 0.38 + 0.6) * 160,
      heading: timestamp * 0.9 + 0.8,
    },
    {
      id: 'charlie',
      label: 'Charlie',
      color: '#facc15',
      x: 1940 + Math.cos(timestamp * 0.18) * 480,
      y: 930 + Math.sin(timestamp * 0.2) * 260,
      heading: timestamp * 0.6 + 1.5,
    },
  ]
}

export default ReplayClient
