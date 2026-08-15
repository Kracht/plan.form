import * as THREE from 'three'

// ── Procedural input textures ─────────────────────────────────────────────────
//
// Eight surfaces in two groups. The groups run two different experiments and it
// matters which one is on screen, because only one of them is a test of the
// claim this project makes.
//
// ── control · symmetry-free ──
// Broadband, isotropic, no privileged orientation and no privileged spatial
// frequency. There is no symmetry in the input to copy, so any symmetry that
// appears downstream came from the connectivity kernel. This is the group that
// tests what Ermentrout & Cowan (1979) and Bressloff et al. (2001) actually
// predict: spontaneous pattern formation out of a near-homogeneous state.
//
//   pink       multi-octave 1/f  → natural-scene statistics, scales compete
//   noise      band-limited      → single scale, no orientation → hexagonal
//   raufaser   grain plus chips  → aperiodic, the wall this started on
//
// ── resonance · form constants ──
// These already carry a form constant, and `rings` carries it in cortical
// coordinates, where it is literally the pattern the kernel is supposed to
// produce. Handing the field the answer is not a demonstration of emergence,
// and it must not be read as one.
//
// What they do test is worth having: whether the field's characteristic
// wavelength k* matches the input's spatial frequency. If it matches, the
// pattern locks and sharpens. If it does not, the field overrides the input and
// imposes its own spacing, which is visible and is the more interesting outcome.
// Wavelength selection, not emergence.
//
//   stripes    1D dominant orientation  → stripe / travelling wave
//   grid       two orthogonal           → square lattice
//   rings      cos(k · log r)           → funnel / tunnel FC
//   spokes     cos(n · θ)               → cobweb FC
//   spiral     cos(k · log r + n · θ)   → spiral FC
//
// Spatial frequency is expressed as numCycles per texture so the 64² thumbnail
// and 512² simulation texture look proportionally identical.

const TWO_PI   = Math.PI * 2
const TEX_SIZE   = 512
const THUMB_SIZE = 64

// ── Shared build infrastructure ───────────────────────────────────────────────

function build(genFn, ss) {
  const atBase = (data, size) => genFn(data, size, 1)
  return {
    texture:   makeDataTexture(atBase, TEX_SIZE, ss),
    thumbnail: makeThumb(atBase, THUMB_SIZE, ss),
  }
}

// ── Supersampling ─────────────────────────────────────────────────────────────
//
// Generate at ss× the target resolution and box-average down. This is the
// correct treatment for a generator that draws hard-edged features: a chip
// smaller than a texel contributes its true area rather than being rounded up
// to one texel or dropped, and grain finer than a texel loses contrast by
// exactly the factor the averaging implies instead of by a hand-picked one.
//
// It is applied per generator rather than globally, because the cost is not
// worth paying everywhere. Measured at 512², the analytic generators cost
// 14 to 33 ms and the two noise sums cost 447 and 865 ms; supersampling scales
// with the square of the factor, so a global ss of 3 would put pink noise at
// roughly seven seconds. It would also buy nothing there. Those generators are
// sums of band-limited sinusoids, and at the distances offered their shortest
// wavelength stays well above two texels, so there is nothing to alias.
//
// Only `raufaser` draws hard edges, and it is the one that gets it, at 2.
// Measured against the same texture at distance 2, factors 2, 3 and 4 are
// visually indistinguishable while costing 268, 518 and 676 ms. The extra
// samples land inside features already resolved by the first step.
function boxDownsample(hiData, hi, size, ss) {
  const data = new Uint8Array(size * size * 4)
  const inv  = 1 / (ss * ss)

  // Every generator writes greyscale, so one channel carries the value.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = 0
      for (let sy = 0; sy < ss; sy++) {
        const row = ((y * ss + sy) * hi + x * ss) * 4
        for (let sx = 0; sx < ss; sx++) acc += hiData[row + sx * 4]
      }
      const v = Math.round(acc * inv)
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return data
}

function renderAt(genFn, size, ss) {
  if (!ss || ss <= 1) {
    const data = new Uint8Array(size * size * 4)
    genFn(data, size)
    return data
  }
  const hi = size * ss
  const hiData = new Uint8Array(hi * hi * 4)
  genFn(hiData, hi)
  return boxDownsample(hiData, hi, size, ss)
}

function makeDataTexture(genFn, size, ss) {
  const data = renderAt(genFn, size, ss)
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT   = THREE.RepeatWrapping
  tex.generateMipmaps     = true
  tex.minFilter           = THREE.LinearMipmapLinearFilter
  tex.needsUpdate         = true
  return tex
}

