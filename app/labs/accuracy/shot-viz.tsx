'use client'

// ---------------------------------------------------------------------------
// Interactive 3D viewer for the accuracy algorithm's shot geometry.
//
// A demo is a navigable series of shots; each shot renders the exact geometry
// the algorithm evaluated: distance-scaled hitbox spheres (team-coloured, with
// the shooter in a white glow and the algorithm's target in a red glow), the
// shot as an orange tracer plus an infinite ray, and a plane standing in for
// whatever stopped a missed bullet (build / terrain).
//
// The whole thing shares the PyVista renderer's look and the same scene JSON.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Html, Grid } from '@react-three/drei'
import * as THREE from 'three'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import type { Demo, ShotScene, PlayerNode, Vec3 } from './types'

// --- palette (mirrors viz/render_pyvista.py) -------------------------------- #
const BG = '#0a0e17'
const ACTOR_HL = '#f5f7ff'
const RECIPIENT_HL = '#ff3b6b'
const TRACER = '#ff8a3d'
const RAY = '#46597c'
const BUILD = '#8fa3bf'
const TERRAIN = '#b8975a'
const TEAM_PALETTE = [
  '#4dd2ff', '#c084fc', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#a3e635', '#fb923c', '#22d3ee', '#e879f9',
  '#2dd4bf', '#f87171', '#818cf8', '#facc15', '#4ade80',
]

type Transform = (p: Vec3) => THREE.Vector3

function makeTransform(demoOrigin: Vec3, scale: number): Transform {
  // Fortnite is Z-up; map to three's Y-up: (x, z, y). Recentre on the demo's
  // shared origin so the coordinate frame is stable across shots.
  const [ox, oy, oz] = demoOrigin
  return ([x, y, z]) =>
    new THREE.Vector3((x - ox) * scale, (z - oz) * scale, (y - oy) * scale)
}

function teamColorMap(demo: Demo): Map<number, string> {
  const teams = new Set<number>()
  demo.shots.forEach((s) => s.players.forEach((p) => teams.add(p.team)))
  const sorted = [...teams].sort((a, b) => a - b)
  const map = new Map<number, string>()
  sorted.forEach((t, i) => map.set(t, TEAM_PALETTE[i % TEAM_PALETTE.length]))
  return map
}

function cleanWeapon(id: string): string {
  return id.replace('WID_', '').replace('_Athena', '').replace(/_/g, ' ').trim()
}

function recipientLoc(shot: ShotScene): Vec3 {
  const r = shot.players.find((p) => p.is_recipient)
  return r ? r.location : shot.impact
}

// A camera placed behind and above the shooter, looking down-range — the
// in-game replay angle.
function overShoulder(shot: ShotScene, tf: Transform) {
  const shooter = tf(shot.origin)
  const target = tf(recipientLoc(shot))
  const up = new THREE.Vector3(0, 1, 0)
  const fwd = target.clone().sub(shooter)
  fwd.y = 0
  if (fwd.lengthSq() === 0) fwd.set(1, 0, 0)
  fwd.normalize()
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize()
  const dist = Math.max(shooter.distanceTo(target), 10)
  const pos = shooter
    .clone()
    .addScaledVector(fwd, -dist * 0.75)
    .addScaledVector(up, dist * 0.52)
    .addScaledVector(right, dist * 0.38)
  const target3 = shooter.clone().lerp(target, 0.5)
  return { pos, target: target3 }
}

// --------------------------------------------------------------------------- #
// per-player render data
// --------------------------------------------------------------------------- #
interface PNode {
  key: string
  username: string
  pos: THREE.Vector3
  radius: number
  color: string
  coreColor: string
  halo: string | null
  baseOpacity: number
  flareOpacity: number
  entryDist: number // metres along the ray where the tracer enters (or Inf)
  labelY: number
}

