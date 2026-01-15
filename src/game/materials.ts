import * as THREE from 'three'
import { config, derived, state } from './state'

export function initMaterials() {
  state.materials.wallMat = new THREE.MeshStandardMaterial({
    color: 0xc9c3ba,
    roughness: 0.9,
    metalness: 0.05,
  })

  state.materials.floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0.05,
  })

  state.materials.ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
  })

  state.materials.propWoodMat = new THREE.MeshStandardMaterial({
    color: 0x6b4a2b,
    roughness: 0.8,
    metalness: 0.1,
  })

  state.materials.propStoneMat = new THREE.MeshStandardMaterial({
    color: 0x7c7f86,
    roughness: 0.9,
    metalness: 0.05,
  })

  state.materials.propMetalMat = new THREE.MeshStandardMaterial({
    color: 0x4e4f52,
    roughness: 0.4,
    metalness: 0.6,
  })

  state.materials.bulletMat = new THREE.MeshStandardMaterial({ color: 0xffd15b })

  state.materials.enemyBoltMat = new THREE.MeshStandardMaterial({
    color: 0x84c5ff,
    emissive: 0x3c7cff,
    emissiveIntensity: 0.8,
  })

  state.geometry.bulletGeo = new THREE.SphereGeometry(0.12, 12, 12)
  state.geometry.enemyBoltGeo = new THREE.SphereGeometry(0.18, 12, 12)

  const textureLoader = new THREE.TextureLoader()

  const wallColorUrl = new URL(
    '../assets/textures/walls/Concrete048_1K-JPG_Color.jpg',
    import.meta.url
  ).toString()
  const wallNormalUrl = new URL(
    '../assets/textures/walls/Concrete048_1K-JPG_NormalGL.jpg',
    import.meta.url
  ).toString()
  const wallRoughnessUrl = new URL(
    '../assets/textures/walls/Concrete048_1K-JPG_Roughness.jpg',
    import.meta.url
  ).toString()
  const floorColorUrl = new URL(
    '../assets/textures/floors/PavingStones150_1K-JPG_Color.jpg',
    import.meta.url
  ).toString()
  const floorNormalUrl = new URL(
    '../assets/textures/floors/PavingStones150_1K-JPG_NormalGL.jpg',
    import.meta.url
  ).toString()
  const floorRoughnessUrl = new URL(
    '../assets/textures/floors/PavingStones150_1K-JPG_Roughness.jpg',
    import.meta.url
  ).toString()

  const ceilingColorUrl = new URL(
    '../assets/textures/ceiling/Wood073_1K-JPG_Color.jpg',
    import.meta.url
  ).toString()
  const ceilingNormalUrl = new URL(
    '../assets/textures/ceiling/Wood073_1K-JPG_NormalGL.jpg',
    import.meta.url
  ).toString()
  const ceilingRoughnessUrl = new URL(
    '../assets/textures/ceiling/Wood073_1K-JPG_Roughness.jpg',
    import.meta.url
  ).toString()

  loadTextureWithFallback(
    textureLoader,
    wallColorUrl,
    'https://ambientcg.com/get?file=Concrete048_1K-JPG_Color.jpg',
    (texture) => {
      const wallMat = state.materials.wallMat
      if (!wallMat) return
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(config.gridWidth / 4, config.gridHeight / 4)
      wallMat.map = texture
      wallMat.needsUpdate = true
    }
  )

  loadTextureWithFallback(
    textureLoader,
    wallNormalUrl,
    'https://ambientcg.com/get?file=Concrete048_1K-JPG_NormalGL.jpg',
    (texture) => {
      const wallMat = state.materials.wallMat
      if (!wallMat) return
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(config.gridWidth / 4, config.gridHeight / 4)
      wallMat.normalMap = texture
      wallMat.needsUpdate = true
    }
  )

  loadTextureWithFallback(
    textureLoader,
    wallRoughnessUrl,
    'https://ambientcg.com/get?file=Concrete048_1K-JPG_Roughness.jpg',
    (texture) => {
      const wallMat = state.materials.wallMat
      if (!wallMat) return
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(config.gridWidth / 4, config.gridHeight / 4)
      wallMat.roughnessMap = texture
      wallMat.needsUpdate = true
    }
  )

  loadTextureWithFallback(
    textureLoader,
    floorColorUrl,
    'https://ambientcg.com/get?file=PavingStones150_1K-JPG_Color.jpg',
    (texture) => {
      const floorMat = state.materials.floorMat
      if (!floorMat) return
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(config.gridWidth / 3, config.gridHeight / 3)
      floorMat.map = texture
      floorMat.needsUpdate = true
    }
  )

  loadTextureWithFallback(
    textureLoader,
    floorNormalUrl,
    'https://ambientcg.com/get?file=PavingStones150_1K-JPG_NormalGL.jpg',
    (texture) => {
      const floorMat = state.materials.floorMat
      if (!floorMat) return
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(config.gridWidth / 3, config.gridHeight / 3)
      floorMat.normalMap = texture
      floorMat.needsUpdate = true
    }
  )

  loadTextureWithFallback(
    textureLoader,
    floorRoughnessUrl,
    'https://ambientcg.com/get?file=PavingStones150_1K-JPG_Roughness.jpg',
    (texture) => {
      const floorMat = state.materials.floorMat
      if (!floorMat) return
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(config.gridWidth / 3, config.gridHeight / 3)
      floorMat.roughnessMap = texture
      floorMat.needsUpdate = true
    }
  )

  loadTextureWithFallback(
    textureLoader,
    ceilingColorUrl,
    'https://ambientcg.com/get?file=Wood073_1K-JPG_Color.jpg',
    (texture) => {
      const ceilingMat = state.materials.ceilingMat
      if (!ceilingMat) return
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(config.gridWidth / 4, config.gridHeight / 4)
      ceilingMat.map = texture
      ceilingMat.needsUpdate = true
    }
  )

  loadTextureWithFallback(
    textureLoader,
    ceilingNormalUrl,
    'https://ambientcg.com/get?file=Wood073_1K-JPG_NormalGL.jpg',
    (texture) => {
      const ceilingMat = state.materials.ceilingMat
      if (!ceilingMat) return
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(config.gridWidth / 4, config.gridHeight / 4)
      ceilingMat.normalMap = texture
      ceilingMat.needsUpdate = true
    }
  )

  loadTextureWithFallback(
    textureLoader,
    ceilingRoughnessUrl,
    'https://ambientcg.com/get?file=Wood073_1K-JPG_Roughness.jpg',
    (texture) => {
      const ceilingMat = state.materials.ceilingMat
      if (!ceilingMat) return
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(config.gridWidth / 4, config.gridHeight / 4)
      ceilingMat.roughnessMap = texture
      ceilingMat.needsUpdate = true
    }
  )

  const ceilingMat = state.materials.ceilingMat
  if (ceilingMat) {
    ceilingMat.side = THREE.BackSide
  }

  const floorMat = state.materials.floorMat ?? new THREE.MeshStandardMaterial()
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(derived.floorSize, derived.floorSize),
    floorMat
  )
  floor.rotation.x = -Math.PI / 2
  state.scene?.add(floor)

  const resolvedCeilingMat = ceilingMat ?? new THREE.MeshStandardMaterial()
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(derived.floorSize, derived.floorSize),
    resolvedCeilingMat
  )
  ceiling.rotation.x = -Math.PI / 2
  ceiling.position.y = config.wallHeight
  state.scene?.add(ceiling)
}

function loadTextureWithFallback(
  textureLoader: THREE.TextureLoader,
  localUrl: string,
  remoteUrl: string,
  onLoad: (texture: THREE.Texture) => void
) {
  textureLoader.load(localUrl, onLoad, undefined, () => {
    textureLoader.load(remoteUrl, onLoad)
  })
}
