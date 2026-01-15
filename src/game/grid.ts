import * as THREE from 'three'
import { config, state, type GridPoint } from './state'

export function gridToWorld(x: number, y: number) {
  return new THREE.Vector3(
    (x - config.gridWidth / 2) * config.cellSize + config.cellSize / 2,
    0,
    (y - config.gridHeight / 2) * config.cellSize + config.cellSize / 2
  )
}

export function worldToGrid(position: THREE.Vector3): GridPoint {
  const halfSize = (config.gridWidth * config.cellSize) / 2
  const gridX = Math.floor((position.x + halfSize) / config.cellSize)
  const gridY = Math.floor((position.z + halfSize) / config.cellSize)
  return {
    x: Math.max(0, Math.min(config.gridWidth - 1, gridX)),
    y: Math.max(0, Math.min(config.gridHeight - 1, gridY)),
  }
}

export function manhattan(a: GridPoint, b: GridPoint) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function getRandomFloorCell(minDistanceFromStart: number, grid: number[][]) {
  let cell: GridPoint = { x: 1, y: 1 }
  let attempts = 0
  const startCell = worldToGrid(state.camera!.position)
  do {
    cell = {
      x: Math.floor(Math.random() * config.gridWidth),
      y: Math.floor(Math.random() * config.gridHeight),
    }
    attempts += 1
  } while (
    (grid[cell.y][cell.x] === 1 ||
      manhattan(cell, startCell) < minDistanceFromStart) &&
    attempts < 200
  )
  return cell
}

export function getRandomFloorCellInRoom(
  room: { x: number; y: number; w: number; h: number },
  minDistanceFromCell: number,
  referenceCell: GridPoint,
  grid: number[][]
) {
  let cell: GridPoint = { x: 1, y: 1 }
  let attempts = 0
  do {
    cell = {
      x: room.x + Math.floor(Math.random() * room.w),
      y: room.y + Math.floor(Math.random() * room.h),
    }
    attempts += 1
  } while (
    (grid[cell.y][cell.x] !== 0 ||
      manhattan(cell, referenceCell) < minDistanceFromCell) &&
    attempts < 100
  )
  if (grid[cell.y][cell.x] === 0) return cell
  return null
}

export function createDiscoveryGrid() {
  return Array.from({ length: config.gridHeight }, () =>
    Array.from({ length: config.gridWidth }, () => false)
  )
}
