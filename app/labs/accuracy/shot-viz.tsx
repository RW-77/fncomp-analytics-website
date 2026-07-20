'use client'

// ---------------------------------------------------------------------------
// Interactive 3D viewer for the accuracy algorithm's shot geometry.
//
// A demo is one continuous timeline: players glide along their movement tracks,
// and as playback crosses each shot's timestamp the shot fires (tracer + ray +
// impact plane + red-glow on the algorithm's target). Pause on a shot (Prev /
// Next / a marker) to switch into the detailed per-shot view — every evaluated
// hitbox, distance-scaled and dimmed when occluded.
//
// Shares the PyVista renderer's look and the same scene JSON + movement tracks.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Html, Grid } from '@react-three/drei'
import * as THREE from 'three'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import type { Demo, ShotScene, Vec3 } from './types'

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
const BODY_R = 1.6          // fixed body-sphere radius during movement (m)
const FREEZE_DUR = 1.0      // real seconds the timeline freezes on each shot
const FIRE_BULLET_REAL = 0.16  // real seconds for the tracer to travel during a freeze

type Transform = (p: Vec3) => THREE.Vector3

function makeTransform(demoOrigin: Vec3, scale: number): Transform {
  // Fortnite is Z-up; map to three's Y-up: (x, z, y). Recentre on the demo's
  // shared origin so the coordinate frame is stable across the whole timeline.
  const [ox, oy, oz] = demoOrigin
  return ([x, y, z]) =>
    new THREE.Vector3((x - ox) * scale, (z - oz) * scale, (y - oy) * scale)
}

function teamColorMap(demo: Demo): Map<number, string> {
  const teams = new Set<number>()
  demo.shots.forEach((s) => s.players.forEach((p) => teams.add(p.team)))
  demo.tracks.forEach((t) => teams.add(t.team))
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

// Camera behind and above the shooter, looking down-range — the replay angle.
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
  const pos = shooter.clone()
    .addScaledVector(fwd, -dist * 0.75)
    .addScaledVector(up, dist * 0.52)
    .addScaledVector(right, dist * 0.38)
  return { pos, target: shooter.clone().lerp(target, 0.5) }
}

// --------------------------------------------------------------------------- #
// Detailed per-shot geometry (shown when parked on a shot)
// --------------------------------------------------------------------------- #
interface PNode {
  key: string; username: string; pos: THREE.Vector3; radius: number
  color: string; coreColor: string; halo: string | null
  baseOpacity: number; flareOpacity: number; entryDist: number; labelY: number
}

function buildNodes(
  shot: ShotScene, tf: Transform, teamColors: Map<number, string>, scale: number,
  opts: { neighborhood: number; showOccluded: boolean },
): PNode[] {
  const out: PNode[] = []
  for (const p of shot.players) {
    const near = p.dist_to_actor <= opts.neighborhood * 100
    if (!(p.is_actor || p.is_recipient || near)) continue
    if (p.occluded && p.is_opponent && !p.is_recipient && !opts.showOccluded) continue

    const team = teamColors.get(p.team) ?? '#888'
    const radius = p.is_actor ? BODY_R : (p.radius ?? 200) * scale
    let baseOpacity: number, flareOpacity: number
    let coreColor = team, halo: string | null = null
    if (p.is_actor) { baseOpacity = 0.95; flareOpacity = 0.95; coreColor = ACTOR_HL; halo = ACTOR_HL }
    else if (p.is_recipient) { baseOpacity = 0.5; flareOpacity = 0.85; halo = RECIPIENT_HL }
    else if (p.is_opponent) { baseOpacity = p.occluded ? 0.12 : 0.28; flareOpacity = p.occluded ? 0.12 : 0.55 }
    else { baseOpacity = 0.12; flareOpacity = 0.12 }

    const flareEligible = p.is_opponent && p.ray_hits_hitbox && p.entry_t != null
    out.push({
      key: p.epic_id, username: p.username, pos: tf(p.location), radius,
      color: team, coreColor, halo, baseOpacity, flareOpacity,
      entryDist: flareEligible ? (p.entry_t as number) * scale : Infinity,
      labelY: radius + 0.6,
    })
  }
  return out
}

