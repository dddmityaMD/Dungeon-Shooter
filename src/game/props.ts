import * as THREE from 'three'
import { state, type SpawnInfo, type Prop, type WallAabb } from './state'
import { gridToWorld } from './grid'

export function clearProps() {
  state.props.forEach((prop) => state.scene?.remove(prop.mesh))
  state.props.length = 0
  state.propColliders.length = 0
}

export function spawnProps(spawns: SpawnInfo[]) {
  clearProps()
  spawns.forEach((spawn) => {
    const worldPos = gridToWorld(spawn.cell.x, spawn.cell.y)
    const prop = createProp(worldPos, spawn.type)
    state.props.push(prop)
    state.propColliders.push(prop.collider)
    state.scene?.add(prop.mesh)
  })
}

export function damageProp(index: number) {
  const prop = state.props[index]
  prop.health -= 1
  if (prop.health <= 0) {
    state.scene?.remove(prop.mesh)
    state.props.splice(index, 1)
    state.propColliders.splice(index, 1)
  }
}

export function getPropHitIndex(start: THREE.Vector3, end: THREE.Vector3) {
  for (let i = 0; i < state.props.length; i += 1) {
    if (segmentAabbIntersect(start, end, state.props[i].collider)) {
      return i
    }
  }
  return -1
}

function createProp(position: THREE.Vector3, type?: string): Prop {
  const types = ['crate', 'barrel', 'pillar', 'rock']
  const resolvedType = type ?? types[Math.floor(Math.random() * types.length)]
  let geometry: THREE.BufferGeometry
  let material: THREE.MeshStandardMaterial
  let health = 2

  const materials = state.materials

  switch (resolvedType) {
    case 'barrel':
      geometry = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 12)
      material = materials.propWoodMat ?? new THREE.MeshStandardMaterial()
      break
    case 'pillar':
      geometry = new THREE.CylinderGeometry(0.6, 0.6, 2.8, 12)
      material = materials.propStoneMat ?? new THREE.MeshStandardMaterial()
      health = 3
      break
    case 'rock':
      geometry = new THREE.DodecahedronGeometry(0.7)
      material = materials.propStoneMat ?? new THREE.MeshStandardMaterial()
      break
    default:
      geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2)
      material = materials.propWoodMat ?? new THREE.MeshStandardMaterial()
      break
  }

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(position)
  if (resolvedType === 'pillar') {
    mesh.position.y = 1.4
  } else {
    mesh.position.y = 0.6
  }

  const collider = getAabbFromMesh(mesh)
  return { mesh, collider, health }
}

function getAabbFromMesh(mesh: THREE.Mesh): WallAabb {
  const box = new THREE.Box3().setFromObject(mesh)
  return {
    minX: box.min.x,
    maxX: box.max.x,
    minZ: box.min.z,
    maxZ: box.max.z,
  }
}

function segmentAabbIntersect(
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

