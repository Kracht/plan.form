import * as THREE from 'three'
import { PROCEDURAL, PROCEDURAL_GROUPS, TEXTURE_DISTANCES, makeScaledTexture } from './procedural.js'

// ── Gallery: auto-discovered at build time ────────────────────────────────────
// Drop any image into src/gallery/, rebuild, and it appears as a tile.
// Sorted alphabetically by filename.
export const GALLERY = Object.entries(
  import.meta.glob('./gallery/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
    eager:  true,
    query:  '?url',
    import: 'default',
  })
).sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    name: path.replace(/.*\//, '').replace(/\.[^/.]+$/, ''),
  }))

// ── Styles ────────────────────────────────────────────────────────────────────

const CSS = `
  #lab-panel {
    position: fixed;
    /* Clear of #scroll-hint, which sits at 2.2rem and shares this corner of the
       screen for the first few percent of the scroll. */
    bottom: 4.4rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    z-index: 20;
    /* opacity and pointer-events driven by scroll JS */

    /* The field behind this panel runs from black to near-white depending on
       the input and the parameter, so the controls cannot rely on the ground
       being dark. Same scrim as the annotation panels. */
    padding: 1rem 1.25rem 1.1rem;
    background: rgba(5, 7, 11, 0.58);
    backdrop-filter: blur(14px) saturate(0.35);
    -webkit-backdrop-filter: blur(14px) saturate(0.35);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  /* ── Tile strip ─────────────────────────────────────────────────── */
  #lab-tiles {
    display: flex;
    gap: 0.55rem;
    align-items: flex-end;
    max-width: min(860px, 92vw);
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  #lab-tiles::-webkit-scrollbar { display: none; }

  /* ── Groups ─────────────────────────────────────────────────────── */
  /* The strip is divided because the groups run different experiments:
     a control input carries no symmetry, a resonance input already carries a
     form constant. Which one is loaded changes what the field is being asked. */
  .lab-group {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.42rem;
  }
  .lab-group + .lab-group {
    border-left: 1px solid rgba(255,255,255,0.09);
    padding-left: 0.85rem;
  }
  .lab-group-label {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-size: 0.42rem;
    letter-spacing: 0.17em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.20);
    white-space: nowrap;
    pointer-events: none;
  }
  .lab-group-tiles {
    display: flex;
    gap: 0.55rem;
    align-items: flex-end;
  }

  /* Distance applies to generated textures only. A photograph cannot be
     regenerated at a finer scale, so the row goes inert rather than lying. */
  .lab-row-inert {
    opacity: 0.28;
    pointer-events: none;
  }

  .lab-tile {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.38rem;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .lab-tile-thumb {
    width: 64px;
    height: 64px;
    object-fit: cover;
    display: block;
    opacity: 0.50;
    outline: 1px solid rgba(255,255,255,0.10);
    transition: opacity 0.2s, outline-color 0.2s;
  }
  .lab-tile:hover .lab-tile-thumb {
    opacity: 0.80;
    outline-color: rgba(255,255,255,0.35);
  }
  .lab-tile.lab-active .lab-tile-thumb {
    opacity: 1.0;
    outline-color: rgba(255,255,255,0.55);
  }
  .lab-tile-name {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-size: 0.44rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.22);
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }
  .lab-tile.lab-active .lab-tile-name {
    color: rgba(255,255,255,0.45);
  }

  /* ── Upload tile ────────────────────────────────────────────────── */
  .lab-tile-upload-box {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed rgba(255,255,255,0.14);
    color: rgba(255,255,255,0.22);
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-size: 1.1rem;
    transition: border-color 0.2s, color 0.2s;
    cursor: pointer;
  }
  .lab-tile:hover .lab-tile-upload-box {
    border-color: rgba(255,255,255,0.32);
    color: rgba(255,255,255,0.50);
  }

  /* ── Lobe-count selector ────────────────────────────────────────── */
  #lab-lobe-wrap {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .lab-lobe-btn {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-size: 0.52rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.22);
    background: none;
    border: 1px solid rgba(255,255,255,0.10);
    padding: 0.22rem 0.55rem;
    cursor: pointer;
    transition: color 0.18s, border-color 0.18s;
    white-space: nowrap;
  }
  .lab-lobe-btn:hover {
    color: rgba(255,255,255,0.50);
    border-color: rgba(255,255,255,0.28);
  }
  .lab-lobe-btn.lab-active {
    color: rgba(255,255,255,0.75);
    border-color: rgba(255,255,255,0.40);
  }

  /* ── α slider ───────────────────────────────────────────────────── */
  #lab-slider-wrap {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .lab-label {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-size: 0.52rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.25);
    white-space: nowrap;
  }
  #lab-dmt-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 180px;
    height: 1px;
    background: rgba(255,255,255,0.14);
    outline: none;
    cursor: pointer;
  }
  #lab-dmt-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,0.50);
    cursor: pointer;
  }
  #lab-dmt-slider::-moz-range-thumb {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,0.50);
    border: none;
    cursor: pointer;
  }
  #lab-dmt-val {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-size: 0.52rem;
    color: rgba(255,255,255,0.28);
    width: 2.8rem;
    text-align: right;
  }
`

