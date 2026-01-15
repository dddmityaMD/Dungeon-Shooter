import * as THREE from 'three'
import { initAudio } from './audio'
import { resolveCollisions } from './collision'
import { fireBullet } from './combat'
import { fadeIn, fadeOut, nextLevel, resetGame } from './level'
import { state } from './state'

export function setupInputHandlers() {
  const startButton = state.ui.startButton
  const nextLevelButton = state.ui.nextLevelButton
  const stayButton = state.ui.stayButton
  const overlay = state.ui.overlay
  const levelModal = state.ui.levelModal
  const camera = state.camera
  const renderer = state.renderer

  if (startButton && overlay && renderer) {
    startButton.addEventListener('click', () => {
      if (state.player.health <= 0) {
        resetGame()
      }
      initAudio()
      state.controls.isActive = true
      overlay.style.display = 'none'
      renderer.domElement.requestPointerLock()
    })
  }

  if (nextLevelButton && levelModal) {
    nextLevelButton.addEventListener('click', () => {
      levelModal.style.display = 'none'
      fadeOut()
      setTimeout(() => {
        nextLevel()
        fadeIn()
      }, 500)
    })
  }

  if (stayButton && levelModal && camera) {
    stayButton.addEventListener('click', () => {
      levelModal.style.display = 'none'
      camera.position.x -= 1
      state.levelTransition = false
    })
  }

  if (renderer && overlay) {
    document.addEventListener('pointerlockchange', () => {
      state.controls.isLocked = document.pointerLockElement === renderer.domElement
      if (state.controls.isLocked) {
        state.controls.isActive = true
        overlay.style.display = 'none'
        state.controls.lastMouse.x = null
        state.controls.lastMouse.y = null
      } else if (state.player.health > 0) {
        state.controls.isActive = false
        overlay.style.display = 'grid'
      }
    })
  }

  window.addEventListener('keydown', (event) => {
    state.controls.keys.add(event.code)
  })

  window.addEventListener('keyup', (event) => {
    state.controls.keys.delete(event.code)
  })

  window.addEventListener('mousemove', (event) => {
    if (!state.controls.isActive) return
    if (state.controls.isLocked) {
      applyLookDelta(event.movementX, event.movementY)
      return
    }
    if (state.controls.lastMouse.x === null || state.controls.lastMouse.y === null) {
      state.controls.lastMouse.x = event.clientX
      state.controls.lastMouse.y = event.clientY
      return
    }
    const deltaX = event.clientX - state.controls.lastMouse.x
    const deltaY = event.clientY - state.controls.lastMouse.y
    state.controls.lastMouse.x = event.clientX
    state.controls.lastMouse.y = event.clientY
    applyLookDelta(deltaX, deltaY)
  })

  window.addEventListener('mousedown', () => {
    if (!state.controls.isActive) return
    const now = performance.now()
    if (now - state.timers.lastShot < 180) return
    state.timers.lastShot = now
    fireBullet()
  })

  if (camera && renderer) {
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }
}

export function updateMovement(delta: number) {
  const camera = state.camera
  if (!camera) return

  state.controls.moveDir.set(0, 0, 0)
  if (state.controls.keys.has('KeyW')) state.controls.moveDir.z += 1
  if (state.controls.keys.has('KeyS')) state.controls.moveDir.z -= 1
  if (state.controls.keys.has('KeyA')) state.controls.moveDir.x -= 1
  if (state.controls.keys.has('KeyD')) state.controls.moveDir.x += 1

  state.controls.moveDir.normalize()
  const speed = state.controls.keys.has('ShiftLeft') ? 8.5 : 6

  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0
  forward.normalize()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0))

  const desired = new THREE.Vector3()
  desired.addScaledVector(forward, state.controls.moveDir.z * speed)
  desired.addScaledVector(right, state.controls.moveDir.x * speed)

  const accel = 24
  state.controls.velocity.x +=
    (desired.x - state.controls.velocity.x) * Math.min(1, accel * delta)
  state.controls.velocity.z +=
    (desired.z - state.controls.velocity.z) * Math.min(1, accel * delta)

  camera.position.x += state.controls.velocity.x * delta
  camera.position.z += state.controls.velocity.z * delta
  resolveCollisions(camera.position, 0.7)
  camera.position.y = 1.7
}

export function updateCamera(delta: number) {
  const camera = state.camera
  if (!camera) return

  state.recoil.pitch = THREE.MathUtils.damp(
    state.recoil.pitch,
    0,
    state.recoil.recoverSpeed,
    delta
  )
  state.recoil.yaw = THREE.MathUtils.damp(
    state.recoil.yaw,
    0,
    state.recoil.recoverSpeed,
    delta
  )
  camera.rotation.set(
    state.controls.pitch + state.recoil.pitch,
    state.controls.yaw + state.recoil.yaw,
    0,
    'YXZ'
  )
}

function applyLookDelta(deltaX: number, deltaY: number) {
  const sensitivity = 0.002
  state.controls.yaw -= deltaX * sensitivity
  state.controls.pitch -= deltaY * sensitivity
  state.controls.pitch = Math.max(-1.35, Math.min(1.35, state.controls.pitch))
}
