uniform sampler2D uTexture;
uniform sampler2D uSimTexture;
uniform float     uDisplacementScale;
uniform float     uSurface;    // 0=flat → 1=full depth (panel 1 reveal)
uniform float     uDMT;
uniform float     uWorldSheet; // Act V · level 3: field read as a height map
uniform float     uRetino;     // 0→1 finale: log-polar blend + imposed displacement
uniform float     uCurvature;  // Act VI: Poincaré disk warp, must match surface.frag + pointcloud.js
uniform float     uTime;
uniform float     uTexAspect;    // texture width/height
uniform float     uScreenAspect; // screen width/height

#define PI 3.14159265358979
#define PLANE_W 2.0
#define PLANE_H 2.667

// Poincaré disk: identical to surface.frag and pointcloud.js, all three must stay in sync.
// Applied to vertex x,y so the mesh geometry follows the texture lookup and particles.
vec2 poincareUV(vec2 uv, float t) {
  vec2  z  = (uv - 0.5) * 2.0;
  float r  = length(z);
  if (r < 0.001) return uv;
  float rC   = min(r, 0.9999);
  float rTex = tanh(atanh(rC) / (1.0 + t * 1.2));
  return normalize(z) * rTex * 0.5 + 0.5;
}

// Cover-mode UV correction (must match surface.frag version).
vec2 texUV(vec2 uv) {
  if (uTexAspect > uScreenAspect) {
    return vec2((uv.x - 0.5) * (uScreenAspect / uTexAspect) + 0.5, uv.y);
  } else {
    return vec2(uv.x, (uv.y - 0.5) * (uTexAspect / uScreenAspect) + 0.5);
  }
}

varying vec2  vUv;
varying float vElevation;
varying float vSimDev;   // deviation from resting state, passed to fragment
varying float vSheet;    // world-sheet height at this vertex, 0 when act V is off

void main() {
  vUv = uv;

  // ── Photo luminance displacement (always active) ───────────────────────────
  float luma = dot(texture2D(uTexture, texUV(uv)).rgb, vec3(0.2126, 0.7152, 0.0722));

  // ── Neural field displacement (grows with DMT) ────────────────────────────
  // Resting state E ≈ 0.33. Deviation from rest: positive = node (push out),
  // negative = anti-node (pull in).
  float simVal = texture2D(uSimTexture, uv).r;
  float dev    = simVal - 0.33;

  // uSurface scales the photo displacement: starts at 0 (flat image),
  // rises to 1 as the user scrolls through panel 1.
  float totalDisp = luma * uDisplacementScale * uSurface
                  + dev  * uDisplacementScale * uDMT  * 1.4;

  vec3 displaced = position + normal * totalDisp;

  // Breath amplitude and rate grow as the surface activates (panel 2+)
  float breathAmp  = 0.002 + uSurface * 0.005;
  float breathRate = 0.4   + uSurface * 0.6;
  displaced.z += sin(uTime * breathRate) * breathAmp;

  // ── Act V · level 3, Magic Eye: the world-sheet ───────────────────────────
  //
  // The reports describe the third level as the Chrysanthemum becoming the
  // texture of an autostereogram: top-down modelling reads a depth map out of
  // the shifting texture, and a surface becomes a volume. Dark recedes, bright
  // advances, and whatever lifts out of the wall is patterned with the same
  // texture it lifted out of, because it is made of it.
  //
  // So the height map is the field, not the photograph. An earlier version did
  // this from image luminance in the finale, which produced the same silhouette
  // for any parameter value and put a photographic decision where a field
  // reading belongs.
  //
  // The split is deliberately asymmetric and has a dead zone:
  //   dev near rest      → stays at the floor, no displacement
  //   dev above rest     → nodes advance toward the viewer
  //   dev below rest     → anti-nodes recede, opening the gap
  // The dead zone is what turns a modulation into a volume. Without it every
  // vertex moves and the result reads as a rippled plane, not as forms standing
  // on a floor.
  //
  // What the code does not do is recognise anything. In the source the fold is
  // driven by recognition: whatever is recognised takes on the excess curvature.
  // That half happens in the viewer, not here.
  float sheet = 0.0;
  if (uWorldSheet > 0.001) {
    // smoothstep is undefined for edge0 >= edge1, so the downward half negates
    // its input rather than reversing the edges.
    float s    = clamp(dev / 0.22, -1.0, 1.0);
    float up   = smoothstep(0.10, 0.85, s);
    float down = smoothstep(0.10, 0.70, -s);
    sheet = (up - down * 0.55) * uDisplacementScale * uWorldSheet * 1.35;
  }
  displaced.z += sheet;

  // ── Imposed entity ring ───────────────────────────────────────────────────
  // Hand-placed elliptical annulus pushed toward the viewer. Not field-derived,
  // not image-derived. A composition decision, disclosed on the about page.
  float dex   = (uv.x - 0.50) / 0.30;
  float dey   = (uv.y - 0.50) / 0.38;
  float dr    = length(vec2(dex, dey));
  float emerge = smoothstep(0.35, 1.0, dr)
               * (1.0 - smoothstep(1.0, 1.35, dr))
               * uRetino * 0.20;
  displaced.z += emerge;

  vElevation = luma;   // blended luma · fragment shading tracks geometry
  vSimDev    = dev;
  vSheet     = sheet;

  // ── Act VI: Poincaré disk · warp x,y to match texture lookup and particles ─
  // The hyperbolic deformation applies to the entire visual field, so the mesh
  // geometry must follow. Without this the texture content and particle positions
  // migrate toward the centre while the bump landscape stays at Euclidean grid
  // positions · causing the visible disconnect at the planform→hyperbolic boundary.
  if (uCurvature > 0.001) {
    vec2 pUv = poincareUV(uv, uCurvature);
    displaced.x = (pUv.x - 0.5) * PLANE_W;
    displaced.y = (pUv.y - 0.5) * PLANE_H;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
