import * as THREE from 'three'
import { config, state, type GridPoint, type LevelData, type LevelState, type SpawnInfo } from './state'
import { createDiscoveryGrid, getRandomFloorCellInRoom, gridToWorld, manhattan, worldToGrid } from './grid'
import { resetCombat } from './combat'
import { spawnProps } from './props'
import { spawnEnemies } from './enemies'

export function createLevelState(): LevelState {
  const data = generateDungeon(config.gridWidth, config.gridHeight)
  const startRoom = data.rooms[0]
  const keyCell = pickKeyCell(data.rooms, startRoom, data.exitRoom, data.grid)
  const enemySpawns = generateEnemySpawns(
    data.rooms,
    startRoom.centerCell,
    10,
    data.grid
  )
  const propSpawns = generatePropSpawns(
    data.rooms,
    startRoom,
    data.exitRoom,
    data.grid
  )
  const potionSpawns = generatePotionSpawns(
    data.rooms,
    startRoom,
    data.exitRoom,
    keyCell,
    data.grid
  )

  return {
    ...data,
    startRoom,
    keyCell,
    enemySpawns,
    propSpawns,
    potionSpawns,
    discovered: createDiscoveryGrid(),
    hasKey: false,
    keyDiscovered: false,
    portalDiscovered: false,
  }
}

export function initLevel() {
  const levelState = createLevelState()
  state.levelState = levelState
  state.discovered = levelState.discovered
  applyLevelState(levelState)
}

export function nextLevel() {
  state.currentLevel += 1
  resetCombat()
  const levelState = createLevelState()
  state.levelState = levelState
  state.discovered = levelState.discovered
  applyLevelState(levelState)
  state.levelTransition = false
}

export function resetGame() {
  state.player.health = 100
  state.player.score = 0
  state.timers.lastShot = 0
  state.effects.hitmarkerTimer = 0
  state.effects.damageVignetteTimer = 0
  state.effects.crosshairTimer = 0
  resetCombat()

  const levelState = state.levelState
  if (!levelState) return

  levelState.hasKey = false
  levelState.keyDiscovered = false
  levelState.portalDiscovered = false
  levelState.discovered = createDiscoveryGrid()
  state.discovered = levelState.discovered

  applyLevelState(levelState)
  state.levelTransition = false
}

export function checkPortal() {
  const levelState = state.levelState
  const exitPortal = state.exitPortal
  const portalHint = state.ui.portalHint
  const levelModal = state.ui.levelModal
  const camera = state.camera
  if (!levelState || !exitPortal || state.levelTransition || !camera) return

  const distance = camera.position.distanceTo(exitPortal.position)
  const missing: string[] = []

  if (state.remainingEnemies > 0) missing.push('defeat all enemies')
  if (!levelState.hasKey) missing.push('find the key')

  if (distance < 4 && missing.length > 0) {
    if (portalHint) {
      portalHint.textContent = `Portal locked: ${missing.join(' + ')}`
      portalHint.style.display = 'block'
    }
    return
  }
  if (portalHint) portalHint.style.display = 'none'

  if (missing.length > 0) return
  if (distance < 3) {
    state.levelTransition = true
    if (levelModal) {
      levelModal.style.display = 'grid'
      levelModal.focus()
    }
    state.controls.isActive = false
    if (state.controls.isLocked) {
      document.exitPointerLock()
    }
  }
}

export function updateKeyPickup() {
  const levelState = state.levelState
  const keyMesh = state.keyMesh
  const camera = state.camera
  const keyNotice = state.ui.keyNotice
  if (!levelState || !keyMesh || levelState.hasKey || !camera) return

  const distance = keyMesh.position.distanceTo(camera.position)
  if (distance < 1.4) {
    levelState.hasKey = true
    levelState.keyDiscovered = true
    if (keyNotice) {
      keyNotice.style.display = 'block'
      setTimeout(() => {
        keyNotice.style.display = 'none'
      }, 1500)
    }
    state.scene?.remove(keyMesh)
    state.keyMesh = null
  }
}

