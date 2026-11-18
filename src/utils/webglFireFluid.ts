/**
 * Real-Time Full-Widescreen GPU Navier-Stokes Eulerian Fluid Fire Simulator (WebGL2)
 * Domain covers full widescreen world space: X in [-1.05, +0.95] (width 2.0), Y in [-0.62, +0.62] (height 1.24)
 * so interactive mouse-blown flames curl freely across the entire screen with ZERO left/top edge clipping!
 */

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
}

interface DoubleFBO {
  read: FBO;
  write: FBO;
  swap: () => void;
}

// Shared fluid-to-world mapping constants (used by both WebGLFireFluid and EmberVinylView!)
export const FLUID_WORLD_MIN_X = -1.05;
export const FLUID_WORLD_W = 2.0;
export const FLUID_WORLD_MIN_Y = -0.62;
export const FLUID_WORLD_H = 1.24;

const SIM_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Injects flickering combustion heat & fuel along the EXACT jagged curved left burn edge of the vinyl sleeve!
const EMIT_TEMP_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_prev;
uniform float u_time;
uniform float u_dt;
uniform float u_activity;
uniform float u_ignition; // 0.0 -> 1.0: flame starts at bottom-left corner (-0.355,-0.355) & spreads to full burnEdge!
uniform float u_sweep; // < 0 when idle, 0..1 during bottom-left -> top-right cover burn transition!
uniform vec2 u_mouseUv;
uniform vec2 u_mouseVel;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = r * p * 2.03;
    a *= 0.48;
  }
  return v;
}

float burnEdgeX(float y) {
  float curve = -0.215 + 0.44 * (y + 0.04) * (y + 0.04) + 0.08 * y;
  float jag1 = (fbm(vec2(y * 10.5 + 1.7, 3.4)) - 0.5) * 0.072;
  float crag = (abs(fract(y * 19.0 + jag1 * 6.0) - 0.5) - 0.25) * 0.032;
  return curve + jag1 + crag;
}

