# plan.form

**Demo: https://planform.sponde.de/**

A scrollytelling WebGL experience that runs the Wilson-Cowan neural field equations in real time on a GPU. An artistic interpretation of the mathematical transformation DMT may apply to the primary visual cortex, unfolding across six acts and a descent, driven entirely by scroll position.

> **plan.form** is both a scientific term and a layered acronym.
> *Planform*, the spatial pattern that self-organises in primary visual cortex at bifurcation, is the central object this project simulates and visualises.
> Read as two halves, each expands into a distinct scientific reference:
>
> **PLAN** · *Poincaré Lateral Activation Network*
> Poincaré: the hyperbolic geometry of DMT phenomenal space (Gomez-Emilsson / QRI).
> Lateral: the lateral excitatory-inhibitory connectivity of V1 (Wilson & Cowan, 1972).
> Activation: the sigmoid activation function σ governing each neural population.
> Network: the cortical neural field as a spatially extended dynamical network.
>
> **FORM** · *Field Of Reaction-diffusion Morphogenesis*
> Field: the Wilson-Cowan neural field equations running on a 512² GPU grid.
> Reaction-diffusion: short-range excitation against long-range inhibition, the
> mechanism that destabilises the homogeneous state.
> Morphogenesis: Turing's reaction-diffusion instability (1952), the same mathematics
> that patterns a leopard's coat, applied to primary visual cortex.

---

## The premise

Many existing DMT visualisations make the same mistake: they add exotic content to a blank canvas. Fractal renders, VJ loops, AI-generated imagery. All attempt to depict the experience through novelty. This does the opposite.

plan.form takes an unremarkable photograph and asks: what if the pattern was already there, implicit in the spatial statistics of the image? As a single parameter rises from 0 to 1, the visual cortex's own lateral connectivity amplifies until it overcomes the external signal and begins generating structure spontaneously.