export function updatePotionPickup() {
  const camera = state.camera
  const potionNotice = state.ui.potionNotice
  if (!camera) return

  for (let i = state.potions.length - 1; i >= 0; i -= 1) {
    const potion = state.potions[i]
    const flatDistance = new THREE.Vector3()
      .subVectors(camera.position, potion.mesh.position)
      .setY(0)
      .length()
    if (flatDistance < 1.2) {
      if (state.player.health >= 100) {
        if (potionNotice) {
          potionNotice.textContent = 'Health already full'
          potionNotice.style.display = 'block'
          setTimeout(() => {
            potionNotice.style.display = 'none'
            potionNotice.textContent = '+25 HP'
          }, 1200)
        }
        continue
      }
      state.player.health = Math.min(100, state.player.health + 25)
      if (potionNotice) {
        potionNotice.textContent = '+25 HP'
        potionNotice.style.display = 'block'
        setTimeout(() => {
          potionNotice.style.display = 'none'
        }, 1200)
      }
      state.scene?.remove(potion.mesh)
      state.potions.splice(i, 1)
    }
  }
}

export function updateDiscovery() {
  const levelState = state.levelState
  const camera = state.camera
  if (!levelState || !camera) return

  const cell = worldToGrid(camera.position)
  const radius = 4
  for (let y = cell.y - radius; y <= cell.y + radius; y += 1) {
    for (let x = cell.x - radius; x <= cell.x + radius; x += 1) {
      if (y < 0 || x < 0 || y >= config.gridHeight || x >= config.gridWidth) continue
      levelState.discovered[y][x] = true
    }
  }

  if (levelState.discovered[levelState.keyCell.y][levelState.keyCell.x]) {
    levelState.keyDiscovered = true
  }
  if (levelState.discovered[levelState.exitRoom.centerCell.y][levelState.exitRoom.centerCell.x]) {
    levelState.portalDiscovered = true
  }
}

export function updateGameOver() {
  if (state.player.health > 0) return
  if (state.ui.overlay) {
    state.ui.overlay.style.display = 'grid'
    const overlayMessage = state.ui.overlay.querySelector('p')
    if (overlayMessage) {
      overlayMessage.textContent = 'You are down! Press Click to restart.'
    }
  }
  if (state.ui.startButton) {
    state.ui.startButton.textContent = 'Restart'
  }
  state.controls.isActive = false
  if (state.controls.isLocked) {
    document.exitPointerLock()
  }
}

export function fadeOut() {
  if (state.ui.fadeOverlay) state.ui.fadeOverlay.style.opacity = '1'
}

export function fadeIn() {
  if (state.ui.fadeOverlay) state.ui.fadeOverlay.style.opacity = '0'
}

export function clearPotions() {
  state.potions.forEach((potion) => state.scene?.remove(potion.mesh))
  state.potions.length = 0
}

export function spawnPotions(spawns: SpawnInfo[]) {
  clearPotions()
  spawns.forEach((spawn) => {
    const geometry = new THREE.CylinderGeometry(0.25, 0.25, 0.6, 12)
    const material = new THREE.MeshStandardMaterial({
      color: 0x63ff9a,
      emissive: 0x2a8f5a,
      emissiveIntensity: 0.6,
    })
    const mesh = new THREE.Mesh(geometry, material)
    const worldPos = gridToWorld(spawn.cell.x, spawn.cell.y)
    mesh.position.set(worldPos.x, 0.5, worldPos.z)
    state.scene?.add(mesh)
    state.potions.push({ mesh, cell: spawn.cell })
  })
}

export function spawnKeyMesh(cell: GridPoint) {
  if (state.keyMesh) state.scene?.remove(state.keyMesh)
  const levelState = state.levelState
  if (levelState?.hasKey) {
    state.keyMesh = null
    return
  }
  const geometry = new THREE.OctahedronGeometry(0.35)
  const material = new THREE.MeshStandardMaterial({
    color: 0xf5d76e,
    emissive: 0xffd66b,
    emissiveIntensity: 0.6,
  })
  const mesh = new THREE.Mesh(geometry, material)
  const position = gridToWorld(cell.x, cell.y)
  mesh.position.set(position.x, 1.2, position.z)
  state.scene?.add(mesh)
  state.keyMesh = mesh
}

