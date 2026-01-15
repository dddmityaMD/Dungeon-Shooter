import * as THREE from 'three'

export interface WallAabb {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface GridPoint {
  x: number
  y: number
}

export type EnemyType = 'melee' | 'ranged'

export interface Enemy {
  mesh: THREE.Object3D
  mixer?: THREE.AnimationMixer
  health: number
  path: GridPoint[]
  pathIndex: number
  lastPathTime: number
  targetCell: GridPoint | null
  state: EnemyState
  lastSeenPosition?: THREE.Vector3
  searchTimer: number
  patrolWaypoints?: THREE.Vector3[]
  currentWaypointIndex?: number
  lastSightCheck: number
  hitFlashTimer: number
  type: EnemyType
  shootCooldown: number
  shootTimer: number
  range: number
}

export enum EnemyState {
  IDLE = 'idle',
  PATROL = 'patrol',
  CHASE = 'chase',
  SEARCH = 'search',
}

export type RoomTag = 'treasure' | 'armory' | 'trap'

export interface Room {
  id: number
  x: number
  y: number
  w: number
  h: number
  centerX: number
  centerZ: number
  centerCell: GridPoint
  tag?: RoomTag
}

export interface LevelData {
  grid: number[][]
  rooms: Room[]
  exitRoom: Room
}

export interface SpawnInfo {
  cell: GridPoint
  type: string
}

export type DoorKind = 'exit' | 'treasure'
export type ConsumableType = 'medkit' | 'shield' | 'scanner'

export interface TreasureSpawn {
  cell: GridPoint
  type: ConsumableType
}

export interface LevelState extends LevelData {
  startRoom: Room
  keyCell: GridPoint
  enemySpawns: SpawnInfo[]
  propSpawns: SpawnInfo[]
  potionSpawns: SpawnInfo[]
  treasureSpawn: TreasureSpawn | null
  leverCell: GridPoint
  leverActivated: boolean
  seed: number
  discovered: boolean[][]
  hasKey: boolean
  keyDiscovered: boolean
  portalDiscovered: boolean
}

export interface Prop {
  mesh: THREE.Mesh
  collider: WallAabb
  health: number
}

export interface Potion {
  mesh: THREE.Mesh
  cell: GridPoint
}

export interface TreasurePickup {
  mesh: THREE.Mesh
  cell: GridPoint
  type: ConsumableType
}

export interface Door {
  mesh: THREE.Mesh
  collider: WallAabb
  cell: GridPoint
  kind: DoorKind
  isLocked: boolean
}

export interface Lever {
  mesh: THREE.Mesh
  cell: GridPoint
  isActivated: boolean
}

export interface EnemyProjectile {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  age: number
  prev: THREE.Vector3
}

export const config = {
  gridWidth: 41,
  gridHeight: 41,
  cellSize: 2,
  wallHeight: 4,
  bulletSpeed: 28,
  bulletDamage: 60,
  headshotDamage: 120,
}

export const state = {
  scene: null as THREE.Scene | null,
  camera: null as THREE.PerspectiveCamera | null,
  renderer: null as THREE.WebGLRenderer | null,
  exitPortal: null as THREE.Group | null,
  wallMesh: null as THREE.InstancedMesh | null,
  keyMesh: null as THREE.Mesh | null,
  enemyTemplate: null as THREE.Object3D | null,
  enemyClips: [] as THREE.AnimationClip[],
  enemyFallback: null as THREE.Object3D | null,
  levelState: null as LevelState | null,
  remainingEnemies: 0,
  currentLevel: 1,
  levelTransition: false,
  discovered: [] as boolean[][],
  wallAabbs: [] as WallAabb[],
  propColliders: [] as WallAabb[],
  doorColliders: [] as WallAabb[],
  bullets: [] as THREE.Mesh[],
  enemyProjectiles: [] as EnemyProjectile[],
  enemies: [] as Enemy[],
  props: [] as Prop[],
  potions: [] as Potion[],
  treasurePickups: [] as TreasurePickup[],
  doors: [] as Door[],
  lever: null as Lever | null,
  tracers: [] as { line: THREE.Line; life: number }[],
  muzzleFlash: null as THREE.PointLight | null,
  torchLights: [] as THREE.PointLight[],
  player: {
    health: 100,
    shield: 0,
    score: 0,
  },
  inventory: {
    held: null as ConsumableType | null,
  },
  timers: {
    lastShot: 0,
    muzzleFlashTimer: 0,
  },
  recoil: {
    pitch: 0,
    yaw: 0,
    recoverSpeed: 10,
  },
  effects: {
    hitmarkerTimer: 0,
    damageVignetteTimer: 0,
    crosshairTimer: 0,
  },
  controls: {
    keys: new Set<string>(),
    velocity: new THREE.Vector3(),
    moveDir: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    isLocked: false,
    isActive: false,
    lastMouse: { x: null as number | null, y: null as number | null },
  },
  ui: {
    hudLevel: null as HTMLSpanElement | null,
    hudScore: null as HTMLSpanElement | null,
    hudHealth: null as HTMLSpanElement | null,
    hudEnemies: null as HTMLSpanElement | null,
    hudItem: null as HTMLSpanElement | null,
    hudShield: null as HTMLSpanElement | null,
    overlay: null as HTMLDivElement | null,
    levelModal: null as HTMLDivElement | null,
    portalHint: null as HTMLDivElement | null,
    doorHint: null as HTMLDivElement | null,
    keyNotice: null as HTMLDivElement | null,
    potionNotice: null as HTMLDivElement | null,
    itemNotice: null as HTMLDivElement | null,
    leverNotice: null as HTMLDivElement | null,
    crosshair: null as HTMLDivElement | null,
    hitmarker: null as HTMLDivElement | null,
    damageVignette: null as HTMLDivElement | null,
    fadeOverlay: null as HTMLDivElement | null,
    minimap: null as HTMLCanvasElement | null,
    minimapCtx: null as CanvasRenderingContext2D | null,
    startButton: null as HTMLButtonElement | null,
    nextLevelButton: null as HTMLButtonElement | null,
    stayButton: null as HTMLButtonElement | null,
  },
  materials: {
    wallMat: null as THREE.MeshStandardMaterial | null,
    floorMat: null as THREE.MeshStandardMaterial | null,
    ceilingMat: null as THREE.MeshStandardMaterial | null,
    propWoodMat: null as THREE.MeshStandardMaterial | null,
    propStoneMat: null as THREE.MeshStandardMaterial | null,
    propMetalMat: null as THREE.MeshStandardMaterial | null,
    bulletMat: null as THREE.MeshStandardMaterial | null,
    enemyBoltMat: null as THREE.MeshStandardMaterial | null,
  },
  geometry: {
    bulletGeo: null as THREE.SphereGeometry | null,
    enemyBoltGeo: null as THREE.SphereGeometry | null,
  },
}

export const derived = {
  floorSize: config.gridWidth * config.cellSize,
  halfSize: (config.gridWidth * config.cellSize) / 2,
}
