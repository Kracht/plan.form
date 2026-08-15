import { gsap }          from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ── Six acts, eight annotation panels ────────────────────────────────────────
// Scroll progress values are fractions of total scroll [0, 1].

const PANELS = [
  // Act I
  {
    title: 'Primary Visual Cortex',
    body:  'A luminance-displaced surface. Each of the 197,000 vertices is pushed outward in proportion to local brightness. Foliage protrudes, bare branches recede. V1 receives this signal. Its lateral connectivity is active but stable, patterns suppressed by the dominance of external input.',
    start: 0.01, peak: 0.07, end: 0.16,
  },
  // Act II · Wilson-Cowan
  {
    title: 'Wilson–Cowan Field',
    body:  'τ · ∂E/∂t = −E + σ(w_EE · K̂_exc⊛E − w_inh · K̂_inh⊛E − w_EI · I + I_ext)\n\nI_ext = luminance · (1−α) · 0.45 + edgeEnergy · 0.10\n\nTwo coupled populations integrate on a 512² GPU grid, 8 steps per frame. The system is stable. For now.',
    start: 0.20, peak: 0.27, end: 0.36,
  },
  {
    title: 'Bifurcation  α ≈ 0.42',
    body:  'Lateral excitation overcomes inhibition. The homogeneous steady state loses stability. Turing instability drives spontaneous spatial pattern formation: the same mathematics that generates leopard spots, applied to cortex.',
    start: 0.37, peak: 0.43, end: 0.52,
  },
  {
    title: 'Hexagonal Planform',
    body:  'The field self-organises into the planform Bressloff et al. (2001) predict for V1 under elevated cortical excitability: the gain increase hallucinogens are thought to induce via 5HT2A action. The symmetry class and the spacing are intrinsic to the cortical connectivity kernel. Where its nodes land is not; the image continues to seed them throughout.',
    start: 0.53, peak: 0.58, end: 0.65,
  },
  // Act III · Poincaré
  {
    title: 'Hyperbolic Space',
    body:  'Gomez-Emilsson (QRI, non-peer-reviewed) proposes DMT transforms phenomenal space from Euclidean to hyperbolic geometry. In the Poincaré disk model, the centre expands exponentially, accommodating the information density of amplified lateral connectivity. The entire visual field folds into a disc-shaped mandala that recedes forever toward the boundary.',
    start: 0.67, peak: 0.73, end: 0.81,
  },
  // Act VI · Super symmetry finale (left)
  {
    title: 'Retino-Cortical Map',
    body:  'z → log(z). The complex logarithm maps the visual field to primary visual cortex. The fovea expands to cover roughly half of V1 surface area; the periphery compresses. The transform here reproduces that logarithmic form qualitatively, not quantitatively. This is the coordinate system in which V1 computes, and in which the planform lives.',
    start: 0.84, peak: 0.90, end: 0.98,
  },
  // Act VI · Entity emergence (right panel, appears with finale)
  {
    title: 'Autonomous Entities',
    body:  'Bilateral, nodal, axially organised structure is what face-selective cortex responds to. That is a claim about the person looking at the screen, not about the field behind it.\n\nThe figures here are also pushed into place by hand: displacement recentred on the image\'s mid-luminance, applied to the photograph rather than derived from the field.\n\nOnly α has changed. Whether that is sufficient to explain entity encounters is an open question.',
    start: 0.81, peak: 0.88, end: 0.94,
    side: 'right',
  },
  // Final reveal · Chrysanthemum reference
  {
    title: 'Chrysanthemum',
    body:  'Terence McKenna\'s name for the radially symmetric, jewel-like geometric form encountered at the threshold of a DMT experience, a tessellated structure of self-similar sub-units in continuous transformation, named for its botanical resemblance.\n\nThe form on the screen was not copied from it. Its structure arrived from a Wilson-Cowan field, a log-polar transform and a hyperbolic remap. Its appearance took a photographer\'s decisions on top of that. Both halves are true and neither is the whole picture.\n\nWhether it produced the phenomenology is a question this project cannot answer, only raise.',
    start: 0.94, peak: 1.0, end: 1.0,
    side: 'right',
  },
]

// ── Progress curves ───────────────────────────────────────────────────────────

// Act I: surface depth reveal
function progressToSurface(p) {
  if (p < 0.04) return 0
  if (p < 0.16) return (p - 0.04) / 0.12
  return 1
}

// Act II–IV: DMT rises from the Wilson-Cowan panel onward, plateaus before finale
function progressToDMT(p) {
  if (p < 0.20) return 0
  if (p < 0.64) return (p - 0.20) / 0.44
  return 1
}

// Act V: Poincaré disk curvature (hyperbolic space panel)
function progressToCurvature(p) {
  if (p < 0.67) return 0
  if (p < 0.82) return (p - 0.67) / 0.15
  return 1
}

// Act VI finale: retino-cortical bilateral symmetry, rises to 1 at scroll end.
// Starts at 0.78, completes exactly at p=1.0 so the full remaining scroll space
// is consumed by the transition with no dead zone at the bottom.
function progressToRetino(p) {
  if (p < 0.78) return 0
  return (p - 0.78) / 0.22   // reaches 1.0 at p=1.0
}

// Colour grade: vibrance + warmth introduced at end of act I, reaches full
// intensity only at the final stage · slow linear ramp across the full scroll arc.
function progressToGrade(p) {
  if (p < 0.13) return 0
  if (p < 0.96) return (p - 0.13) / 0.83
  return 1
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
      color: rgba(255,255,255,0.18);
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

export function createScroll(onDMT, onSurface, onRetino, onCurvature, onGrade) {
  const { panelEls, hint, thumb } = buildPanels()

  ScrollTrigger.create({
    start: 0,
    end: () => document.documentElement.scrollHeight - window.innerHeight,
    onUpdate(self) {
      const p = self.progress

      onDMT(progressToDMT(p))
      onSurface(progressToSurface(p))
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