export function refreshTorchLights(roomList: LevelData['rooms']) {
  state.torchLights.forEach((light) => state.scene?.remove(light))
  state.torchLights = []
  roomList.forEach((room, index) => {
    if (index % 2 === 0) {
      const light = new THREE.PointLight(0xffb26a, 1.2, 16, 2)
      light.position.set(room.centerX, 2.6, room.centerZ)
      light.userData.baseIntensity = 1.1
      state.torchLights.push(light)
      state.scene?.add(light)
    }
  })
}

export function createExitPortal(exitRoom: LevelData['exitRoom']) {
  const portalGroup = new THREE.Group()
  portalGroup.position.set(exitRoom.centerX, 0, exitRoom.centerZ)

  const portalRingMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x004444,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.8,
  })
  const portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.5, 0.3, 16, 32),
    portalRingMat
  )
  portalRing.position.set(0, 1.6, 0)
  portalGroup.add(portalRing)

  const portalSurfaceMat = new THREE.MeshStandardMaterial({
    color: 0x0088ff,
    emissive: 0x002244,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.7,
  })
  const portalSurface = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 16),
    portalSurfaceMat
  )
  portalSurface.position.set(0, 1.6, 0)
  portalGroup.add(portalSurface)

  const portalLight = new THREE.PointLight(0x00ffff, 2, 10)
  portalLight.position.set(0, 2.8, 0)
  portalGroup.add(portalLight)

  portalGroup.userData.light = portalLight
  portalGroup.userData.surface = portalSurface
  portalGroup.userData.ring = portalRing

  const particleCount = 50
  const particleGeometry = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const velocities = new Float32Array(particleCount * 3)

  for (let i = 0; i < particleCount; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * 2.2
    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = 0.5 + Math.random() * 2
    positions[i * 3 + 2] = Math.sin(angle) * radius
    velocities[i * 3] = (Math.random() - 0.5) * 0.1
    velocities[i * 3 + 1] = Math.random() * 0.02
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1
  }

  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
  )
  const particleMat = new THREE.PointsMaterial({
    color: 0x00ffff,
    size: 0.1,
  })
  const particles = new THREE.Points(particleGeometry, particleMat)
  portalGroup.add(particles)

  function animateParticles() {
    const pos = particleGeometry.attributes.position.array as Float32Array
    for (let i = 0; i < particleCount; i += 1) {
      pos[i * 3 + 1] += velocities[i * 3 + 1]
      if (pos[i * 3 + 1] > 3) pos[i * 3 + 1] = 0.5
      pos[i * 3] += velocities[i * 3]
      pos[i * 3 + 2] += velocities[i * 3 + 2]
    }
    particleGeometry.attributes.position.needsUpdate = true
    requestAnimationFrame(animateParticles)
  }
  animateParticles()

  return portalGroup
}

function applyLevelState(levelState: LevelState) {
  const scene = state.scene
  const camera = state.camera
  if (!scene || !camera) return

  if (state.wallMesh) scene.remove(state.wallMesh)
  if (state.exitPortal) scene.remove(state.exitPortal)
  state.wallAabbs.length = 0

  const wallPositions: THREE.Matrix4[] = []
  for (let y = 0; y < config.gridHeight; y += 1) {
    for (let x = 0; x < config.gridWidth; x += 1) {
      if (levelState.grid[y][x] === 1) {
        const worldPos = gridToWorld(x, y)
        const matrix = new THREE.Matrix4().makeTranslation(
          worldPos.x,
          config.wallHeight / 2,
          worldPos.z
        )
        wallPositions.push(matrix)
        state.wallAabbs.push({
          minX: worldPos.x - config.cellSize / 2,
          maxX: worldPos.x + config.cellSize / 2,
          minZ: worldPos.z - config.cellSize / 2,
          maxZ: worldPos.z + config.cellSize / 2,
        })
      }
    }
  }

  const wallMat = state.materials.wallMat ?? new THREE.MeshStandardMaterial()
  state.wallMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(config.cellSize, config.wallHeight, config.cellSize),
    wallMat,
    wallPositions.length
  )
  wallPositions.forEach((matrix, index) => {
    state.wallMesh?.setMatrixAt(index, matrix)
  })
  scene.add(state.wallMesh)

  state.exitPortal = createExitPortal(levelState.exitRoom)
  scene.add(state.exitPortal)
  refreshTorchLights(levelState.rooms)

  spawnProps(levelState.propSpawns)
  spawnPotions(levelState.potionSpawns)
  camera.position.set(levelState.startRoom.centerX, 1.7, levelState.startRoom.centerZ)
  state.controls.velocity.set(0, 0, 0)
  spawnEnemies(levelState.enemySpawns)
  spawnKeyMesh(levelState.keyCell)

  if (state.ui.keyNotice) state.ui.keyNotice.style.display = 'none'
  if (state.ui.potionNotice) state.ui.potionNotice.style.display = 'none'
}

