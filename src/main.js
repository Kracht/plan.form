import * as THREE from 'three'
import { createSurface, PLANE_ASPECT } from './surface.js'
import { createGPUCompute } from './gpuCompute.js'
import { createScroll }     from './scroll.js'
import { createLab, GALLERY } from './lab.js'
import { createPostFX }     from './postfx.js'
import { createPointCloud } from './pointcloud.js'
import { createWaveFront }  from './wavefront.js'
import { PROCEDURAL }       from './procedural.js'

// ─── Renderer ─────────────────────────────────────────────────────────────────

let renderer
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,                  // transparent canvas — sides show CSS body colour
  })
} catch (e) {
  document.body.innerHTML = '<p style="color:#fff;padding:2rem;font-family:monospace">WebGL unavailable: ' + e.message + '</p>'
  throw e
}
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x000000, 0)   // fully transparent clear
renderer.toneMapping         = THREE.NoToneMapping  // ACES applied in post shader
renderer.toneMappingExposure = 1.0
document.body.appendChild(renderer.domElement)

// ─── Scene / Camera ───────────────────────────────────────────────────────────

const scene = new THREE.Scene()
// No scene.background — body { background: #080808 } shows through the canvas

// vFOV 48° at z=3.0 → visible height ≈ 2.67 units = plane height → full fill
const camera = new THREE.PerspectiveCamera(
  48, window.innerWidth / window.innerHeight, 0.1, 100
)
camera.position.set(0, 0, 3.0)

// ─── Placeholder texture (safe to sample before GPU compute initialises) ──────

const blackPixel = new THREE.DataTexture(
  new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat
)
blackPixel.needsUpdate = true

// ─── Load texture, then build surface + GPU sim ───────────────────────────────

let surface    = null
let gpuSim     = null
let lab        = null
let postfx     = null
let pointCloud = null
let waveFront  = null
let dmt        = 0.0
let retino     = 0.0

function initScene(texture) {
  surface = createSurface(texture)
  surface.material.uniforms.uSimTexture.value = blackPixel
  scene.add(surface)

  gpuSim     = createGPUCompute(renderer, texture)
  postfx     = createPostFX(renderer)
  pointCloud = createPointCloud()
  scene.add(pointCloud.mesh)
  waveFront  = createWaveFront()
  scene.add(waveFront.mesh)
  lab        = createLab(surface, gpuSim)
}

if (GALLERY.length > 0) {
  // Photo in gallery: load normally with sRGB colour space correction
  new THREE.TextureLoader().load(GALLERY[0].url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    texture.needsUpdate = true
    initScene(texture)
  })
} else {
  // No gallery — start directly with the first procedural texture
  const tex = PROCEDURAL[0].texture
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  initScene(tex)
}

// ─── Scroll narrative ─────────────────────────────────────────────────────────

createScroll(
  (alpha) => { dmt = alpha },
  (s)     => { if (surface) surface.material.uniforms.uSurface.value    = s },
  (r)     => { retino = r; if (surface) surface.material.uniforms.uRetino.value = r },
  (c)     => { if (surface) surface.material.uniforms.uCurvature.value  = c },
  (g)     => { if (surface) surface.material.uniforms.uGrade.value      = g }
)

// ─── Parallax ─────────────────────────────────────────────────────────────────

const mouse     = { x: 0, y: 0 }
const camTarget = { x: 0, y: 0 }

const PARALLAX_X    = 0.12
const PARALLAX_Y    = 0.08
const PARALLAX_EASE = 0.038

window.addEventListener('mousemove', (e) => {
  mouse.x =  (e.clientX / window.innerWidth  - 0.5) * 2
  mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2
})
window.addEventListener('touchmove', (e) => {
  const t = e.touches[0]
  mouse.x =  (t.clientX / window.innerWidth  - 0.5) * 2
  mouse.y = -(t.clientY / window.innerHeight - 0.5) * 2
}, { passive: true })

// ─── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight
  camera.aspect = aspect
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  if (postfx) postfx.resize(window.innerWidth, window.innerHeight)
  if (surface) {
    surface.scale.x = aspect / PLANE_ASPECT
    surface.material.uniforms.uScreenAspect.value = aspect
  }
  if (pointCloud) pointCloud.resize(aspect)
  if (waveFront)  waveFront.resize(aspect)
})

// ─── Animation loop ───────────────────────────────────────────────────────────

const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)

  const dt      = clock.getDelta()
  const elapsed = clock.elapsedTime

  camTarget.x += (mouse.x * PARALLAX_X - camTarget.x) * PARALLAX_EASE
  camTarget.y += (mouse.y * PARALLAX_Y - camTarget.y) * PARALLAX_EASE
  camera.position.x = camTarget.x
  camera.position.y = camTarget.y

  if (surface && gpuSim && postfx) {
    const activeDMT = (lab && lab.getDMT() !== null) ? lab.getDMT() : dmt
    const simTex    = gpuSim.step(activeDMT)

    surface.material.uniforms.uTime.value       = elapsed
    surface.material.uniforms.uDMT.value        = activeDMT
    surface.material.uniforms.uSimTexture.value = simTex

    if (waveFront) {
      waveFront.update(activeDMT, dt)
      gpuSim.setWaveFront(waveFront.getRadius())
    }
    const wfRadius  = waveFront ? waveFront.getRadius() : -1.0
    const curvature = surface.material.uniforms.uCurvature.value
    if (pointCloud) pointCloud.update(simTex, activeDMT, elapsed, curvature, retino, wfRadius)

    postfx.render(scene, camera, activeDMT, retino, simTex)
  } else {
    renderer.render(scene, camera)
  }
}

animate()
