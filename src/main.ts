import './style.css'
import * as THREE from 'three'
import { updateBullets, updateEnemyProjectiles, handleBulletHits } from './game/combat'
import { updateEffects, updateHUD } from './game/effects'
import { initEnemyAssets, updateEnemies } from './game/enemies'
import {
  checkPortal,
  initLevel,
  updateDiscovery,
  updateGameOver,
  updateKeyPickup,
  updatePotionPickup,
} from './game/level'
import { updateMinimap } from './game/minimap'
import { initMaterials } from './game/materials'
import { setupInputHandlers, updateCamera, updateMovement } from './game/input'
import { state } from './game/state'

const app = document.querySelector<HTMLDivElement>('#app')!

const hud = document.createElement('div')
hud.id = 'hud'
hud.innerHTML = `
  <div>Level: <span id="level">1</span></div>
  <div>Score: <span id="score">0</span></div>
  <div>Health: <span id="health">100</span></div>
  <div>Enemies: <span id="enemies">0</span></div>
`

const overlay = document.createElement('div')
overlay.id = 'overlay'
overlay.innerHTML = `
  <div>
    <button id="start">Click to Start</button>
    <p>WASD to move · Mouse to look · Click to shoot · ESC to release</p>
  </div>
`

const crosshair = document.createElement('div')
crosshair.id = 'crosshair'

const hitmarker = document.createElement('div')
hitmarker.id = 'hitmarker'

const portalHint = document.createElement('div')
portalHint.id = 'portal-hint'
portalHint.textContent = 'Defeat all enemies to activate the portal'
portalHint.style.display = 'none'

const keyNotice = document.createElement('div')
keyNotice.id = 'key-notice'
keyNotice.textContent = 'Key found'
keyNotice.style.display = 'none'

const potionNotice = document.createElement('div')
potionNotice.id = 'potion-notice'
potionNotice.textContent = '+25 HP'
potionNotice.style.display = 'none'

const minimap = document.createElement('canvas')
minimap.id = 'minimap'
minimap.width = 200
minimap.height = 200
const minimapCtx = minimap.getContext('2d')

const damageVignette = document.createElement('div')
damageVignette.id = 'damage-vignette'

const levelModal = document.createElement('div')
levelModal.id = 'level-modal'
levelModal.tabIndex = -1
levelModal.innerHTML = `
  <div>
    <h2>Level Complete!</h2>
    <p>Do you want to proceed to the next level?</p>
    <button id="next-level">Yes, next level</button>
    <button id="stay">Stay here</button>
  </div>
`

const fadeOverlay = document.createElement('div')
fadeOverlay.style.position = 'absolute'
fadeOverlay.style.inset = '0'
fadeOverlay.style.backgroundColor = 'black'
fadeOverlay.style.opacity = '0'
fadeOverlay.style.transition = 'opacity 0.5s'
fadeOverlay.style.pointerEvents = 'none'
fadeOverlay.style.zIndex = '5'

app.append(
  hud,
  overlay,
  levelModal,
  portalHint,
  keyNotice,
  potionNotice,
  minimap,
  hitmarker,
  crosshair,
  damageVignette,
  fadeOverlay
)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x05070d)
scene.fog = new THREE.Fog(0x05070d, 14, 80)

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  200
)

const ambient = new THREE.AmbientLight(0xa6a6a6, 0.28)
scene.add(ambient)

const hemisphere = new THREE.HemisphereLight(0xd8d2c8, 0x2a2a2a, 0.35)
hemisphere.position.set(0, 6, 0)
scene.add(hemisphere)

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
dirLight.position.set(12, 14, 6)
scene.add(dirLight)

const muzzleFlash = new THREE.PointLight(0xffc36e, 0, 6)
muzzleFlash.intensity = 0
scene.add(muzzleFlash)

state.scene = scene
state.camera = camera
state.renderer = renderer
state.muzzleFlash = muzzleFlash
state.ui.hudLevel = hud.querySelector<HTMLSpanElement>('#level')
state.ui.hudScore = hud.querySelector<HTMLSpanElement>('#score')
state.ui.hudHealth = hud.querySelector<HTMLSpanElement>('#health')
state.ui.hudEnemies = hud.querySelector<HTMLSpanElement>('#enemies')
state.ui.overlay = overlay
state.ui.levelModal = levelModal
state.ui.portalHint = portalHint
state.ui.keyNotice = keyNotice
state.ui.potionNotice = potionNotice
state.ui.crosshair = crosshair
state.ui.hitmarker = hitmarker
state.ui.damageVignette = damageVignette
state.ui.fadeOverlay = fadeOverlay
state.ui.minimap = minimap
state.ui.minimapCtx = minimapCtx
state.ui.startButton = overlay.querySelector<HTMLButtonElement>('#start')
state.ui.nextLevelButton = levelModal.querySelector<HTMLButtonElement>('#next-level')
state.ui.stayButton = levelModal.querySelector<HTMLButtonElement>('#stay')

initMaterials()
initEnemyAssets()
initLevel()
setupInputHandlers()

let lastTime = performance.now()
function animate(time: number) {
  const delta = Math.min(0.05, (time - lastTime) / 1000)
  lastTime = time

  updateCamera(delta)
  updateMovement(delta)
  updateBullets(delta)
  updateEnemies(delta, time)
  updateEnemyProjectiles(delta)
  handleBulletHits()
  updateKeyPickup()
  updatePotionPickup()
  updateDiscovery()
  updateMinimap()
  updateEffects(delta, time)
  updateHUD()
  updateGameOver()
  checkPortal()

  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

requestAnimationFrame(animate)
