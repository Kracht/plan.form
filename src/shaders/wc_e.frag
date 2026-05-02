// Wilson-Cowan — Excitatory population (E)
//
// GPUComputationRenderer prepends:
//   uniform sampler2D textureE;   (previous E state)
//   uniform sampler2D textureI;   (previous I state)
//   uniform vec2 resolution;

uniform sampler2D uInputTexture;
uniform float     uDMT;
uniform vec2      uTexelSize;
// N-fold planform bias (0 = free / no bias; 3/4/6/8 = bias toward that planform class).
// Injects a small cosine-angular seed into I_ext so the winning planform aligns
// with the requested rotational symmetry. Amplitude kept low (≤ 0.03) so the
// Wilson-Cowan dynamics remain in control — this tips the competition, not rigging it.
uniform float     uLobeCount;
// Travelling wave front: world-space radius of the activation boundary.
// -1 = wave not yet triggered (full DMT everywhere).
// ≥ 0 = pixels outside this radius stay sub-bifurcation; inside get full DMT.
uniform float     uWaveFront;

// ── Sigmoid ───────────────────────────────────────────────────────────────────
// threshold=0.28, beta=5 → S(0) ≈ 0.35, which puts the resting state high
// enough to be visible AND to have sufficient slope for Turing instability.
// f'(E*=0.35) = 5 * 0.35 * 0.65 ≈ 1.14 — well above the critical gain needed.
float sigma(float x) {
    return 1.0 / (1.0 + exp(-5.0 * (x - 0.28)));
}

// ── 12-point ring (30° spacing) — short-range excitatory kernel ──────────────
// 12 points gives 6-fold symmetry rather than the 4-fold of the old 8-point ring.
// 4-fold bias caused the kernel itself to prefer square lattice planforms when the
// input had no strong orientation. 6-fold is consistent with Bressloff (2001)'s
// theoretical prediction that isotropic kernels prefer hexagonal planforms.
float ring12(sampler2D tex, vec2 uv, float r) {
    // cos/sin of 0°,30°,60°,90°,120°,150° and their negatives
    float c30 = r * 0.8660;   // r·cos(30°)
    float s30 = r * 0.5000;   // r·sin(30°)
    return (
        texture2D(tex, uv + vec2( r,    0.0 )).r +
        texture2D(tex, uv + vec2( c30,  s30 )).r +
        texture2D(tex, uv + vec2( s30,  c30 )).r +
        texture2D(tex, uv + vec2( 0.0,  r   )).r +
        texture2D(tex, uv + vec2(-s30,  c30 )).r +
        texture2D(tex, uv + vec2(-c30,  s30 )).r +
        texture2D(tex, uv + vec2(-r,    0.0 )).r +
        texture2D(tex, uv + vec2(-c30, -s30 )).r +
        texture2D(tex, uv + vec2(-s30, -c30 )).r +
        texture2D(tex, uv + vec2( 0.0, -r   )).r +
        texture2D(tex, uv + vec2( s30, -c30 )).r +
        texture2D(tex, uv + vec2( c30, -s30 )).r
    ) / 12.0;
}

