# plan.form

**Demo: https://planform.sponde.de/**

A scrollytelling WebGL experience that runs the Wilson-Cowan neural field equations in real time on a GPU. An artistic interpretation of the mathematical transformation DMT may apply to the primary visual cortex, unfolding across six acts driven entirely by scroll position.

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

| Scroll | Act | What happens |
|--------|-----|--------------|
| 0–16% | **I · Primary Visual Cortex** | The photograph is rendered as a luminance-displaced 3D surface. Each of the 197,000 vertices is pushed outward in proportion to local brightness. Mouse movement drives camera parallax. V1 receives this signal; lateral connectivity active but stable, patterns suppressed by the dominance of external input. |
| 20–36% | **II · Wilson–Cowan Field** | A 512² GPU simulation of two coupled neural populations (excitatory E, inhibitory I) activates alongside the image. The field runs 8 integration steps per rendered frame. The system is stable. The external image dominates. |
| 37–52% | **III · Bifurcation α ≈ 0.42** | Lateral excitatory coupling w_EE crosses a critical threshold. The homogeneous steady state loses stability through a Turing instability. A travelling wave of activation sweeps centrifugally from the foveal centre outward: the propagation front of lateral excitation. Inside the front, spatial patterns form spontaneously. Outside it, the cortex remains at resting state. |
| 53–65% | **IV · Hexagonal Planform** | The field self-organises into the planform class Bressloff et al. (2001) predict for V1 under elevated cortical excitability: the gain increase hallucinogens are thought to induce via 5HT₂A-mediated action on V1. The symmetry class and the spacing of the pattern are intrinsic to the cortical connectivity kernel. Where its nodes land is not: the image continues to seed them throughout. |
| 67–81% | **V · Hyperbolic Space** | The Poincaré disk transform initiates. The visual field folds into a disc-shaped mandala with exponential centre expansion, accommodating the information density of amplified lateral connectivity. The entire visual field recedes forever toward the boundary of the disc. |
| 78–100% | **VI · Entity Emergence** | z → log(z). The complex logarithm maps the visual field to cortical coordinates. Bilateral, nodal, axially organised structure is what face-selective cortex responds to, which is a claim about the person looking at the screen rather than about the field behind it. The figures here are also pushed into place by hand. See [Honest accounting](#honest-accounting). |

---

## Technical Architecture

```
src/
├── main.js              # Renderer, scene, animation loop, scroll wiring
├── surface.js           # THREE.PlaneGeometry + ShaderMaterial (384×512 segments)
├── gpuCompute.js        # GPUComputationRenderer ping-pong (512² grid, 8 steps/frame)
├── wavefront.js         # Activation front state machine (ring mesh not rendered)
├── pointcloud.js        # 256² particle layer tracking the WC E field
├── procedural.js        # 7 scientifically-motivated procedural input textures
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

Seven textures covering the full space of Ermentrout-Cowan (1979) form constants and Bressloff et al. (2001) planform predictions. All are expressed in cortical (log-polar) coordinates so they seed the correct planform class:

| Texture | Formula | Cortical representation | Expected planform |
|---------|---------|------------------------|-------------------|
| rings | cos(k · log r) | Vertical stripes | Funnel / tunnel |
| spokes | cos(6θ) | Horizontal stripes | Cobweb / mandala |
| spiral | cos(6·log r + 3θ) | Diagonal stripes | Logarithmic spiral |
| pink | 1/f multi-octave | All scales | Multi-planform |
| noise | Isotropic band-limited | No dominant orientation | Hexagonal mosaic |
| stripes | Oriented single-scale | 1D dominance | Stripe / wave |
| grid | sin(kx)·sin(ky) | Two orthogonal | Square lattice |

All textures are generated at 512² (simulation) and 64² (thumbnail) from the same generator function, with mipmaps enabled to reduce aliasing through the log-polar transform.

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

During the final transition, vertex displacement is recentred around the image's mid-luminance point, causing dark areas to recede and bright areas to protrude. That displacement is imposed, not computed: it is applied to the photograph's luminance and is not derived from the field. Separately, the fusiform face area (Kanwisher et al., 1997) responds to the structural features of a face independent of whether the input literally is one. That is a claim about the viewer, not about the simulation.

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

- **Input textures**: 7 procedural presets (rings, spokes, spiral, pink noise, noise, stripes, grid) plus any images placed in `src/gallery/`
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
- [x] Procedural input textures: 7 patterns covering full Ermentrout-Cowan form constant space
- [x] 12-point excitatory ring (6-fold symmetry, prevents square-lattice bias of 8-point ring)
- [x] Boundary damping (prevents hard rectangular planform-edge artefact)
- [x] Planform bias selector (3/4/6/8-fold mode)
- [x] Surface Laboratory: fades as scrollytelling begins
- [x] Entity emergence: imposed displacement in Act VI, disclosed under Honest accounting
- [ ] Binaural audio sync: peak spatial frequency of the E field drives a Web Audio binaural beat generator

---

## Honest accounting

The neural field is real: two coupled populations, integrated on the GPU, with no scripted outcome. Everything that follows the field is a design decision. Separating the two matters more than either does alone.

**What the field determines.** The symmetry class and the characteristic wavelength of the planform follow from the connectivity kernel and from nothing else. The bifurcation is a real loss of stability. The activation front is not a visual overlay: it gates the simulation itself, so cortex outside the front stays sub-bifurcation until the front arrives.

**What the image determines.** Where the nodes land. A persistent high-frequency term derived from the input texture enters the external drive and does not fade as α rises, so the pattern stays topographically anchored to the photograph throughout. The kernel decides what class of pattern forms; the image decides where it forms.

**What is imposed.**

- **Entity geometry.** In the final act, vertex displacement is recentred on the image's mid-luminance so bright forms protrude and dark regions sink. Applied to the photograph, not derived from the field. The resemblance to standing figures is composed, not computed.
- **Symmetry bias.** The planform selector injects a low-amplitude angular modulation into the external drive, centred on the frame. Small enough that the field still resolves the competition, but the competition has been tipped, and the centring biases toward a radial composition.
- **Boundary damping.** Lateral coupling is pulled back toward its sub-threshold value within the outer tenth of the frame. A vignette applied to the dynamics rather than to the picture.
- **Front timing.** Trigger point, one-second delay and constant speed are set by hand. In a neural field, fronts emerge from the dynamics. Here the front is direction, and the dynamics follow it.
- **Everything after the render.** Bloom, radial chromatic aberration, the plasma volume, two colour grades, drift, disk mask, edge fades, frame feedback, tone mapping. None of this is in any model. It is photography.

**What the model does not claim.** The face-like forms of the final act are a statement about the viewer, not about the simulation. Whether the same account extends to entity encounters under DMT is an open question this piece raises rather than answers.

---

## Scientific basis

### Peer-reviewed literature

- **Amari, S.** (1977). Dynamics of pattern formation in lateral-inhibition type neural fields. *Biological Cybernetics*, 27(2), 77–87.
- **Bressloff, P.C., Cowan, J.D., Golubitsky, M., Thomas, P.J., Wiener, M.** (2001). Geometric visual hallucinations, Euclidean symmetry and the functional architecture of striate cortex. *Phil. Trans. R. Soc. B*, 356, 299–330.
- **Ermentrout, G.B. & Cowan, J.D.** (1979). A mathematical theory of visual hallucination patterns. *Biological Cybernetics*, 34, 137–150.
- **Horton, J.C. & Hoyt, W.F.** (1991). The representation of the visual field in human striate cortex: a revision of the classic Holmes map. *Archives of Ophthalmology*, 109(6), 816–824.
- **Kanwisher, N., McDermott, J. & Chun, M.M.** (1997). The fusiform face area: a module in human extrastriate cortex specialized for face perception. *Journal of Neuroscience*, 17(11), 4302–4311.
- **Klüver, H.** (1966). *Mescal and mechanisms of hallucinations*. University of Chicago Press. (Original work published 1928)
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