function buildNodes(
  shot: ShotScene,
  tf: Transform,
  teamColors: Map<number, string>,
  scale: number,
  opts: { neighborhood: number; showOccluded: boolean },
): PNode[] {
  const out: PNode[] = []
  for (const p of shot.players) {
    const near = p.dist_to_actor <= opts.neighborhood * 100
    if (!(p.is_actor || p.is_recipient || near)) continue
    if (p.occluded && p.is_opponent && !p.is_recipient && !opts.showOccluded) continue

    const team = teamColors.get(p.team) ?? '#888'
    const radius = p.is_actor ? 1.5 : (p.radius ?? 200) * scale

    let baseOpacity: number
    let flareOpacity: number
    let coreColor = team
    let halo: string | null = null
    if (p.is_actor) {
      baseOpacity = 0.95
      flareOpacity = 0.95
      coreColor = ACTOR_HL
      halo = ACTOR_HL
    } else if (p.is_recipient) {
      baseOpacity = 0.5
      flareOpacity = 0.85
      halo = RECIPIENT_HL
    } else if (p.is_opponent) {
      baseOpacity = p.occluded ? 0.12 : 0.28
      flareOpacity = p.occluded ? 0.12 : 0.55
    } else {
      baseOpacity = 0.12
      flareOpacity = 0.12
    }

    const flareEligible = p.is_opponent && p.ray_hits_hitbox && p.entry_t != null
    const entryDist = flareEligible ? (p.entry_t as number) * scale : Infinity

    out.push({
      key: p.epic_id,
      username: p.username,
      pos: tf(p.location),
      radius,
      color: team,
      coreColor,
      halo,
      baseOpacity,
      flareOpacity,
      entryDist,
      labelY: radius + 0.6,
    })
  }
  return out
}

// --------------------------------------------------------------------------- #
// 3D primitives
// --------------------------------------------------------------------------- #
function ImpactPlane({ shot, tf, scale }: { shot: ShotScene; tf: Transform; scale: number }) {
  const bp = shot.build_plane
  const { position, quaternion, size, color } = useMemo(() => {
    if (!bp) return { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), size: 0, color: BUILD }
    const position = tf(bp.center)
    // normal is a direction: rotate but don't translate.
    const n = new THREE.Vector3(bp.normal[0], bp.normal[2], bp.normal[1]).normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
    return {
      position, quaternion, size: bp.size * scale,
      color: shot.impact_kind === 'terrain' ? TERRAIN : BUILD,
    }
  }, [bp, tf, scale, shot.impact_kind])
  if (!bp) return null
  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={color} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[size, size, 8, 8]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

