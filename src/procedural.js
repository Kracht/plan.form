import * as THREE from 'three'

// ── Procedural input textures ─────────────────────────────────────────────────
//
// Seven surfaces covering the full space of Ermentrout-Cowan form constants
// (1979) and Bressloff et al. (2001) planform predictions.
//
// The retino-cortical transform maps visual-field coordinates (r, θ) to
// cortical coordinates (log r, θ). Inputs expressed in cortical coordinates
// produce the cleanest planform seeds:
//
//   cos(k · log r)        → vertical stripes in cortex  → funnel/tunnel FC
//   cos(n · θ)            → horizontal stripes in cortex → cobweb FC
//   cos(k · log r + n·θ)  → diagonal stripes in cortex  → spiral FC
//   multi-octave noise     → all scales / multi-planform → natural scene
//   band-limited noise     → no dominant orientation     → hexagonal
//   oriented stripes       → 1D dominant orientation     → stripe/wave
//   orthogonal grid        → two orthogonal orientations → square lattice
//
// Spatial frequency is expressed as numCycles per texture so the 64² thumbnail
// and 512² simulation texture look proportionally identical.

const TWO_PI   = Math.PI * 2
const TEX_SIZE   = 512
const THUMB_SIZE = 64

// ── Shared build infrastructure ───────────────────────────────────────────────

function build(genFn) {
  return {
    texture:   makeDataTexture(genFn, TEX_SIZE),
    thumbnail: makeThumb(genFn, THUMB_SIZE),
  }
}

function makeDataTexture(genFn, size) {
  const data = new Uint8Array(size * size * 4)
  genFn(data, size)
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT   = THREE.RepeatWrapping
  tex.generateMipmaps     = true
  tex.minFilter           = THREE.LinearMipmapLinearFilter
  tex.needsUpdate         = true
  return tex
}

function makeThumb(genFn, size) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const id  = ctx.createImageData(size, size)
  genFn(id.data, size)
  ctx.putImageData(id, 0, 0)
  return canvas.toDataURL()
}

// v ∈ [-1, 1] → RGBA greyscale pixel
function writePixel(data, idx, v) {
  const b = Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255)))
  data[idx * 4]     = b
  data[idx * 4 + 1] = b
  data[idx * 4 + 2] = b
  data[idx * 4 + 3] = 255
}

// Normalize a Float32Array to [-1,1] then write all pixels
function normalizeAndWrite(tmp, data, size) {
  let min = Infinity, max = -Infinity
  for (let i = 0; i < tmp.length; i++) {
    if (tmp[i] < min) min = tmp[i]
    if (tmp[i] > max) max = tmp[i]
  }
  const range = max - min || 1
  for (let i = 0; i < size * size; i++) {
    writePixel(data, i, (tmp[i] - min) / range * 2 - 1)
  }
}

// ── 1. Log-spaced concentric rings ────────────────────────────────────────────
// cos(k · log r) · rings with logarithmically increasing spacing.
// In cortical (log-polar) space this is perfectly regular vertical stripes.
// → Funnel / tunnel form constant (Ermentrout & Cowan 1979, Bressloff 2001).
function genRings(data, size) {
  const half = size / 2
  const k    = 9.0          // number of rings across the log-radial extent

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - half, dy = y - half
      const r  = Math.sqrt(dx * dx + dy * dy)
      // Fade to neutral near centre where log is undefined
      const fade = Math.min(1, r / (half * 0.04))
      const v    = r < 0.5 ? 0 : Math.cos(k * Math.log(r / half + 0.001)) * fade
      writePixel(data, y * size + x, v)
    }
  }
}

// ── 2. Radial spokes ─────────────────────────────────────────────────────────
// cos(n · θ) · n-fold angular pattern.
// In cortical space this maps to horizontal stripes (the θ axis is preserved).
// → Cobweb / mandala form constant. Pinwheel singularity at the centre models
//   the orientation-column singularities of V1 (Bonhoeffer & Grinvald 1991).
const SPOKES_N = 6   // 6-fold → hexagonal cobweb
function genSpokes(data, size) {
  const half = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - half, dy = y - half
      const r  = Math.sqrt(dx * dx + dy * dy)
      // Radial fade: full contrast at edge, smooth zero at centre
      const fade = Math.min(1, r / (half * 0.12))
      const v    = Math.cos(SPOKES_N * Math.atan2(dy, dx)) * fade
      writePixel(data, y * size + x, v)
    }
  }
}

