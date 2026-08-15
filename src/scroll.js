import { gsap }          from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ── Six acts and a coda, eleven annotation panels ────────────────────────────
//
// The act boundaries follow the six-level phenomenology reported in the trip
// report corpus (Gomez-Emilsson 2016, non-peer-reviewed), not an arbitrary
// dramaturgy. Two terms collide and have to be kept apart:
//
//   "Threshold" in the reports  = the first level. Ambience shift, sharpening
//                                 of the senses, no geometry yet.
//   "threshold crossing" here   = the Turing bifurcation at alpha ~ 0.42.
//
// Those are one level apart. The point at which spontaneous geometry begins in
// the reports is the Threshold -> Chrysanthemum transition, which is act III.
//
// Levels five (Breakthrough) and six (Amnesia) are deliberately not attempted.
// The source defines Breakthrough as a topological change of the world-sheet,
// a change in the connectivity of represented space rather than its curvature.
// A depth-mapped surface cannot do that.
//
// Scroll progress values are fractions of total scroll [0, 1].

const PANELS = [
  // ── Act I · sober ──────────────────────────────────────────────────────────
  {
    title: 'Primary Visual Cortex',
    body:  'A luminance-displaced surface. Each of the 197,000 vertices is pushed outward in proportion to local brightness. Foliage protrudes, bare branches recede. V1 receives this signal. Its lateral connectivity is active but stable, patterns suppressed by the dominance of external input.',
    start: 0.01, peak: 0.06, end: 0.13,
  },
  // ── Act II · level 1, Threshold ────────────────────────────────────────────
  {
    title: 'Threshold',
    body:  'The first level reported, and the quietest. No geometry. Colours lift, local contrast sharpens, the scene reads as though an intervening medium had been removed.\n\nα is still zero. The field is running and stable. Nothing here comes from it: this is a grade and a four-tap local contrast lift, applied to the photograph.',
    start: 0.15, peak: 0.20, end: 0.26,
  },
  // ── Act III · the bifurcation ──────────────────────────────────────────────
  {
    title: 'Wilson–Cowan Field',
    body:  'τ · ∂E/∂t = −E + σ(w_EE · K̂_exc⊛E − w_inh · K̂_inh⊛E − w_EI · I + I_ext)\n\nI_ext = luminance · (1−α) · 0.45 + edgeEnergy · 0.10\n\nTwo coupled populations integrate on a 512² GPU grid, 8 steps per frame. The system is stable. For now.',
    start: 0.27, peak: 0.32, end: 0.37,
  },
  {
    title: 'Bifurcation  α ≈ 0.42',
    body:  'Lateral excitation overcomes inhibition. The homogeneous steady state loses stability. Turing instability drives spontaneous spatial pattern formation: the same mathematics that generates leopard spots, applied to cortex.\n\nThis is the entry into the geometric levels, not the Threshold of the reports. The two words mean different things and are one level apart.',
    start: 0.38, peak: 0.42, end: 0.46,
  },
  // ── Act IV · level 2, Chrysanthemum ────────────────────────────────────────
  {
    title: 'Hexagonal Planform',
    body:  'The field self-organises into the planform Bressloff et al. (2001) predict for V1 under elevated cortical excitability: the gain increase hallucinogens are thought to induce via 5HT2A action. The symmetry class and the spacing are intrinsic to the cortical connectivity kernel. Where its nodes land is not; the image continues to seed them throughout.',
    start: 0.47, peak: 0.51, end: 0.55,
  },
  {
    title: 'Chrysanthemum',
    body:  'Terence McKenna\'s name for the second reported level: a flat surface saturated with symmetrical texture, apersonal, no entities yet. The reports describe it as symmetrifying whatever patterned surface is looked at.\n\nThat is what this act is. The photograph\'s own texture sets where the nodes land, the kernel sets what class of pattern they form. Two claims about the same frame, and the piece exists to keep them apart.',
    start: 0.56, peak: 0.60, end: 0.635,
  },
  // ── Act V · level 3, Magic Eye ─────────────────────────────────────────────
  {
    title: 'Magic Eye',
    body:  'The third level. The texture is read as an autostereogram: dark recedes, bright advances, and a surface becomes a volume.\n\nThe height map here is the field itself, not the photograph. Nodes rise, anti-nodes sink, the mid-range flattens into a floor. What lifts out of the wall carries the planform\'s symmetry because it is made of the planform.\n\nThe reports say the fold comes from recognition: whatever you recognise takes on the excess curvature. The recognising is not in the code. It is being done by whoever is reading this.',
    start: 0.64, peak: 0.70, end: 0.77,
  },
  // ── Act VI · level 4, Waiting Room ─────────────────────────────────────────
  {
    title: 'Hyperbolic Space',
    body:  'Gomez-Emilsson (QRI, non-peer-reviewed) proposes DMT transforms phenomenal space from Euclidean to hyperbolic geometry. In the Poincaré disk model the centre expands exponentially, and the visual field folds into a disc that recedes forever toward its boundary.\n\nIn the source the curvature is local: it accumulates where attention has already measured, and only jumps to the whole space on overflow. Here it is one global parameter applied to the entire frame at once. Right name, wrong operator, and it is listed with the imposed effects.',
    start: 0.79, peak: 0.84, end: 0.89,
  },
  {
    title: 'Retino-Cortical Map',
    body:  'z → log(z). The complex logarithm maps the visual field to primary visual cortex. The fovea expands to cover roughly half of V1 surface area; the periphery compresses. The transform here reproduces that logarithmic form qualitatively, not quantitatively. This is the coordinate system in which V1 computes, and in which the planform lives.',
    start: 0.855, peak: 0.90, end: 0.945,
  },
  {
    title: 'Autonomous Entities',
    body:  'Bilateral, nodal, axially organised structure is what face-selective cortex responds to. That is a claim about the person looking at the screen, not about the field behind it.\n\nIn the reports the entities are a gradient across four levels, from a social colouring of the ambience to figures that interact. This act shows one point on that gradient, not the gradient.\n\nOnly α has changed. Whether that is sufficient to explain entity encounters is an open question.',
    start: 0.815, peak: 0.87, end: 0.925,
    side: 'right',
  },
  // ── Coda · the descent ─────────────────────────────────────────────────────
  {
    title: 'Descent',
    body:  'DMT plasma concentration peaks two to three minutes after injection and the effects decay over the following quarter hour. Whole-brain models fit the bifurcation parameter as a gamma function: fast rise, slow fall.\n\nSo α falls. The curvature relaxes, the cortical map unwinds, and the photograph comes back. It is the same photograph.',
    start: 0.945, peak: 0.98, end: 1.0,
    side: 'right',
  },
]

