import * as THREE from 'three'

// ── Post-processing: bloom + chromatic aberration + plasma volume ─────────────
//
// Pipeline:
//   1. Scene renders to offscreen WebGLRenderTarget (full resolution)
//   2. Fullscreen quad applies:
//      a. Radial chromatic aberration, R/G/B UV channels offset radially
//      b. Bloom, 4 rings × 8 samples, additive glow above luminance threshold
//      c. Plasma volume, screen-space Gaussian blur of the sim texture, mapped
//         to deep blue → cyan colours.  Fills enclosed structure interiors as a
//         continuous glow (no discrete sprites, no plane boundary artifact).
//   3. ACES tone map → canvas

const POST_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const POST_FRAG = /* glsl */`
  precision highp float;

  uniform sampler2D uScene;
  uniform sampler2D uSimTexture;
  uniform sampler2D uFeedbackTex; // previous frame post output
  uniform vec2      uResolution;
  uniform float     uDMT;
  uniform float     uRetino;
  uniform float     uEcho;        // feedback echo strength (driven by DMT)

  varying vec2 vUv;

  // ── Chromatic aberration ──────────────────────────────────────────────────
  vec3 chromaticAberration(vec2 uv) {
    vec2  d    = uv - 0.5;
    float r2   = dot(d, d);
    float edge = 1.0 - smoothstep(0.18, 0.38, r2);
    float str  = uDMT * 0.042 * r2 * edge;

    vec2 uvR = uv + d * str * 1.0;
    vec2 uvG = uv + d * str * 0.35;
    vec2 uvB = uv - d * str * 0.30;

    return vec3(
      texture2D(uScene, clamp(uvR, 0.001, 0.999)).r,
      texture2D(uScene, clamp(uvG, 0.001, 0.999)).g,
      texture2D(uScene, clamp(uvB, 0.001, 0.999)).b
    );
  }

  // ── Bloom ─────────────────────────────────────────────────────────────────
  vec3 bloom(vec2 uv, vec3 base) {
    const float THRESHOLD = 0.52;
    float bloomStr = uDMT * 0.22 + uRetino * 0.14;
    if (bloomStr < 0.001) return base;

    vec2 px = 1.0 / uResolution;

    float radii[4];
    radii[0] = 3.0; radii[1] = 7.0; radii[2] = 14.0; radii[3] = 26.0;
    float weights[4];
    weights[0] = 0.38; weights[1] = 0.28; weights[2] = 0.20; weights[3] = 0.14;

    vec3 glow = vec3(0.0);
    for (int ri = 0; ri < 4; ri++) {
      float radius = radii[ri];
      float w      = weights[ri];
      for (int si = 0; si < 8; si++) {
        float angle = float(si) * 0.7853981634;
        vec2  off   = vec2(cos(angle), sin(angle)) * radius * px;
        vec3  s     = texture2D(uScene, clamp(uv + off, 0.001, 0.999)).rgb;
        float lum   = dot(s, vec3(0.2126, 0.7152, 0.0722));
        float contrib = max(lum - THRESHOLD, 0.0) / (1.0 - THRESHOLD);
        glow += s * contrib * w;
      }
    }
    glow /= 8.0;
    return base + glow * bloomStr;
  }

  // ── Plasma volume ─────────────────────────────────────────────────────────
  //
  // Screen-space Gaussian blur of the Wilson-Cowan activation field, composited
  // only onto dark regions of the scene.
  //
  // The luminance mask is the key:
  //   depthMask = 1 - smoothstep(sceneLuma)
  //   → full glow in dark interiors (the void inside enclosed structures)
  //   → zero glow on bright white surfaces (keeps depth and surface contrast)
  //   → zero glow in pure-black depth (low density there anyway)
  //
  // This produces the "vapor in a glass body" gradient: the glow accumulates
  // toward the surface (where density is highest from the blur), fades toward
  // the deep interior (lower blur density + less scene-dark suppression overlap),
  // and disappears entirely on the bright particle surface itself.
  //
  // 5 rings of blur taps reach up to 0.210 UV (~25% screen width) so the
  // deep centres of the large enclosed planform structures are filled.
  vec3 plasmaVolume(vec2 uv, float sceneLuma) {
    if (uDMT < 0.01) return vec3(0.0);

    // ── Depth mask ────────────────────────────────────────────────────────
    // Suppress plasma where the scene is already bright (particle surfaces,
    // white blooms).  Keeps depth illusion and surface contrast intact.
    // Fully active below luma 0.10 (dark interior), gone above 0.55 (surface).
    float depthMask = 1.0 - smoothstep(0.10, 0.55, sceneLuma);
    if (depthMask < 0.005) return vec3(0.0);

    // Screen-edge vignette · no hard clip at sim-texture boundary.
    vec2  edgeDist = min(uv, 1.0 - uv);
    float edgeFade = smoothstep(0.0, 0.05, edgeDist.x)
                   * smoothstep(0.0, 0.05, edgeDist.y);

    // ── Multi-ring Gaussian blur ──────────────────────────────────────────
    // 5 rings; outermost at 0.210 UV fills the deep centres of large structures.
    // Weights fall off with radius so local edge detail stays sharper than
    // the far-interior fill, producing the density-gradient-toward-surface look.
    //
    //  ring 0  r=0.030  8 taps  w=0.38 , surface proximity / edge detail
    //  ring 1  r=0.065  8 taps  w=0.28 , near-interior
    //  ring 2  r=0.105 10 taps  w=0.18 , mid interior
    //  ring 3  r=0.155 12 taps  w=0.11 , deep interior
    //  ring 4  r=0.210 14 taps  w=0.06 , furthest reach (large structure centres)
    const float PI2 = 6.28318530718;

    float density = texture2D(uSimTexture, clamp(uv, 0.001, 0.999)).r * 0.20;
    float wTotal  = 0.20;

    for (int i = 0; i < 8; i++) {
      float a = PI2 * float(i) / 8.0;
      density += texture2D(uSimTexture, clamp(uv + vec2(cos(a),sin(a))*0.030, 0.001,0.999)).r * 0.38;
      wTotal  += 0.38;
    }
    for (int i = 0; i < 8; i++) {
      float a = PI2 * float(i) / 8.0;
      density += texture2D(uSimTexture, clamp(uv + vec2(cos(a),sin(a))*0.065, 0.001,0.999)).r * 0.28;
      wTotal  += 0.28;
    }
    for (int i = 0; i < 10; i++) {
      float a = PI2 * float(i) / 10.0;
      density += texture2D(uSimTexture, clamp(uv + vec2(cos(a),sin(a))*0.105, 0.001,0.999)).r * 0.18;
      wTotal  += 0.18;
    }
    for (int i = 0; i < 12; i++) {
      float a = PI2 * float(i) / 12.0;
      density += texture2D(uSimTexture, clamp(uv + vec2(cos(a),sin(a))*0.155, 0.001,0.999)).r * 0.11;
      wTotal  += 0.11;
    }
    for (int i = 0; i < 14; i++) {
      float a = PI2 * float(i) / 14.0;
      density += texture2D(uSimTexture, clamp(uv + vec2(cos(a),sin(a))*0.210, 0.001,0.999)).r * 0.06;
      wTotal  += 0.06;
    }

    density /= wTotal;

    // Soft power curve instead of saturating smoothstep, preserves the
    // interior→surface density gradient rather than clamping everything to 1.
    // Threshold at 0.18 removes noise floor; pow(x, 0.75) gently lifts midtones.
    density = pow(max(density - 0.18, 0.0) / 0.42, 0.75);
    if (density < 0.002) return vec3(0.0);

    // ── Colour ────────────────────────────────────────────────────────────
    // Near-neutral dark grey · the WC field has no inherent colour.
    // A very slight cool tint (more blue than red) prevents it reading as
    // warm and keeps it visually distinct from the scene darks, without
    // implying anything not in the science.
    float tMid = smoothstep(0.12, 0.60, density);

    vec3 cold = vec3(0.06, 0.07, 0.09);   // near-black, barely cool
    vec3 mid  = vec3(0.14, 0.17, 0.22);   // dark cool grey
    vec3 col  = mix(cold, mid, tMid);

    // DMT² onset; capped lower so the glow fills structure without dominating.
    float strength = min(uDMT * uDMT, 0.75) * 0.11;

    return col * density * strength * edgeFade * depthMask;
  }

  // ── Control interruption: feedback echo via x/y axis difference ─────────────
  //
  // Directional frame feedback: the previous frame's post output is sampled with
  // an offset and added back, so prior sensory data bleeds into the current frame.
  //
  // Provenance, stated precisely. This is not derived from the Wilson-Cowan
  // field and no neural field model produces it. It is a deliberate
  // implementation of the first of the four operators in Gomez-Emilsson's
  // algorithmic reduction of psychedelic states (2016, non-peer-reviewed),
  // which describes control interruption as "a longer half-life for all qualia"
  // and the buildup of overlapping prior frames. A second model, cited on the
  // about page, not the one the simulation runs.
  //
  // The displacement of the echo sample is driven by the *difference* between
  // the local x-axis and y-axis luminance gradients.  Where horizontal edges
  // dominate (lumX > lumY) the echo shifts right-down; where vertical edges
  // dominate it shifts left-up.  This asymmetric drift creates the complex
  // interference patterns and extended afterimages characteristic of the effect.
  vec3 controlInterruption(vec2 uv, vec3 col) {
    if (uEcho < 0.005) return col;

    vec2  px    = 1.0 / uResolution;

    // Local x / y luminance gradient (2-pixel offset for stability)
    float lumX = dot(texture2D(uScene,
                   clamp(uv + vec2(px.x * 2.0, 0.0), 0.001, 0.999)).rgb,
                   vec3(0.2126, 0.7152, 0.0722));
    float lumY = dot(texture2D(uScene,
                   clamp(uv + vec2(0.0, px.y * 2.0), 0.001, 0.999)).rgb,
                   vec3(0.2126, 0.7152, 0.0722));

    // Axis difference → echo displacement direction
    float xyDiff = lumX - lumY;
    vec2  echoOff = vec2(xyDiff, -xyDiff) * 0.007 * uEcho;

    vec3 prev = texture2D(uFeedbackTex, clamp(uv + echoOff, 0.001, 0.999)).rgb;

    // Additive blend · sensory buildup. Cap prevents blow-out above uEcho=0.8.
    return col + prev * uEcho * 0.38;
  }

  // ── ACES filmic tone mapping ───────────────────────────────────────────────
  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec3 col = chromaticAberration(vUv);
    col = bloom(vUv, col);

    // Compute scene luminance BEFORE adding plasma so the mask reads the
    // true surface brightness, not a value already inflated by the glow.
    float sceneLuma = dot(col, vec3(0.2126, 0.7152, 0.0722));

    col = col + plasmaVolume(vUv, sceneLuma);

    // Control interruption · must run after bloom/plasma (operates on lit scene)
    // but before tone mapping (needs linear-light values for correct buildup).
    col = controlInterruption(vUv, col);

    col = aces(col * 1.1);
    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Minimal blit shader (copies one texture to canvas) ────────────────────────
const BLIT_FRAG = /* glsl */`
  precision mediump float;
  uniform sampler2D uTex;
  varying vec2 vUv;
  void main() { gl_FragColor = texture2D(uTex, vUv); }