void main() {
  vec4 prev = texture(u_prev, v_uv);

  // Full widescreen world coords: X in [-1.05, +0.95], Y in [-0.62, +0.62]
  vec2 world = vec2(v_uv.x * 2.0 - 1.05, v_uv.y * 1.24 - 0.62);
  float bEdge = burnEdgeX(world.y);

  // Ignition spread: starts at the bottom-left corner (-0.355, -0.355) and creeps right + up to full burnEdge(y)!
  float ign = clamp(u_ignition, 0.0, 1.0);
  float activeX = mix(-0.355, bEdge - 0.022, smoothstep(0.0, 0.72, ign));
  float maxEmitY = mix(-0.33, 0.34, smoothstep(0.04, 1.0, ign));
  float ySpan = smoothstep(-0.37, -0.30, world.y) * (1.0 - smoothstep(maxEmitY - 0.10, maxEmitY + 0.04, world.y));
  float distToEdge = abs(world.x - activeX);
  float strip = exp(-distToEdge * distToEdge / (0.023 * 0.023)) * ySpan * smoothstep(0.0, 0.06, ign);

  float pulse1 = noise(vec2(world.y * 14.0 - u_time * 5.2, u_time * 2.1));
  float pulse2 = noise(vec2(world.y * 28.0 - u_time * 9.5, u_time * 3.7 + 7.1));
  float ignition = (0.34 + 0.92 * pulse1 * pulse2 * 2.0) * u_activity;

  float baseHotspot = exp(-pow((world.y + 0.18) * 4.5, 2.0)) * 0.48 + exp(-pow((world.y - 0.04) * 5.0, 2.0)) * 0.36;
  float addTemp = strip * (ignition + baseHotspot * u_activity) * u_dt * 10.2;

  // Sweeping diagonal cover-burn flame wave (bottom-left -> across disc -> vanishes into air past top-right!)
  float sweepTemp = 0.0;
  float sweepCore = 0.0;
  if (u_sweep >= 0.0 && u_sweep < 0.96) {
    vec2 dUv = world - vec2(0.024, -0.012);
    float r = length(dUv);
    // Keep wave tightly hugging the spinning vinyl disc + brief lift-off puff past the right rim
    float inDisc = 1.0 - smoothstep(0.32, 0.39, r);
    float diag = (dUv.x * 0.78 + dUv.y * 0.62) / (0.348 * 1.95) + 0.52;
    float jag = (fbm(dUv * 16.0 + vec2(u_time * 0.35, 2.3)) - 0.5) * 0.14;
    float frontPos = mix(-0.14, 1.18, u_sweep);
    float distF = abs((diag + jag) - frontPos);
    // Fade emission smoothly out as the flame reaches the top-right rim so it lifts up & disappears into thin air!
    float fadeOut = smoothstep(0.0, 0.08, u_sweep) * (1.0 - smoothstep(0.74, 0.94, u_sweep));
    float waveStrip = exp(-distF * distF / (0.042 * 0.042)) * inDisc * fadeOut;
    float flickerW = 0.65 + 0.75 * noise(vec2(dUv.y * 22.0 - u_time * 8.0, dUv.x * 22.0 + u_time * 4.0));
    sweepTemp = waveStrip * flickerW * u_dt * 16.5;
    sweepCore = waveStrip * flickerW * u_dt * 13.0;
  }

  // Aspect-corrected mouse distance in world space for soft spark when swiping flames (only while ignited!)
  vec2 mWorld = vec2(u_mouseUv.x * 2.0 - 1.05, u_mouseUv.y * 1.24 - 0.62);
  float mDist = length(world - mWorld);
  float mouseSpeed = length(u_mouseVel);
  float mouseHeat = exp(-mDist * mDist / 0.0014) * min(1.0, mouseSpeed * 14.0) * 0.32 * u_activity * smoothstep(0.05, 0.35, prev.r + 0.12);

  float nextTemp = clamp(prev.r + addTemp + sweepTemp + mouseHeat, 0.0, 2.3);
  float nextCore = clamp(prev.g + strip * ignition * u_dt * 9.0 + sweepCore, 0.0, 1.7);
  float nextSmoke = clamp(prev.b + max(0.0, prev.r - 0.18) * u_dt * 0.52, 0.0, 1.0);

  outColor = vec4(nextTemp, nextCore, nextSmoke, 1.0);
}
`;

const EMIT_VEL_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_prev;
uniform float u_time;
uniform float u_dt;
uniform float u_activity;
uniform float u_ignition; // 0.0 -> 1.0: flame starts at bottom-left corner (-0.355,-0.355) & spreads to full burnEdge!
uniform float u_sweep; // < 0 when idle, 0..1 during bottom-left -> top-right cover burn transition!
uniform vec2 u_mouseUv;
uniform vec2 u_mouseVel;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = r * p * 2.03;
    a *= 0.48;
  }
  return v;
}

float burnEdgeX(float y) {
  float curve = -0.215 + 0.44 * (y + 0.04) * (y + 0.04) + 0.08 * y;
  float jag1 = (fbm(vec2(y * 10.5 + 1.7, 3.4)) - 0.5) * 0.072;
  float crag = (abs(fract(y * 19.0 + jag1 * 6.0) - 0.5) - 0.25) * 0.032;
  return curve + jag1 + crag;
}

void main() {
  vec2 vel = texture(u_prev, v_uv).xy;
  vec2 world = vec2(v_uv.x * 2.0 - 1.05, v_uv.y * 1.24 - 0.62);
  float bEdge = burnEdgeX(world.y);

  float ign = clamp(u_ignition, 0.0, 1.0);
  float activeX = mix(-0.355, bEdge - 0.024, smoothstep(0.0, 0.72, ign));
  float maxEmitY = mix(-0.32, 0.36, smoothstep(0.04, 1.0, ign));
  float ySpan = smoothstep(-0.37, -0.28, world.y) * (1.0 - smoothstep(maxEmitY - 0.10, maxEmitY + 0.05, world.y));
  float distToEdge = abs(world.x - activeX);
  float strip = exp(-distToEdge * distToEdge / (0.032 * 0.032)) * ySpan * smoothstep(0.0, 0.06, ign);

  // Chaotic convective gusts ejecting slightly left-and-up off the charred edge (zero when cooled!)
  float gustX = (noise(vec2(world.y * 16.0 - u_time * 6.2, u_time * 3.1)) - 0.54) * 1.15 * u_activity;
  float jetY = (0.95 + 0.85 * noise(vec2(world.y * 12.0 + 3.2, u_time * 4.8))) * u_activity;
  vel += vec2(gustX, jetY) * strip * u_dt * 4.2;

  // Sweeping cover-burn flame velocity wave (pushes flames diagonally up-right & lifts them off into air!)
  if (u_sweep >= 0.0 && u_sweep < 0.96) {
    vec2 dUv = world - vec2(0.024, -0.012);
    float r = length(dUv);
    float inDisc = 1.0 - smoothstep(0.32, 0.40, r);
    float diag = (dUv.x * 0.78 + dUv.y * 0.62) / (0.348 * 1.95) + 0.52;
    float jag = (fbm(dUv * 16.0 + vec2(u_time * 0.35, 2.3)) - 0.5) * 0.14;
    float frontPos = mix(-0.14, 1.18, u_sweep);
    float distF = abs((diag + jag) - frontPos);
    float fadeOut = smoothstep(0.0, 0.08, u_sweep) * (1.0 - smoothstep(0.74, 0.94, u_sweep));
    float waveStrip = exp(-distF * distF / (0.052 * 0.052)) * inDisc * fadeOut;
    float swirl = (noise(vec2(dUv.y * 18.0 - u_time * 7.0, dUv.x * 18.0)) - 0.5) * 1.2;
    vel += vec2(1.05 + swirl, 1.75 + abs(swirl)) * waveStrip * u_dt * 4.8;
  }

  // Aspect-corrected interactive cursor wind splat across the full screen!
  vec2 mWorld = vec2(u_mouseUv.x * 2.0 - 1.05, u_mouseUv.y * 1.24 - 0.62);
  float mDist = length(world - mWorld);
  float splat = exp(-mDist * mDist / 0.0055);
  vel += u_mouseVel * splat * 9.5;

  outColor = vec4(vel, 0.0, 1.0);
}
`;

