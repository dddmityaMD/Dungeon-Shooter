import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { triggerDamageFeedback } from './effects'
import { resolveCollisions } from './collision'
import { gridToWorld, worldToGrid } from './grid'
import { config, state, type Enemy, type EnemyType, EnemyState, type GridPoint, type SpawnInfo } from './state'
import { spawnEnemyProjectile } from './combat'

const enemyLoader = new GLTFLoader()

export function initEnemyAssets() {
  if (!state.enemyFallback) {
    state.enemyFallback = createFallbackEnemy()
  }

  enemyLoader.load(
    'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
    (gltf) => {
      state.enemyTemplate = gltf.scene
      state.enemyTemplate.scale.setScalar(0.4)
      state.enemyTemplate.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
        }
      })
      state.enemyClips = gltf.animations
      for (const enemy of state.enemies) {
        replaceEnemyMesh(enemy)
      }
    }
  )
}

export function spawnEnemies(spawns: SpawnInfo[]) {
  state.enemies.forEach((enemy) => state.scene?.remove(enemy.mesh))
  state.enemies.length = 0

  spawns.forEach((spawn) => {
    const position = gridToWorld(spawn.cell.x, spawn.cell.y)
    const enemy = createEnemy(position, spawn.type === 'ranged' ? 'ranged' : 'melee')
    enemy.health = 100
    enemy.path = []
    enemy.pathIndex = 0
    enemy.lastPathTime = 0
    enemy.targetCell = null
    enemy.state = EnemyState.IDLE
    enemy.searchTimer = 0
    enemy.lastSightCheck = 0
    state.enemies.push(enemy)
    state.scene?.add(enemy.mesh)
  })
  state.remainingEnemies = state.enemies.length
}

export function clearEnemies() {
  state.enemies.forEach((enemy) => state.scene?.remove(enemy.mesh))
  state.enemies.length = 0
  state.remainingEnemies = 0
}