// ── 16-point ring (22.5° spacing) — long-range inhibitory kernel ─────────────
float ring16(sampler2D tex, vec2 uv, float r) {
    float a = r;
    float b = r * 0.9239;
    float c = r * 0.7071;
    float d = r * 0.3827;
    return (
        texture2D(tex, uv + vec2( a,  0.0)).r +
        texture2D(tex, uv + vec2( b,  d  )).r +
        texture2D(tex, uv + vec2( c,  c  )).r +
        texture2D(tex, uv + vec2( d,  b  )).r +
        texture2D(tex, uv + vec2( 0.0, a )).r +
        texture2D(tex, uv + vec2(-d,  b  )).r +
        texture2D(tex, uv + vec2(-c,  c  )).r +
        texture2D(tex, uv + vec2(-b,  d  )).r +
        texture2D(tex, uv + vec2(-a,  0.0)).r +
        texture2D(tex, uv + vec2(-b, -d  )).r +
        texture2D(tex, uv + vec2(-c, -c  )).r +
        texture2D(tex, uv + vec2(-d, -b  )).r +
        texture2D(tex, uv + vec2( 0.0,-a )).r +
        texture2D(tex, uv + vec2( d, -b  )).r +
        texture2D(tex, uv + vec2( c, -c  )).r +
        texture2D(tex, uv + vec2( b, -d  )).r
    ) / 16.0;
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    float E = texture2D(textureE, uv).r;
    float I = texture2D(textureI, uv).r;

    // ── Mexican-hat lateral connectivity ──────────────────────────────────────
    float r_exc = 6.0  * uTexelSize.x;   // short-range excitation
    float r_inh = 20.0 * uTexelSize.x;   // long-range effective inhibition

    float excInput = ring12(textureE, uv, r_exc);
    float inhInput = ring16(textureE, uv, r_inh);

    // ── External input ────────────────────────────────────────────────────────
    float luma     = dot(texture2D(uInputTexture, uv).rgb, vec3(0.2126, 0.7152, 0.0722));
    // High-frequency texture detail (edge energy) — does NOT fade with DMT.
    // This seeds planform nodes at foliage texture boundaries so the pattern
    // emerges from the image's own fine structure rather than arbitrary positions.
    float lumaFine = dot(texture2D(uInputTexture, uv + uTexelSize * 3.0).rgb, vec3(0.2126, 0.7152, 0.0722));
    float hf       = abs(luma - lumaFine) * 2.5;
    float I_ext    = luma * (1.0 - uDMT) * 0.45 + hf * 0.10;

    // ── Boundary damping ──────────────────────────────────────────────────────
    // Clamp w_EE toward the sub-bifurcation value within 10% of each edge.
    // This keeps the field at resting state near the plane boundary, preventing
    // the hard rectangular planform-edge artefact visible with procedural textures.
    float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float edgeFade = smoothstep(0.0, 0.10, edgeDist);

    // ── Wave-front gating ─────────────────────────────────────────────────────
    // While the travelling wave is active, pixels outside the front stay
    // sub-bifurcation (localDMT=0). Inside the swept zone, full DMT applies.
    // Soft transition over 0.08 wu avoids a sharp discontinuity in the field.
    // Once the wave has crossed the whole plane (uWaveFront < 0 or very large),
    // localDMT equals uDMT everywhere.
    float localDMT = uDMT;
    if (uWaveFront >= 0.0) {
        vec2  wc    = (uv - 0.5) * vec2(2.000, 2.667);
        float wDist = length(wc);
        float wGate = smoothstep(uWaveFront + 0.04, uWaveFront - 0.06, wDist);
        localDMT   *= wGate;
    }

    // ── Coupling (DMT-modulated) ───────────────────────────────────────────────
    // Bifurcation analysis: with f'(E*)≈1.14, threshold crossed when
    // w_EE * J0(k* * r_exc) > 1/f'(E*) ≈ 0.88
    // J0(2π * k* * 6) ≈ 0.889 at k* = 1/(2*(6+20)) ≈ 0.019
    // → w_EE > 0.88/0.889 ≈ 0.99 triggers Turing instability
    // At α=0: w_EE=0.45 (stable). Bifurcation at α≈0.42. At α=1: w_EE=1.75 (patterned).
    float w_EE      = mix(0.45, 0.45 + localDMT * 1.30, edgeFade);  // stable at edges
    float w_lat_inh = 0.85;
    float w_EI      = 0.18;

    // ── N-fold symmetry bias ──────────────────────────────────────────────────
    // A gentle angular-frequency modulation seeds the planform competition.
    // smoothstep avoids the atan singularity at the exact centre pixel.
    if (uLobeCount > 0.5) {
        vec2  c     = uv - vec2(0.5);
        float r     = length(c);
        float theta = atan(c.y, c.x);
        float bias  = cos(uLobeCount * theta) * 0.030 * localDMT * smoothstep(0.02, 0.10, r);
        I_ext      += bias;
    }

    float net        = w_EE * excInput - w_lat_inh * inhInput - w_EI * I + I_ext;
    float activation = sigma(net);

    float dt    = 0.28;
    float tau_E = 1.0;
    float newE  = E + (dt / tau_E) * (-E + activation);

    gl_FragColor = vec4(clamp(newE, 0.0, 1.0), 0.0, 0.0, 1.0);
}