function ImpactPlane({ shot, tf, scale }: { shot: ShotScene; tf: Transform; scale: number }) {
  const bp = shot.build_plane
  const data = useMemo(() => {
    if (!bp) return null
    const n = new THREE.Vector3(bp.normal[0], bp.normal[2], bp.normal[1]).normalize()
    return {
      position: tf(bp.center),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n),
      size: bp.size * scale,
      color: shot.impact_kind === 'terrain' ? TERRAIN : BUILD,
    }
  }, [bp, tf, scale, shot.impact_kind])
  if (!data) return null
  return (
    <group position={data.position} quaternion={data.quaternion}>
      <mesh>
        <planeGeometry args={[data.size, data.size]} />
        <meshStandardMaterial color={data.color} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[data.size, data.size, 8, 8]} />
        <meshBasicMaterial color={data.color} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

function DetailScene({
  shot, tf, scale, teamColors, opts, replayNonce,
}: {
  shot: ShotScene; tf: Transform; scale: number; teamColors: Map<number, string>
  opts: { neighborhood: number; showOccluded: boolean; showLabels: boolean }; replayNonce: number
}) {
  const nodes = useMemo(() => buildNodes(shot, tf, teamColors, scale, opts),
    [shot, tf, teamColors, scale, opts.neighborhood, opts.showOccluded])
  const origin = useMemo(() => tf(shot.origin), [shot, tf])
  const dir = useMemo(() => new THREE.Vector3(shot.direction[0], shot.direction[2], shot.direction[1]).normalize(), [shot])
  const tracerQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), [dir])
  const travel = shot.dist_to_impact * scale
  const rayLen = Math.max(travel * 2.5, 80)

  const bulletRef = useRef<THREE.Mesh>(null)
  const tracerRef = useRef<THREE.Mesh>(null)
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const tRef = useRef(0)
  useEffect(() => { matRefs.current = new Array(nodes.length).fill(null) }, [nodes.length])
  useEffect(() => { tRef.current = 0 }, [shot, replayNonce])

  useFrame((_, delta) => {
    tRef.current += Math.min(delta, 0.05)
    const frac = Math.min(tRef.current / 1.1, 1)
    const dist = travel * frac
    if (bulletRef.current) { bulletRef.current.position.copy(origin).addScaledVector(dir, dist); bulletRef.current.visible = frac < 1 }
    if (tracerRef.current) { tracerRef.current.position.copy(origin).addScaledVector(dir, dist / 2); tracerRef.current.scale.y = Math.max(dist, 1e-3) }
    nodes.forEach((n, i) => { const m = matRefs.current[i]; if (m) m.opacity = dist >= n.entryDist ? n.flareOpacity : n.baseOpacity })
  })

  return (
    <>
      {nodes.map((n, i) => (
        <group key={n.key}>
          <mesh position={n.pos}>
            <sphereGeometry args={[n.radius, 32, 24]} />
            <meshStandardMaterial ref={(el) => { matRefs.current[i] = el as THREE.MeshStandardMaterial | null }}
              color={n.color} transparent opacity={n.baseOpacity} depthWrite={false} roughness={0.55} metalness={0} />
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

      <Line points={[origin.clone().addScaledVector(dir, -rayLen), origin.clone().addScaledVector(dir, rayLen)]}
        color={RAY} lineWidth={1} transparent opacity={0.7} />
      <mesh ref={tracerRef} quaternion={tracerQuat}>
        <cylinderGeometry args={[0.18, 0.18, 1, 16]} />
        <meshBasicMaterial color={TRACER} />
      </mesh>
      <mesh position={origin}><sphereGeometry args={[0.9, 20, 16]} /><meshBasicMaterial color={TRACER} /></mesh>
      <mesh ref={bulletRef}><sphereGeometry args={[0.38, 16, 12]} /><meshBasicMaterial color={TRACER} /></mesh>

      <ImpactPlane shot={shot} tf={tf} scale={scale} />

      {opts.showLabels && nodes.map((n) => (
        <Html key={`l-${n.key}`} position={[n.pos.x, n.pos.y + n.labelY, n.pos.z]} center distanceFactor={40} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap select-none text-[11px] leading-none text-slate-200/85 drop-shadow">{n.username}</div>
        </Html>
      ))}
    </>
  )
}

// --------------------------------------------------------------------------- #
// Continuous movement layer (players gliding along their tracks)
// --------------------------------------------------------------------------- #
function MovementLayer({
  demo, tf, teamColors, tRef, neighborhood, showLabels,
}: {
  demo: Demo; tf: Transform; teamColors: Map<number, string>
  tRef: React.MutableRefObject<number>; neighborhood: number; showLabels: boolean
}) {
  const actorId = demo.shots[0].actor_id
  const tracks = useMemo(() => {
    const [ox, oy, oz] = demo.demo_origin
    const rCm = neighborhood * 100
    const out = []
    for (const tr of demo.tracks) {
      let minD = Infinity
      for (const s of tr.samples) {
        minD = Math.min(minD, Math.hypot(s[1] - ox, s[2] - oy, s[3] - oz))
      }
      if (minD > rCm) continue
      out.push({
        key: tr.epic_id, username: tr.username,
        color: teamColors.get(tr.team) ?? '#888', isActor: tr.epic_id === actorId,
        times: tr.samples.map((s) => s[0]),
        pts: tr.samples.map((s) => tf([s[1], s[2], s[3]])),
        minT: tr.samples[0][0], maxT: tr.samples[tr.samples.length - 1][0],
      })
    }
    return out
  }, [demo, tf, teamColors, neighborhood, actorId])

  const groupRefs = useRef<(THREE.Group | null)[]>([])
  useEffect(() => { groupRefs.current = new Array(tracks.length).fill(null) }, [tracks.length])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const t = tRef.current
    tracks.forEach((tk, i) => {
      const g = groupRefs.current[i]
      if (!g) return
      if (t < tk.minT - 0.001 || t > tk.maxT + 0.001) { g.visible = false; return }
      g.visible = true
      const times = tk.times
      let j = 1
      while (j < times.length && times[j] < t) j++
      const a = Math.max(0, j - 1), b = Math.min(times.length - 1, j)
      const w = times[b] > times[a] ? (t - times[a]) / (times[b] - times[a]) : 0
      g.position.copy(tmp.copy(tk.pts[a]).lerp(tk.pts[b], w))
    })
  })

  return (
    <>
      {tracks.map((tk, i) => (
        <group key={tk.key} ref={(el) => { groupRefs.current[i] = el }} visible={false}>
          <mesh>
            <sphereGeometry args={[BODY_R, 24, 18]} />
            <meshStandardMaterial color={tk.color} transparent opacity={tk.isActor ? 0.95 : 0.55} depthWrite={false} roughness={0.55} />
          </mesh>
          <mesh>
            <sphereGeometry args={[BODY_R * 0.35, 12, 10]} />
            <meshBasicMaterial color={tk.isActor ? ACTOR_HL : tk.color} />
          </mesh>
          {tk.isActor && (
            <mesh><sphereGeometry args={[BODY_R * 1.5, 20, 16]} /><meshBasicMaterial color={ACTOR_HL} transparent opacity={0.14} depthWrite={false} /></mesh>
          )}
          {showLabels && (
            <Html position={[0, BODY_R + 0.6, 0]} center distanceFactor={40} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div className="whitespace-nowrap select-none text-[11px] leading-none text-slate-200/80 drop-shadow">{tk.username}</div>
            </Html>
          )}
        </group>
      ))}
    </>
  )
}