export function updateEnemies(delta: number, time: number) {
  const camera = state.camera
  const levelState = state.levelState
  if (!camera || !levelState) return

  const playerCell = worldToGrid(camera.position)
  for (const enemy of state.enemies) {
    if (!enemy.mesh.parent) continue

    const distanceToPlayer = new THREE.Vector3()
      .subVectors(camera.position, enemy.mesh.position)
      .setY(0)
      .length()

    if (enemy.type === 'ranged') {
      const canSee = hasLineOfSight(enemy.mesh.position, camera.position)
      enemy.shootTimer = Math.max(0, enemy.shootTimer - delta)
      if (canSee && distanceToPlayer <= enemy.range) {
        if (enemy.shootTimer <= 0) {
          spawnEnemyProjectile(enemy)
          enemy.shootTimer = enemy.shootCooldown
        }
      }

      if (canSee) {
        enemy.mesh.lookAt(camera.position.x, enemy.mesh.position.y, camera.position.z)
      }

      if (enemy.mixer) {
        enemy.mixer.update(delta)
      }

      if (distanceToPlayer < 1.2) {
        state.player.health = Math.max(0, state.player.health - 30 * delta)
        triggerDamageFeedback()
      }

      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - delta)
        applyEnemyHitFlash(enemy, enemy.hitFlashTimer / 0.15)
      } else {
        applyEnemyHitFlash(enemy, 0)
      }
      continue
    }

    if (time - enemy.lastSightCheck > 300) {
      enemy.lastSightCheck = time
      const canSee = hasLineOfSight(enemy.mesh.position, camera.position)

      switch (enemy.state) {
        case EnemyState.IDLE:
          if (canSee) {
            enemy.state = EnemyState.CHASE
          } else {
            enemy.state = EnemyState.PATROL
            enemy.patrolWaypoints = generatePatrolWaypoints(enemy.mesh.position)
            enemy.currentWaypointIndex = 0
          }
          break
        case EnemyState.PATROL:
          if (canSee) {
            enemy.state = EnemyState.CHASE
          } else if (enemy.searchTimer > 10000) {
            enemy.state = EnemyState.IDLE
            enemy.searchTimer = 0
          }
          break
        case EnemyState.CHASE:
          if (!canSee) {
            enemy.state = EnemyState.SEARCH
            enemy.lastSeenPosition = camera.position.clone()
            enemy.searchTimer = 0
          }
          break
        case EnemyState.SEARCH:
          if (canSee) {
            enemy.state = EnemyState.CHASE
          } else if (enemy.searchTimer > 8000) {
            enemy.state = EnemyState.PATROL
          }
          break
      }
    }

    enemy.searchTimer += delta * 1000

    switch (enemy.state) {
      case EnemyState.IDLE:
        break
      case EnemyState.PATROL:
        if (enemy.patrolWaypoints && enemy.patrolWaypoints.length > 0) {
          const waypoint = enemy.patrolWaypoints[enemy.currentWaypointIndex!]
          const direction = new THREE.Vector3()
            .subVectors(waypoint, enemy.mesh.position)
            .setY(0)
          const distance = direction.length()
          if (distance < 0.5) {
            enemy.currentWaypointIndex =
              (enemy.currentWaypointIndex! + 1) % enemy.patrolWaypoints.length
          } else {
            direction.normalize()
            enemy.mesh.position.addScaledVector(direction, delta * 1.5)
            resolveCollisions(enemy.mesh.position, 0.65)
          }
        }
        break
      case EnemyState.CHASE:
        if (
          !enemy.targetCell ||
          enemy.targetCell.x !== playerCell.x ||
          enemy.targetCell.y !== playerCell.y ||
          time - enemy.lastPathTime > 800
        ) {
          enemy.path = findPath(worldToGrid(enemy.mesh.position), playerCell, levelState.grid)
          enemy.pathIndex = 0
          enemy.lastPathTime = time
          enemy.targetCell = playerCell
        }

        const nextPoint = enemy.path[enemy.pathIndex]
        if (nextPoint) {
          const target = gridToWorld(nextPoint.x, nextPoint.y)
          const direction = new THREE.Vector3()
            .subVectors(target, enemy.mesh.position)
            .setY(0)
          const distance = direction.length()
          if (distance < 0.3) {
            enemy.pathIndex = Math.min(enemy.pathIndex + 1, enemy.path.length)
          } else {
            direction.normalize()
            enemy.mesh.position.addScaledVector(direction, delta * 2.2)
            resolveCollisions(enemy.mesh.position, 0.65)
          }
        }
        break
      case EnemyState.SEARCH:
        if (enemy.lastSeenPosition) {
          const direction = new THREE.Vector3()
            .subVectors(enemy.lastSeenPosition, enemy.mesh.position)
            .setY(0)
          const distance = direction.length()
          if (distance < 0.5) {
            enemy.mesh.rotation.y += delta * 2
          } else {
            direction.normalize()
            enemy.mesh.position.addScaledVector(direction, delta * 1.8)
            resolveCollisions(enemy.mesh.position, 0.65)
          }
        }
        break
    }

    if (enemy.state === EnemyState.CHASE || enemy.state === EnemyState.SEARCH) {
      enemy.mesh.lookAt(camera.position.x, enemy.mesh.position.y, camera.position.z)
    }

    if (enemy.mixer) {
      enemy.mixer.update(delta)
    }

    if (distanceToPlayer < 1.2) {
      state.player.health = Math.max(0, state.player.health - 30 * delta)
      triggerDamageFeedback()
    }

    if (enemy.hitFlashTimer > 0) {
      enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - delta)
      applyEnemyHitFlash(enemy, enemy.hitFlashTimer / 0.15)
    } else {
      applyEnemyHitFlash(enemy, 0)
    }
  }
}

export function generatePatrolWaypoints(center: THREE.Vector3): THREE.Vector3[] {
  const waypoints: THREE.Vector3[] = []
  const radius = 3
  const levelState = state.levelState
  if (!levelState) return waypoints

  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2
    const waypoint = new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y,
      center.z + Math.sin(angle) * radius
    )
    const cell = worldToGrid(waypoint)
    if (levelState.grid[cell.y][cell.x] === 0) {
      waypoints.push(waypoint)
    }
  }
  return waypoints
}

export function replaceEnemyMesh(enemy: Enemy) {
  const position = enemy.mesh.position.clone()
  state.scene?.remove(enemy.mesh)
  enemy.mesh = createEnemyMesh(position)
  enemy.mixer = enemy.mesh.userData.mixer as THREE.AnimationMixer | undefined
  state.scene?.add(enemy.mesh)
}

export function assignHeadshotData(mesh: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(mesh)
  const size = new THREE.Vector3()
  box.getSize(size)
  const headCenterY = box.max.y - size.y * 0.18
  const headRadius = Math.max(0.3, size.y * 0.18)
  mesh.userData.headOffset = headCenterY - mesh.position.y
  mesh.userData.headRadius = headRadius
}

