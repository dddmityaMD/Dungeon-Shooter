import * as THREE from 'three'
import { playDamageSound, playHitmarker } from './audio'
import { state } from './state'

export function triggerHitmarker() {
  state.effects.hitmarkerTimer = 0.12
  playHitmarker()
}

export function triggerDamageFeedback() {
  state.effects.damageVignetteTimer = 0.3
  playDamageSound()
}

export function updateEffects(delta: number, time: number) {
  const hitmarker = state.ui.hitmarker
  const crosshair = state.ui.crosshair
  const vignette = state.ui.damageVignette

  if (hitmarker) {
    if (state.effects.hitmarkerTimer > 0) {
      state.effects.hitmarkerTimer = Math.max(0, state.effects.hitmarkerTimer - delta)
      hitmarker.style.opacity = `${state.effects.hitmarkerTimer / 0.12}`
    } else {
      hitmarker.style.opacity = '0'
    }
  }

  if (crosshair) {
    if (state.effects.crosshairTimer > 0) {
      state.effects.crosshairTimer = Math.max(0, state.effects.crosshairTimer - delta)
    }
    const crosshairScale = 1 + (state.effects.crosshairTimer / 0.12) * 0.4
    crosshair.style.transform = `translate(-50%, -50%) scale(${crosshairScale.toFixed(2)})`
  }

  if (vignette) {
    if (state.effects.damageVignetteTimer > 0) {
      state.effects.damageVignetteTimer = Math.max(0, state.effects.damageVignetteTimer - delta)
      vignette.style.opacity = `${(state.effects.damageVignetteTimer / 0.3) * 0.6}`
    } else {
      vignette.style.opacity = '0'
    }
  }

  if (state.timers.muzzleFlashTimer > 0 && state.muzzleFlash) {
    state.timers.muzzleFlashTimer = Math.max(0, state.timers.muzzleFlashTimer - delta)
    state.muzzleFlash.intensity = (state.timers.muzzleFlashTimer / 0.08) * 2.5
  } else if (state.muzzleFlash) {
    state.muzzleFlash.intensity = 0
  }

  for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
    const tracer = state.tracers[i]
    tracer.life -= delta
    if (tracer.life <= 0) {
      state.scene?.remove(tracer.line)
      tracer.line.geometry.dispose()
      ;(tracer.line.material as THREE.Material).dispose()
      state.tracers.splice(i, 1)
    }
  }

  state.torchLights.forEach((light, index) => {
    const base = (light.userData.baseIntensity as number | undefined) ?? 1.1
    const flicker =
      Math.sin(time * 0.005 + index) * 0.12 +
      Math.sin(time * 0.011 + index * 1.7) * 0.08
    light.intensity = base + flicker
  })

  if (state.keyMesh) {
    state.keyMesh.rotation.y += delta * 1.5
    state.keyMesh.position.y = 1.2 + Math.sin(time * 0.004) * 0.15
  }

  if (state.exitPortal) {
    const portalLight = state.exitPortal.userData.light as THREE.PointLight | undefined
    const portalSurface = state.exitPortal.userData.surface as THREE.Mesh | undefined
    const unlocked = state.remainingEnemies === 0 && state.levelState?.hasKey
    const intensity = unlocked ? 3.2 : 1.4
    if (portalLight) portalLight.intensity = intensity
    if (portalSurface && portalSurface.material instanceof THREE.MeshStandardMaterial) {
      portalSurface.material.emissiveIntensity = unlocked ? 0.8 : 0.3
    }
  }
}

export function updateHUD() {
  if (state.ui.hudLevel) state.ui.hudLevel.textContent = `${state.currentLevel}`
  if (state.ui.hudScore) state.ui.hudScore.textContent = `${state.player.score}`
  if (state.ui.hudHealth) {
    state.ui.hudHealth.textContent = `${Math.max(0, Math.round(state.player.health))}`
  }
  if (state.ui.hudEnemies) {
    state.ui.hudEnemies.textContent = `${state.remainingEnemies}`
  }
  if (state.ui.hudItem) {
    state.ui.hudItem.textContent = state.inventory.held
      ? `${formatItemLabel(state.inventory.held)} (Q)`
      : 'None'
  }
  if (state.ui.hudShield) {
    state.ui.hudShield.textContent = `${Math.max(0, Math.round(state.player.shield))}`
  }
}

function formatItemLabel(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1)
}