// A single shot's geometry, shown only while the timeline is frozen on it.
// The victim is highlighted by its actual distance-scaled hitbox (team colour +
// red halo, like the detailed view) — not a separate marker.
function ShotFireItem({
  shot, index, tf, scale, teamColors, frozenShotRef, fireProgressRef,
}: {
  shot: ShotScene; index: number; tf: Transform; scale: number
  teamColors: Map<number, string>
  frozenShotRef: React.MutableRefObject<number | null>
  fireProgressRef: React.MutableRefObject<number>
}) {
  const origin = useMemo(() => tf(shot.origin), [shot, tf])
  const dir = useMemo(() => new THREE.Vector3(shot.direction[0], shot.direction[2], shot.direction[1]).normalize(), [shot])
  const tracerQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), [dir])
  const travel = shot.dist_to_impact * scale
  const rayLen = Math.max(travel * 2.5, 80)
  const victim = useMemo(() => {
    const r = shot.players.find((p) => p.is_recipient)
    return r ? { pos: tf(r.location), radius: r.radius ? r.radius * scale : BODY_R, color: teamColors.get(r.team) ?? '#888' } : null
  }, [shot, tf, scale, teamColors])

  const groupRef = useRef<THREE.Group>(null)
  const bulletRef = useRef<THREE.Mesh>(null)
  const tracerRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    if (frozenShotRef.current !== index) { g.visible = false; return }
    g.visible = true
    const frac = fireProgressRef.current
    const dist = travel * frac
    if (bulletRef.current) { bulletRef.current.position.copy(origin).addScaledVector(dir, dist); bulletRef.current.visible = frac < 1 }
    if (tracerRef.current) { tracerRef.current.position.copy(origin).addScaledVector(dir, dist / 2); tracerRef.current.scale.y = Math.max(dist, 1e-3) }
  })

  return (
    <group ref={groupRef} visible={false}>
      <Line points={[origin.clone().addScaledVector(dir, -rayLen), origin.clone().addScaledVector(dir, rayLen)]}
        color={RAY} lineWidth={1} transparent opacity={0.6} />
      <mesh ref={tracerRef} quaternion={tracerQuat}><cylinderGeometry args={[0.18, 0.18, 1, 16]} /><meshBasicMaterial color={TRACER} /></mesh>
      <mesh position={origin}><sphereGeometry args={[0.9, 16, 12]} /><meshBasicMaterial color={TRACER} /></mesh>
      <mesh ref={bulletRef}><sphereGeometry args={[0.38, 16, 12]} /><meshBasicMaterial color={TRACER} /></mesh>
      {victim && (
        <group position={victim.pos}>
          <mesh>
            <sphereGeometry args={[victim.radius, 28, 20]} />
            <meshStandardMaterial color={victim.color} transparent opacity={0.5} depthWrite={false} roughness={0.55} />
          </mesh>
          <mesh>
            <sphereGeometry args={[victim.radius * 1.14, 24, 18]} />
            <meshBasicMaterial color={RECIPIENT_HL} transparent opacity={0.18} depthWrite={false} />
          </mesh>
        </group>
      )}
      <ImpactPlane shot={shot} tf={tf} scale={scale} />
    </group>
  )
}