function makeThumb(genFn, size, ss) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const id  = ctx.createImageData(size, size)
  id.data.set(renderAt(genFn, size, ss))
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
function genRings(data, size, scale) {
  const half = size / 2
  const k    = 9.0 * scale  // number of rings across the log-radial extent

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
function genSpokes(data, size, scale) {
  const half = size / 2
  const n    = Math.max(1, Math.round(SPOKES_N * scale))

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - half, dy = y - half
      const r  = Math.sqrt(dx * dx + dy * dy)
      // Radial fade: full contrast at edge, smooth zero at centre
      const fade = Math.min(1, r / (half * 0.12))
      const v    = Math.cos(n * Math.atan2(dy, dx)) * fade
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
function genSpiral(data, size, scale) {
  const half = size / 2
  const kk   = SPIRAL_K * scale
  const nn   = Math.max(1, Math.round(SPIRAL_N * scale))

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - half, dy = y - half
      const r   = Math.sqrt(dx * dx + dy * dy)
      const th  = Math.atan2(dy, dx)
      const fade = Math.min(1, r / (half * 0.05))
      const v    = r < 0.5 ? 0
                 : Math.cos(kk * Math.log(r / half + 0.001) + nn * th) * fade
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
function genPink(data, size, scale) {
  const tmp = new Float32Array(size * size)

  for (let oct = 0; oct < PINK_OCTAVES; oct++) {
    const numCycles = 6 * Math.pow(2, oct) * scale   // 6, 12, 24, 48 at scale 1
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
function genNoise(data, size, scale) {
  const N      = 24
  const k      = TWO_PI * 18 * scale / size
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
function genStripes(data, size, scale) {
  const k     = TWO_PI * 18 * scale / size
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
function genGrid(data, size, scale) {
  const k = TWO_PI * 10 * scale / size

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      writePixel(data, y * size + x, Math.sin(k * x) * Math.sin(k * y))
    }
  }
}

// ── 8. Woodchip wallpaper · Raufaser ─────────────────────────────────────────
// Paper grain with embedded chips at random positions, orientations and sizes.
// Broadband, isotropic, aperiodic. Chip angles are drawn uniformly over the
// full circle, so no orientation is privileged and there is nothing here for a
// planform to be copied from.
//
// It also happens to be the surface the reports collected for this project were
// looking at when the geometry started, which makes the methodologically
// cleanest stimulus and the phenomenologically honest one the same texture.

const RAUFASER_SEED = 0x5eed1a
const RAUFASER_CHIPS = 1400   // fixed count so thumbnail and full texture match

// Small deterministic PRNG. The layout has to be identical between the 64²
// thumbnail and the 512² texture, so nothing here may use Math.random().
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Value noise on a wrapping lattice, so RepeatWrapping shows no seam.
function tileableValueNoise(size, cells, rnd) {
  const g = new Float32Array(cells * cells)
  for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1

  const out = new Float32Array(size * size)
  const s   = cells / size

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x * s, fy = y * s
      const x0 = Math.floor(fx) % cells, y0 = Math.floor(fy) % cells
      const x1 = (x0 + 1) % cells,       y1 = (y0 + 1) % cells

      let tx = fx - Math.floor(fx), ty = fy - Math.floor(fy)
      tx = tx * tx * (3 - 2 * tx)
      ty = ty * ty * (3 - 2 * ty)

      const a = g[y0 * cells + x0] * (1 - tx) + g[y0 * cells + x1] * tx
      const b = g[y1 * cells + x0] * (1 - tx) + g[y1 * cells + x1] * tx
      out[y * size + x] = a * (1 - ty) + b * ty
    }
  }
  return out
}

function genRaufaser(data, size, scale) {
  // Two independent streams so the chip layout does not shift when the noise
  // lattice changes resolution between thumbnail and texture.
  const rndNoise = mulberry32(RAUFASER_SEED)
  const rndChips = mulberry32(RAUFASER_SEED ^ 0x9e3779b9)

  const tmp = new Float32Array(size * size)

  // Paper grain: three octaves, lattice scaled with the texture and with the
  // viewing distance. Capped at one cell per texel, past which it is white noise.
  const octaves = [[8, 1.0], [4, 0.55], [2, 0.30]]
  for (const [div, amp] of octaves) {
    const cells = Math.min(size, Math.max(2, Math.round(size / div * scale)))
    const n = tileableValueNoise(size, cells, rndNoise)
    for (let i = 0; i < tmp.length; i++) tmp[i] += n[i] * amp
  }
  // No distance-dependent damping here. Grain finer than a texel loses contrast
  // because the supersampled render is averaged down, which is the same thing
  // that happens in an eye and gets the factor right without anyone choosing it.
  for (let i = 0; i < tmp.length; i++) tmp[i] *= 0.32

  // Chips: soft elongated bumps, wrapped at the edges, half raised half sunken.
  // Count grows with the square of the scale so chip density per unit of wall
  // stays constant while the chips themselves shrink. That is what stepping
  // back from a wall does, and it is why this is a distance control and not a
  // texture-repeat: no tile boundary is introduced, so no seam appears, and a
  // seam would be an edge, and edges seed planform nodes.
  const chips = Math.round(RAUFASER_CHIPS * scale * scale)

  for (let c = 0; c < chips; c++) {
    const cx = rndChips() * size
    const cy = rndChips() * size
    const th = rndChips() * TWO_PI
    // No floor. The render happens at ss× resolution, so a chip below one
    // output texel is still several pixels wide where it is drawn and arrives
    // as its true area contribution after the downsample.
    const a  = size * (0.005 + rndChips() * 0.011) / scale
    const b  = a * (0.28 + rndChips() * 0.34)
    const h  = (rndChips() < 0.5 ? -1 : 1) * (0.45 + rndChips() * 0.55)

    const ca = Math.cos(th), sa = Math.sin(th)
    const R  = Math.ceil(a) + 1

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const u = ( dx * ca + dy * sa) / a
        const v = (-dx * sa + dy * ca) / b
        const d = u * u + v * v
        if (d >= 1) continue

        const f = (1 - d) * (1 - d)
        const x = (((cx + dx) % size) + size) % size | 0
        const y = (((cy + dy) % size) + size) % size | 0
        tmp[y * size + x] += h * f
      }
    }
  }

  // Soft clip before normalising. A handful of overlapping chips would
  // otherwise own the range and push everything else into a narrow band around
  // mid grey, which reads as a flat wall and gives the external drive almost
  // nothing to work with.
  for (let i = 0; i < tmp.length; i++) tmp[i] = Math.tanh(tmp[i] * 1.6)

  normalizeAndWrite(tmp, data, size)
}

// ── Export ────────────────────────────────────────────────────────────────────
//
// `kind` drives the grouping in the laboratory strip. Order matters: the first
// entry is the default when no photograph is present, and the default has to be
// a control.

// `ss` is the supersampling factor. Only the generator that draws hard edges
// needs one; see the note above boxDownsample for why it is not global.
export const PROCEDURAL = [
  { name: 'pink',     label: 'pink',     kind: 'control',   ss: 1, gen: genPink     },
  { name: 'noise',    label: 'noise',    kind: 'control',   ss: 1, gen: genNoise    },
  { name: 'raufaser', label: 'raufaser', kind: 'control',   ss: 2, gen: genRaufaser },
  { name: 'stripes',  label: 'stripes',  kind: 'resonance', ss: 1, gen: genStripes  },
  { name: 'grid',     label: 'grid',     kind: 'resonance', ss: 1, gen: genGrid     },
  { name: 'rings',    label: 'rings',    kind: 'resonance', ss: 1, gen: genRings    },
  { name: 'spokes',   label: 'spokes',   kind: 'resonance', ss: 1, gen: genSpokes   },
  { name: 'spiral',   label: 'spiral',   kind: 'resonance', ss: 1, gen: genSpiral   },
].map(({ name, label, kind, ss, gen }) => ({ name, label, kind, ss, ...build(gen, ss) }))

export const PROCEDURAL_GROUPS = [
  { kind: 'control',   label: 'control · symmetry-free' },
  { kind: 'resonance', label: 'resonance · form constants' },
]

// ── Viewing distance ──────────────────────────────────────────────────────────
//
// At scale 1 the texture fills the frame with features large enough to read as
// a close-up. Stepping back from a wall raises the spatial frequency of what
// lands on the retina, and that is exactly what these factors do: the texture is
// regenerated with proportionally finer features, at the same resolution.
//
// The alternative, tiling the texture with RepeatWrapping, was rejected. It
// introduces a phase discontinuity at every tile boundary, and those seams are
// straight edges. Edges enter the external drive through the edge-energy term
// and seed planform nodes, so a tiled input would print its own grid into the
// pattern. It would also impose an exact translational periodicity on textures
// whose entire purpose is to carry none.
//
// There is a second, more interesting consequence. The field has a
// characteristic wavelength of roughly 28 px on the 512² grid. Past distance 2
// the input's features fall below it, the field stops locking to them and
// imposes its own spacing instead. The image goes from steering the pattern to
// merely tinting it, and the transition is visible.

const GENERATORS = {
  pink:     genPink,
  noise:    genNoise,
  raufaser: genRaufaser,
  stripes:  genStripes,
  grid:     genGrid,
  rings:    genRings,
  spokes:   genSpokes,
  spiral:   genSpiral,
}

// Two steps, and that is the whole useful range. The field's characteristic
// wavelength is roughly 28 px on the 512² grid. At distance 1 the input's
// features sit above it and the image places the nodes. At distance 2 they fall
// to it and past it, the field stops locking to the input and begins imposing
// its own spacing, which is where symmetry the input never had starts to appear.
// A third step would only push further into the same regime: everything below
// the field's wavelength looks alike to the field, so the images converge.
export const TEXTURE_DISTANCES = [
  { scale: 1, label: '1×' },
  { scale: 2, label: '2×' },
]

// Regenerating a 512² texture costs a few tens of milliseconds, so results are
// kept. Eight textures at four distances is 32 MB at the very worst, and in
// practice only the few that get visited are ever built.
const scaledCache = new Map()

export function makeScaledTexture(name, scale) {
  const gen = GENERATORS[name]
  if (!gen) return null

  const key = `${name}@${scale}`
  if (scaledCache.has(key)) return scaledCache.get(key)

  const entry = PROCEDURAL.find((t) => t.name === name)
  const tex = (scale === 1 && entry)
    ? entry.texture
    : makeDataTexture((data, size) => gen(data, size, scale), TEX_SIZE, entry?.ss ?? 1)

  scaledCache.set(key, tex)
  return tex
}