function generateDungeon(width: number, height: number): LevelData {
  const grid = Array.from({ length: height }, () => Array(width).fill(1))
  const rooms: {
    x: number
    y: number
    w: number
    h: number
    centerX: number
    centerZ: number
    centerCell: GridPoint
  }[] = []

  const maxRooms = 12
  const attempts = 40

  for (let i = 0; i < attempts && rooms.length < maxRooms; i += 1) {
    const roomWidth = randRange(4, 8)
    const roomHeight = randRange(4, 8)
    const x = randRange(1, width - roomWidth - 2)
    const y = randRange(1, height - roomHeight - 2)

    if (intersectsExistingRoom(grid, x, y, roomWidth, roomHeight)) continue

    for (let ry = y; ry < y + roomHeight; ry += 1) {
      for (let rx = x; rx < x + roomWidth; rx += 1) {
        grid[ry][rx] = 0
      }
    }

    const centerCell = {
      x: Math.floor(x + roomWidth / 2),
      y: Math.floor(y + roomHeight / 2),
    }
    const centerWorld = gridToWorld(centerCell.x, centerCell.y)
    rooms.push({
      x,
      y,
      w: roomWidth,
      h: roomHeight,
      centerX: centerWorld.x,
      centerZ: centerWorld.z,
      centerCell,
    })
  }

  rooms.sort((a, b) => a.centerCell.x - b.centerCell.x)

  for (let i = 1; i < rooms.length; i += 1) {
    const prev = rooms[i - 1].centerCell
    const current = rooms[i].centerCell
    carveCorridor(grid, prev, current)
  }

  if (rooms.length === 0) {
    const fallback = {
      x: Math.floor(width / 2) - 3,
      y: Math.floor(height / 2) - 3,
      w: 6,
      h: 6,
    }
    for (let ry = fallback.y; ry < fallback.y + fallback.h; ry += 1) {
      for (let rx = fallback.x; rx < fallback.x + fallback.w; rx += 1) {
        grid[ry][rx] = 0
      }
    }
    const centerCell = {
      x: Math.floor(fallback.x + fallback.w / 2),
      y: Math.floor(fallback.y + fallback.h / 2),
    }
    const centerWorld = gridToWorld(centerCell.x, centerCell.y)
    rooms.push({
      ...fallback,
      centerX: centerWorld.x,
      centerZ: centerWorld.z,
      centerCell,
    })
  }

  const startRoom = rooms[0]
  let exitRoom = rooms[rooms.length - 1]
  for (const room of rooms) {
    if (
      manhattan(room.centerCell, startRoom.centerCell) >
      manhattan(exitRoom.centerCell, startRoom.centerCell)
    ) {
      exitRoom = room
    }
  }

  return { grid, rooms, exitRoom }
}

function pickKeyCell(
  roomList: LevelData['rooms'],
  start: LevelData['rooms'][number],
  exit: LevelData['rooms'][number],
  gridSource: number[][]
) {
  const candidates = roomList.filter((room) => room !== start && room !== exit)
  const farRooms = candidates.filter(
    (room) => manhattan(room.centerCell, start.centerCell) >= 8
  )
  const keyRoom =
    farRooms[Math.floor(Math.random() * farRooms.length)] ||
    candidates[Math.floor(Math.random() * candidates.length)] ||
    exit
  return (
    getRandomFloorCellInRoom(keyRoom, 4, start.centerCell, gridSource) ||
    keyRoom.centerCell
  )
}

