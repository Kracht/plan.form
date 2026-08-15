import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import wcEShader from './shaders/wc_e.frag?raw'
import wcIShader from './shaders/wc_i.frag?raw'

const GRID = 512
// 8 steps/frame · patterns form within ~1-2 seconds after crossing bifurcation
const STEPS_PER_FRAME = 8

export function createGPUCompute(renderer, inputTexture) {
  const gpuCompute = new GPUComputationRenderer(GRID, GRID, renderer)

  // Seed near the expected resting state (~0.35 with corrected sigmoid).
  // Small noise amplitude seeds symmetry breaking without biasing direction.
  const dtE = gpuCompute.createTexture()
  const dtI = gpuCompute.createTexture()
  seedTexture(dtE, 0.33, 0.06)
  seedTexture(dtI, 0.33, 0.03)

  const eVar = gpuCompute.addVariable('textureE', wcEShader, dtE)
  const iVar = gpuCompute.addVariable('textureI', wcIShader, dtI)

  gpuCompute.setVariableDependencies(eVar, [eVar, iVar])
  gpuCompute.setVariableDependencies(iVar, [eVar, iVar])

  // Periodic wrapping on the sampler. Note this does NOT make the field periodic:
  // wc_e.frag damps w_EE within the outer 10% of the frame, which suppresses
  // pattern at the border and centres the composition. That damping is a design
  // choice, not a model assumption.
  eVar.wrapS = THREE.RepeatWrapping
  eVar.wrapT = THREE.RepeatWrapping
  iVar.wrapS = THREE.RepeatWrapping
  iVar.wrapT = THREE.RepeatWrapping

  const texelSize = new THREE.Vector2(1 / GRID, 1 / GRID)

  eVar.material.uniforms.uInputTexture = { value: inputTexture }
  eVar.material.uniforms.uDMT          = { value: 0.0 }
  eVar.material.uniforms.uTexelSize    = { value: texelSize }
  eVar.material.uniforms.uLobeCount    = { value: 0.0 }   // 0 = free (no bias)
  eVar.material.uniforms.uWaveFront    = { value: -1.0 }  // world-space radius; -1 = inactive

  iVar.material.uniforms.uDMT       = { value: 0.0 }
  iVar.material.uniforms.uTexelSize = { value: texelSize }

  const error = gpuCompute.init()
  if (error !== null) console.error('GPUComputationRenderer:', error)

  return {
    setWaveFront(radius) {
      eVar.material.uniforms.uWaveFront.value = radius
    },

    step(dmt) {
      eVar.material.uniforms.uDMT.value = dmt
      iVar.material.uniforms.uDMT.value = dmt

      for (let i = 0; i < STEPS_PER_FRAME; i++) {
        gpuCompute.compute()
      }

      renderer.setRenderTarget(null)
      return gpuCompute.getCurrentRenderTarget(eVar).texture
    },

    reset() {
      const dtE2 = gpuCompute.createTexture()
      const dtI2 = gpuCompute.createTexture()
      seedTexture(dtE2, 0.33, 0.06)
      seedTexture(dtI2, 0.33, 0.03)
      // renderTexture copies a DataTexture into a WebGLRenderTarget
      gpuCompute.renderTexture(dtE2, eVar.renderTargets[0])
      gpuCompute.renderTexture(dtE2, eVar.renderTargets[1])
      gpuCompute.renderTexture(dtI2, iVar.renderTargets[0])
      gpuCompute.renderTexture(dtI2, iVar.renderTargets[1])
      renderer.setRenderTarget(null)
    },

    setTexture(texture) {
      eVar.material.uniforms.uInputTexture.value = texture
      this.reset()
    },

    // Set n-fold planform bias. Pass 0 for free (no bias).
    // Resets the simulation so the new planform forms from a clean state.
    setLobeCount(n) {
      eVar.material.uniforms.uLobeCount.value = n
      this.reset()
    },
  }
}

function seedTexture(texture, mean, spread) {
  const data = texture.image.data
  for (let i = 0; i < data.length; i += 4) {
    const v = mean + (Math.random() * 2 - 1) * spread
    data[i]     = Math.max(0, Math.min(1, v))
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = 1
  }
}
