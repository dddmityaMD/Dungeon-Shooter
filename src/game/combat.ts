import * as THREE from 'three'
import { playGunshot } from './audio'
import { state, config, type Enemy } from './state'
import { triggerDamageFeedback, triggerHitmarker } from './effects'
import { isPointInsideObstacle, segmentAabbIntersect, segmentSphereIntersect } from './collision'
import { damageProp, getPropHitIndex } from './props'

const hitRaycaster = new THREE.Raycaster()

export function applyPlayerDamage(amount: number) {
  let remaining = amount
  if (state.player.shield > 0) {
    const absorbed = Math.min(state.player.shield, remaining)
    state.player.shield -= absorbed
    remaining -= absorbed
  }
  if (remaining > 0) {
    state.player.health = Math.max(0, state.player.health - remaining)
  }
}

export function fireBullet() {
  const camera = state.camera
  const bulletGeo = state.geometry.bulletGeo
  const bulletMat = state.materials.bulletMat
  if (!camera || !bulletGeo || !bulletMat) return

  const bullet = new THREE.Mesh(bulletGeo, bulletMat)
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  bullet.position.copy(camera.position).addScaledVector(forward, 0.6)
  bullet.userData.velocity = forward.clone().multiplyScalar(config.bulletSpeed)
  bullet.userData.age = 0
  bullet.userData.prevPosition = bullet.position.clone()
  state.scene?.add(bullet)
  state.bullets.push(bullet)

  state.recoil.pitch += 0.04
  state.recoil.yaw += (Math.random() - 0.5) * 0.02
  state.effects.crosshairTimer = 0.12
  triggerMuzzleFlash(forward)
  spawnTracer(forward)
  playGunshot()
}

export function updateBullets(delta: number) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i]
    const velocityVec = bullet.userData.velocity as THREE.Vector3
    const prevPosition = bullet.userData.prevPosition as THREE.Vector3
    prevPosition.copy(bullet.position)
    bullet.position.addScaledVector(velocityVec, delta)
    bullet.userData.age += delta

    const hitPropIndex = getPropHitIndex(prevPosition, bullet.position)
    if (hitPropIndex !== -1) {
      damageProp(hitPropIndex)
      state.scene?.remove(bullet)
      state.bullets.splice(i, 1)
      continue
    }

    if (bullet.userData.age > 2.5 || isPointInsideObstacle(bullet.position)) {
      state.scene?.remove(bullet)
      state.bullets.splice(i, 1)
    }
  }
}

export function spawnEnemyProjectile(enemy: Enemy) {
  const enemyBoltGeo = state.geometry.enemyBoltGeo
  const enemyBoltMat = state.materials.enemyBoltMat
  if (!enemyBoltGeo || !enemyBoltMat || !state.camera) return

  const origin = enemy.mesh.position.clone()
  origin.y += 1.2
  const target = state.camera.position.clone()
  target.y = origin.y
  const direction = new THREE.Vector3().subVectors(target, origin).normalize()

  const bolt = new THREE.Mesh(enemyBoltGeo, enemyBoltMat)
  bolt.position.copy(origin)
  state.scene?.add(bolt)
  state.enemyProjectiles.push({
    mesh: bolt,
    velocity: direction.multiplyScalar(10),
    age: 0,
    prev: origin.clone(),
  })
}

export function updateEnemyProjectiles(delta: number) {
  const camera = state.camera
  if (!camera) return

  for (let i = state.enemyProjectiles.length - 1; i >= 0; i -= 1) {
    const projectile = state.enemyProjectiles[i]
    projectile.prev.copy(projectile.mesh.position)
    projectile.mesh.position.addScaledVector(projectile.velocity, delta)
    projectile.age += delta

    const hitObstacle = state.wallAabbs
      .concat(state.propColliders, state.doorColliders)
      .some((wall) =>
        segmentAabbIntersect(projectile.prev, projectile.mesh.position, wall)
      )
    if (hitObstacle || projectile.age > 4) {
      state.scene?.remove(projectile.mesh)
      state.enemyProjectiles.splice(i, 1)
      continue
    }

    const playerCenter = camera.position.clone()
    const playerHit = segmentSphereIntersect(
      projectile.prev,
      projectile.mesh.position,
      playerCenter,
      0.9
    )
    if (playerHit) {
      applyPlayerDamage(20)
      triggerDamageFeedback()
      state.scene?.remove(projectile.mesh)
      state.enemyProjectiles.splice(i, 1)
    }
  }
}

export function handleBulletHits() {
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i]
    for (let j = state.bullets.length - 1; j >= 0; j -= 1) {
      const bullet = state.bullets[j]
      if ((bullet.userData.age as number) < 0.02) continue

      const prev = bullet.userData.prevPosition as THREE.Vector3
      const direction = new THREE.Vector3().subVectors(bullet.position, prev)
      const distance = direction.length()
      if (distance <= 0.0001) continue

      hitRaycaster.ray.origin.copy(prev)
      hitRaycaster.ray.direction.copy(direction.normalize())
      hitRaycaster.far = distance

      const intersections = hitRaycaster.intersectObject(enemy.mesh, true)
      if (intersections.length === 0) continue

      const isHeadshot = intersections.some((hit) =>
        hit.object.name.toLowerCase().includes('head')
      )

      enemy.health -= isHeadshot ? config.headshotDamage : config.bulletDamage
      enemy.hitFlashTimer = 0.15
      triggerHitmarker()
      state.scene?.remove(bullet)
      state.bullets.splice(j, 1)
      if (enemy.health <= 0) {
        state.scene?.remove(enemy.mesh)
        state.enemies.splice(i, 1)
        state.remainingEnemies = Math.max(0, state.remainingEnemies - 1)
        state.player.score += 25
      }
      break
    }
  }
}

export function triggerMuzzleFlash(direction: THREE.Vector3) {
  if (!state.muzzleFlash || !state.camera) return
  state.muzzleFlash.position.copy(state.camera.position).addScaledVector(direction, 0.6)
  state.muzzleFlash.intensity = 2.5
  state.timers.muzzleFlashTimer = 0.08
}

export function spawnTracer(direction: THREE.Vector3) {
  if (!state.camera) return
  const start = state.camera.position.clone().addScaledVector(direction, 0.6)
  const end = start.clone().addScaledVector(direction, 6)
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end])
  const material = new THREE.LineBasicMaterial({
    color: 0xffd18a,
    transparent: true,
    opacity: 0.8,
  })
  const line = new THREE.Line(geometry, material)
  state.scene?.add(line)
  state.tracers.push({ line, life: 0.08 })
}

export function resetCombat() {
  state.bullets.forEach((bullet) => state.scene?.remove(bullet))
  state.bullets.length = 0
  state.enemyProjectiles.forEach((projectile) => state.scene?.remove(projectile.mesh))
  state.enemyProjectiles.length = 0
  state.tracers.forEach((tracer) => state.scene?.remove(tracer.line))
  state.tracers.length = 0
}