The geometry is not drawn. It is the stable solution to a differential equation, the same equation that governs V1 lateral connectivity in every human brain. What the mathematics produces is structure. Turning that structure into an image took a great many decisions that are not in the mathematics, and those are listed openly under [Honest accounting](#honest-accounting).

This is an artistic interpretation built on scientific models, not a scientific demonstration. The neuroscience grounding the simulation is well-established; the claim that this is what the DMT experience *is* is not. That gap is intentional, and worth keeping in mind.

---

## The Six Acts

Scroll position maps directly to shader uniforms. There is no timeline, no animation loop driving the narrative, only the reader's own pace through the mathematics.

The act boundaries follow the six-level phenomenology that recurs across the trip report corpus, as collected and ordered by Gomez-Emilsson (2016, non-peer-reviewed): Threshold, Chrysanthemum, Magic Eye, Waiting Room, Breakthrough, Amnesia.

One word has to be kept apart from itself. *Threshold* in those reports is the first level: a shift in ambience and a sharpening of the senses, with no geometry at all. *Threshold crossing* in a neural field means the bifurcation point. They are one level apart, and act III is the second of them.

| Scroll | Act | Level | What happens |
|--------|-----|-------|--------------|
| 0–13% | **I · Primary Visual Cortex** | sober | The photograph is rendered as a luminance-displaced 3D surface. Each of the 197,000 vertices is pushed outward in proportion to local brightness. Mouse movement drives camera parallax. V1 receives this signal; lateral connectivity active but stable, patterns suppressed by the dominance of external input. |
| 14–26% | **II · Threshold** | 1 | The first reported level and the quietest. Colours lift, local contrast sharpens, the scene reads as though an intervening medium had been removed. No geometry, no motion. α is still zero and the field is idle: what happens here is a colour grade and a four-tap local contrast lift applied to the photograph. The act exists because the corpus puts it first. |
| 26–46% | **III · Bifurcation α ≈ 0.42** | crossing | The Wilson-Cowan field comes up alongside the image: two coupled populations, 8 integration steps per rendered frame on a 512² grid. Lateral excitatory coupling w_EE then crosses its critical value and the homogeneous steady state loses stability through a Turing instability. A travelling wave of activation sweeps centrifugally from the foveal centre outward. Inside the front, spatial patterns form spontaneously. |
| 47–63% | **IV · Chrysanthemum** | 2 | The field self-organises into the planform class Bressloff et al. (2001) predict for V1 under elevated cortical excitability. Flat, apersonal, no figures yet. The reports describe this level as symmetrifying whatever patterned surface is looked at, which is exactly the split here: the kernel sets the symmetry class and the spacing, the photograph sets where the nodes land. |
| 62–79% | **V · Magic Eye** | 3 | The texture is read as an autostereogram. Dark recedes, bright advances, and a surface becomes a volume. The height map is the field itself: nodes rise, anti-nodes sink, the mid-range flattens into a floor, and what lifts out of the wall carries the planform's symmetry because it is made of the planform. In the reports the fold comes from recognition, and that half is not in the code. |
| 78–93% | **VI · Waiting Room** | 4 | The Poincaré disk transform reaches full strength and z → log(z) maps the visual field to cortical coordinates. Bilateral, nodal, axially organised structure is what face-selective cortex responds to, which is a claim about the person looking at the screen rather than about the field behind it. In the reports the entities are a gradient across four levels; this act shows one point on it. |
| 92–100% | **Coda · Descent** | post-peak | Plasma concentration peaks 2–3 min after injection and effects decay across the following quarter hour (Timmermann et al., 2019); whole-brain models fit the bifurcation parameter as a gamma function, fast rise and slow fall (Piccinini et al., 2025). So α falls, the curvature relaxes, the cortical map unwinds and the photograph comes back. Earlier versions held the parameter at maximum to the end, which matched neither the pharmacokinetics nor the reports. |

### Where this stops, and why

Levels five and six, Breakthrough and Amnesia, are deliberately not attempted, and the reason is structural. The source defines a breakthrough as a *topological* change of the world-sheet: the connectivity of represented space changes, loops open between points that had none. Everything here is a change of curvature applied to a depth-mapped surface, and a depth-mapped surface cannot change its own topology. Amnesia is by definition not representable. The work covers four of six levels and stops there.

---

## Technical Architecture

```
src/
├── main.js              # Renderer, scene, animation loop, scroll wiring
├── surface.js           # THREE.PlaneGeometry + ShaderMaterial (384×512 segments)
├── gpuCompute.js        # GPUComputationRenderer ping-pong (512² grid, 8 steps/frame)
├── wavefront.js         # Activation front state machine (ring mesh not rendered)
├── pointcloud.js        # 256² particle layer tracking the WC E field
├── procedural.js        # 8 input textures in two groups: control and resonance
├── postfx.js            # Post-processing: chromatic aberration + bloom + plasma volume + ACES
├── scroll.js            # GSAP ScrollTrigger → shader uniforms, annotation panels
├── lab.js               # Surface Laboratory: texture selector, upload, α slider, planform bias
├── ui.js                # Debug UI (dev only)
└── shaders/
    ├── surface.vert     # Luminance + sim displacement, entity emergence
    ├── surface.frag     # Retino-cortical, Poincaré disk, colour grade, vignette
    ├── wc_e.frag        # Wilson-Cowan excitatory population (GPU compute)
    └── wc_i.frag        # Wilson-Cowan inhibitory population (GPU compute)
```

### Shader uniforms driven by scroll

| Uniform | Range | Controls |
|---------|-------|----------|
| `uSurface` | 0 → 1 | Luminance displacement reveal (Act I) |
| `uDMT` | 0 → 1 | w_EE coupling strength, external input suppression |
| `uCurvature` | 0 → 1 | Poincaré disk hyperbolic warp |
| `uRetino` | 0 → 1 | Log-polar cortical UV mapping |
| `uGrade` | 0 → 1 | Colour grade: vibrance + warmth (Acts I→II) |

### Wilson-Cowan GPU simulation

Two coupled populations per spatial point on a 512×512 grid, updated 8 times per rendered frame:

```
τ_E · ∂E/∂t = −E + σ( w_EE · K_exc⊛E  −  w_inh · K_inh⊛E  −  w_EI · I  +  I_ext )
τ_I · ∂I/∂t = −I + σ( w_IE · E  −  w_II · I )

I_ext = luminance · (1−α) · 0.45  +  edgeEnergy · 0.10

σ(x) = 1 / (1 + exp(−5·(x − 0.28)))
```

Both kernels sample the excitatory field; their difference is the Mexican hat. Note that the second term in I_ext does not scale with α, which is why the pattern stays anchored to the image at every value of the parameter.

The spatial convolution uses two ring samplers:
- **12-point ring** (30° spacing, 6-fold symmetry) for short-range excitation at r = 6 px
- **16-point ring** (22.5° spacing) for long-range inhibition at r = 20 px

The 12-point excitatory ring has 6-fold rotational symmetry, consistent with Bressloff et al. (2001)'s prediction that isotropic kernels prefer hexagonal planforms. Worth stating plainly: the discretised ring is not isotropic, so part of the hexagonal preference is supplied by the sampling pattern rather than emerging from it. An 8-point ring would introduce 4-fold bias and spuriously favour square-lattice patterns.

Strictly speaking, this is a reduced formulation: the inhibitory equation uses only local E (no spatial kernel on the E → I coupling), placing the system between the full Wilson-Cowan model and the Amari (1977) single-population neural field. The simplification is standard, preserves the Turing-instability behaviour, and keeps the GPU cost low enough for real-time integration at 60 fps.

**Bifurcation analysis:** with σ′(E*) ≈ 1.14 at the resting state, Turing instability is triggered when w_EE crosses ≈ 0.99. At α = 0 (baseline), w_EE = 0.45 (stable). The bifurcation occurs at α ≈ 0.42. At α = 1, w_EE = 1.75 (strongly patterned).

**Boundary damping:** w_EE is clamped to the sub-bifurcation value (0.45) within 10% of each texture edge via `smoothstep(0.0, 0.10, edgeDist)`, preventing the hard rectangular planform-edge artefact that appears when periodic boundary wrapping is combined with non-periodic input textures.

The external input `I_ext` contains both low-frequency luminance (which suppresses planform formation where the image is bright) and a persistent high-frequency edge signal that seeds planform nodes at input texture boundaries, ensuring the pattern is topographically anchored to the input rather than arbitrary.

### Travelling wave activation front

At bifurcation, the Wilson-Cowan system does not activate everywhere simultaneously. The foveal representation activates first and excites its neighbours, creating a wave that sweeps centrifugally, matching the subjective report that psychedelic hallucinations emerge from the centre of the visual field outward.

The wave is implemented as a state machine (IDLE → DELAY → EXPANDING → DONE):

- **IDLE**: waiting for α to cross 0.42
- **DELAY**: 1 s pause after trigger (neural latency)
- **EXPANDING**: radius grows at 0.50 world units/s (~3.3 s to cover the full plane)
- **DONE**: ring exits the plane; full bifurcation everywhere

The wave front is wired directly into the GPU simulation via `uWaveFront` in `wc_e.frag`. Outside the front, w_EE stays at 0.45 (sub-bifurcation). Inside the swept zone, w_EE rises to the full modulated value. The planform only forms where the wave has passed; the inside/outside boundary is real, not cosmetic.

A glowing ring mesh exists in `wavefront.js` but is deliberately **not** added to the scene: the visible flash distracted from the pattern forming beneath it. The front itself still runs and still gates the simulation. Re-add `waveFront.mesh` in `main.js` to restore the ring.

### Point cloud overlay

A 256×256 grid of THREE.Points samples the WC E field each frame. Z-displacement tracks activation above resting state, creating a volumetric heightmap layer above the surface. Point size and alpha both scale with activation, so the cloud emerges naturally as the planform forms; no explicit wave gating required (the WC simulation's own gate ensures E stays near resting outside the wave front).

Colour gradient: cold teal (onset, E ≈ 0.33–0.44) → bright cyan (active, E ≈ 0.55–0.72) → warm white (supercritical peak, E > 0.72). This maps directly to the three sigmoid activation regimes.

### Post-processing

Two-pass pipeline rendered to a HDR (HalfFloat) offscreen target:

1. **Radial chromatic aberration**: R/G/B channels offset radially from centre, magnitude proportional to uDMT × r². Rolled off toward screen edges via `smoothstep` so fringing doesn't overpower the plane boundary.
2. **Bloom**: 4 concentric rings (3/7/14/26 px) × 8 samples per ring, additive glow on pixels above luminance threshold 0.52. Strength scales with both uDMT and uRetino.
3. **Plasma volume**: screen-space Gaussian blur of the Wilson-Cowan sim texture (5 rings, radii 0.030–0.210 UV, 52 taps total). Maps blurred activation density to deep blue-indigo → blue-cyan → red-violet colours, composited additively. A scene-luminance depth mask restricts the glow to dark interior regions: it fills the void inside enclosed planform structures like a bioluminescent glow, without touching the bright particle surfaces.
4. **ACES filmic tone mapping**: Hill/Uncharted approximation applied after all additive passes.

### Procedural input textures

Eight textures in two groups. The split is not cosmetic: the groups run two different experiments, and only one of them tests the claim this project makes. The laboratory strip is divided and labelled accordingly.

**control · symmetry-free.** Broadband, isotropic, no privileged orientation and no privileged spatial frequency. There is no symmetry in the input to copy, so any symmetry that appears downstream came from the connectivity kernel. This is what Ermentrout & Cowan (1979) and Bressloff et al. (2001) actually predict: spontaneous pattern formation out of a near-homogeneous state. `pink` is the default when no photograph is present.

| Texture | Construction | Why it qualifies |
|---------|--------------|------------------|
| pink | 1/f multi-octave, 12 orientations per octave | Natural-scene spatial statistics; all scales compete, none is imposed |
| noise | Isotropic band-limited, 24 orientations | Single scale matched to the field's characteristic wavelength, no orientation |
| raufaser | Tileable value-noise grain plus ~420 chips at uniformly random angles | Aperiodic and isotropic; chip length scaled toward k\* so it carries energy near the field's own wavelength without carrying an orientation |

**resonance · form constants.** These already carry a form constant, and `rings` carries it in cortical coordinates, where it is literally the pattern the kernel is supposed to produce. Handing the field the answer is not a demonstration of emergence and must not be read as one.

What they do test is worth having: whether the field's characteristic wavelength k\* matches the input's spatial frequency. If it matches, the pattern locks and sharpens. If it does not, the field overrides the input and imposes its own spacing. That is wavelength selection, not emergence, and switching between the two groups makes the difference visible.

| Texture | Formula | Cortical representation | Form constant |
|---------|---------|------------------------|---------------|
| stripes | Oriented single-scale | 1D dominance | Stripe / wave |
| grid | sin(kx)·sin(ky) | Two orthogonal | Square lattice |
| rings | cos(k · log r) | Vertical stripes | Funnel / tunnel |
| spokes | cos(6θ) | Horizontal stripes | Cobweb / mandala |
| spiral | cos(6·log r + 3θ) | Diagonal stripes | Logarithmic spiral |

**Viewing distance.** A `distance` control regenerates the live texture at 1× or 2× feature density. Nothing moves and no camera changes: stepping back from a wall raises the spatial frequency of what lands on a retina, and that is exactly what the factors do.

Tiling the texture with `RepeatWrapping` would have been the cheaper route and was rejected. It introduces a phase discontinuity at every tile boundary, those seams are straight edges, and edges enter the external drive through the edge-energy term and seed planform nodes. A tiled input prints its own grid into the pattern. It would also impose an exact translational periodicity on textures whose whole purpose is to carry none.

Two steps is the whole useful range, because the second one crosses something. The field's characteristic wavelength is roughly 28 px on the 512² grid. At distance 1 the input's features sit above it and the image decides where the nodes go. At distance 2 they fall to it and past it, the field stops locking to the input and imposes its own spacing, and structures appear that the input never contained: the oriented stripes at distance 2, held past the peak, produce symmetries that distance 1 does not produce at any parameter value. A third step only pushes further into the same regime, where everything below the field's wavelength looks alike to the field.

`raufaser` is rendered at 2× resolution and box-averaged down, because it is the only generator that draws hard edges and so the only one that aliases: a chip below one texel then contributes its true area instead of being rounded up or dropped, and grain finer than a texel loses contrast by exactly the factor the averaging implies. Factors of 3 and 4 are visually indistinguishable from 2 at these distances while costing two and three times as much. The analytic generators are sums of band-limited sinusoids whose shortest wavelength stays well above two texels here, so they get nothing from it and are left at 1×.

The control is inert while a photograph is loaded, since a photograph has no generator to re-run.

All textures are generated at 512² (simulation) and 64² (thumbnail) from the same generator function, with mipmaps enabled to reduce aliasing through the log-polar transform. `raufaser` uses a seeded PRNG rather than `Math.random()` so the thumbnail and the simulation texture show the same wall.

### Retino-cortical transform

```glsl
vec2 corticalUV(vec2 uv) {
  vec2 c  = (uv - 0.5) * 2.0;
  float r = max(length(c), 0.04);
  float cx = (log(r) + 3.22) / 3.57;
  float cy = atan(c.y, c.x) / (2.0 * PI) + 0.5;
  return vec2(cx, cy);
}
```

The log-polar mapping reproduces the logarithmic form of foveal magnification (~50% of V1 surface area devoted to the central ~10° of visual field; Horton & Hoyt 1991) qualitatively. Its constants are chosen for framing, not fitted to the published magnification factor. Radial symmetry that is implicit in the original input becomes explicit in cortical coordinates.

In the QRI account the curvature is a *local* quantity driven by attention: it accumulates where measurements have already been made, and only jumps to the whole space when a surface can no longer hold it. Here it is a single global parameter applied to the entire frame at once, centred on the middle of the image and unrelated to where the field is active. The name of the mechanism is borrowed correctly; the operator is not the one described.

The local half of that idea is what act V implements. The field's deviation from rest is read as a height map rather than as a brightness modulation: nodes advance, anti-nodes recede, and the mid-range holds still as a floor, so the plane acquires volume and forms stand out of it. Those forms are patterned with the planform because they are made of it. The height map is field-derived; the single key light and rim term that make it read as relief are not. An earlier version produced this effect from the photograph's own luminance in the final act, which gave the same silhouette at every parameter value.

The fusiform face area (Kanwisher et al., 1997) responds to the structural features of a face independent of whether the input literally is one. That is a claim about the viewer, not about the simulation.

### Model class limit

The field here is a single-population reduction with an isotropic Mexican-hat kernel and no orientation dimension, which places it in the Ermentrout-Cowan class rather than the orientation-tuned one. Bressloff et al. (2001, §3d) are explicit about what that class can and cannot do: *"The absence of orientation representation in the Ermentrout-Cowan model means that a number of the form constants cannot be generated by the model, including lattice tunnels, honeycombs and certain chequer-boards, and cobwebs."*

What this class does generate is contrasting regions of light and dark, which under the inverse retino-cortical map give tunnels, funnels and spirals. Honeycombs and lattices need oriented contours, and oriented contours need a dimension this field does not have. The honeycomb quality on screen, the part that looks most like the reports, comes from the photograph's texture and from the composition.

The same limit shows up as a symmetry count. An isotropic kernel on a doubly periodic lattice supports three lattice types, rhombic, square and hexagonal, which in wallpaper terms is at most p2mm, p4m and p6m. Three of the seventeen plane symmetry groups, where reports of psychedelic visuals claim all seventeen. That gap is a property of the model, not a rendering limitation.

### Planform bias selector

An n-fold symmetry bias can be injected into the WC simulation via the Surface Laboratory. A cosine angular modulation `cos(n·θ) × 0.030 × α` is added to `I_ext`, seeding the competition between planform modes without overriding the dynamics. Options: free (no bias), 3-fold, 4-fold, 6-fold, 8-fold.

---

## Getting Started

Requires Node.js 18+.

```bash
git clone https://github.com/Kracht/plan.form.git
cd plan.form
npm install
npm run dev
```

The simulation starts with procedural input textures; no external images are required. To add your own images, drop them into `src/gallery/`. They are auto-discovered at build time and appear as tiles in the Surface Laboratory.

```bash
npm run build    # production build → dist/
npm run preview  # preview production build locally
```

---

## Surface Laboratory

The Surface Laboratory panel appears at the top of the page and fades out as the first annotation panel comes into view (scrolling back restores it).

- **Input textures**: 8 procedural presets in two labelled groups, control (pink, noise, raufaser) and resonance (stripes, grid, rings, spokes, spiral), plus any images placed in `src/gallery/`
- **Upload**: load any image from disk; a preset tile is created for it
- **α slider**: manually scrub the DMT parameter from 0 → 1, overriding the scroll-driven value. Useful for exploring the bifurcation threshold with any input
- **Planform bias**: select n-fold rotational symmetry bias (free / 3 / 4 / 6 / 8) to tip the competition between planform modes

Changing texture or planform resets the simulation to resting state so the new planform forms cleanly.

---

## Roadmap

- [x] Wilson-Cowan GPU simulation: ping-pong 512² grid, 8 steps/frame
- [x] Travelling activation front: gates the WC simulation itself, ring no longer rendered
- [x] Point cloud overlay: Wilson-Cowan E field as 3D heightmap particle layer
- [x] Post-processing stack: chromatic aberration + bloom + plasma volume + ACES tone mapping
- [x] Procedural input textures: 8 patterns split into a symmetry-free control group and a form-constant resonance group
- [x] 12-point excitatory ring (6-fold symmetry, prevents square-lattice bias of 8-point ring)
- [x] Boundary damping (prevents hard rectangular planform-edge artefact)
- [x] Planform bias selector (3/4/6/8-fold mode)
- [x] Surface Laboratory: fades as scrollytelling begins
- [x] Magic Eye world-sheet: field-derived height map in Act V, replaces the imposed luminance displacement of the old finale

---

## Honest accounting

The neural field is real: two coupled populations, integrated on the GPU, with no scripted outcome. Everything that follows the field is a design decision. Separating the two matters more than either does alone.

**What the field determines.** The symmetry class and the characteristic wavelength of the planform follow from the connectivity kernel and from nothing else. The bifurcation is a real loss of stability. The activation front is not a visual overlay: it gates the simulation itself, so cortex outside the front stays sub-bifurcation until the front arrives. The shape of the world-sheet in act V as well: the height at every vertex is the local deviation of the excitatory population from its resting state, split asymmetrically so nodes advance and anti-nodes recede.

**What the input determines.** Where the nodes land, and, for one group of inputs, more than that. A persistent high-frequency term derived from the input texture enters the external drive and does not fade as α rises. With a control input that is all it does: the input has no symmetry, so it anchors the pattern topographically while the kernel decides the pattern's class. With a resonance input the picture changes, because the input already carries a form constant and `rings` carries it in the very coordinates the kernel works in. Then the field is not producing a planform, it is being handed one. Both are on the tile strip, labelled, and the difference is the point of having both.

**What the image determines.** Where the nodes land. A persistent high-frequency term derived from the input texture enters the external drive and does not fade as α rises, so the pattern stays topographically anchored to the photograph throughout. The kernel decides what class of pattern forms; the image decides where it forms.

**What is imposed.**

- **The entity ring.** An elliptical annulus in the final act, placed by hand and pushed toward the viewer. Not field-derived, not image-derived, a composition decision and nothing else.
- **Lighting the world-sheet.** The height map of act V comes from the field, but a height map only reads as volume once it catches light. One fixed key light and a rim term do that. The shape is simulated; the way it is lit is rendering.
- **The hyperbolic warp.** One global curvature parameter, applied to the whole frame at once and centred on the middle of the image. In the account it is borrowed from, curvature is local and driven by attention. Here it is neither.
- **The Threshold sharpening.** Act II is a colour grade and a four-tap local contrast lift on the photograph. The field is idle throughout it.
- **A second model, running as post-effects.** The frame feedback echo and the drifting warp implement the first two of the four operators in Gomez-Emilsson's algorithmic reduction (2016, non-peer-reviewed): control interruption and drifting. Two of those four operators are present as post-effects and none as field mechanisms.
- **Symmetry bias.** The planform selector injects a low-amplitude angular modulation into the external drive, centred on the frame. Small enough that the field still resolves the competition, but the competition has been tipped, and the centring biases toward a radial composition.
- **Boundary damping.** Lateral coupling is pulled back toward its sub-threshold value within the outer tenth of the frame. A vignette applied to the dynamics rather than to the picture.
- **Front timing.** Trigger point, one-second delay and constant speed are set by hand. In a neural field, fronts emerge from the dynamics. Here the front is direction, and the dynamics follow it.
- **Everything after the render.** Bloom, radial chromatic aberration, the plasma volume, two colour grades, drift, disk mask, edge fades, frame feedback, tone mapping. None of this is in any model. It is photography.

**What the model does not claim.** The face-like forms of the final act are a statement about the viewer, not about the simulation. Whether the same account extends to entity encounters under DMT is an open question this piece raises rather than answers.

It does not claim to produce the pattern class it most resembles: the field belongs to the model class Bressloff et al. show cannot generate honeycombs, lattices or cobwebs, and it spans three of the seventeen plane symmetry groups where the reports claim all seventeen.

It does not claim to cover the experience: four of six reported levels, stopping before Breakthrough and Amnesia.

It does not model recognition. Act V reads the field as depth, but the source attributes the fold to recognition, and nothing in the code recognises anything. That half of the mechanism is supplied by the person watching.

---

## Scientific basis

### Peer-reviewed literature

- **Amari, S.** (1977). Dynamics of pattern formation in lateral-inhibition type neural fields. *Biological Cybernetics*, 27(2), 77–87.
- **Bressloff, P.C., Cowan, J.D., Golubitsky, M., Thomas, P.J., Wiener, M.** (2001). Geometric visual hallucinations, Euclidean symmetry and the functional architecture of striate cortex. *Phil. Trans. R. Soc. B*, 356, 299–330.
- **Ermentrout, G.B. & Cowan, J.D.** (1979). A mathematical theory of visual hallucination patterns. *Biological Cybernetics*, 34, 137–150.
- **Horton, J.C. & Hoyt, W.F.** (1991). The representation of the visual field in human striate cortex: a revision of the classic Holmes map. *Archives of Ophthalmology*, 109(6), 816–824.
- **Kanwisher, N., McDermott, J. & Chun, M.M.** (1997). The fusiform face area: a module in human extrastriate cortex specialized for face perception. *Journal of Neuroscience*, 17(11), 4302–4311.
- **Klüver, H.** (1966). *Mescal and mechanisms of hallucinations*. University of Chicago Press. (Original work published 1928)
- **Piccinini, J.I. et al.** (2025). Transient destabilization of whole brain dynamics induced by N,N-Dimethyltryptamine (DMT). *Communications Biology*, 8, 148.
- **Timmermann, C. et al.** (2019). Neural correlates of the DMT experience assessed with multivariate EEG. *Scientific Reports*, 9, 16324.
- **Turing, A.M.** (1952). The chemical basis of morphogenesis. *Phil. Trans. R. Soc. B*, 237, 37–72.
- **Wilson, H.R. & Cowan, J.D.** (1972). Excitatory and inhibitory interactions in localized populations of model neurons. *Biophysical Journal*, 12(1), 1–24.
- **Wilson, H.R. & Cowan, J.D.** (1973). A mathematical theory of the functional dynamics of cortical and thalamic nervous tissue. *Kybernetik*, 13(2), 55–80.

### Speculative and cultural sources

The following sources shaped the conceptual framing and visual language of this project. They are listed separately not as a dismissal of their intellectual value, but to distinguish their epistemic register from the peer-reviewed literature above.

McKenna's ethnobotanical and cultural work operates in a tradition of experiential inquiry and synthesis that sits outside, but not beneath, academic convention.

Gomez-Emilsson's essay represents serious independent theoretical work in the phenomenology of altered states, produced within the Qualia Research Institute's research programme, and engages directly with mathematical and geometric frameworks.

- **Gomez-Emilsson, A.** (2016). The hyperbolic geometry of DMT experiences. *Qualia Research Institute* (non-peer-reviewed essay). Used here as conceptual inspiration for the Poincaré disk transform, not as empirical evidence.
- **McKenna, T.** (1993). *Food of the gods: The search for the original tree of knowledge*. Bantam Books. Cited for the cultural framing of the closing panel only; nothing in the model depends on it.

---

## Stack

| Component | Technology |
|-----------|------------|
| 3D rendering | Three.js r170 |
| GPU neural field | `THREE.GPUComputationRenderer` (WebGL2 ping-pong) |
| Scroll animation | GSAP 3 + ScrollTrigger |
| Build | Vite 5 |
| Shaders | Custom GLSL (vertex + fragment + 2× compute) |
| Deployment | Static, any CDN |

---

## License

MIT · [github.com/Kracht](https://github.com/Kracht)
