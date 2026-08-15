uniform sampler2D uTexture;
uniform sampler2D uSimTexture;
uniform float     uDMT;
uniform float     uThreshold; // Act II · level 1: sharpening, no geometry
uniform float     uWorldSheet;// Act V · level 3: field read as depth
uniform float     uRetino;    // Act VI: 0→1 log-polar + entity ring
uniform float     uCurvature; // Act VI: 0→1
uniform float     uGrade;     // Colour grade: 0=natural, 1=vibrance+warmth
uniform float     uTexAspect;    // texture width/height
uniform float     uScreenAspect; // screen width/height, for circular vignette + UV correction
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
varying float vSheet;

// ── Act II · level 1, Threshold ──────────────────────────────────────────────
// "The air appears to suddenly have been sucked out of the room because all the
// colors brighten visibly, as though some intervening medium has been removed."
// The first reported level is a sharpening, not a hallucination: no geometry,
// no motion, only more of what is already present.
//
// Implemented as a four-tap unsharp mask. This is a photographic operation on a
// photograph. Nothing in the neural field produces it, and at this point in the
// scroll the field is still sub-threshold and idle.
vec3 clarity(vec2 luv, vec3 c) {
  if (uThreshold < 0.001) return c;
  vec2 e = vec2(0.0035, 0.0);
  vec3 blur = (
      texture2D(uTexture, texUV(luv + e.xy)).rgb
    + texture2D(uTexture, texUV(luv - e.xy)).rgb
    + texture2D(uTexture, texUV(luv + e.yx)).rgb
    + texture2D(uTexture, texUV(luv - e.yx)).rgb
  ) * 0.25;
  return c + (c - blur) * uThreshold * 0.85;
}

// ── Act VI: retino-cortical map  z → log(z) ───────────────────────────────────
// Log-polar mapping: fovea expands to ~50% of V1 surface area, periphery compresses.
vec2 corticalUV(vec2 uv) {
  vec2  c  = (uv - 0.5) * 2.0;
  float r  = max(length(c), 0.04);
  float th = atan(c.y, c.x);
  float cx = (log(r) + 3.22) / 3.57;
  float cy = th / (2.0 * PI) + 0.5;
  return vec2(cx, cy);
}

