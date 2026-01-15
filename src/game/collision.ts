import * as THREE from 'three'
import { state } from './state'
import type { WallAabb } from './state'

export function resolveCollisions(position: THREE.Vector3, radius: number) {
  const colliders = state.wallAabbs.concat(state.propColliders, state.doorColliders)
  for (const wall of colliders) {
    const closestX = Math.max(wall.minX, Math.min(wall.maxX, position.x))
    const closestZ = Math.max(wall.minZ, Math.min(wall.maxZ, position.z))
    const dx = position.x - closestX
    const dz = position.z - closestZ
    const distanceSq = dx * dx + dz * dz
    if (distanceSq < radius * radius) {
      if (Math.abs(dx) > Math.abs(dz)) {
        position.x = closestX + Math.sign(dx || 1) * radius
      } else {
        position.z = closestZ + Math.sign(dz || 1) * radius
      }
    }
  }
}

export function isPointInsideObstacle(position: THREE.Vector3) {
  const colliders = state.wallAabbs.concat(state.propColliders, state.doorColliders)
  for (const wall of colliders) {
    if (
      position.x >= wall.minX &&
      position.x <= wall.maxX &&
      position.z >= wall.minZ &&
      position.z <= wall.maxZ
    ) {
      return true
    }
  }
  return false
}

export function segmentAabbIntersect(
  start: THREE.Vector3,
  end: THREE.Vector3,
  box: WallAabb
) {
  const dir = new THREE.Vector3().subVectors(end, start)
  let tMin = 0
  let tMax = 1

  const axes: Array<{ origin: number; direction: number; min: number; max: number }> = [
    { origin: start.x, direction: dir.x, min: box.minX, max: box.maxX },
    { origin: start.z, direction: dir.z, min: box.minZ, max: box.maxZ },
  ]

  for (const axis of axes) {
    if (Math.abs(axis.direction) < 1e-6) {
      if (axis.origin < axis.min || axis.origin > axis.max) return false
      continue
    }
    const inv = 1 / axis.direction
    let t1 = (axis.min - axis.origin) * inv
    let t2 = (axis.max - axis.origin) * inv
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  }

  return true
}

export function segmentSphereIntersect(
  start: THREE.Vector3,
  end: THREE.Vector3,
  center: THREE.Vector3,
  radius: number
) {
  const dir = new THREE.Vector3().subVectors(end, start)
  const lenSq = dir.lengthSq()
  if (lenSq === 0) return start.distanceTo(center) <= radius
  const t = Math.max(
    0,
    Math.min(1, new THREE.Vector3().subVectors(center, start).dot(dir) / lenSq)
  )
  const closest = new THREE.Vector3().copy(start).addScaledVector(dir, t)
  return closest.distanceTo(center) <= radius
}