// ── Progress curves ───────────────────────────────────────────────────────────

// Act I: surface depth reveal
function progressToSurface(p) {
  if (p < 0.03) return 0
  if (p < 0.13) return (p - 0.03) / 0.10
  return 1
}

// Act II · level 1: sensory sharpening with no geometry. Drives the colour
// grade and a local contrast lift. Falls back in the coda so the photograph
// returns close to how it started.
function progressToThreshold(p) {
  if (p < 0.14) return 0
  if (p < 0.26) return (p - 0.14) / 0.12
  if (p < 0.94) return 1
  return 1 - (p - 0.94) / 0.06 * 0.55
}

// Acts III–VI: α rises through the bifurcation, plateaus, then descends.
// The descent is the point: Timmermann et al. (2019) measure peak subjective
// intensity 2–3 min post-injection with effects elevated for ~17 min, and
// Piccinini et al. (2025) parametrise the model bifurcation parameter a(t) as
// a gamma function that "rises rapidly and then presents a slow decay".
// A monotone ramp to a permanent plateau matches neither.
function progressToDMT(p) {
  if (p < 0.26) return 0
  if (p < 0.62) return (p - 0.26) / 0.36
  if (p < 0.92) return 1
  return 1 - (p - 0.92) / 0.08 * 0.75
}

// Act V · level 3: the world-sheet. The field is read as a height map rather
// than as a brightness modulation, so the plane acquires volume. Local, field
// driven, and the honest counterpart to the global curvature that follows.
function progressToWorldSheet(p) {
  if (p < 0.62) return 0
  if (p < 0.79) return (p - 0.62) / 0.17
  if (p < 0.93) return 1
  return 1 - (p - 0.93) / 0.07 * 0.85
}

// Act VI · level 4: Poincaré disk curvature. Global and imposed, see the
// disclosure section.
function progressToCurvature(p) {
  if (p < 0.78) return 0
  if (p < 0.90) return (p - 0.78) / 0.12
  if (p < 0.94) return 1
  return 1 - (p - 0.94) / 0.06 * 0.85
}