// Boussinesq thermal buoyancy: hotter gas rises faster upward!
const BUOYANCY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_velocity;
uniform sampler2D u_temp;
uniform float u_dt;
uniform float u_buoyancy;

void main() {
  vec2 vel = texture(u_velocity, v_uv).xy;
  vec4 tData = texture(u_temp, v_uv);
  float temp = tData.r;
  float smoke = tData.b;

  vel.y += u_dt * (temp * u_buoyancy - smoke * 0.12);
  // Subtle natural draft tilt near upper flames
  vel.x -= u_dt * temp * 0.12 * smoothstep(0.55, 0.92, v_uv.y);

  outColor = vec4(vel, 0.0, 1.0);
}
`;

const CURL_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_velocity;
uniform vec2 u_texelSize;

void main() {
  float L = texture(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).y;
  float R = texture(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).y;
  float T = texture(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).x;
  float B = texture(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).x;
  float vorticity = R - L - T + B;
  outColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
}
`;

const VORTICITY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_velocity;
uniform sampler2D u_curl;
uniform vec2 u_texelSize;
uniform float u_curlStrength;
uniform float u_dt;

void main() {
  float L = texture(u_curl, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float R = texture(u_curl, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float T = texture(u_curl, v_uv + vec2(0.0, u_texelSize.y)).x;
  float B = texture(u_curl, v_uv - vec2(0.0, u_texelSize.y)).x;
  float C = texture(u_curl, v_uv).x;

  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= u_curlStrength * C;
  force.y *= -1.0;

  vec2 vel = texture(u_velocity, v_uv).xy;
  vel += force * u_dt;
  vel = clamp(vel, vec2(-22.0), vec2(22.0));
  outColor = vec4(vel, 0.0, 1.0);
}
`;

const DIVERGENCE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_velocity;
uniform vec2 u_texelSize;

void main() {
  float L = texture(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float R = texture(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float T = texture(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).y;
  float B = texture(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).y;
  vec2 C = texture(u_velocity, v_uv).xy;

  if (v_uv.x - u_texelSize.x < 0.0) L = -C.x;
  if (v_uv.x + u_texelSize.x > 1.0) R = -C.x;
  if (v_uv.y + u_texelSize.y > 1.0) T = -C.y;
  if (v_uv.y - u_texelSize.y < 0.0) B = -C.y;

  float div = 0.5 * (R - L + T - B);
  outColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

const PRESSURE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform vec2 u_texelSize;

void main() {
  float L = texture(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float R = texture(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float T = texture(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
  float B = texture(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
  float div = texture(u_divergence, v_uv).x;
  float p = (L + R + B + T - div) * 0.25;
  outColor = vec4(p, 0.0, 0.0, 1.0);
}
`;

const GRADIENT_SUB_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_pressure;
uniform sampler2D u_velocity;
uniform vec2 u_texelSize;

void main() {
  float L = texture(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float R = texture(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float T = texture(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
  float B = texture(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
  vec2 vel = texture(u_velocity, v_uv).xy;
  vel -= vec2(R - L, T - B) * 0.5;
  outColor = vec4(vel, 0.0, 1.0);
}
`;

const ADVECT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform vec2 u_worldScale; // (1/WORLD_W, 1/WORLD_H) so velocity moves identically in X & Y!
uniform float u_dt;
uniform float u_dissipation;
uniform float u_isTemp;

void main() {
  vec2 vel = texture(u_velocity, v_uv).xy;
  vec2 coord = v_uv - u_dt * vel * 0.36 * u_worldScale;
  vec4 result = texture(u_source, clamp(coord, vec2(0.002), vec2(0.998)));

  if (u_isTemp > 0.5) {
    // Smooth radiative cooling only near the very outer edges of the full widescreen frame!
    float topCool = mix(1.0, 2.2, smoothstep(0.76, 0.99, v_uv.y));
    float sideCool = mix(1.0, 2.5, smoothstep(0.88, 0.99, abs(v_uv.x - 0.5) * 2.0));
    float decayTemp = 1.0 / (1.0 + u_dissipation * topCool * sideCool * u_dt);
    float decayCore = 1.0 / (1.0 + u_dissipation * 2.1 * topCool * u_dt);
    float decaySmoke = 1.0 / (1.0 + 1.4 * u_dt);
    outColor = vec4(result.r * decayTemp, result.g * decayCore, result.b * decaySmoke, 1.0);
  } else {
    float decay = 1.0 / (1.0 + u_dissipation * u_dt);
    outColor = vec4(result.xy * decay, 0.0, 1.0);
  }
}
`;

const CLEAR_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_value;
void main() {
  outColor = texture(u_tex, v_uv) * u_value;
}
`;

function compileGL2(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('FireFluid shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgramGL2(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compileGL2(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileGL2(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('FireFluid link error:', gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

export class WebGLFireFluid {
  private gl: WebGL2RenderingContext;
  private quadVao: WebGLVertexArrayObject | null;
  private quadBuf: WebGLBuffer | null;

  // Aspect-matched widescreen grids (2.0 : 1.24 = 1.613:1 -> crisp square cells across full monitor!)
  private simW = 320;
  private simH = 198;
  private dyeW = 560;
  private dyeH = 348;

  private velocity: DoubleFBO;
  private temp: DoubleFBO;
  private pressure: DoubleFBO;
  private curl: FBO;
  private divergence: FBO;

  private pEmitTemp: WebGLProgram;
  private pEmitVel: WebGLProgram;
  private pBuoyancy: WebGLProgram;
  private pCurl: WebGLProgram;
  private pVorticity: WebGLProgram;
  private pDivergence: WebGLProgram;
  private pPressure: WebGLProgram;
  private pGradSub: WebGLProgram;
  private pAdvect: WebGLProgram;
  private pClear: WebGLProgram;

  private internalFormat: number;
  private texType: number;

  constructor(gl: WebGL2RenderingContext, prewarm = true) {
    this.gl = gl;

    const hasFloatBuf = !!gl.getExtension('EXT_color_buffer_float');
    const hasHalfBuf = !!gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_half_float_linear');
    gl.getExtension('OES_texture_float_linear');

    if (hasFloatBuf || hasHalfBuf) {
      this.internalFormat = gl.RGBA16F;
      this.texType = gl.HALF_FLOAT;
    } else {
      this.internalFormat = gl.RGBA8;
      this.texType = gl.UNSIGNED_BYTE;
    }

    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.pEmitTemp = createProgramGL2(gl, SIM_VS, EMIT_TEMP_FS)!;
    this.pEmitVel = createProgramGL2(gl, SIM_VS, EMIT_VEL_FS)!;
    this.pBuoyancy = createProgramGL2(gl, SIM_VS, BUOYANCY_FS)!;
    this.pCurl = createProgramGL2(gl, SIM_VS, CURL_FS)!;
    this.pVorticity = createProgramGL2(gl, SIM_VS, VORTICITY_FS)!;
    this.pDivergence = createProgramGL2(gl, SIM_VS, DIVERGENCE_FS)!;
    this.pPressure = createProgramGL2(gl, SIM_VS, PRESSURE_FS)!;
    this.pGradSub = createProgramGL2(gl, SIM_VS, GRADIENT_SUB_FS)!;
    this.pAdvect = createProgramGL2(gl, SIM_VS, ADVECT_FS)!;
    this.pClear = createProgramGL2(gl, SIM_VS, CLEAR_FS)!;

    this.velocity = this.createDoubleFBO(this.simW, this.simH);
    this.temp = this.createDoubleFBO(this.dyeW, this.dyeH);
    this.pressure = this.createDoubleFBO(this.simW, this.simH);
    this.curl = this.createFBO(this.simW, this.simH);
    this.divergence = this.createFBO(this.simW, this.simH);

    // Pre-warm 40 frames only when starting in playing state so paused view starts 100% cool & normal!
    if (prewarm) {
      for (let i = 0; i < 40; i++) {
        this.step(0.016, i * 0.016, 1.0, -10, -10, 0, 0, -1, 1.0);
      }
    }
  }

  private createFBO(w: number, h: number): FBO {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.internalFormat, w, h, 0, gl.RGBA, this.texType, null);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { texture, fbo, width: w, height: h };
  }

  private createDoubleFBO(w: number, h: number): DoubleFBO {
    let fbo1 = this.createFBO(w, h);
    let fbo2 = this.createFBO(w, h);
    return {
      get read() {
        return fbo1;
      },
      get write() {
        return fbo2;
      },
      swap() {
        const tmp = fbo1;
        fbo1 = fbo2;
        fbo2 = tmp;
      },
    };
  }

  private blit(target: FBO) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.width, target.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private bindTex(unit: number, tex: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  public get fireTexture(): WebGLTexture {
    return this.temp.read.texture;
  }

  public step(
    dt: number,
    time: number,
    activity: number,
    mouseU: number,
    mouseV: number,
    mouseVelX: number,
    mouseVelY: number,
    sweep = -1,
    ignition = 1.0
  ) {
    const gl = this.gl;
    const clampedDt = Math.min(0.022, Math.max(0.004, dt));

    gl.bindVertexArray(this.quadVao);

    // 1. Emit combustion heat along creeping ignition curve + active cover-burn transition sweep
    gl.useProgram(this.pEmitTemp);
    this.bindTex(0, this.temp.read.texture);
    gl.uniform1i(gl.getUniformLocation(this.pEmitTemp, 'u_prev'), 0);
    gl.uniform1f(gl.getUniformLocation(this.pEmitTemp, 'u_time'), time);
    gl.uniform1f(gl.getUniformLocation(this.pEmitTemp, 'u_dt'), clampedDt);
    gl.uniform1f(gl.getUniformLocation(this.pEmitTemp, 'u_activity'), activity);
    gl.uniform1f(gl.getUniformLocation(this.pEmitTemp, 'u_ignition'), ignition);
    gl.uniform1f(gl.getUniformLocation(this.pEmitTemp, 'u_sweep'), sweep);
    gl.uniform2f(gl.getUniformLocation(this.pEmitTemp, 'u_mouseUv'), mouseU, mouseV);
    gl.uniform2f(gl.getUniformLocation(this.pEmitTemp, 'u_mouseVel'), mouseVelX, mouseVelY);
    this.blit(this.temp.write);
    this.temp.swap();

    // 2. Emit upward flame jets + sweep wave momentum + interactive full-screen cursor wind
    gl.useProgram(this.pEmitVel);
    this.bindTex(0, this.velocity.read.texture);
    gl.uniform1i(gl.getUniformLocation(this.pEmitVel, 'u_prev'), 0);
    gl.uniform1f(gl.getUniformLocation(this.pEmitVel, 'u_time'), time);
    gl.uniform1f(gl.getUniformLocation(this.pEmitVel, 'u_dt'), clampedDt);
    gl.uniform1f(gl.getUniformLocation(this.pEmitVel, 'u_activity'), activity);
    gl.uniform1f(gl.getUniformLocation(this.pEmitVel, 'u_ignition'), ignition);
    gl.uniform1f(gl.getUniformLocation(this.pEmitVel, 'u_sweep'), sweep);
    gl.uniform2f(gl.getUniformLocation(this.pEmitVel, 'u_mouseUv'), mouseU, mouseV);
    gl.uniform2f(gl.getUniformLocation(this.pEmitVel, 'u_mouseVel'), mouseVelX, mouseVelY);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // 3. Thermal Buoyancy
    gl.useProgram(this.pBuoyancy);
    this.bindTex(0, this.velocity.read.texture);
    this.bindTex(1, this.temp.read.texture);
    gl.uniform1i(gl.getUniformLocation(this.pBuoyancy, 'u_velocity'), 0);
    gl.uniform1i(gl.getUniformLocation(this.pBuoyancy, 'u_temp'), 1);
    gl.uniform1f(gl.getUniformLocation(this.pBuoyancy, 'u_dt'), clampedDt);
    gl.uniform1f(gl.getUniformLocation(this.pBuoyancy, 'u_buoyancy'), 2.75 + activity * 0.75);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // 4. Curl
    const tx = 1.0 / this.simW;
    const ty = 1.0 / this.simH;
    gl.useProgram(this.pCurl);
    this.bindTex(0, this.velocity.read.texture);
    gl.uniform1i(gl.getUniformLocation(this.pCurl, 'u_velocity'), 0);
    gl.uniform2f(gl.getUniformLocation(this.pCurl, 'u_texelSize'), tx, ty);
    this.blit(this.curl);

    // 5. Vorticity Confinement
    gl.useProgram(this.pVorticity);
    this.bindTex(0, this.velocity.read.texture);
    this.bindTex(1, this.curl.texture);
    gl.uniform1i(gl.getUniformLocation(this.pVorticity, 'u_velocity'), 0);
    gl.uniform1i(gl.getUniformLocation(this.pVorticity, 'u_curl'), 1);
    gl.uniform2f(gl.getUniformLocation(this.pVorticity, 'u_texelSize'), tx, ty);
    gl.uniform1f(gl.getUniformLocation(this.pVorticity, 'u_curlStrength'), 38.0);
    gl.uniform1f(gl.getUniformLocation(this.pVorticity, 'u_dt'), clampedDt);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // 6. Divergence
    gl.useProgram(this.pDivergence);
    this.bindTex(0, this.velocity.read.texture);
    gl.uniform1i(gl.getUniformLocation(this.pDivergence, 'u_velocity'), 0);
    gl.uniform2f(gl.getUniformLocation(this.pDivergence, 'u_texelSize'), tx, ty);
    this.blit(this.divergence);

    // 7. Jacobi Pressure Projection (18 iterations)
    gl.useProgram(this.pClear);
    this.bindTex(0, this.pressure.read.texture);
    gl.uniform1i(gl.getUniformLocation(this.pClear, 'u_tex'), 0);
    gl.uniform1f(gl.getUniformLocation(this.pClear, 'u_value'), 0.8);
    this.blit(this.pressure.write);
    this.pressure.swap();

    gl.useProgram(this.pPressure);
    this.bindTex(1, this.divergence.texture);
    gl.uniform1i(gl.getUniformLocation(this.pPressure, 'u_pressure'), 0);
    gl.uniform1i(gl.getUniformLocation(this.pPressure, 'u_divergence'), 1);
    gl.uniform2f(gl.getUniformLocation(this.pPressure, 'u_texelSize'), tx, ty);
    for (let i = 0; i < 18; i++) {
      this.bindTex(0, this.pressure.read.texture);
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    // 8. Gradient Subtraction
    gl.useProgram(this.pGradSub);
    this.bindTex(0, this.pressure.read.texture);
    this.bindTex(1, this.velocity.read.texture);
    gl.uniform1i(gl.getUniformLocation(this.pGradSub, 'u_pressure'), 0);
    gl.uniform1i(gl.getUniformLocation(this.pGradSub, 'u_velocity'), 1);
    gl.uniform2f(gl.getUniformLocation(this.pGradSub, 'u_texelSize'), tx, ty);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // 9. Advect Velocity & High-Res Temperature/Smoke using exact world aspect scale!
    gl.useProgram(this.pAdvect);
    this.bindTex(0, this.velocity.read.texture);
    this.bindTex(1, this.velocity.read.texture);
    gl.uniform1i(gl.getUniformLocation(this.pAdvect, 'u_velocity'), 0);
    gl.uniform1i(gl.getUniformLocation(this.pAdvect, 'u_source'), 1);
    gl.uniform2f(
      gl.getUniformLocation(this.pAdvect, 'u_worldScale'),
      1.0 / FLUID_WORLD_W,
      1.0 / FLUID_WORLD_H
    );
    gl.uniform1f(gl.getUniformLocation(this.pAdvect, 'u_dt'), clampedDt);
    gl.uniform1f(gl.getUniformLocation(this.pAdvect, 'u_dissipation'), 0.52);
    gl.uniform1f(gl.getUniformLocation(this.pAdvect, 'u_isTemp'), 0.0);
    this.blit(this.velocity.write);
    this.velocity.swap();

    this.bindTex(0, this.velocity.read.texture);
    this.bindTex(1, this.temp.read.texture);
    gl.uniform1f(gl.getUniformLocation(this.pAdvect, 'u_dissipation'), 2.35 - activity * 0.35);
    gl.uniform1f(gl.getUniformLocation(this.pAdvect, 'u_isTemp'), 1.0);
    this.blit(this.temp.write);
    this.temp.swap();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
  }

  public dispose() {
    const gl = this.gl;
    const delFbo = (f: FBO) => {
      gl.deleteTexture(f.texture);
      gl.deleteFramebuffer(f.fbo);
    };
    delFbo(this.velocity.read);
    delFbo(this.velocity.write);
    delFbo(this.temp.read);
    delFbo(this.temp.write);
    delFbo(this.pressure.read);
    delFbo(this.pressure.write);
    delFbo(this.curl);
    delFbo(this.divergence);
    [
      this.pEmitTemp,
      this.pEmitVel,
      this.pBuoyancy,
      this.pCurl,
      this.pVorticity,
      this.pDivergence,
      this.pPressure,
      this.pGradSub,
      this.pAdvect,
      this.pClear,
    ].forEach((p) => gl.deleteProgram(p));
    if (this.quadBuf) gl.deleteBuffer(this.quadBuf);
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);
  }
}
