import * as THREE from 'three'
import vertexShader   from './shaders/surface.vert?raw'
import fragmentShader from './shaders/surface.frag?raw'

// The plane always fills the screen height.
// Width is set via mesh.scale.x at runtime to match screen aspect.
// At z=3.0, vFOV=48°: visible height ≈ 2.667 units.
const PLANE_W = 2.0
const PLANE_H = 2.667

// Exported so main.js can update scale.x on resize.
export const PLANE_ASPECT = PLANE_W / PLANE_H   // 0.75

// One vertex per ~8 px of the 3000×4000 source image.
const SEG_W = 384
const SEG_H = 512

function texAspect(tex) {
  const img = tex.image
  if (!img) return 1.0
  const w = img.videoWidth  || img.naturalWidth  || img.width  || 1
  const h = img.videoHeight || img.naturalHeight || img.height || 1
  return w / h
}

export function createSurface(texture) {
  const geometry = new THREE.PlaneGeometry(PLANE_W, PLANE_H, SEG_W, SEG_H)

  texture.colorSpace  = THREE.SRGBColorSpace
  texture.anisotropy  = 8
  texture.needsUpdate = true

  const screenAspect = window.innerWidth / window.innerHeight

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture:           { value: texture },
      uDisplacementScale: { value: 0.28 },
      uSurface:           { value: 0.0 },
      uTime:              { value: 0.0 },
      uSimTexture:        { value: null },
      uDMT:               { value: 0.0 },
      uThreshold:         { value: 0.0 },  // act II · level 1, sharpening only
      uWorldSheet:        { value: 0.0 },  // act V · level 3, field read as depth
      uRetino:            { value: 0.0 },
      uCurvature:         { value: 0.0 },  // vertex + fragment both consume this
      uGrade:             { value: 0.0 },
      uTexAspect:         { value: texAspect(texture) },
      uScreenAspect:      { value: screenAspect },
    },
    vertexShader,
    fragmentShader,
  })

  const mesh = new THREE.Mesh(geometry, material)
  // Scale width so the plane fills the screen horizontally
  mesh.scale.x = screenAspect / PLANE_ASPECT

  return mesh
}
