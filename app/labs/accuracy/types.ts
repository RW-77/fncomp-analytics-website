// Shape of the bundled shot-scene demos produced by the ETL repo
// (viz/shot_scene.py -> viz/pack_web_demo.py). One demo = a navigable series of
// shots; each shot is the exact geometry the accuracy algorithm evaluated.

export type Vec3 = [number, number, number]

export interface PlayerNode {
  epic_id: string
  username: string
  team: number
  location: Vec3
  is_actor: boolean
  is_teammate: boolean
  is_opponent: boolean
  is_recipient: boolean
  radius: number | null
  dist_to_actor: number
  occluded: boolean
  ray_hits_hitbox: boolean
  entry_t: number | null
  exit_t: number | null
  passing_distance: number | null
  interpolated: boolean
  dt_us: number
}

export interface BuildPlane {
  center: Vec3
  normal: Vec3
  size: number
}

export interface ShotScene {
  match_id: string
  timestamp: number
  game_time_seconds: number
  weapon_id: string
  actor_id: string
  actor_username: string
  actor_team: number
  direct_hit: boolean
  impact_kind: 'player' | 'build' | 'terrain'
  origin: Vec3
  instigator_location: Vec3 | null
  impact: Vec3
  direction: Vec3
  dist_to_impact: number
  recipient_id: string | null
  recipient_username: string | null
  passing_distance: number | null
  max_range_cm: number
  players: PlayerNode[]
  build_plane: BuildPlane | null
  focus: Vec3
  suggested_scale: number
  // seconds from the demo timeline's window start (set by the packer).
  t_rel: number
}

// A player's sampled position track over the demo window: [t_rel_s, x, y, z].
export interface Track {
  epic_id: string
  username: string
  team: number
  samples: [number, number, number, number][]
}

export interface Demo {
  id: string
  title: string
  subtitle: string
  match_id: string
  actor_username: string
  window: [number, number] | null
  duration: number | null
  demo_origin: Vec3
  scale: number
  tracks: Track[]
  shots: ShotScene[]
}