// ── 3. Logarithmic spiral ─────────────────────────────────────────────────────
// cos(k · log r + n · θ) · combines the radial and angular form constants.
// In cortical space this is diagonal stripes at angle arctan(n/k).
// → Spiral form constant · a superposition of funnel and cobweb.
//   Logarithmic spirals are one of the four canonical hallucination geometries
//   (Ermentrout & Cowan 1979, Class III).
const SPIRAL_K = 6    // radial frequency
const SPIRAL_N = 3    // angular frequency (tightness of spiral arms)
function genSpiral(data, size) {
  const half = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - half, dy = y - half
      const r   = Math.sqrt(dx * dx + dy * dy)
      const th  = Math.atan2(dy, dx)
      const fade = Math.min(1, r / (half * 0.05))
      const v    = r < 0.5 ? 0
                 : Math.cos(SPIRAL_K * Math.log(r / half + 0.001) + SPIRAL_N * th) * fade
      writePixel(data, y * size + x, v)
    }
  }
}

// ── 4. 1/f (pink) noise ───────────────────────────────────────────────────────
// Summed octaves of isotropic band-limited noise with 1/f amplitude weighting.
// Approximates the spatial frequency statistics of natural visual scenes
// (Field 1987; Ruderman & Bialek 1994).
// → Multi-planform response: different spatial scales compete simultaneously.
const PINK_OCTAVES = 4
const PINK_N       = 12   // orientations per octave
const PINK_PHASES  = Array.from(
  {length: PINK_OCTAVES * PINK_N},
  () => Math.random() * TWO_PI
)
function genPink(data, size) {
  const tmp = new Float32Array(size * size)

  for (let oct = 0; oct < PINK_OCTAVES; oct++) {
    const numCycles = 6 * Math.pow(2, oct)    // 6, 12, 24, 48 cycles
    const k         = TWO_PI * numCycles / size
    const amp       = 1.0 / (oct + 1)         // 1/f: 1, 0.5, 0.33, 0.25
    const angles    = Array.from({length: PINK_N}, (_, i) => i * Math.PI / PINK_N)

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0
        for (let i = 0; i < PINK_N; i++) {
          const ph = PINK_PHASES[oct * PINK_N + i]
          v += Math.cos(k * (x * Math.cos(angles[i]) + y * Math.sin(angles[i])) + ph)
        }
        tmp[y * size + x] += v * amp
      }
    }
  }

  normalizeAndWrite(tmp, data, size)
}

// ── 5. Isotropic band-limited noise ──────────────────────────────────────────
// Single-scale isotropic noise matched to the Wilson-Cowan characteristic
// wavelength. No dominant orientation → hexagonal planform.
// (Bressloff et al. 2001, Table 1, isotropic input → hexagonal planform.)
genNoise._phases = Array.from({length: 24}, () => Math.random() * TWO_PI)
function genNoise(data, size) {
  const N      = 24
  const k      = TWO_PI * 18 / size
  const angles = Array.from({length: N}, (_, i) => i * Math.PI / N)
  const phases = genNoise._phases
  const tmp    = new Float32Array(size * size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0
      for (let i = 0; i < N; i++) {
        v += Math.cos(k * (x * Math.cos(angles[i]) + y * Math.sin(angles[i])) + phases[i])
      }
      tmp[y * size + x] = v
    }
  }
  normalizeAndWrite(tmp, data, size)
}

// ── 6. Oriented stripes ───────────────────────────────────────────────────────
// Single dominant orientation with organic slow-wobble modulation.
// Strong 1D periodicity → stripe / travelling-wave planform.
function genStripes(data, size) {
  const k     = TWO_PI * 18 / size
  const angle = Math.PI / 6

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const proj   = x * Math.cos(angle) + y * Math.sin(angle)
      const nx = x / size, ny = y / size
      const wobble = Math.sin(nx * TWO_PI * 1.3 + ny * TWO_PI * 0.7) * 0.55
                   + Math.sin(nx * TWO_PI * 0.5 - ny * TWO_PI * 1.1) * 0.25
      writePixel(data, y * size + x, Math.sin(k * proj + wobble))
    }
  }
}

// ── 7. Orthogonal grid ────────────────────────────────────────────────────────
// Product of two orthogonal sinusoids. Two dominant orientations at 90°
// → square lattice planform (Bressloff 2001, even square planform).
// 10 cycles (down from 14) reduces Moiré aliasing through the log-polar transform.
function genGrid(data, size) {
  const k = TWO_PI * 10 / size

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      writePixel(data, y * size + x, Math.sin(k * x) * Math.sin(k * y))
    }
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export const PROCEDURAL = [
  { name: 'pink',    label: 'pink',    gen: genPink    },
  { name: 'noise',   label: 'noise',   gen: genNoise   },
  { name: 'stripes', label: 'stripes', gen: genStripes },
  { name: 'grid',    label: 'grid',    gen: genGrid    },
  { name: 'rings',   label: 'rings',   gen: genRings   },
].map(({ name, label, gen }) => ({ name, label, ...build(gen) }))