function generateEnemySpawns(
  roomList: LevelData['rooms'],
  startCell: GridPoint,
  count: number,
  gridSource: number[][]
): SpawnInfo[] {
  const filteredRooms = roomList.filter(
    (room) => manhattan(room.centerCell, startCell) >= 10
  )
  const availableRooms = (filteredRooms.length > 0 ? filteredRooms : roomList).sort(
    (a, b) =>
      manhattan(b.centerCell, startCell) - manhattan(a.centerCell, startCell)
  )

  const spawns: SpawnInfo[] = []
  const rangedCount = Math.max(1, Math.round(count * 0.3))
  for (let i = 0; i < count && i < availableRooms.length; i += 1) {
    const room = availableRooms[i % availableRooms.length]
    const cell = getRandomFloorCellInRoom(room, 8, startCell, gridSource)
    if (!cell) continue
    spawns.push({ cell, type: i < rangedCount ? 'ranged' : 'melee' })
  }
  return spawns
}

function generatePropSpawns(
  roomList: LevelData['rooms'],
  start: LevelData['rooms'][number],
  exit: LevelData['rooms'][number],
  gridSource: number[][]
): SpawnInfo[] {
  const spawns: SpawnInfo[] = []
  const occupied = new Set<string>()
  const types = ['crate', 'barrel', 'pillar', 'rock']

  roomList.forEach((room) => {
    if (room === start || room === exit) return
    const propCount = randRange(1, 3)
    for (let i = 0; i < propCount; i += 1) {
      const cell = getRandomFloorCellInRoom(room, 4, start.centerCell, gridSource)
      if (!cell) continue
      const key = `${cell.x},${cell.y}`
      if (occupied.has(key)) continue
      occupied.add(key)
      const type = types[Math.floor(Math.random() * types.length)]
      spawns.push({ cell, type })
    }
  })

  return spawns
}

function generatePotionSpawns(
  roomList: LevelData['rooms'],
  start: LevelData['rooms'][number],
  exit: LevelData['rooms'][number],
  keyCell: GridPoint,
  gridSource: number[][]
): SpawnInfo[] {
  const spawns: SpawnInfo[] = []
  const occupied = new Set<string>([`${keyCell.x},${keyCell.y}`])
  const candidateRooms = roomList.filter((room) => room !== start && room !== exit)

  const potionCount = randRange(2, 4)
  for (let i = 0; i < potionCount; i += 1) {
    const room =
      candidateRooms[Math.floor(Math.random() * candidateRooms.length)] || start
    const cell = getRandomFloorCellInRoom(room, 4, start.centerCell, gridSource)
    if (!cell) continue
    const key = `${cell.x},${cell.y}`
    if (occupied.has(key)) continue
    occupied.add(key)
    spawns.push({ cell, type: 'potion' })
  }

  return spawns
}

function intersectsExistingRoom(
  grid: number[][],
  x: number,
  y: number,
  w: number,
  h: number
) {
  for (let ry = y - 1; ry < y + h + 1; ry += 1) {
    for (let rx = x - 1; rx < x + w + 1; rx += 1) {
      if (grid[ry]?.[rx] === 0) return true
    }
  }
  return false
}

function carveCorridor(grid: number[][], from: GridPoint, to: GridPoint) {
  const horizontalFirst = Math.random() > 0.5
  if (horizontalFirst) {
    carveLine(grid, from.x, from.y, to.x, from.y)
    carveLine(grid, to.x, from.y, to.x, to.y)
  } else {
    carveLine(grid, from.x, from.y, from.x, to.y)
    carveLine(grid, from.x, to.y, to.x, to.y)
  }
}

function carveLine(grid: number[][], x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.sign(x2 - x1)
  const dy = Math.sign(y2 - y1)
  let x = x1
  let y = y1
  grid[y][x] = 0
  while (x !== x2 || y !== y2) {
    if (x !== x2) x += dx
    else if (y !== y2) y += dy
    grid[y][x] = 0
  }
}

function randRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