// Advances the timeline; freezes FREEZE_DUR real-seconds on each shot as it is
// crossed (so the victim's hitbox can be studied), then resumes.
function TimelineDriver({
  tRef, tRelList, duration, playing, speed, frozenShotRef, fireProgressRef, onPause, onTime,
}: {
  tRef: React.MutableRefObject<number>; tRelList: number[]; duration: number
  playing: boolean; speed: number
  frozenShotRef: React.MutableRefObject<number | null>
  fireProgressRef: React.MutableRefObject<number>
  onPause: () => void; onTime: (t: number) => void
}) {
  const acc = useRef(0)
  const freezeStart = useRef(0)
  useFrame((_, delta) => {
    const now = performance.now() / 1000
    if (frozenShotRef.current != null) {
      const i = frozenShotRef.current
      tRef.current = tRelList[i]
      fireProgressRef.current = Math.min((now - freezeStart.current) / FIRE_BULLET_REAL, 1)
      if (now - freezeStart.current >= FREEZE_DUR || !playing) {
        frozenShotRef.current = null
        tRef.current = tRelList[i] + 1e-4  // step past so it doesn't retrigger
      }
    } else if (playing) {
      const prev = tRef.current
      let next = prev + Math.min(delta, 0.05) * speed
      let cross = -1
      for (let i = 0; i < tRelList.length; i++) {
        if (tRelList[i] > prev && tRelList[i] <= next) { cross = i; break }
      }
      if (cross >= 0) {
        next = tRelList[cross]
        frozenShotRef.current = cross
        freezeStart.current = now
        fireProgressRef.current = 0
      }
      tRef.current = next
      if (next >= duration) onPause()
    }
    acc.current += delta
    if (acc.current > 0.06) { acc.current = 0; onTime(tRef.current) }
  })
  return null
}

