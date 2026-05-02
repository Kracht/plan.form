uniform sampler2D uTexture;
uniform sampler2D uSimTexture;
uniform float     uDMT;
uniform float     uRetino;    // Act VI: 0→1 finale
uniform float     uCurvature; // Act V: 0→1
uniform float     uGrade;     // Colour grade: 0=natural, 1=vibrance+warmth
uniform float     uTexAspect;    // texture width/height
uniform float     uScreenAspect; // screen width/height — for circular vignette + UV correction
uniform float     uTime;

// Screen-space centred position: x scaled by aspect so distances are isotropic.
// length(sc(uv)) == 0.5 at the top/bottom screen edge centre.
vec2 sc(vec2 uv) {
  return (uv - 0.5) * vec2(uScreenAspect, 1.0);
}

// Cover-mode UV correction: samples texture at its natural aspect ratio.
// Uses the effective plane aspect (= screen aspect, since plane fills screen).
vec2 texUV(vec2 uv) {
  if (uTexAspect > uScreenAspect) {
    // texture wider than screen → crop sides
    return vec2((uv.x - 0.5) * (uScreenAspect / uTexAspect) + 0.5, uv.y);
  } else {
    // texture taller than screen → crop top/bottom
    return vec2(uv.x, (uv.y - 0.5) * (uTexAspect / uScreenAspect) + 0.5);
  }
}

#define PI 3.14159265358979

varying vec2  vUv;
varying float vElevation;
varying float vSimDev;

// ── Act II: retino-cortical map  z → log(z) ───────────────────────────────────
// Log-polar mapping: fovea expands to ~50% of V1 surface area, periphery compresses.
vec2 corticalUV(vec2 uv) {
  vec2  c  = (uv - 0.5) * 2.0;
  float r  = max(length(c), 0.04);
  float th = atan(c.y, c.x);
  float cx = (log(r) + 3.22) / 3.57;
  float cy = th / (2.0 * PI) + 0.5;
  return vec2(cx, cy);
}

// ── Act IV: Poincaré disk (hyperbolic magnification) ─────────────────────────
// Exponential centre expansion models DMT-induced hyperbolic phenomenal geometry
// (Gomez-Emilsson / QRI). Centre maps to infinite hyperbolic space.
vec2 poincareUV(vec2 uv, float t) {
  vec2  z = (uv - 0.5) * 2.0;
  float r = length(z);
  if (r < 0.001) return uv;
  float rC   = min(r, 0.9999);
  float rTex = tanh(atanh(rC) / (1.0 + t * 1.2));   // gentler than before
  return normalize(z) * rTex * 0.5 + 0.5;
}

// ── Psychedelic drifting ──────────────────────────────────────────────────────
// Domain-warped UV displacement — models feature detachment and texture fluidity.
// Two-layer domain warp: slow boundary undulation feeds into fast surface flow.
// Scales as DMT² so onset is gentle below ~0.4, strong toward 1.0.
vec2 driftUV(vec2 uv) {
  float str = uDMT * uDMT * 0.026;
  if (str < 0.0001) return vec2(0.0);
  float t  = uTime;
  // Layer 1: slow global undulation (boundary dissolution)
  float lx = sin(uv.y * 2.1 + t * 0.17) * cos(uv.x * 1.8 + t * 0.11);
  float ly = cos(uv.x * 2.4 + t * 0.14) * sin(uv.y * 1.9 + t * 0.20);
  // Layer 2: faster local flow warped by layer 1 (texture fluidity)
  float hx = sin(uv.y * 5.1 + t * 0.41 + lx * 1.6) * 0.35;
  float hy = cos(uv.x * 4.7 + t * 0.38 + ly * 1.4) * 0.35;
  return vec2(lx + hx, ly + hy) * str;
}