function createEnemy(position: THREE.Vector3, type: EnemyType): Enemy {
  const mesh = createEnemyMesh(position)
  return {
    mesh,
    health: 100,
    path: [],
    pathIndex: 0,
    lastPathTime: 0,
    targetCell: null,
    state: EnemyState.IDLE,
    searchTimer: 0,
    lastSightCheck: 0,
    hitFlashTimer: 0,
    type,
    shootCooldown: type === 'ranged' ? 1.2 : 0,
    shootTimer: type === 'ranged' ? Math.random() * 1.2 : 0,
    range: type === 'ranged' ? 18 : 2,
    mixer: mesh.userData.mixer as THREE.AnimationMixer | undefined,
  }
}

function createEnemyMesh(position: THREE.Vector3) {
  let mesh: THREE.Object3D
  let mixer: THREE.AnimationMixer | undefined

  if (state.enemyTemplate) {
    mesh = SkeletonUtils.clone(state.enemyTemplate)
    mesh.position.copy(position)
    if (state.enemyClips.length > 0) {
      mixer = new THREE.AnimationMixer(mesh)
      const clip =
        THREE.AnimationClip.findByName(state.enemyClips, 'Walking') || state.enemyClips[0]
      mixer.clipAction(clip).play()
    }
  } else {
    mesh = SkeletonUtils.clone(state.enemyFallback ?? createFallbackEnemy())
    mesh.position.copy(position)
  }

  mesh.userData.mixer = mixer
  assignHeadshotData(mesh)
  return mesh
}

function applyEnemyHitFlash(enemy: Enemy, intensity: number) {
  enemy.mesh.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      const material = child.material
      if (material.userData.baseEmissiveIntensity === undefined) {
        material.userData.baseEmissiveIntensity = material.emissiveIntensity ?? 0
        material.userData.baseEmissive = material.emissive.clone()
      }
      const baseIntensity = material.userData.baseEmissiveIntensity as number
      const baseEmissive = material.userData.baseEmissive as THREE.Color
      material.emissive.copy(baseEmissive)
      material.emissiveIntensity = baseIntensity + intensity * 2.5
    }
  })
}

function hasLineOfSight(enemyPos: THREE.Vector3, playerPos: THREE.Vector3): boolean {
  const direction = new THREE.Vector3().subVectors(playerPos, enemyPos).normalize()
  const distance = enemyPos.distanceTo(playerPos)

  for (const wall of state.wallAabbs) {
    const tMin = (wall.minX - enemyPos.x) / direction.x
    const tMax = (wall.maxX - enemyPos.x) / direction.x
    const tyMin = (wall.minZ - enemyPos.z) / direction.z
    const tyMax = (wall.maxZ - enemyPos.z) / direction.z

    const t1 = Math.max(Math.min(tMin, tMax), Math.min(tyMin, tyMax))
    const t2 = Math.min(Math.max(tMin, tMax), Math.max(tyMin, tyMax))

    if (t2 >= t1 && t1 <= distance && t2 >= 0) {
      return false
    }
  }
  return true
}

function findPath(start: GridPoint, goal: GridPoint, grid: number[][]): GridPoint[] {
  if (grid[start.y]?.[start.x] !== 0 || grid[goal.y]?.[goal.x] !== 0) {
    return []
  }

  const width = config.gridWidth
  const height = config.gridHeight
  const visited = new Array(width * height).fill(false)
  const prev = new Array(width * height).fill(-1)
  const queue: GridPoint[] = []
  const startIndex = start.y * width + start.x
  const goalIndex = goal.y * width + goal.x

  queue.push(start)
  visited[startIndex] = true

  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentIndex = current.y * width + current.x
    if (currentIndex === goalIndex) break
    for (const dir of directions) {
      const nx = current.x + dir.x
      const ny = current.y + dir.y
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (grid[ny][nx] === 1) continue
      const neighborIndex = ny * width + nx
      if (visited[neighborIndex]) continue
      visited[neighborIndex] = true
      prev[neighborIndex] = currentIndex
      queue.push({ x: nx, y: ny })
    }
  }

  if (!visited[goalIndex]) return []

  const path: GridPoint[] = []
  let currentIndex = goalIndex
  while (currentIndex !== startIndex && currentIndex !== -1) {
    const x = currentIndex % width
    const y = Math.floor(currentIndex / width)
    path.unshift({ x, y })
    currentIndex = prev[currentIndex]
  }
  return path
}

function createFallbackEnemy() {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x546091 })
  const headMat = new THREE.MeshStandardMaterial({ color: 0xc5b3a0 })
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xff5c7a,
    emissive: 0xff2848,
    emissiveIntensity: 0.7,
  })
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.1, 4, 8),
    bodyMat
  )
  body.position.y = 0.8
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), headMat)
  head.name = 'Head'
  head.position.y = 1.6
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), coreMat)
  core.position.set(0, 1.1, 0.35)
  group.add(body, head, core)
  return group
}
