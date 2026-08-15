import * as THREE from 'three'

// ── Point cloud overlay ───────────────────────────────────────────────────────
//
// 256×256 grid of sprites whose Z-displacement tracks the Wilson-Cowan E field.
// Additive blending, depth-write off → glowing volumetric layer over the surface.
// Invisible at uDMT=0; emerges with the lateral connectivity as α rises.
//
// Colour gradient: cold teal (below threshold) → bright cyan (onset)
//                  → warm white (supercritical peaks)
// This maps directly to the three sigmoid activation regimes.

const GRID_N  = 256
const PLANE_W = 2.0
const PLANE_H = 2.667

// Base Z offset: slightly in front of the surface plane so points
// never z-fight with the mesh at low activation.
const BASE_Z  = 0.04

// Maximum upward lift (toward viewer) at full activation + full DMT.
// Resting E ≈ 0.33; planform peak E ≈ 0.75–0.85.
const LIFT_SCALE = 0.48

const VERT = /* glsl */`
  uniform sampler2D uSimTexture;
  uniform sampler2D uTexture;      // the photograph, same one the mesh displaces by
  uniform float     uDMT;
  uniform float     uSurface;      // act I photo-displacement ramp, mirrors surface.vert
  uniform float     uDispScale;    // uDisplacementScale from surface.js
  uniform float     uTexAspect;
  uniform float     uScreenAspect;
  uniform float     uTime;
  uniform float     uCurvature;   // Poincaré disk warp (Act VI)
  uniform float     uRetino;      // retino-cortical blend (Act VI)
  uniform float     uWorldSheet;  // Act V · level 3, surface expresses the field
  uniform float     uWaveFront;   // world-space wave radius; -1 = not yet started
  uniform float     uPlaneW;      // actual world-space plane width (aspect-corrected)

  attribute vec2 aUv;

  varying float vActivation;
  varying float vAlpha;

  #define PI 3.14159265358979

  // Cover-mode UV correction. Must match surface.vert and surface.frag: the
  // particles ride on the mesh, so they have to read the photograph the same way.
  vec2 texUV(vec2 uv) {
    if (uTexAspect > uScreenAspect) {
      return vec2((uv.x - 0.5) * (uScreenAspect / uTexAspect) + 0.5, uv.y);
    } else {
      return vec2(uv.x, (uv.y - 0.5) * (uTexAspect / uScreenAspect) + 0.5);
    }
  }

  // Poincaré disk: exponential centre expansion (hyperbolic geometry).
  // Particles represent V1 excitation nodes in cortical space, the Poincaré
  // warp reflects that the geometry of visual space has deformed, so nodes near
  // the centre appear more spread out. Capped at 0.65 to keep particles well
  // inside the disk boundary and avoid positional blow-up.
  vec2 poincareUV(vec2 uv, float t) {
    vec2  z  = (uv - 0.5) * 2.0;
    float r  = length(z);
    if (r < 0.001) return uv;
    float rC   = min(r, 0.9999);
    float rTex = tanh(atanh(rC) / (1.0 + t * 1.2));
    return normalize(z) * rTex * 0.5 + 0.5;
  }

  void main() {
    float e = texture2D(uSimTexture, aUv).r;
    vActivation = e;

    // ── Ride the mesh ─────────────────────────────────────────────────────
    // These points are not a free-floating layer, they mark field nodes on the
    // surface. So their height has to be the surface's height, term for term:
    // the photograph's luminance displacement, the field deviation, the breath.
    //
    // An earlier version lifted them by max(e - 0.30, 0) alone. That had no
    // downward branch and ignored the photograph entirely, so the points sat on
    // a near-flat plane while the mesh moved underneath them. At low relief it
    // passed; once the world-sheet gave the mesh real depth it read as a dotted
    // sheet of glass hovering in front of the landscape.
    float luma = dot(texture2D(uTexture, texUV(aUv)).rgb, vec3(0.2126, 0.7152, 0.0722));
    float dev  = e - 0.33;

    float meshZ = luma * uDispScale * uSurface
                + dev  * uDispScale * uDMT * 1.4;

    float breathAmp  = 0.002 + uSurface * 0.005;
    float breathRate = 0.4   + uSurface * 0.6;
    meshZ += sin(uTime * breathRate) * breathAmp;

    // Poincaré only · corticalUV is a texture-sampling transform (where to look
    // in an image), not a spatial position transform. The tanh formulation keeps
    // positions bounded inside the unit disk for any t ∈ [0,1], so no cap needed.
    vec2 pUv = (uCurvature > 0.001) ? poincareUV(aUv, uCurvature) : aUv;

    vec3 pos = vec3(
      (pUv.x - 0.5) * ${PLANE_W.toFixed(3)},
      (pUv.y - 0.5) * ${PLANE_H.toFixed(3)},
      ${BASE_Z.toFixed(3)} + meshZ
    );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

    float hot  = smoothstep(0.36, 0.60, e);
    gl_PointSize = 1.0 + hot * uDMT * 2.0;

    float onset = smoothstep(0.33, 0.44, e);

    // Wave-front gate: particle only visible after the wave has swept through it.
    // Distance uses the same world-space units as the wavefront shader.
    vec2  worldPos      = (aUv - 0.5) * vec2(uPlaneW, ${PLANE_H.toFixed(3)});
    float distFromCentre = length(worldPos);
    float behind        = uWaveFront - distFromCentre;  // positive = wave already passed
    float waveGate      = (uWaveFront < 0.0) ? 0.0 : smoothstep(0.0, 0.18, behind);

    // Act V handover: once the world-sheet lifts, the mesh expresses the field
    // as geometry, and this layer cannot follow it. Matching the world-sheet
    // displacement here would mean a third copy of that function kept in sync by
    // hand, for a layer whose only job was to make the field visible while the
    // surface could only modulate brightness. So the points hand over instead:
    // they are how the field is shown before it has volume, and they are gone
    // once it does. The plasma volume in postfx.js keeps carrying the glow.
    float sheetFade = 1.0 - smoothstep(0.05, 0.55, uWorldSheet);

    // Act VI fade-out: as the retino-cortical map engages, the cortical-mapped
    // surface texture expresses the activation directly. The particle layer
    // becomes redundant, and fading it out here prevents the visible disconnect
    // between particles (which can't follow the log-polar transform
    // meaningfully) and the morphing surface beneath.
    float retinoFade = 1.0 - smoothstep(0.30, 0.80, uRetino);

    float alpha = uDMT * uDMT * onset * 0.92 * waveGate * sheetFade * retinoFade;
    vAlpha = alpha;
  }
`