`

function makeRT(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format:    THREE.RGBAFormat,
    type:      THREE.HalfFloatType,
  })
}

export function createPostFX(renderer) {
  const dpr = Math.min(window.devicePixelRatio, 2)
  const rw  = window.innerWidth  * dpr
  const rh  = window.innerHeight * dpr

  // Scene render target (existing role)
  const target = makeRT(rw, rh)

  // Ping-pong feedback targets · store the previous frame's post output
  // so controlInterruption() can sample it with its xy-diff offset.
  const feedTargets = [ makeRT(rw, rh), makeRT(rw, rh) ]
  let   feedRead    = 0   // index of the previous-frame target (read-only this frame)

  // Initialise both feedback targets to black so the first frame has no echo
  const blackFallback = new THREE.DataTexture(
    new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat
  )
  blackFallback.needsUpdate = true

  // ── Post FX scene (renders to feedTargets[feedWrite]) ───────────────────────
  const postScene  = new THREE.Scene()
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: {
        uScene:       { value: target.texture },
        uSimTexture:  { value: blackFallback },
        uFeedbackTex: { value: blackFallback },   // updated each frame
        uResolution:  { value: new THREE.Vector2(rw, rh) },
        uDMT:         { value: 0.0 },
        uRetino:      { value: 0.0 },
        uEcho:        { value: 0.0 },
      },
      vertexShader:   POST_VERT,
      fragmentShader: POST_FRAG,
      depthTest:  false,
      depthWrite: false,
    })
  )
  postScene.add(quad)

  // ── Blit scene (copies feedTargets[feedWrite] → canvas) ─────────────────────
  const blitScene = new THREE.Scene()
  const blitQuad  = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms:       { uTex: { value: null } },
      vertexShader:   POST_VERT,
      fragmentShader: BLIT_FRAG,
      depthTest:  false,
      depthWrite: false,
    })
  )
  blitScene.add(blitQuad)

  return {
    render(scene, camera, dmt, retino, simTexture) {
      // 1. Render 3-D scene → sceneTarget
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)

      // 2. Post FX: reads sceneTarget + feedTargets[feedRead]
      //    writes → feedTargets[feedWrite]
      const feedWrite = 1 - feedRead
      quad.material.uniforms.uDMT.value         = dmt
      quad.material.uniforms.uRetino.value       = retino
      quad.material.uniforms.uEcho.value         = dmt * dmt  // quadratic onset
      quad.material.uniforms.uFeedbackTex.value  = feedTargets[feedRead].texture
      if (simTexture) quad.material.uniforms.uSimTexture.value = simTexture

      renderer.setRenderTarget(feedTargets[feedWrite])
      renderer.render(postScene, postCamera)

      // 3. Blit post output → canvas
      blitQuad.material.uniforms.uTex.value = feedTargets[feedWrite].texture
      renderer.setRenderTarget(null)
      renderer.render(blitScene, postCamera)

      // 4. Advance ping-pong: next frame reads what we just wrote
      feedRead = feedWrite
    },

    resize(w, h) {
      const dpr2 = Math.min(window.devicePixelRatio, 2)
      const nw = w * dpr2, nh = h * dpr2
      target.setSize(nw, nh)
      feedTargets[0].setSize(nw, nh)
      feedTargets[1].setSize(nw, nh)
      quad.material.uniforms.uResolution.value.set(nw, nh)
    },
  }
}
