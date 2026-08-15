// Wilson-Cowan · Inhibitory population (I)
//
// GPUComputationRenderer prepends:
//   uniform sampler2D textureE;
//   uniform sampler2D textureI;
//   uniform vec2 resolution;

uniform float uDMT;
uniform vec2  uTexelSize;

float sigma(float x) {
    return 1.0 / (1.0 + exp(-5.0 * (x - 0.28)));
}

void main() {
    vec2  uv = gl_FragCoord.xy / resolution.xy;
    float E  = texture2D(textureE, uv).r;
    float I  = texture2D(textureI, uv).r;

    float w_IE = 0.95 - uDMT * 0.20;   // 0.95 → 0.75 (slightly weaker with DMT)
    float w_II = 0.15;

    float net        = w_IE * E - w_II * I;
    float activation = sigma(net);

    float dt    = 0.28;
    float tau_I = 1.5;
    float newI  = I + (dt / tau_I) * (-I + activation);

    gl_FragColor = vec4(clamp(newI, 0.0, 1.0), 0.0, 0.0, 1.0);
}