// Act VI · level 4: retino-cortical map and the imposed entity ring.
// Unwinds in the coda so the log-polar sampling releases the photograph.
function progressToRetino(p) {
  if (p < 0.80) return 0
  if (p < 0.93) return (p - 0.80) / 0.13
  return 1 - (p - 0.93) / 0.07 * 0.80
}

// Colour grade rides the Threshold parameter: the lift arrives with the first
// reported level and leaves with the descent.
function progressToGrade(p) {
  return progressToThreshold(p)
}

// ── Build DOM ─────────────────────────────────────────────────────────────────

function buildPanels() {
  const style = document.createElement('style')
  style.textContent = `
    .scroll-panel {
      position: fixed;
      left: 1.5vw;
      top: 50%;
      transform: translateY(-50%);
      width: min(250px, 22vw);
      pointer-events: none;
      user-select: none;
      opacity: 0;
      z-index: 10;
      padding: 1.1rem 1.3rem;
      background: rgba(4, 6, 10, 0.52);
      backdrop-filter: blur(12px) saturate(0.35);
      -webkit-backdrop-filter: blur(12px) saturate(0.35);
      border-left: 1px solid rgba(255,255,255,0.06);
    }
    .scroll-panel-right {
      left: auto;
      right: 1.5vw;
      text-align: right;
      border-left: none;
      border-right: 1px solid rgba(255,255,255,0.06);
    }
    .scroll-panel h3 {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 0.65rem;
      font-weight: normal;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.72);
      margin-bottom: 0.9rem;
    }
    .scroll-panel p {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 0.62rem;
      line-height: 1.8;
      letter-spacing: 0.06em;
      color: rgba(255,255,255,0.48);
      white-space: pre-wrap;
    }
    #scroll-hint {
      position: fixed;
      bottom: 2.2rem;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 0.58rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      /* The first act can run from near-black to near-white depending on the
         input, so this cannot be a faint white on an assumed dark ground. The
         shadow carries it on either. */
      color: rgba(255,255,255,0.46);
      text-shadow:
        0 1px 3px rgba(0,0,0,0.92),
        0 0 10px rgba(0,0,0,0.75);
      pointer-events: none;
      user-select: none;
    }
    #scroll-progress {
      position: fixed;
      right: 2rem;
      top: 50%;
      transform: translateY(-50%);
      width: 1px;
      height: 120px;
      background: rgba(255,255,255,0.08);
      pointer-events: none;
    }
    #scroll-progress-thumb {
      width: 1px;
      background: rgba(255,255,255,0.35);
      height: 0%;
    }
  `
  document.head.appendChild(style)

  const panelEls = PANELS.map(({ title, body, side }) => {
    const el = document.createElement('div')
    el.className = side === 'right' ? 'scroll-panel scroll-panel-right' : 'scroll-panel'
    el.innerHTML = `<h3>${title}</h3><p>${body}</p>`
    document.body.appendChild(el)
    return el
  })

  const hint = document.createElement('div')
  hint.id = 'scroll-hint'
  hint.textContent = 'scroll to explore'
  document.body.appendChild(hint)

  const bar = document.createElement('div')
  bar.id = 'scroll-progress'
  bar.innerHTML = '<div id="scroll-progress-thumb"></div>'
  document.body.appendChild(bar)

  return { panelEls, hint, thumb: bar.querySelector('#scroll-progress-thumb') }
}

// ── Export ────────────────────────────────────────────────────────────────────

export function createScroll(handlers) {
  const {
    onDMT, onSurface, onThreshold, onWorldSheet, onRetino, onCurvature, onGrade,
  } = handlers

  const { panelEls, hint, thumb } = buildPanels()

  ScrollTrigger.create({
    start: 0,
    end: () => document.documentElement.scrollHeight - window.innerHeight,
    onUpdate(self) {
      const p = self.progress

      onDMT(progressToDMT(p))
      onSurface(progressToSurface(p))
      onThreshold(progressToThreshold(p))
      onWorldSheet(progressToWorldSheet(p))
      onRetino(progressToRetino(p))
      onCurvature(progressToCurvature(p))
      onGrade(progressToGrade(p))

      PANELS.forEach(({ start, peak, end }, i) => {
        let opacity = 0
        if (p >= start && p <= end) {
          opacity = p < peak
            ? (p - start) / (peak - start)
            : 1 - (p - peak) / (end - peak)
        }
        panelEls[i].style.opacity = Math.max(0, Math.min(1, opacity))
      })

      thumb.style.height = `${p * 100}%`
      hint.style.opacity = p < 0.04 ? String(1 - p / 0.04) : '0'
    },
  })
}