// --------------------------------------------------------------------------- #
// Scene (per-frame animation of the tracer + hitbox flares)
// --------------------------------------------------------------------------- #
function Scene({
  shot, tf, scale, teamColors, opts, playing, replayNonce, onComplete,
}: {
  shot: ShotScene
  tf: Transform
  scale: number
  teamColors: Map<number, string>
  opts: { neighborhood: number; showOccluded: boolean; showLabels: boolean; gridlines: boolean }
  playing: boolean
  replayNonce: number
  onComplete: () => void
}) {
  const nodes = useMemo(
    () => buildNodes(shot, tf, teamColors, scale, opts),
    [shot, tf, teamColors, scale, opts.neighborhood, opts.showOccluded],
  )
  const origin = useMemo(() => tf(shot.origin), [shot, tf])
  const dir = useMemo(() => {
    const d = new THREE.Vector3(shot.direction[0], shot.direction[2], shot.direction[1])
    return d.normalize()
  }, [shot])
  const travel = shot.dist_to_impact * scale
  const rayLen = Math.max(travel * 2.5, 80)

  const groundY = useMemo(() => {
    let m = Infinity
    nodes.forEach((n) => { m = Math.min(m, n.pos.y - n.radius) })
    return Number.isFinite(m) ? m : origin.y - 1.5
  }, [nodes, origin])

  // orientation of the tracer tube (its local +Y aligns with the shot dir);
  // the tube grows from the origin to the bullet each frame.
  const tracerQuat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
    [dir],
  )

  const bulletRef = useRef<THREE.Mesh>(null)
  const tracerRef = useRef<THREE.Mesh>(null)
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const tRef = useRef(0)
  const doneRef = useRef(false)

  useEffect(() => {
    matRefs.current = new Array(nodes.length).fill(null)
  }, [nodes.length])

  useEffect(() => {
    tRef.current = 0
    doneRef.current = false
  }, [shot, replayNonce])

  useFrame((_, delta) => {
    const travelDur = 1.1
    const holdDur = 0.7
    tRef.current += Math.min(delta, 0.05)
    const frac = Math.min(tRef.current / travelDur, 1)
    const dist = travel * frac
    if (bulletRef.current) {
      bulletRef.current.position.copy(origin).addScaledVector(dir, dist)
      bulletRef.current.visible = frac < 1
    }
    // grow the thick tracer from the origin up to the bullet (only the path
    // already travelled is highlighted).
    if (tracerRef.current) {
      tracerRef.current.position.copy(origin).addScaledVector(dir, dist / 2)
      tracerRef.current.scale.y = Math.max(dist, 1e-3)
    }
    nodes.forEach((n, i) => {
      const mat = matRefs.current[i]
      if (!mat) return
      mat.opacity = dist >= n.entryDist ? n.flareOpacity : n.baseOpacity
    })
    if (!doneRef.current && tRef.current >= travelDur + (playing ? holdDur : 0)) {
      doneRef.current = true
      if (playing) onComplete()
    }
  })

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#8ea6c8', '#0a0e17', 0.5]} />
      <directionalLight position={[30, 60, 20]} intensity={0.7} />
      <directionalLight position={[-40, 30, -30]} intensity={0.3} />

      {/* players */}
      {nodes.map((n, i) => (
        <group key={n.key}>
          <mesh position={n.pos}>
            <sphereGeometry args={[n.radius, 32, 24]} />
            <meshStandardMaterial
              ref={(el) => { matRefs.current[i] = el as THREE.MeshStandardMaterial | null }}
              color={n.color} transparent opacity={n.baseOpacity}
              depthWrite={false} roughness={0.55} metalness={0} />
          </mesh>
          <mesh position={n.pos}>
            <sphereGeometry args={[Math.max(n.radius * 0.12, 0.4), 16, 12]} />
            <meshBasicMaterial color={n.coreColor} />
          </mesh>
          {n.halo && (
            <mesh position={n.pos}>
              <sphereGeometry args={[n.radius * 1.18, 24, 18]} />
              <meshBasicMaterial color={n.halo} transparent opacity={0.16} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}

      {/* infinite ray + tracer + bullet + origin */}
      <Line
        points={[origin.clone().addScaledVector(dir, -rayLen), origin.clone().addScaledVector(dir, rayLen)]}
        color={RAY} lineWidth={1} transparent opacity={0.7} />
      {/* thick tracer, grown from the origin to the bullet in useFrame */}
      <mesh ref={tracerRef} quaternion={tracerQuat}>
        <cylinderGeometry args={[0.18, 0.18, 1, 16]} />
        <meshBasicMaterial color={TRACER} />
      </mesh>
      <mesh position={origin}>
        <sphereGeometry args={[0.9, 20, 16]} />
        <meshBasicMaterial color={TRACER} />
      </mesh>
      <mesh ref={bulletRef}>
        <sphereGeometry args={[0.38, 16, 12]} />
        <meshBasicMaterial color={TRACER} />
      </mesh>

      <ImpactPlane shot={shot} tf={tf} scale={scale} />

      {/* labels */}
      {opts.showLabels && nodes.map((n) => (
        <Html key={`l-${n.key}`} position={[n.pos.x, n.pos.y + n.labelY, n.pos.z]} center distanceFactor={40} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap select-none text-[11px] leading-none text-slate-200/85 drop-shadow">
            {n.username}
          </div>
        </Html>
      ))}

      {opts.gridlines && (
        <Grid
          position={[origin.x, groundY, origin.z]}
          args={[10, 10]} infiniteGrid cellSize={2} sectionSize={20}
          cellColor="#46618c" sectionColor="#6f93c9"
          cellThickness={1} sectionThickness={1.6}
          fadeDistance={280} fadeStrength={1}
        />
      )}
    </>
  )
}

function CameraRig({
  shot, tf, resetNonce, controls,
}: { shot: ShotScene; tf: Transform; resetNonce: number; controls: React.MutableRefObject<any> }) {
  const { camera } = useThree()
  useEffect(() => {
    const { pos, target } = overShoulder(shot, tf)
    camera.position.copy(pos)
    if (controls.current) {
      controls.current.target.copy(target)
      controls.current.update()
    } else {
      camera.lookAt(target)
    }
    // only when the user asks to reset (or the demo first mounts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce])
  return null
}

// --------------------------------------------------------------------------- #
// Top-level viewer with overlay UI
// --------------------------------------------------------------------------- #
export default function ShotViz({ demo }: { demo: Demo }) {
  const [shotIndex, setShotIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [replayNonce, setReplayNonce] = useState(0)
  const [resetNonce, setResetNonce] = useState(0)
  const [neighborhood, setNeighborhood] = useState(250)
  const [showLabels, setShowLabels] = useState(true)
  const [showOccluded, setShowOccluded] = useState(true)
  const [gridlines, setGridlines] = useState(true)
  const controls = useRef<any>(null)

  const tf = useMemo(() => makeTransform(demo.demo_origin, demo.scale), [demo])
  const teamColors = useMemo(() => teamColorMap(demo), [demo])
  const shot = demo.shots[shotIndex]
  const initialCam = useMemo(() => overShoulder(demo.shots[0], tf), [demo, tf])

  // Running accuracy over the shots seen so far (up to and including the current
  // one). A shot is an "attempt" if it hit a player or was attributed to one;
  // "hits" are the direct hits. Accuracy = hits / attempts — 4/6 = 66.7% here.
  const stats = useMemo(() => {
    let attempts = 0
    let hits = 0
    for (let i = 0; i <= shotIndex; i++) {
      const s = demo.shots[i]
      if (s.direct_hit || s.recipient_id != null) {
        attempts++
        if (s.direct_hit) hits++
      }
    }
    return { attempts, hits, misses: attempts - hits, acc: attempts ? (hits / attempts) * 100 : 0 }
  }, [demo, shotIndex])

  const goto = (i: number) => {
    setShotIndex(((i % demo.shots.length) + demo.shots.length) % demo.shots.length)
    setReplayNonce((n) => n + 1)
  }

  const opts = { neighborhood, showOccluded, showLabels, gridlines }
  const outcome = shot.direct_hit
    ? 'Direct hit'
    : shot.recipient_id
      ? `Miss (${shot.impact_kind}) → counted`
      : `Miss (${shot.impact_kind}) → stray`
  const outcomeColor = shot.direct_hit
    ? 'text-emerald-300'
    : shot.recipient_id ? 'text-amber-300' : 'text-slate-400'

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#0a0e17]">
      <Canvas
        camera={{ position: initialCam.pos.toArray(), fov: 45, near: 0.1, far: 5000 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[BG]} />
        <Scene
          shot={shot} tf={tf} scale={demo.scale} teamColors={teamColors}
          opts={opts} playing={playing} replayNonce={replayNonce}
          onComplete={() => goto(shotIndex + 1)}
        />
        <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12}
          maxDistance={800} minDistance={2} />
        <CameraRig shot={shot} tf={tf} resetNonce={resetNonce} controls={controls} />
      </Canvas>

      {/* --- top-left: shot info --------------------------------------------- */}
      <Card className="absolute left-4 top-4 max-w-xs gap-1 border-white/10 bg-black/55 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{demo.title}</div>
          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Shot {shotIndex + 1}</span>
        </div>
        <div className="text-lg font-semibold">{shot.actor_username}</div>
        <div className="font-mono text-xs text-muted-foreground">{cleanWeapon(shot.weapon_id)} · t={shot.game_time_seconds.toFixed(2)}s</div>
        <div className={`mt-1 text-sm font-medium ${outcomeColor}`}>{outcome}</div>
        {shot.recipient_username && (
          <div className="mt-1 text-sm">
            <span className="text-muted-foreground">target </span>
            <span className="font-medium">{shot.recipient_username}</span>
            <span className="text-muted-foreground"> · {(shot.dist_to_impact * demo.scale).toFixed(1)} m</span>
            {shot.passing_distance != null && (
              <span className="text-muted-foreground"> · off-center {(shot.passing_distance * demo.scale).toFixed(2)} m</span>
            )}
          </div>
        )}
      </Card>

      {/* --- top-center: running accuracy ----------------------------------- */}
      <Card className="absolute left-1/2 top-4 -translate-x-1/2 flex-row items-center gap-4 border-white/10 bg-black/55 px-5 py-3 backdrop-blur">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Accuracy</div>
          <div className="text-2xl font-bold tabular-nums leading-tight">{stats.acc.toFixed(1)}%</div>
        </div>
        <div className="flex flex-col gap-0.5 text-xs leading-tight">
          <span><span className="font-semibold tabular-nums text-emerald-300">{stats.hits}</span> <span className="text-muted-foreground">hits</span></span>
          <span><span className="font-semibold tabular-nums text-amber-300">{stats.misses}</span> <span className="text-muted-foreground">misses</span></span>
          <span className="text-muted-foreground"><span className="tabular-nums">{stats.attempts}</span> attempts</span>
        </div>
      </Card>

      {/* --- top-right: options --------------------------------------------- */}
      <Card className="absolute right-4 top-4 w-56 gap-3 border-white/10 bg-black/55 p-4 backdrop-blur">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={gridlines} onCheckedChange={(v) => setGridlines(!!v)} /> Gridlines</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={showLabels} onCheckedChange={(v) => setShowLabels(!!v)} /> Labels</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={showOccluded} onCheckedChange={(v) => setShowOccluded(!!v)} /> Occluded players</label>
        <div className="mt-1">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Range shown</span><span>{neighborhood} m</span></div>
          <Slider value={[neighborhood]} min={30} max={300} step={10} onValueChange={(v) => setNeighborhood(v[0])} />
        </div>
        <Button variant="secondary" size="sm" className="mt-1" onClick={() => setResetNonce((n) => n + 1)}>Reset view</Button>
      </Card>

      {/* --- legend --------------------------------------------------------- */}
      <div className="absolute bottom-24 left-4 flex flex-col gap-1 rounded-md border border-white/10 bg-black/45 p-3 text-xs backdrop-blur">
        <LegendDot color={ACTOR_HL} label="shooter" />
        <LegendDot color={RECIPIENT_HL} label="algorithm's target" />
        <LegendDot color={TRACER} label="shot / tracer" />
        <LegendDot color={BUILD} label="build" />
        <LegendDot color={TERRAIN} label="terrain" />
      </div>

      {/* --- bottom: transport ---------------------------------------------- */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/55 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => { setPlaying(false); goto(shotIndex - 1) }}>‹ Prev</Button>
        <Button size="sm" onClick={() => { setPlaying((p) => !p); setReplayNonce((n) => n + 1) }}>
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setPlaying(false); goto(shotIndex + 1) }}>Next ›</Button>
        <div className="mx-1 flex items-center gap-1.5">
          {demo.shots.map((_, i) => (
            <button
              key={i}
              onClick={() => { setPlaying(false); goto(i) }}
              className={`h-2 w-2 rounded-full transition ${i === shotIndex ? 'bg-primary' : 'bg-white/25 hover:bg-white/50'}`}
              aria-label={`shot ${i + 1}`}
            />
          ))}
        </div>
        <span className="font-mono text-xs text-muted-foreground">{shotIndex + 1}/{demo.shots.length}</span>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-300">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  )
}