function CameraRig({ shot, tf, resetNonce, controls }: {
  shot: ShotScene; tf: Transform; resetNonce: number; controls: React.MutableRefObject<any>
}) {
  const { camera } = useThree()
  useEffect(() => {
    const { pos, target } = overShoulder(shot, tf)
    camera.position.copy(pos)
    if (controls.current) { controls.current.target.copy(target); controls.current.update() }
    else camera.lookAt(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce])
  return null
}

// --------------------------------------------------------------------------- #
// Top-level viewer
// --------------------------------------------------------------------------- #
export default function ShotViz({
  demo, embedded = false, height,
}: {
  demo: Demo
  /** Compact chrome for embedding in a narrow column (e.g. the docs). */
  embedded?: boolean
  /** CSS height; defaults to the viewport on the lab page, 520px when embedded. */
  height?: string
}) {
  const tf = useMemo(() => makeTransform(demo.demo_origin, demo.scale), [demo])
  const teamColors = useMemo(() => teamColorMap(demo), [demo])
  const duration = demo.duration ?? demo.shots[demo.shots.length - 1].t_rel + 0.5
  const groundY = -BODY_R

  const [playing, setPlaying] = useState(true)      // autoplay from the start
  const [speed, setSpeed] = useState(0.1)
  const [parked, setParked] = useState(false)
  const [parkedIndex, setParkedIndex] = useState(0)
  const [tDisplay, setTDisplay] = useState(0)
  const [replayNonce, setReplayNonce] = useState(0)
  const [resetNonce, setResetNonce] = useState(0)
  const [neighborhood, setNeighborhood] = useState(250)
  const [showLabels, setShowLabels] = useState(true)
  const [showOccluded, setShowOccluded] = useState(true)
  const [gridlines, setGridlines] = useState(true)

  const tRef = useRef(0)
  const frozenShotRef = useRef<number | null>(null)
  const fireProgressRef = useRef(0)
  const tRelList = useMemo(() => demo.shots.map((s) => s.t_rel), [demo])
  const controls = useRef<any>(null)
  const initialCam = useMemo(() => overShoulder(demo.shots[0], tf), [demo, tf])

  // which shot the info card / accuracy reflect
  const activeIndex = useMemo(() => {
    if (parked) return parkedIndex
    let idx = 0
    for (let i = 0; i < demo.shots.length; i++) if (demo.shots[i].t_rel <= tDisplay + 0.02) idx = i
    return idx
  }, [parked, parkedIndex, tDisplay, demo])
  const shot = demo.shots[activeIndex]
  const fired = parked ? parkedIndex + 1 : demo.shots.filter((s) => s.t_rel <= tDisplay + 0.02).length

  const stats = useMemo(() => {
    let attempts = 0, hits = 0
    for (let i = 0; i < fired; i++) {
      const s = demo.shots[i]
      if (s.direct_hit || s.recipient_id != null) { attempts++; if (s.direct_hit) hits++ }
    }
    return { attempts, hits, misses: attempts - hits, acc: attempts ? (hits / attempts) * 100 : null }
  }, [demo, fired])

  const gotoShot = (i: number) => {
    const idx = ((i % demo.shots.length) + demo.shots.length) % demo.shots.length
    frozenShotRef.current = null
    tRef.current = demo.shots[idx].t_rel
    setTDisplay(demo.shots[idx].t_rel)
    setParkedIndex(idx)
    setParked(true)
    setPlaying(false)
    setReplayNonce((n) => n + 1)
  }
  const togglePlay = () => {
    if (playing) { setPlaying(false); setParked(false); return }
    frozenShotRef.current = null
    if (parked || tRef.current >= duration - 0.02) tRef.current = 0  // parked -> replay the whole sequence
    setParked(false)
    setPlaying(true)
  }
  const scrub = (v: number) => {
    frozenShotRef.current = null
    tRef.current = v
    setTDisplay(v)
    setPlaying(false)
    setParked(false)
  }

  const outcome = shot.direct_hit ? 'Direct hit'
    : shot.recipient_id ? `Miss (${shot.impact_kind}) → counted` : `Miss (${shot.impact_kind}) → stray`
  const outcomeColor = shot.direct_hit ? 'text-emerald-300' : shot.recipient_id ? 'text-amber-300' : 'text-slate-400'
  const detailOpts = { neighborhood, showOccluded, showLabels }

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#0a0e17] ${embedded ? 'not-prose rounded-xl border border-white/10' : ''}`}
      style={{ height: height ?? (embedded ? '520px' : 'calc(100vh - 3.5rem)') }}
    >
      <Canvas camera={{ position: initialCam.pos.toArray(), fov: 45, near: 0.1, far: 5000 }} gl={{ antialias: true }} dpr={[1, 2]}>
        <color attach="background" args={[BG]} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#8ea6c8', '#0a0e17', 0.5]} />
        <directionalLight position={[30, 60, 20]} intensity={0.7} />
        <directionalLight position={[-40, 30, -30]} intensity={0.3} />

        {parked ? (
          <DetailScene shot={shot} tf={tf} scale={demo.scale} teamColors={teamColors} opts={detailOpts} replayNonce={replayNonce} />
        ) : (
          <>
            <MovementLayer demo={demo} tf={tf} teamColors={teamColors} tRef={tRef} neighborhood={neighborhood} showLabels={showLabels} />
            {demo.shots.map((s, i) => (
              <ShotFireItem key={i} shot={s} index={i} tf={tf} scale={demo.scale} teamColors={teamColors}
                frozenShotRef={frozenShotRef} fireProgressRef={fireProgressRef} />
            ))}
          </>
        )}

        {gridlines && (
          <Grid position={[0, groundY, 0]} args={[10, 10]} infiniteGrid cellSize={2} sectionSize={20}
            cellColor="#46618c" sectionColor="#6f93c9" cellThickness={1} sectionThickness={1.6}
            fadeDistance={280} fadeStrength={1} />
        )}

        <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} maxDistance={800} minDistance={2} />
        <CameraRig shot={shot} tf={tf} resetNonce={resetNonce} controls={controls} />
        <TimelineDriver tRef={tRef} tRelList={tRelList} duration={duration} playing={playing} speed={speed}
          frozenShotRef={frozenShotRef} fireProgressRef={fireProgressRef}
          onPause={() => setPlaying(false)} onTime={setTDisplay} />
      </Canvas>

      {/* --- top-left: shot info -------------------------------------------- */}
      <Card className={`absolute left-3 top-3 border-white/10 bg-black/55 backdrop-blur ${embedded ? 'max-w-[13.5rem] gap-0.5 p-3' : 'left-4 top-4 max-w-xs gap-1 p-4'}`}>
        {!embedded && <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{demo.title}</div>}
        <div className="mb-1 flex items-baseline gap-2">
          <span className={`rounded-md bg-primary font-bold uppercase leading-none tracking-wide text-primary-foreground shadow-sm ${embedded ? 'px-2 py-0.5 text-sm' : 'px-2.5 py-1 text-lg'}`}>Shot {activeIndex + 1}</span>
          <span className={`text-muted-foreground ${embedded ? 'text-xs' : 'text-sm'}`}>of {demo.shots.length}</span>
        </div>
        {!embedded && <div className="text-lg font-semibold">{shot.actor_username}</div>}
        {!embedded && <div className="font-mono text-xs text-muted-foreground">{cleanWeapon(shot.weapon_id)} · t={shot.game_time_seconds.toFixed(2)}s</div>}
        <div className={`mt-1 font-medium ${embedded ? 'text-xs' : 'text-sm'} ${outcomeColor}`}>{outcome}</div>
        {shot.recipient_username && (
          <div className={embedded ? 'mt-0.5 text-[11px] leading-snug' : 'mt-1 text-sm'}>
            <span className="text-muted-foreground">target </span>
            <span className="font-medium">{shot.recipient_username}</span>
            <span className="text-muted-foreground"> · {(shot.dist_to_impact * demo.scale).toFixed(1)} m</span>
            {shot.passing_distance != null && <span className="text-muted-foreground"> · off-center {(shot.passing_distance * demo.scale).toFixed(2)} m</span>}
          </div>
        )}
        {!parked && !embedded && <div className="mt-1 text-[11px] italic text-muted-foreground">playing — pause on a shot for full geometry</div>}
      </Card>

      {/* --- running accuracy (top-centre normally, top-right when embedded) -- */}
      <Card className={`absolute flex-row items-center border-white/10 bg-black/55 backdrop-blur ${embedded ? 'right-3 top-3 gap-3 px-3 py-2' : 'left-1/2 top-4 -translate-x-1/2 gap-4 px-5 py-3'}`}>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Accuracy</div>
          <div className={`font-bold tabular-nums leading-tight ${embedded ? 'text-lg' : 'text-2xl'}`}>{stats.acc == null ? '—' : `${stats.acc.toFixed(1)}%`}</div>
        </div>
        <div className={`flex flex-col gap-0.5 leading-tight ${embedded ? 'text-[11px]' : 'text-xs'}`}>
          <span><span className="font-semibold tabular-nums text-emerald-300">{stats.hits}</span> <span className="text-muted-foreground">hits</span></span>
          <span><span className="font-semibold tabular-nums text-amber-300">{stats.misses}</span> <span className="text-muted-foreground">misses</span></span>
          <span className="text-muted-foreground"><span className="tabular-nums">{stats.attempts}</span> attempts</span>
        </div>
      </Card>

      {/* --- top-right: options (full page only) ----------------------------- */}
      {!embedded && (
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
      )}

      {/* --- legend (full page only) ----------------------------------------- */}
      {!embedded && (
        <div className="absolute bottom-32 left-4 flex flex-col gap-1 rounded-md border border-white/10 bg-black/45 p-3 text-xs backdrop-blur">
          <LegendDot color={ACTOR_HL} label="shooter" />
          <LegendDot color={RECIPIENT_HL} label="algorithm's target" />
          <LegendDot color={TRACER} label="shot / tracer" />
          <LegendDot color={BUILD} label="build" />
          <LegendDot color={TERRAIN} label="terrain" />
        </div>
      )}


      {/* --- bottom: timeline + transport ----------------------------------- */}
      <div className={`absolute left-1/2 -translate-x-1/2 rounded-xl border border-white/10 bg-black/55 backdrop-blur ${embedded ? 'bottom-3 w-[calc(100%-1.5rem)] px-3 py-2' : 'bottom-4 w-[min(680px,calc(100%-2rem))] px-4 py-3'}`}>
        <div className="relative mb-2">
          <Slider value={[Math.min(tDisplay, duration)]} min={0} max={duration} step={0.01} onValueChange={(v) => scrub(v[0])} />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
            {demo.shots.map((s, i) => (
              <button key={i} title={`Jump to shot ${i + 1}`} onClick={() => gotoShot(i)}
                className={`pointer-events-auto absolute h-3 w-3 -translate-x-1/2 rounded-full border border-black/40 transition hover:scale-125 ${i === activeIndex ? 'bg-primary ring-2 ring-primary/40' : 'bg-amber-300/80'}`}
                style={{ left: `${(s.t_rel / duration) * 100}%` }} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => gotoShot(activeIndex - 1)}>‹ Prev</Button>
            <Button size="sm" className="min-w-16" onClick={togglePlay}>{playing ? 'Pause' : parked ? 'Play ▶' : 'Resume'}</Button>
            <Button variant="ghost" size="sm" onClick={() => gotoShot(activeIndex + 1)}>Next ›</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{Math.min(tDisplay, duration).toFixed(2)} / {duration.toFixed(1)}s</span>
            <div className="flex items-center gap-0.5 rounded-md bg-white/5 p-0.5">
              {[0.1, 0.25, 0.5, 1].map((s) => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`rounded px-1.5 py-0.5 text-[11px] tabular-nums transition ${speed === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{s}×</button>
              ))}
            </div>
          </div>
        </div>
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
