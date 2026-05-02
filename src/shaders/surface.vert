uniform sampler2D uTexture;
uniform sampler2D uSimTexture;
uniform float     uDisplacementScale;
uniform float     uSurface;    // 0=flat → 1=full depth (panel 1 reveal)
uniform float     uDMT;
uniform float     uRetino;     // 0→1 bilateral mirror blend (finale)
uniform float     uCurvature;  // Act V: Poincaré disk warp — must match surface.frag + pointcloud.js
uniform float     uTime;
uniform float     uTexAspect;    // texture width/height
uniform float     uScreenAspect; // screen width/height

#define PI 3.14159265358979
#define PLANE_W 2.0
#define PLANE_H 2.667

// Poincaré disk: identical to surface.frag and pointcloud.js — all three must stay in sync.
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

  // ── Machine elf emergence (inverted ring — teal closest, red farthest) ───
  float dex   = (uv.x - 0.50) / 0.30;
  float dey   = (uv.y - 0.50) / 0.38;
  float dr    = length(vec2(dex, dey));
  float emerge = smoothstep(0.35, 1.0, dr)
               * (1.0 - smoothstep(1.0, 1.35, dr))
               * uRetino * 0.20;
  displaced.z += emerge;

  // ── Statue emergence: floor drops, bright forms protrude (finale) ─────────
  // Recentres luma around 0.38: dark "floor" areas go negative (sink back),
  // bright creature surfaces go further positive (push toward viewer).
  // The growing depth gap between floor and statues creates entity emergence.
  float statueDisp = (luma - 0.38) * uDisplacementScale * uRetino * 1.1;
  displaced.z += statueDisp;

  vElevation = luma;   // blended luma — fragment shading tracks geometry
  vSimDev    = dev;

  // ── Act V: Poincaré disk — warp x,y to match texture lookup and particles ──
  // The hyperbolic deformation applies to the entire visual field, so the mesh
  // geometry must follow. Without this the texture content and particle positions
  // migrate toward the centre while the bump landscape stays at Euclidean grid
  // positions — causing the visible disconnect at the planform→hyperbolic boundary.
  if (uCurvature > 0.001) {
    vec2 pUv = poincareUV(uv, uCurvature);
    displaced.x = (pUv.x - 0.5) * PLANE_W;
    displaced.y = (pUv.y - 0.5) * PLANE_H;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