void main() {
  // ── Act IV: Poincaré warp applied to screen UV before anything else ────────
  // When uCurvature > 0 this bends the lookup into hyperbolic space.
  vec2 wUv = (uCurvature > 0.001) ? poincareUV(vUv, uCurvature) : vUv;

  // Circular disk mask — UV space (vUv covers full plane = full screen),
  // calibrated so the disk fills the plane with the corners fading to black.
  float diskR    = length((vUv - 0.5) * 2.0);
  float diskMask = mix(1.0, smoothstep(1.02, 0.88, diskR), uCurvature);

  // ── Act II: retino-cortical blend (natural → log-polar) ──────────────────
  float cortT = smoothstep(0.50, 1.0, uRetino);

  // Drifting displaces the texture lookup; retino mode disables it (log-polar
  // handles its own spatial transformation and drift would clash).
  vec2  drift  = driftUV(wUv) * (1.0 - cortT);
  vec4 texNat  = texture2D(uTexture, texUV(wUv + drift));
  vec4 texCort = texture2D(uTexture, texUV(corticalUV(wUv)));
  vec4 tex     = mix(texNat, texCort, cortT);

  // ── UV edge softener — fades all four plane boundaries to black ───────────
  // The circular vignette doesn't reach black at the centre of each edge;
  // this linear fade ensures the geometry boundary is never visible.
  float edgeX = smoothstep(0.0, 0.06, vUv.x) * smoothstep(0.0, 0.06, 1.0 - vUv.x);
  float edgeY = smoothstep(0.0, 0.04, vUv.y) * smoothstep(0.0, 0.04, 1.0 - vUv.y);
  float edgeFade = edgeX * edgeY;

  // ── Base photo shading ─────────────────────────────────────────────────────
  float shading  = 0.82 + vElevation * 0.36;
  // Circular vignette in screen space — length(sc) = 0.5 at top/bottom edge centre
  float vignette = 1.0 - smoothstep(0.45, 1.05, length(sc(vUv)));

  vec3 tinted = mix(
    tex.rgb * vec3(0.95, 0.97, 1.02),
    tex.rgb * vec3(1.02, 1.01, 0.97),
    vElevation
  );
  vec3 base = tinted * shading * vignette * edgeFade;

  // ── Act III: neural luminance modulation ──────────────────────────────────
  float modulate = 1.0 + vSimDev * uDMT * 1.4;
  base *= modulate * diskMask;

  // ── Grade 1: vibrance + warmth (fades in act I→II, stays through finale) ──
  // Warmth: amber lift in shadows, slight blue suppression.
  // Vibrance: smart saturation — muted areas boosted more than already-vivid ones.
  vec3 warm = vec3(
    base.r * (1.0 + uGrade * 0.07),
    base.g * (1.0 + uGrade * 0.018),
    base.b * (1.0 - uGrade * 0.09)
  );
  float lumW  = dot(warm, vec3(0.2126, 0.7152, 0.0722));
  float mxW   = max(warm.r, max(warm.g, warm.b));
  float satW  = clamp(mxW - lumW, 0.0, 1.0);
  float vibW  = uGrade * 0.42 * (1.0 - satW * 0.85);
  vec3  viv1  = clamp(mix(vec3(lumW), warm, 1.0 + vibW), 0.0, 1.15);
  base = mix(base, viv1, uGrade);

  // ── Grade 2: final stage — contrast + deep vignette, no saturation shift ──
  // Gamma contrast deepens shadows and lifts highlights without touching hue.
  // Saturation boost removed: preserves the full yellow-green/blue-green
  // spectrum from the pasted reference; only luminance structure changes.
  vec3  contrast = pow(clamp(base, 0.001, 1.0), vec3(1.0 + uRetino * 0.32));
  float vigR2    = length((vUv - 0.5) * 2.0);
  float deepV    = 1.0 - smoothstep(0.38, 1.02, vigR2) * 0.88 * uRetino;
  base = mix(base, contrast, uRetino) * deepV;

  gl_FragColor = vec4(clamp(base, 0.0, 1.1), 1.0);
}
