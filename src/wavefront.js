import * as THREE from 'three'

// ── Travelling luminance wave ─────────────────────────────────────────────────
//
// A pure-white additive ring that sweeps outward from centre at bifurcation.
// Additive blending means it adds luminance to whatever structure sits beneath —
// the patterns the Wilson-Cowan field has already formed briefly flare bright
// as the front passes through them, then settle back.
//
// No colour gradient, no painted trail — just a tight Gaussian ring of light.

const PLANE_W = 2.0
const PLANE_H = 2.667

const DMT_TRIGGER = 0.42   // α at which bifurcation fires
const DELAY_S     = 1.0    // seconds between trigger and wave start
const WAVE_SPEED  = 0.50   // world units / second

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */`
  precision highp float;

  uniform float uWaveFront;  // world-space radius; < 0 = inactive
  uniform float uPlaneW;     // actual world-space width (screen-aspect corrected)
  uniform float uMaxRadius;  // diagonal of scaled plane

  varying vec2 vUv;

  void main() {
    if (uWaveFront < 0.0) { gl_FragColor = vec4(0.0); return; }

    // World-space distance from centre using actual plane dimensions
    vec2  c    = (vUv - 0.5) * vec2(uPlaneW, ${PLANE_H.toFixed(3)});
    float dist = length(c);
    float sd   = dist - uWaveFront;   // negative = inside swept zone

    // Gaussian luminance pulse — tight ring of light
    float pulse = exp(-sd * sd * 90.0);

    // Very brief afterglow in the wake — fades within ~0.15 world units
    float behind    = max(-sd, 0.0);
    float afterglow = exp(-behind * 18.0) * 0.18;

    // Dim as the ring expands outward (energy conservation)
    float fade  = 1.0 - smoothstep(0.0, uMaxRadius, uWaveFront);
    float alpha = (pulse + afterglow) * (0.45 + fade * 0.55);

    // Pure near-white — additive blending brightens whatever structure is beneath
    gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * alpha, alpha);
  }
`

function calcMaxRadius(worldW) {
  return Math.sqrt((worldW / 2) ** 2 + (PLANE_H / 2) ** 2) + 0.15
}

function worldW(screenAspect) {
  return PLANE_W * (screenAspect / (PLANE_W / PLANE_H))
}

export function createWaveFront() {
  const initW  = worldW(window.innerWidth / window.innerHeight)
  let maxRadius = calcMaxRadius(initW)

  const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H)
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uWaveFront: { value: -1.0      },
      uPlaneW:    { value: initW     },
      uMaxRadius: { value: maxRadius },
    },
    vertexShader:   VERT,
    fragmentShader: FRAG,
    transparent:    true,
    blending:       THREE.AdditiveBlending,
    depthWrite:     false,
    depthTest:      false,
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.z  = 0.15
  mesh.renderOrder = 2
  mesh.scale.x     = initW / PLANE_W

  // ── State machine ─────────────────────────────────────────────────────────
  let state      = 'IDLE'
  let delayTimer = 0
  let radius     = -1.0
  let prevDMT    = 0.0

  return {
    mesh,

    getRadius() { return radius },
    isDone()    { return state === 'DONE' },

    update(dmt, dt) {
      switch (state) {
        case 'IDLE':
          if (prevDMT < DMT_TRIGGER && dmt >= DMT_TRIGGER) {
            state = 'DELAY'; delayTimer = 0
          }
          break

        case 'DELAY':
          delayTimer += dt
          if (delayTimer >= DELAY_S) { state = 'EXPANDING'; radius = 0.0 }
          break

        case 'EXPANDING':
          radius += WAVE_SPEED * dt
          mat.uniforms.uWaveFront.value = radius
          if (radius >= maxRadius) {
            radius = maxRadius + 0.5   // park past edge, keeps point-cloud gate open
            mat.uniforms.uWaveFront.value = radius
            state = 'DONE'
          }
          break
      }
      prevDMT = dmt
    },

    resize(screenAspect) {
      const w = worldW(screenAspect)
      maxRadius = calcMaxRadius(w)
      mesh.scale.x = w / PLANE_W
      mat.uniforms.uPlaneW.value    = w
      mat.uniforms.uMaxRadius.value = maxRadius
    },

    reset() {
      state = 'IDLE'; delayTimer = 0; radius = -1.0; prevDMT = 0.0
      mat.uniforms.uWaveFront.value = -1.0
    },
  }
}