// ── createLab ─────────────────────────────────────────────────────────────────

export function createLab(surface, gpuSim) {
  const loader = new THREE.TextureLoader()
  let dmtOverride = null
  let activeTile  = null

  // Inject styles
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  // ── Panel root ──────────────────────────────────────────────────────────────
  const panel = document.createElement('div')
  panel.id = 'lab-panel'

  // ── Tile strip ──────────────────────────────────────────────────────────────
  const strip = document.createElement('div')
  strip.id = 'lab-tiles'

  function setAspect(tex) {
    const img = tex.image
    const w = img.videoWidth  || img.naturalWidth  || img.width  || 1
    const h = img.videoHeight || img.naturalHeight || img.height || 1
    surface.material.uniforms.uTexAspect.value = w / h
  }

  function applyTexture(url, tileEl) {
    loader.load(url, (tex) => {
      tex.colorSpace  = THREE.SRGBColorSpace
      tex.anisotropy  = 8
      tex.needsUpdate = true
      surface.material.uniforms.uTexture.value = tex
      setAspect(tex)
      gpuSim.setTexture(tex)
    })
    if (activeTile) activeTile.classList.remove('lab-active')
    if (tileEl)     tileEl.classList.add('lab-active')
    activeTile = tileEl ?? null
    activeProcedural = null
    syncDistanceRow()
  }

  // Which generated texture is live, and at what distance. Null once a
  // photograph is loaded, because a photograph has no generator behind it.
  let activeProcedural = null
  let activeDistance   = 1
  let distanceRow      = null

  function syncDistanceRow() {
    if (!distanceRow) return
    distanceRow.classList.toggle('lab-row-inert', activeProcedural === null)
  }

  // For procedural DataTextures (already in GPU memory, no load needed)
  function applyDirectTexture(tex, tileEl, name) {
    tex.anisotropy  = 8
    tex.needsUpdate = true
    surface.material.uniforms.uTexture.value = tex
    setAspect(tex)
    gpuSim.setTexture(tex)
    if (activeTile) activeTile.classList.remove('lab-active')
    if (tileEl)     tileEl.classList.add('lab-active')
    activeTile = tileEl ?? null
    if (name !== undefined) activeProcedural = name
    syncDistanceRow()
  }

  // Rebuild the live texture at the current distance. Both consumers have to be
  // fed: the surface samples it for display, the simulation samples it for the
  // external drive. Updating only one would decouple where the nodes land from
  // what is visible under them.
  function applyDistance(scale) {
    activeDistance = scale
    if (activeProcedural === null) return
    const tex = makeScaledTexture(activeProcedural, scale)
    if (!tex) return
    tex.anisotropy  = 8
    tex.needsUpdate = true
    surface.material.uniforms.uTexture.value = tex
    setAspect(tex)
    gpuSim.setTexture(tex)
  }

  function makeTile(url, name, thumb) {
    const tile = document.createElement('button')
    tile.className = 'lab-tile'

    const img = document.createElement('img')
    img.className = 'lab-tile-thumb'
    img.src = thumb ?? url
    img.alt = name
    img.draggable = false

    const label = document.createElement('span')
    label.className = 'lab-tile-name'
    label.textContent = name

    tile.appendChild(img)
    tile.appendChild(label)
    tile.addEventListener('click', () => applyTexture(url, tile))
    return tile
  }

  // A labelled block of tiles. The label is not decoration: it says which of
  // the two experiments the tiles below it run.
  function makeGroup(label) {
    const group = document.createElement('div')
    group.className = 'lab-group'

    const caption = document.createElement('span')
    caption.className   = 'lab-group-label'
    caption.textContent = label

    const tiles = document.createElement('div')
    tiles.className = 'lab-group-tiles'

    group.appendChild(caption)
    group.appendChild(tiles)
    strip.appendChild(group)
    return tiles
  }

  // Gallery tiles from src/gallery/
  if (GALLERY.length > 0) {
    const photoTiles = makeGroup('photograph')
    GALLERY.forEach(({ url, name }, i) => {
      const tile = makeTile(url, name)
      if (i === 0) {
        tile.classList.add('lab-active')
        activeTile = tile
      }
      photoTiles.appendChild(tile)
    })
  }

  // Procedural tiles, grouped by what they test
  PROCEDURAL_GROUPS.forEach(({ kind, label }) => {
    const entries = PROCEDURAL.filter((t) => t.kind === kind)
    if (entries.length === 0) return

    const groupTiles = makeGroup(label)

    entries.forEach(({ name, label: tileLabel, texture, thumbnail }) => {
      const tile = document.createElement('button')
      tile.className = 'lab-tile'

      const img = document.createElement('img')
      img.className = 'lab-tile-thumb'
      img.src       = thumbnail
      img.alt       = tileLabel
      img.draggable = false

      const span = document.createElement('span')
      span.className   = 'lab-tile-name'
      span.textContent = tileLabel

      tile.appendChild(img)
      tile.appendChild(span)
      tile.addEventListener('click', () => applyDirectTexture(makeScaledTexture(name, activeDistance) ?? texture, tile, name))

      // Default when no photograph is present. It has to be a control, so the
      // first thing anyone sees is the field solving an input with no symmetry
      // in it rather than one that already carries the answer.
      if (name === PROCEDURAL[0].name && GALLERY.length === 0) {
        tile.classList.add('lab-active')
        activeTile       = tile
        activeProcedural = name
      }

      groupTiles.appendChild(tile)
    })
  })

  // Upload tile
  const fileInput = document.createElement('input')
  fileInput.type   = 'file'
  fileInput.accept = 'image/*'
  fileInput.style.display = 'none'
  document.body.appendChild(fileInput)

  const uploadTile = document.createElement('button')
  uploadTile.className = 'lab-tile'
  uploadTile.innerHTML = `
    <span class="lab-tile-upload-box">+</span>
    <span class="lab-tile-name">upload</span>
  `
  uploadTile.addEventListener('click', () => fileInput.click())

  const uploadTiles = makeGroup('your own')

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    const name = file.name.replace(/\.[^/.]+$/, '').slice(0, 18)
    const tile = makeTile(objectUrl, name)
    uploadTiles.insertBefore(tile, uploadTile)
    applyTexture(objectUrl, tile)
    fileInput.value = ''
  })

  uploadTiles.appendChild(uploadTile)
  panel.appendChild(strip)

  // ── α slider ────────────────────────────────────────────────────────────────
  const sliderRow = document.createElement('div')
  sliderRow.id = 'lab-slider-wrap'

  const sliderLabel = document.createElement('span')
  sliderLabel.className = 'lab-label'
  sliderLabel.textContent = 'α'

  const slider = document.createElement('input')
  slider.type  = 'range'
  slider.id    = 'lab-dmt-slider'
  slider.min   = '0'
  slider.max   = '1'
  slider.step  = '0.01'
  slider.value = '1'

  const valDisplay = document.createElement('span')
  valDisplay.id          = 'lab-dmt-val'
  valDisplay.textContent = '1.00'

  slider.addEventListener('input', () => {
    dmtOverride = parseFloat(slider.value)
    valDisplay.textContent = dmtOverride.toFixed(2)
  })

  sliderRow.appendChild(sliderLabel)
  sliderRow.appendChild(slider)
  sliderRow.appendChild(valDisplay)
  panel.appendChild(sliderRow)

  // ── Lobe-count selector ─────────────────────────────────────────────────────
  const LOBE_OPTIONS = [
    { n: 0, label: 'free' },
    { n: 3, label: '3'    },
    { n: 4, label: '4'    },
    { n: 6, label: '6'    },
    { n: 8, label: '8'    },
  ]

  const lobeRow = document.createElement('div')
  lobeRow.id = 'lab-lobe-wrap'

  const lobeLabel = document.createElement('span')
  lobeLabel.className = 'lab-label'
  lobeLabel.textContent = 'planform'
  lobeRow.appendChild(lobeLabel)

  let activeLobe = null

  LOBE_OPTIONS.forEach(({ n, label }) => {
    const btn = document.createElement('button')
    btn.className   = 'lab-lobe-btn'
    btn.textContent = label
    if (n === 0) {
      btn.classList.add('lab-active')
      activeLobe = btn
    }
    btn.addEventListener('click', () => {
      if (activeLobe) activeLobe.classList.remove('lab-active')
      btn.classList.add('lab-active')
      activeLobe = btn
      gpuSim.setLobeCount(n)
    })
    lobeRow.appendChild(btn)
  })

  panel.appendChild(lobeRow)

  // ── Viewing distance ────────────────────────────────────────────────────────
  // Nothing moves. The texture is regenerated with proportionally finer
  // features, which is what stepping back from a wall does to the image landing
  // on a retina. Past 2× the features drop below the field's own wavelength and
  // the pattern stops following them.
  const distRow = document.createElement('div')
  distRow.id = 'lab-lobe-wrap'
  distanceRow = distRow

  const distLabel = document.createElement('span')
  distLabel.className = 'lab-label'
  distLabel.textContent = 'distance'
  distRow.appendChild(distLabel)

  let activeDistBtn = null

  TEXTURE_DISTANCES.forEach(({ scale, label }) => {
    const btn = document.createElement('button')
    btn.className   = 'lab-lobe-btn'
    btn.textContent = label
    if (scale === 1) {
      btn.classList.add('lab-active')
      activeDistBtn = btn
    }
    btn.addEventListener('click', () => {
      if (activeDistBtn) activeDistBtn.classList.remove('lab-active')
      btn.classList.add('lab-active')
      activeDistBtn = btn
      applyDistance(scale)
    })
    distRow.appendChild(btn)
  })

  panel.appendChild(distRow)
  syncDistanceRow()

  document.body.appendChild(panel)

  // ── Visibility: visible at start, fades out as first annotation panel peaks ──
  // First panel peaks at scroll p ≈ 0.06 (full opacity).
  // Lab fades: p=0.00 → opacity 1.0, p=0.07 → opacity 0.0.
  // Scrolling back reverses the fade.
  function updateLabOpacity() {
    const scrollH = document.documentElement.scrollHeight - window.innerHeight
    const p = scrollH > 0 ? window.scrollY / scrollH : 0
    const opacity = Math.max(0, Math.min(1, 1.0 - (p - 0.01) / 0.06))
    panel.style.opacity      = String(opacity)
    panel.style.pointerEvents = opacity > 0.05 ? 'auto' : 'none'

    // Hand α back to the scroll once the laboratory is out of reach.
    //
    // The override used to latch: one touch of the slider set dmtOverride to a
    // number and nothing ever set it back to null, so main.js preferred it for
    // the rest of the session and the scrollytelling could no longer drive α.
    // Scrolling then moved curvature, the world-sheet and the cortical map while
    // the field stayed frozen wherever the slider had left it, which reads as a
    // fully developed planform sitting under the Threshold panel.
    if (opacity <= 0.05 && dmtOverride !== null) {
      dmtOverride            = null
      slider.value           = '0'
      valDisplay.textContent = '0.00'
    }
  }

  updateLabOpacity()   // set correct state on load (before any scroll)
  window.addEventListener('scroll', updateLabOpacity, { passive: true })

  return {
    getDMT() { return dmtOverride },
  }
}