// ── Act VI: Poincaré disk (hyperbolic magnification) ─────────────────────────
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
// The second of the four operators in Gomez-Emilsson's algorithmic reduction
// (2016, non-peer-reviewed): feature detachment, breathing walls, textures that
// flow constantly. Like the feedback echo in postfx.js this is not derived from
// the Wilson-Cowan field. It implements a second model, and the two are kept
// apart on the about page.
//
// Domain-warped UV displacement · models feature detachment and texture fluidity.
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
  // ── Act VI: Poincaré warp applied to screen UV before anything else ────────
  // When uCurvature > 0 this bends the lookup into hyperbolic space.
  vec2 wUv = (uCurvature > 0.001) ? poincareUV(vUv, uCurvature) : vUv;

  // Circular disk mask · UV space (vUv covers full plane = full screen),
  // calibrated so the disk fills the plane with the corners fading to black.
  float diskR    = length((vUv - 0.5) * 2.0);
  float diskMask = mix(1.0, smoothstep(1.02, 0.88, diskR), uCurvature);

  // ── Act VI: retino-cortical blend (natural → log-polar) ──────────────────
  float cortT = smoothstep(0.50, 1.0, uRetino);

  // Drifting displaces the texture lookup; retino mode disables it (log-polar
  // handles its own spatial transformation and drift would clash).
  vec2  drift  = driftUV(wUv) * (1.0 - cortT);
  vec4 texNat  = texture2D(uTexture, texUV(wUv + drift));
  texNat.rgb   = clarity(wUv + drift, texNat.rgb);
  vec4 texCort = texture2D(uTexture, texUV(corticalUV(wUv)));
  vec4 tex     = mix(texNat, texCort, cortT);

  // ── UV edge softener · fades all four plane boundaries to black ───────────
  // The circular vignette doesn't reach black at the centre of each edge;
  // this linear fade ensures the geometry boundary is never visible.
  float edgeX = smoothstep(0.0, 0.06, vUv.x) * smoothstep(0.0, 0.06, 1.0 - vUv.x);
  float edgeY = smoothstep(0.0, 0.04, vUv.y) * smoothstep(0.0, 0.04, 1.0 - vUv.y);
  float edgeFade = edgeX * edgeY;

  // ── Base photo shading ─────────────────────────────────────────────────────
  float shading  = 0.82 + vElevation * 0.36;
  // Circular vignette in screen space · length(sc) = 0.5 at top/bottom edge centre
  float vignette = 1.0 - smoothstep(0.45, 1.05, length(sc(vUv)));

  vec3 tinted = mix(
    tex.rgb * vec3(0.95, 0.97, 1.02),
    tex.rgb * vec3(1.02, 1.01, 0.97),
    vElevation
  );
  vec3 base = tinted * shading * vignette * edgeFade;

  // ── Act IV: neural luminance modulation ──────────────────────────────────
  float modulate = 1.0 + vSimDev * uDMT * 1.4;
  base *= modulate * diskMask;

  // ── Act V · level 3: lighting the world-sheet ─────────────────────────────
  //
  // The vertex stage reads the field as a height map. Left unlit it stays a
  // brightness pattern; a height map only reads as volume once it catches
  // light. The normal is taken from the gradient of the simulation texture, so
  // the surface that is lit is the surface the field actually built.
  //
  // The honest split: the shape is field-derived, the lighting is not. One
  // fixed key light and a rim term are rendering decisions and are listed with
  // the imposed effects. The floor stays near its unlit brightness so the gain
  // reads as relief rather than as an exposure change.
  if (uWorldSheet > 0.001) {
    float d  = 2.0 / 512.0;
    float hL = texture2D(uSimTexture, vUv - vec2(d, 0.0)).r;
    float hR = texture2D(uSimTexture, vUv + vec2(d, 0.0)).r;
    float hD = texture2D(uSimTexture, vUv - vec2(0.0, d)).r;
    float hU = texture2D(uSimTexture, vUv + vec2(0.0, d)).r;

    vec3  n   = normalize(vec3((hL - hR) * 12.0, (hD - hU) * 12.0, 1.0));
    vec3  L   = normalize(vec3(-0.45, 0.58, 0.68));
    float lam = max(dot(n, L), 0.0);
    float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2);

    // vSheet carries the actual displacement of this fragment, so the rim only
    // fires on what rose out of the floor rather than on every steep gradient.
    float lifted = clamp(vSheet / 0.378, 0.0, 1.0);

    base *= mix(1.0, 0.45 + lam * 0.85, uWorldSheet);
    base += vec3(0.16, 0.19, 0.21) * rim * lifted * uWorldSheet * 0.42;
  }

  // ── Grade 1: warmth + vibrance, with the tonal range carried along ────────
  //
  // Warmth alone costs range at both ends. The red lift settles into the toe
  // and the blue suppression pulls the white point down, so the frame reads as
  // though contrast had been removed rather than as though it had been graded.
  // On a near-monochrome planform, where the whole image is the black-to-white
  // axis, that is the only thing you see.
  //
  // So the tint does not travel alone. Three moves ride the same uGrade and
  // arrive at exactly the same rate:
  //   1. the tint itself, which owns the midtones
  //   2. highlight neutralisation, so white stays white instead of going cream
  //   3. a highlight additive and a toe recovery, which push the two ends of the
  //      range apart by more than the tint pulled them together
  // The black-to-white space widens with the colour instead of shrinking under it.
  vec3 warm = vec3(
    base.r * (1.0 + uGrade * 0.07),
    base.g * (1.0 + uGrade * 0.018),
    base.b * (1.0 - uGrade * 0.09)
  );

  float lumT   = dot(warm, vec3(0.2126, 0.7152, 0.0722));
  float hiMask = smoothstep(0.58, 1.02, lumT);
  float loMask = 1.0 - smoothstep(0.0, 0.28, lumT);

  // Split tone: the tint is blended back out toward the top of the range, so
  // the warmth lives in the midtones and the highlights keep their neutrality.
  warm = mix(warm, base, hiMask * uGrade * 0.80);

  // Specular additive, near-neutral and weighted to the top of the range. This
  // is the term that makes the grade read as gain rather than as haze.
  warm += vec3(0.085, 0.088, 0.092) * hiMask * uGrade;

  // Toe recovery: the same curve in the other direction, weighted warm so it
  // takes out exactly the cast the tint put into the shadows.
  warm -= vec3(0.034, 0.028, 0.020) * loMask * uGrade;
  warm  = max(warm, 0.0);

  // Vibrance reads the compensated value, not the raw tint.
  float lumW  = dot(warm, vec3(0.2126, 0.7152, 0.0722));
  float mxW   = max(warm.r, max(warm.g, warm.b));
  float satW  = clamp(mxW - lumW, 0.0, 1.0);
  float vibW  = uGrade * 0.42 * (1.0 - satW * 0.85);
  vec3  viv1  = clamp(mix(vec3(lumW), warm, 1.0 + vibW), 0.0, 1.15);
  base = mix(base, viv1, uGrade);

  // ── Grade 2: final stage · contrast + deep vignette, no saturation shift ──
  // Gamma contrast deepens shadows and lifts highlights without touching hue.
  // Saturation boost removed: preserves the full yellow-green/blue-green
  // spectrum from the pasted reference; only luminance structure changes.
  vec3  contrast = pow(clamp(base, 0.001, 1.0), vec3(1.0 + uRetino * 0.32));
  float vigR2    = length((vUv - 0.5) * 2.0);
  float deepV    = 1.0 - smoothstep(0.38, 1.02, vigR2) * 0.88 * uRetino;
  base = mix(base, contrast, uRetino) * deepV;

  gl_FragColor = vec4(clamp(base, 0.0, 1.1), 1.0);
}
