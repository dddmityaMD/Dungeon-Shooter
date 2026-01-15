import * as THREE from 'three'
import { config, state } from './state'
import { worldToGrid } from './grid'

export function updateMinimap() {
  const levelState = state.levelState
  const minimap = state.ui.minimap
  const minimapCtx = state.ui.minimapCtx
  const camera = state.camera
  if (!levelState || !minimap || !minimapCtx || !camera) return

  const size = minimap.width
  const cellSizePx = size / config.gridWidth
  minimapCtx.clearRect(0, 0, size, size)

  for (let y = 0; y < config.gridHeight; y += 1) {
    for (let x = 0; x < config.gridWidth; x += 1) {
      if (!levelState.discovered[y][x]) {
        minimapCtx.fillStyle = 'rgba(10, 12, 20, 0.9)'
      } else if (levelState.grid[y][x] === 1) {
        minimapCtx.fillStyle = '#2a2a2a'
      } else {
        minimapCtx.fillStyle = '#6b6b6b'
      }
      minimapCtx.fillRect(x * cellSizePx, y * cellSizePx, cellSizePx, cellSizePx)
    }
  }

  if (levelState.portalDiscovered) {
    minimapCtx.fillStyle = '#4fd4ff'
    minimapCtx.fillRect(
      levelState.exitRoom.centerCell.x * cellSizePx - 2,
      levelState.exitRoom.centerCell.y * cellSizePx - 2,
      4,
      4
    )
  }

  if (levelState.keyDiscovered && !levelState.hasKey) {
    minimapCtx.fillStyle = '#f5d76e'
    minimapCtx.fillRect(
      levelState.keyCell.x * cellSizePx - 2,
      levelState.keyCell.y * cellSizePx - 2,
      4,
      4
    )
  }

  state.doors.forEach((door) => {
    if (!levelState.discovered[door.cell.y][door.cell.x]) return
    minimapCtx.fillStyle = door.kind === 'exit' ? '#f5d76e' : '#d38cff'
    minimapCtx.fillRect(
      door.cell.x * cellSizePx - 2,
      door.cell.y * cellSizePx - 2,
      4,
      4
    )
  })

  if (state.lever && levelState.discovered[state.lever.cell.y][state.lever.cell.x]) {
    minimapCtx.fillStyle = '#8bf7ff'
    minimapCtx.fillRect(
      state.lever.cell.x * cellSizePx - 2,
      state.lever.cell.y * cellSizePx - 2,
      4,
      4
    )
  }

  state.treasurePickups.forEach((pickup) => {
    if (!levelState.discovered[pickup.cell.y][pickup.cell.x]) return
    minimapCtx.fillStyle =
      pickup.type === 'medkit'
        ? '#63ff9a'
        : pickup.type === 'shield'
          ? '#63c7ff'
          : '#d38cff'
    minimapCtx.fillRect(
      pickup.cell.x * cellSizePx - 2,
      pickup.cell.y * cellSizePx - 2,
      4,
      4
    )
  })

  state.potions.forEach((potion) => {
    if (!levelState.discovered[potion.cell.y][potion.cell.x]) return
    minimapCtx.fillStyle = '#63ff9a'
    minimapCtx.fillRect(
      potion.cell.x * cellSizePx - 2,
      potion.cell.y * cellSizePx - 2,
      4,
      4
    )
  })

  const playerCell = worldToGrid(camera.position)
  minimapCtx.fillStyle = '#ffffff'
  minimapCtx.beginPath()
  minimapCtx.arc(
    playerCell.x * cellSizePx,
    playerCell.y * cellSizePx,
    3,
    0,
    Math.PI * 2
  )
  minimapCtx.fill()

  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  minimapCtx.strokeStyle = '#ffffff'
  minimapCtx.beginPath()
  minimapCtx.moveTo(playerCell.x * cellSizePx, playerCell.y * cellSizePx)
  minimapCtx.lineTo(
    playerCell.x * cellSizePx + forward.x * 8,
    playerCell.y * cellSizePx + forward.z * 8
  )
  minimapCtx.stroke()
}
