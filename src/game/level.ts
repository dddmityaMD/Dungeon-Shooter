import * as THREE from 'three'
import {
  config,
  state,
  type ConsumableType,
  type DoorKind,
  type GridPoint,
  type LevelData,
  type LevelState,
  type Room,
  type RoomTag,
  type SpawnInfo,
} from './state'
import { createDiscoveryGrid, gridToWorld, manhattan, worldToGrid } from './grid'
import { resetCombat } from './combat'
import { spawnProps } from './props'
import { spawnEnemies } from './enemies'

export function createLevelState(): LevelState {
  const seed = Math.floor(Math.random() * 1_000_000_000)
  const rng = createRng(seed)
  const data = generateDungeon(config.gridWidth, config.gridHeight, rng)
  const startRoom = data.rooms[0]
  const keyCell = pickKeyCell(data.rooms, startRoom, data.exitRoom, data.grid, rng)
  const keyRoom = findRoomForCell(data.rooms, keyCell)
  assignRoomTags(data.rooms, startRoom, data.exitRoom, keyRoom, data.grid, rng)
  const treasureRoom = data.rooms.find((room) => room.tag === 'treasure') ?? null
  const enemySpawns = generateEnemySpawns(
    data.rooms,
    startRoom.centerCell,
    10,
    data.grid,
    rng
  )
  const propSpawns = generatePropSpawns(
    data.rooms,
    startRoom,
    data.exitRoom,
    data.grid,
    rng
  )
  const potionSpawns = generatePotionSpawns(
    data.rooms,
    startRoom,
    data.exitRoom,
    keyCell,
    data.grid,
    rng
  )
  const leverCell = pickLeverCell(
    data.rooms,
    startRoom,
    data.exitRoom,
    keyRoom,
    treasureRoom,
    data.grid,
    rng
  )
  const treasureSpawn = treasureRoom
    ? createTreasureSpawn(treasureRoom, startRoom.centerCell, data.grid, rng)
    : null

  return {
    ...data,
    startRoom,
    keyCell,
    enemySpawns,
    propSpawns,
    potionSpawns,
    treasureSpawn,
    leverCell,
    leverActivated: false,
    seed,
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
  state.player.shield = 0
  state.player.score = 0
  state.inventory.held = null
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
  levelState.leverActivated = false
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

export function updateTreasurePickup() {
  const camera = state.camera
  const itemNotice = state.ui.itemNotice
  if (!camera) return

  for (let i = state.treasurePickups.length - 1; i >= 0; i -= 1) {
    const pickup = state.treasurePickups[i]
    const flatDistance = new THREE.Vector3()
      .subVectors(camera.position, pickup.mesh.position)
      .setY(0)
      .length()
    if (flatDistance < 1.2) {
      if (state.inventory.held) {
        if (itemNotice) {
          itemNotice.textContent = 'Inventory full'
          itemNotice.style.display = 'block'
          setTimeout(() => {
            if (itemNotice) itemNotice.style.display = 'none'
          }, 1200)
        }
        continue
      }
      state.inventory.held = pickup.type
      if (itemNotice) {
        itemNotice.textContent = `Picked up: ${formatConsumableLabel(pickup.type)} (Press Q)`
        itemNotice.style.display = 'block'
        setTimeout(() => {
          if (itemNotice) itemNotice.style.display = 'none'
        }, 1400)
      }
      state.scene?.remove(pickup.mesh)
      state.treasurePickups.splice(i, 1)
    }
  }
}

export function updateLeverInteraction() {
  const levelState = state.levelState
  const camera = state.camera
  const lever = state.lever
  const leverNotice = state.ui.leverNotice
  if (!levelState || !camera || !lever || lever.isActivated) return

  const distance = lever.mesh.position.distanceTo(camera.position)
  if (distance < 1.3) {
    levelState.leverActivated = true
    lever.isActivated = true
    if (leverNotice) {
      leverNotice.textContent = 'Switch activated'
      leverNotice.style.display = 'block'
      setTimeout(() => {
        if (leverNotice) leverNotice.style.display = 'none'
      }, 1400)
    }
    const light = lever.mesh.userData.light as THREE.PointLight | undefined
    if (light) state.scene?.remove(light)
    state.scene?.remove(lever.mesh)
    state.lever = null
  }
}

export function updateDoorInteractions() {
  const levelState = state.levelState
  const camera = state.camera
  const doorHint = state.ui.doorHint
  if (!levelState || !camera) return

  let showHint = false
  for (let i = state.doors.length - 1; i >= 0; i -= 1) {
    const door = state.doors[i]
    const distance = door.mesh.position.distanceTo(camera.position)
    if (distance > 2.4) continue

    const isUnlocked = door.kind === 'exit' ? levelState.hasKey : levelState.leverActivated
    if (!isUnlocked) {
      if (doorHint && !showHint) {
        doorHint.textContent =
          door.kind === 'exit'
            ? 'Door locked: find the key'
            : 'Door locked: activate the switch'
        doorHint.style.display = 'block'
      }
      showHint = true
      continue
    }

    if (distance < 1.8) {
      removeDoor(i)
    }
  }

  if (!showHint && doorHint) doorHint.style.display = 'none'
}

export function useHeldItem() {
  const held = state.inventory.held
  const itemNotice = state.ui.itemNotice
  if (!held) return

  switch (held) {
    case 'medkit':
      state.player.health = Math.min(100, state.player.health + 40)
      if (itemNotice) {
        itemNotice.textContent = 'Medkit used: +40 HP'
        itemNotice.style.display = 'block'
        setTimeout(() => {
          if (itemNotice) itemNotice.style.display = 'none'
        }, 1200)
      }
      break
    case 'shield':
      state.player.shield = Math.min(100, state.player.shield + 40)
      if (itemNotice) {
        itemNotice.textContent = 'Shield activated'
        itemNotice.style.display = 'block'
        setTimeout(() => {
          if (itemNotice) itemNotice.style.display = 'none'
        }, 1200)
      }
      break
    case 'scanner':
      if (state.levelState) {
        revealTreasureArea(state.levelState)
      }
      if (itemNotice) {
        itemNotice.textContent = 'Scanner pulse'
        itemNotice.style.display = 'block'
        setTimeout(() => {
          if (itemNotice) itemNotice.style.display = 'none'
        }, 1200)
      }
      break
  }

  state.inventory.held = null
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

  refreshDiscoveryFlags(levelState)
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

function clearDoors() {
  state.doors.forEach((door) => state.scene?.remove(door.mesh))
  state.doors.length = 0
  state.doorColliders.length = 0
}

function removeDoor(index: number) {
  const door = state.doors[index]
  state.scene?.remove(door.mesh)
  state.doors.splice(index, 1)
  state.doorColliders.splice(index, 1)
}

function spawnDoors(levelState: LevelState) {
  clearDoors()

  const startCell = levelState.startRoom.centerCell
  const requiredCells: GridPoint[] = [levelState.keyCell, levelState.leverCell]
  if (levelState.treasureSpawn) requiredCells.push(levelState.treasureSpawn.cell)

  const exitEntrances = findRoomEntrances(levelState.exitRoom, levelState.grid)
  const exitDoorCell = pickDoorCell(
    exitEntrances,
    levelState.grid,
    startCell,
    requiredCells
  )

  if (exitDoorCell) {
    createDoor(exitDoorCell, 'exit')
  } else {
    createDoor(levelState.exitRoom.centerCell, 'exit')
  }

  const treasureRoom = levelState.rooms.find((room) => room.tag === 'treasure')
  if (!treasureRoom || !levelState.treasureSpawn) return

  const treasureEntrances = findRoomEntrances(treasureRoom, levelState.grid)
  const treasureDoorCell = pickTreasureDoorCell(
    treasureEntrances,
    levelState.grid,
    startCell,
    levelState.leverCell,
    levelState.treasureSpawn.cell
  )

  if (treasureDoorCell) {
    createDoor(treasureDoorCell, 'treasure')
  }
}

function createDoor(cell: GridPoint, kind: DoorKind) {
  const material = new THREE.MeshStandardMaterial({
    color: kind === 'exit' ? 0xf5d76e : 0xd38cff,
    emissive: kind === 'exit' ? 0xffd66b : 0x5f2a88,
    emissiveIntensity: 0.35,
  })
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(config.cellSize, config.wallHeight, config.cellSize),
    material
  )
  const worldPos = gridToWorld(cell.x, cell.y)
  mesh.position.set(worldPos.x, config.wallHeight / 2, worldPos.z)
  state.scene?.add(mesh)

  const collider = {
    minX: worldPos.x - config.cellSize / 2,
    maxX: worldPos.x + config.cellSize / 2,
    minZ: worldPos.z - config.cellSize / 2,
    maxZ: worldPos.z + config.cellSize / 2,
  }
  state.doors.push({ mesh, collider, cell, kind, isLocked: true })
  state.doorColliders.push(collider)
}

function clearLever() {
  if (state.lever) {
    const light = state.lever.mesh.userData.light as THREE.PointLight | undefined
    if (light) state.scene?.remove(light)
    state.scene?.remove(state.lever.mesh)
  }
  state.lever = null
}

function spawnLever(levelState: LevelState) {
  clearLever()
  if (levelState.leverActivated) return

  const geometry = new THREE.CylinderGeometry(0.18, 0.28, 1.2, 10)
  const material = new THREE.MeshStandardMaterial({
    color: 0x8bf7ff,
    emissive: 0x1f6a75,
    emissiveIntensity: 0.8,
  })
  const mesh = new THREE.Mesh(geometry, material)
  const worldPos = gridToWorld(levelState.leverCell.x, levelState.leverCell.y)
  mesh.position.set(worldPos.x, 0.65, worldPos.z)
  state.scene?.add(mesh)

  const light = new THREE.PointLight(0x8bf7ff, 1.0, 10)
  light.position.set(worldPos.x, 2.2, worldPos.z)
  state.scene?.add(light)
  mesh.userData.light = light

  state.lever = { mesh, cell: levelState.leverCell, isActivated: false }
}

function clearTreasurePickups() {
  state.treasurePickups.forEach((pickup) => state.scene?.remove(pickup.mesh))
  state.treasurePickups.length = 0
}

function spawnTreasurePickups(levelState: LevelState) {
  clearTreasurePickups()
  if (!levelState.treasureSpawn) return

  const geometry = new THREE.OctahedronGeometry(0.35)
  const material = new THREE.MeshStandardMaterial({
    color: getTreasureColor(levelState.treasureSpawn.type),
    emissive: getTreasureEmissive(levelState.treasureSpawn.type),
    emissiveIntensity: 0.6,
  })
  const mesh = new THREE.Mesh(geometry, material)
  const worldPos = gridToWorld(
    levelState.treasureSpawn.cell.x,
    levelState.treasureSpawn.cell.y
  )
  mesh.position.set(worldPos.x, 1.1, worldPos.z)
  state.scene?.add(mesh)
  state.treasurePickups.push({
    mesh,
    cell: levelState.treasureSpawn.cell,
    type: levelState.treasureSpawn.type,
  })
}

export function refreshTorchLights(roomList: LevelData['rooms']) {
  state.torchLights.forEach((light) => state.scene?.remove(light))
  state.torchLights = []
  roomList.forEach((room, index) => {
    if (index % 2 === 0) {
      const baseColor = getTorchColor(room.tag)
      const baseIntensity = room.tag === 'treasure' ? 1.5 : room.tag === 'trap' ? 0.9 : 1.2
      const light = new THREE.PointLight(baseColor, baseIntensity, 16, 2)
      light.position.set(room.centerX, 2.6, room.centerZ)
      light.userData.baseIntensity = baseIntensity
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
  clearDoors()
  clearTreasurePickups()
  clearLever()
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
  spawnDoors(levelState)
  spawnLever(levelState)
  spawnTreasurePickups(levelState)

  spawnProps(levelState.propSpawns)
  spawnPotions(levelState.potionSpawns)
  camera.position.set(levelState.startRoom.centerX, 1.7, levelState.startRoom.centerZ)
  state.controls.velocity.set(0, 0, 0)
  spawnEnemies(levelState.enemySpawns)
  spawnKeyMesh(levelState.keyCell)

  if (state.ui.keyNotice) state.ui.keyNotice.style.display = 'none'
  if (state.ui.potionNotice) state.ui.potionNotice.style.display = 'none'
  if (state.ui.itemNotice) state.ui.itemNotice.style.display = 'none'
  if (state.ui.leverNotice) state.ui.leverNotice.style.display = 'none'
  if (state.ui.doorHint) state.ui.doorHint.style.display = 'none'
}

function generateDungeon(width: number, height: number, rng: Rng): LevelData {
  const grid = Array.from({ length: height }, () => Array(width).fill(1))
  const rooms: Room[] = []

  const maxRooms = 12
  const attempts = 40
  let roomId = 0

  for (let i = 0; i < attempts && rooms.length < maxRooms; i += 1) {
    const roomWidth = randRange(rng, 4, 8)
    const roomHeight = randRange(rng, 4, 8)
    const x = randRange(rng, 1, width - roomWidth - 2)
    const y = randRange(rng, 1, height - roomHeight - 2)

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
      id: roomId,
      x,
      y,
      w: roomWidth,
      h: roomHeight,
      centerX: centerWorld.x,
      centerZ: centerWorld.z,
      centerCell,
    })
    roomId += 1
  }

  rooms.sort((a, b) => a.centerCell.x - b.centerCell.x)

  for (let i = 1; i < rooms.length; i += 1) {
    const prev = rooms[i - 1].centerCell
    const current = rooms[i].centerCell
    carveCorridor(grid, prev, current, rng)
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
      id: roomId,
      ...fallback,
      centerX: centerWorld.x,
      centerZ: centerWorld.z,
      centerCell,
    })
    roomId += 1
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
  gridSource: number[][],
  rng: Rng
) {
  const candidates = roomList.filter((room) => room !== start && room !== exit)
  const farRooms = candidates.filter(
    (room) => manhattan(room.centerCell, start.centerCell) >= 8
  )
  const keyRoom =
    pickRandomRoom(farRooms, rng) ?? pickRandomRoom(candidates, rng) ?? start
  return (
    getRandomFloorCellInRoomWithRng(keyRoom, 4, start.centerCell, gridSource, rng) ||
    keyRoom.centerCell
  )
}

function generateEnemySpawns(
  roomList: LevelData['rooms'],
  startCell: GridPoint,
  count: number,
  gridSource: number[][],
  rng: Rng
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
    const cell = getRandomFloorCellInRoomWithRng(room, 8, startCell, gridSource, rng)
    if (!cell) continue
    spawns.push({ cell, type: i < rangedCount ? 'ranged' : 'melee' })
  }

  roomList
    .filter((room) => room.tag === 'trap')
    .forEach((room) => {
      const cell = getRandomFloorCellInRoomWithRng(room, 4, startCell, gridSource, rng)
      if (cell) {
        spawns.push({ cell, type: 'melee' })
      }
    })

  return spawns
}

function generatePropSpawns(
  roomList: LevelData['rooms'],
  start: LevelData['rooms'][number],
  exit: LevelData['rooms'][number],
  gridSource: number[][],
  rng: Rng
): SpawnInfo[] {
  const spawns: SpawnInfo[] = []
  const occupied = new Set<string>()
  const types = ['crate', 'barrel', 'pillar', 'rock']

  roomList.forEach((room) => {
    if (room === start || room === exit) return
    const baseMin = room.tag === 'armory' ? 2 : 1
    const baseMax = room.tag === 'armory' ? 4 : 3
    const propCount = randRange(rng, baseMin, baseMax)
    for (let i = 0; i < propCount; i += 1) {
      const cell = getRandomFloorCellInRoomWithRng(room, 4, start.centerCell, gridSource, rng)
      if (!cell) continue
      const key = `${cell.x},${cell.y}`
      if (occupied.has(key)) continue
      occupied.add(key)
      const type = types[Math.floor(rng() * types.length)]
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
  gridSource: number[][],
  rng: Rng
): SpawnInfo[] {
  const spawns: SpawnInfo[] = []
  const occupied = new Set<string>([`${keyCell.x},${keyCell.y}`])
  const candidateRooms = roomList.filter((room) => room !== start && room !== exit)

  const potionCount = randRange(rng, 2, 4)
  for (let i = 0; i < potionCount; i += 1) {
    const room = pickRandomRoom(candidateRooms, rng) ?? start
    const cell = getRandomFloorCellInRoomWithRng(room, 4, start.centerCell, gridSource, rng)
    if (!cell) continue
    const key = `${cell.x},${cell.y}`
    if (occupied.has(key)) continue
    occupied.add(key)
    spawns.push({ cell, type: 'potion' })
  }

  return spawns
}

type Rng = () => number

function createRng(seed: number): Rng {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function randRange(rng: Rng, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function pickRandomRoom<T extends Room>(rooms: T[], rng: Rng) {
  if (rooms.length === 0) return null
  return rooms[Math.floor(rng() * rooms.length)]
}

function pickRoomFromTop(rooms: Room[], rng: Rng) {
  if (rooms.length === 0) return null
  const topCount = Math.max(1, Math.ceil(rooms.length * 0.5))
  return rooms[Math.floor(rng() * topCount)]
}

function findRoomForCell(rooms: Room[], cell: GridPoint) {
  return (
    rooms.find(
      (room) =>
        cell.x >= room.x &&
        cell.x < room.x + room.w &&
        cell.y >= room.y &&
        cell.y < room.y + room.h
    ) ?? null
  )
}

function assignRoomTags(
  rooms: Room[],
  start: Room,
  exit: Room,
  keyRoom: Room | null,
  gridSource: number[][],
  rng: Rng
) {
  rooms.forEach((room) => {
    room.tag = undefined
  })

  const candidates = rooms.filter(
    (room) => room !== start && room !== exit && room !== keyRoom
  )
  if (candidates.length === 0) return

  const sorted = [...candidates].sort(
    (a, b) =>
      manhattan(b.centerCell, start.centerCell) - manhattan(a.centerCell, start.centerCell)
  )

  const leafCandidates = sorted.filter(
    (room) => findRoomEntrances(room, gridSource).length <= 1
  )
  const treasureRoom = pickRoomFromTop(leafCandidates.length > 0 ? leafCandidates : sorted, rng)
  if (treasureRoom) treasureRoom.tag = 'treasure'

  const remaining = sorted.filter((room) => room !== treasureRoom)
  const trapRoom = pickRoomFromTop(remaining, rng)
  if (trapRoom) trapRoom.tag = 'trap'

  const armoryRoom = pickRoomFromTop(remaining.filter((room) => room !== trapRoom), rng)
  if (armoryRoom) armoryRoom.tag = 'armory'
}

function pickLeverCell(
  rooms: Room[],
  start: Room,
  exit: Room,
  keyRoom: Room | null,
  treasureRoom: Room | null,
  gridSource: number[][],
  rng: Rng
) {
  const candidates = rooms.filter(
    (room) => room !== start && room !== exit && room !== keyRoom && room !== treasureRoom
  )

  let chosen = candidates[0] ?? start
  if (treasureRoom && candidates.length > 0) {
    chosen = candidates.reduce((best, room) =>
      manhattan(room.centerCell, treasureRoom.centerCell) >
      manhattan(best.centerCell, treasureRoom.centerCell)
        ? room
        : best
    )
  } else if (candidates.length > 0) {
    chosen = candidates[Math.floor(rng() * candidates.length)]
  }

  return (
    getRandomFloorCellInRoomWithRng(chosen, 3, start.centerCell, gridSource, rng) ||
    chosen.centerCell
  )
}

function createTreasureSpawn(
  room: Room,
  referenceCell: GridPoint,
  gridSource: number[][],
  rng: Rng
) {
  const types: ConsumableType[] = ['medkit', 'shield', 'scanner']
  const type = types[Math.floor(rng() * types.length)]
  const cell =
    getRandomFloorCellInRoomWithRng(room, 4, referenceCell, gridSource, rng) ||
    room.centerCell
  return { cell, type }
}

function getRandomFloorCellInRoomWithRng(
  room: { x: number; y: number; w: number; h: number },
  minDistanceFromCell: number,
  referenceCell: GridPoint,
  gridSource: number[][],
  rng: Rng
) {
  let cell: GridPoint = { x: 1, y: 1 }
  let attempts = 0
  do {
    cell = {
      x: room.x + Math.floor(rng() * room.w),
      y: room.y + Math.floor(rng() * room.h),
    }
    attempts += 1
  } while (
    (gridSource[cell.y][cell.x] !== 0 ||
      manhattan(cell, referenceCell) < minDistanceFromCell) &&
    attempts < 100
  )
  if (gridSource[cell.y][cell.x] === 0) return cell
  return null
}

function findRoomEntrances(room: Room, gridSource: number[][]) {
  const entrances: GridPoint[] = []
  const seen = new Set<string>()
  const minX = room.x
  const maxX = room.x + room.w - 1
  const minY = room.y
  const maxY = room.y + room.h - 1

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (x !== minX && x !== maxX && y !== minY && y !== maxY) continue
      if (gridSource[y]?.[x] !== 0) continue

      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ]

      neighbors.forEach((neighbor) => {
        if (
          neighbor.x < minX ||
          neighbor.x > maxX ||
          neighbor.y < minY ||
          neighbor.y > maxY
        ) {
          if (gridSource[neighbor.y]?.[neighbor.x] !== 0) return
          const key = `${x},${y}`
          if (seen.has(key)) return
          entrances.push({ x, y })
          seen.add(key)
        }
      })
    }
  }

  return entrances
}

function revealTreasureArea(levelState: LevelState) {
  const treasureRoom = levelState.rooms.find((room) => room.tag === 'treasure')
  if (!treasureRoom) return

  const minX = Math.max(0, treasureRoom.x - 1)
  const maxX = Math.min(config.gridWidth - 1, treasureRoom.x + treasureRoom.w)
  const minY = Math.max(0, treasureRoom.y - 1)
  const maxY = Math.min(config.gridHeight - 1, treasureRoom.y + treasureRoom.h)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (levelState.grid[y][x] !== 0) continue
      levelState.discovered[y][x] = true
    }
  }

  refreshDiscoveryFlags(levelState)
}

function refreshDiscoveryFlags(levelState: LevelState) {
  if (levelState.discovered[levelState.keyCell.y][levelState.keyCell.x]) {
    levelState.keyDiscovered = true
  }
  if (levelState.discovered[levelState.exitRoom.centerCell.y][levelState.exitRoom.centerCell.x]) {
    levelState.portalDiscovered = true
  }
}

function formatConsumableLabel(type: ConsumableType) {
  switch (type) {
    case 'medkit':
      return 'Medkit'
    case 'shield':
      return 'Shield'
    case 'scanner':
      return 'Scanner'
    default:
      return 'Item'
  }
}

function pickDoorCell(
  candidates: GridPoint[],
  gridSource: number[][],
  startCell: GridPoint,
  requiredReachable: GridPoint[]
) {
  const filtered = candidates.filter((cell) =>
    canReachAllCells(gridSource, startCell, requiredReachable, new Set([cellKey(cell)]))
  )
  if (filtered.length === 0) return null
  return filtered[0]
}

function pickTreasureDoorCell(
  candidates: GridPoint[],
  gridSource: number[][],
  startCell: GridPoint,
  leverCell: GridPoint,
  treasureCell: GridPoint
) {
  for (const candidate of candidates) {
    const blocked = new Set([cellKey(candidate)])
    const reachable = floodFillReachable(gridSource, startCell, blocked)
    if (!reachable.has(cellKey(leverCell))) continue
    if (reachable.has(cellKey(treasureCell))) continue
    return candidate
  }
  return null
}

function canReachAllCells(
  gridSource: number[][],
  startCell: GridPoint,
  targets: GridPoint[],
  blocked: Set<string>
) {
  const reachable = floodFillReachable(gridSource, startCell, blocked)
  for (const target of targets) {
    if (!reachable.has(cellKey(target))) return false
  }
  return true
}

function floodFillReachable(
  gridSource: number[][],
  startCell: GridPoint,
  blocked: Set<string>
) {
  const visited = new Set<string>()
  const queue: GridPoint[] = [startCell]
  visited.add(cellKey(startCell))

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    ]

    for (const neighbor of neighbors) {
      if (
        neighbor.x < 0 ||
        neighbor.y < 0 ||
        neighbor.x >= config.gridWidth ||
        neighbor.y >= config.gridHeight
      ) {
        continue
      }
      if (gridSource[neighbor.y][neighbor.x] !== 0) continue
      const key = cellKey(neighbor)
      if (blocked.has(key) || visited.has(key)) continue
      visited.add(key)
      queue.push(neighbor)
    }
  }

  return visited
}

function cellKey(cell: GridPoint) {
  return `${cell.x},${cell.y}`
}


function getTreasureColor(type: ConsumableType) {
  switch (type) {
    case 'medkit':
      return 0x63ff9a
    case 'shield':
      return 0x63c7ff
    case 'scanner':
      return 0xd38cff
    default:
      return 0x9bd8ff
  }
}

function getTreasureEmissive(type: ConsumableType) {
  switch (type) {
    case 'medkit':
      return 0x2a8f5a
    case 'shield':
      return 0x1f5f88
    case 'scanner':
      return 0x5f2a88
    default:
      return 0x35648c
  }
}

function getTorchColor(tag?: RoomTag) {
  switch (tag) {
    case 'treasure':
      return 0x78d6ff
    case 'trap':
      return 0xff6b5b
    case 'armory':
      return 0xffc36e
    default:
      return 0xffb26a
  }
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

function carveCorridor(grid: number[][], from: GridPoint, to: GridPoint, rng: Rng) {
  const horizontalFirst = rng() > 0.5
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