const FRAG = /* glsl */`
  precision highp float;

  varying float vActivation;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.01) discard;

    // Circular soft sprite
    vec2  c    = gl_PointCoord - 0.5;
    float dist = length(c);
    if (dist > 0.5) discard;
    float softEdge = smoothstep(0.5, 0.18, dist);

    // Colour gradient across three regimes:
    //   onset  [0.33–0.55] : cold teal
    //   active [0.55–0.72] : bright cyan
    //   peak   [0.72–1.00] : warm white
    float t1  = smoothstep(0.33, 0.55, vActivation);
    float t2  = smoothstep(0.55, 0.72, vActivation);
    float t3  = smoothstep(0.72, 0.90, vActivation);

    vec3 cold = vec3(0.06, 0.22, 0.28);
    vec3 mid  = vec3(0.12, 0.78, 0.90);
    vec3 hot  = vec3(1.00, 0.96, 0.82);

    vec3 col  = mix(cold, mid, t1 * (1.0 - t2));
         col  = mix(col,  mid, t2);
         col  = mix(col,  hot, t3);

    gl_FragColor = vec4(col, vAlpha * softEdge);
  }
`

export function createPointCloud() {
  const count     = GRID_N * GRID_N
  const positions = new Float32Array(count * 3)
  const uvs       = new Float32Array(count * 2)

  for (let row = 0; row < GRID_N; row++) {
    for (let col = 0; col < GRID_N; col++) {
      const i = row * GRID_N + col
      const u = col / (GRID_N - 1)
      const v = row / (GRID_N - 1)

      positions[i * 3 + 0] = (u - 0.5) * PLANE_W
      positions[i * 3 + 1] = (v - 0.5) * PLANE_H
      positions[i * 3 + 2] = BASE_Z

      uvs[i * 2 + 0] = u
      uvs[i * 2 + 1] = v
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aUv',      new THREE.BufferAttribute(uvs,       2))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSimTexture: { value: null },
      uTexture:      { value: null },
      uDMT:        { value: 0.0 },
      uSurface:      { value: 0.0 },
      uDispScale:    { value: 0.28 },  // must match uDisplacementScale in surface.js
      uTexAspect:    { value: 1.0 },
      uScreenAspect: { value: window.innerWidth / window.innerHeight },
      uTime:       { value: 0.0 },
      uCurvature:  { value: 0.0 },
      uRetino:     { value: 0.0 },
      uWorldSheet: { value: 0.0 },
      uWaveFront:  { value: -1.0 },
      uPlaneW:     { value: PLANE_W * (window.innerWidth / window.innerHeight) / (PLANE_W / PLANE_H) },
    },
    vertexShader:   VERT,
    fragmentShader: FRAG,
    transparent:    true,
    blending:       THREE.AdditiveBlending,
    depthWrite:     false,
    depthTest:      false,
  })

  const points = new THREE.Points(geometry, material)
  points.renderOrder = 1   // composite after the surface mesh

  // Match the surface plane's screen-filling scale on init and resize
  const initAspect = window.innerWidth / window.innerHeight
  points.scale.x = initAspect / (PLANE_W / PLANE_H)

  return {
    mesh: points,
    // surfaceUniforms is surface.material.uniforms. The point cloud reads the
    // photo, the surface ramp and the aspect corrections straight off the mesh
    // rather than keeping its own copies, so the two can never drift apart.
    update(simTexture, dmt, time, curvature, retino, waveFront, worldSheet, surfaceUniforms) {
      if (surfaceUniforms) {
        material.uniforms.uTexture.value      = surfaceUniforms.uTexture.value
        material.uniforms.uSurface.value      = surfaceUniforms.uSurface.value
        material.uniforms.uDispScale.value    = surfaceUniforms.uDisplacementScale.value
        material.uniforms.uTexAspect.value    = surfaceUniforms.uTexAspect.value
        material.uniforms.uScreenAspect.value = surfaceUniforms.uScreenAspect.value
      }
      material.uniforms.uSimTexture.value = simTexture
      material.uniforms.uDMT.value        = dmt
      material.uniforms.uTime.value       = time
      material.uniforms.uCurvature.value  = curvature
      material.uniforms.uRetino.value     = retino
      material.uniforms.uWorldSheet.value = worldSheet
      material.uniforms.uWaveFront.value  = waveFront
    },
    resize(screenAspect) {
      const worldW = PLANE_H * screenAspect
      points.scale.x = screenAspect / (PLANE_W / PLANE_H)
      material.uniforms.uPlaneW.value = worldW
    },
  }
}
