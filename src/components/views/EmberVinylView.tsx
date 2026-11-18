import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import {
  SharedViewProps,
  cleanDisplayTitle,
  formatTime,
  formatDelta,
  getBestCoverUrl,
} from '../../utils/viewCatalog';
import {
  WebGLFireFluid,
  FLUID_WORLD_MIN_X,
  FLUID_WORLD_W,
  FLUID_WORLD_MIN_Y,
  FLUID_WORLD_H,
} from '../../utils/webglFireFluid';
import { useDiscScrub } from '../../hooks/useDiscScrub';
import { sound } from '../../utils/soundEffects';

const EMBER_VS_GL2 = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const EMBER_FS_GL2 = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_coverTex;
uniform sampler2D u_prevCoverTex;
uniform sampler2D u_fireTex;
uniform sampler2D u_metalBaseTex;
uniform sampler2D u_metalNormalTex;
uniform sampler2D u_metalOrmTex;
uniform float u_hasCover;
uniform float u_hasPrevCover;
uniform float u_hasMetalPBR;
uniform float u_burnSweep; // < 0 when idle, 0.0 -> 1.0 sweeping bottom-left to top-right on song change!
uniform vec2 u_resolution;
uniform float u_angle;
uniform float u_time;
uniform float u_flameProg; // 0.0 -> 1.0: flame ignites at bottom-left corner & spreads to burnEdge!
uniform float u_lavaHeat;  // 0.0 -> 1.0: delayed behind u_flameProg so molten lava appears AFTER the flame!
uniform float u_fireBoost;
uniform vec2 u_mouse;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.03;
    a *= 0.48;
  }
  return v;
}

// Voronoi cellular crack distance (d2 - d1) for photorealistic branching volcanic lava fissures!
float voronoiCrack(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return sqrt(d2) - sqrt(d1);
}

// Volcanic blackbody lava color ramp: dark cooled crust -> cherry magma -> molten orange -> white-gold core
vec3 lavaColor(float heat) {
  heat = clamp(heat, 0.0, 1.4);
  vec3 c0 = vec3(0.0);
  vec3 c1 = vec3(0.85, 0.04, 0.003);   // deep volcanic cherry red
  vec3 c2 = vec3(2.10, 0.36, 0.012);   // blazing molten lava orange
  vec3 c3 = vec3(3.10, 1.35, 0.14);    // superheated golden magma
  vec3 c4 = vec3(3.60, 2.75, 1.25);    // incandescent white-hot molten core
  if (heat < 0.30) return mix(c0, c1, heat / 0.30);
  if (heat < 0.68) return mix(c1, c2, (heat - 0.30) / 0.38);
  if (heat < 1.05) return mix(c2, c3, (heat - 0.68) / 0.37);
  return mix(c3, c4, clamp((heat - 1.05) / 0.35, 0.0, 1.0));
}

vec3 acesFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// Pure Mirror-Chrome Studio Environment — razor-crisp dark/white architectural chrome horizon bands!
vec3 sampleChromeStudioEnv(vec3 R, vec2 worldUv) {
  float diag   = R.x * 0.72 + R.y * 0.69 + worldUv.x * 0.50 + worldUv.y * 0.42 - u_mouse.x * 0.22 + u_mouse.y * 0.12;
  float crossD = -R.x * 0.69 + R.y * 0.72 - worldUv.x * 0.28 + worldUv.y * 0.34;

  // Ultra-crisp dark-light-dark mirror chrome reflection bands (liquid mercury / polished chrome look!)
  float mainSoftbox    = exp(-pow((diag - 0.16) * 5.2, 2.0));
  float razorHighlight = exp(-pow((diag - 0.20) * 18.0, 2.0));
  float secondStrip    = exp(-pow((diag + 0.30) * 7.2, 2.0)) * 0.68;
  float topRimLight    = exp(-pow((R.y - 0.20 + worldUv.y * 0.28) * 6.8, 2.0)) * 0.52;
  float darkBaffle     = exp(-pow((diag + 0.02) * 7.5, 2.0));

  vec3 col = vec3(0.022, 0.026, 0.034);
  col += vec3(0.16, 0.19, 0.24) * smoothstep(-0.48, 0.52, crossD);
  col *= (1.0 - darkBaffle * 0.84);
  col += vec3(0.96, 0.99, 1.05) * mainSoftbox * 1.26;
  col += vec3(1.38, 1.44, 1.54) * razorHighlight * 0.92;
  col += vec3(0.82, 0.88, 0.98) * secondStrip;
  col += vec3(0.84, 0.90, 1.00) * topRimLight;
  return col;
}

float D_GGX(float NdotH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float d = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
  return a2 / max(0.0001, 3.14159265 * d * d);
}

// Full-widescreen Navier-Stokes fluid sampling (X in [-1.05, +0.95], Y in [-0.62, +0.62] -> ZERO cutoff!)
vec4 sampleFluid(vec2 worldUv) {
  vec2 fuv = vec2((worldUv.x + 1.05) / 2.0, (worldUv.y + 0.62) / 1.24);
  if (fuv.x < 0.004 || fuv.x > 0.996 || fuv.y < 0.004 || fuv.y > 0.996) {
    return vec4(0.0);
  }
  float edgeFade = smoothstep(0.004, 0.045, fuv.x) * smoothstep(0.996, 0.955, fuv.x)
                 * smoothstep(0.004, 0.045, fuv.y) * smoothstep(0.996, 0.955, fuv.y);
  return texture(u_fireTex, fuv) * edgeFade;
}

// Rich fiery blackbody flame ramp (saturated molten orange-gold cores without chalky opaque white wash!)
vec3 blackbodyFluidFlame(float temp) {
  float t = clamp(temp, 0.0, 1.8);
  vec3 c0 = vec3(0.0);
  vec3 c1 = vec3(0.62, 0.045, 0.003);  // translucent crimson wisps
  vec3 c2 = vec3(1.10, 0.26, 0.010);   // vibrant fiery tangerine-orange
  vec3 c3 = vec3(1.35, 0.68, 0.065);   // luminous solar gold
  vec3 c4 = vec3(1.55, 1.15, 0.38);    // hot golden-amber heart
  if (t < 0.24) return mix(c0, c1, t / 0.24);
  if (t < 0.65) return mix(c1, c2, (t - 0.24) / 0.41);
  if (t < 1.18) return mix(c2, c3, (t - 0.65) / 0.53);
  return mix(c3, c4, clamp((t - 1.18) / 0.62, 0.0, 1.0));
}

// Pure Liquid Mirror-Chrome Shader (ZERO texture noise — razor-sharp studio bands + crystal-clear live flame mirror!)
vec3 shadeMirrorChromePBR(
  vec3 N,
  vec3 V,
  vec2 worldUv,
  vec3 L_key,
  vec3 L_fire,
  vec3 fireRadiance,
  vec3 baseF0,
  float roughness,
  float ao
) {
  float NdotV = max(dot(N, V), 0.04);

  // 1. Razor-crisp Studio Specular
  vec3 H1 = normalize(V + L_key);
  float NdotL1 = max(dot(N, L_key), 0.0);
  float NdotH1 = max(dot(N, H1), 0.0);
  float VdotH1 = max(dot(V, H1), 0.0);
  vec3 F1 = baseF0 + (1.0 - baseF0) * pow(1.0 - VdotH1, 5.0);
  float D1 = D_GGX(NdotH1, roughness);
  float k = (roughness + 1.0) * (roughness + 1.0) * 0.125;
  float G1 = (NdotV / (NdotV * (1.0 - k) + k)) * (NdotL1 / (NdotL1 * (1.0 - k) + k));
  vec3 specKey = (D1 * G1 * F1) / max(0.06, 4.0 * NdotV * NdotL1 + 0.04);

  // 2. Smooth Mirror Reflection Vector R -> crisp studio horizon + LIVE mirror reflection of the flames!
  vec3 R = reflect(-V, N);
  vec3 envChrome = sampleChromeStudioEnv(R, worldUv);

  // Sharp multi-distance live flame mirror reflection gliding across the chrome!
  vec4 reflFire1 = sampleFluid(worldUv + R.xy * 0.18 - vec2(0.04, 0.0));
  vec4 reflFire2 = sampleFluid(worldUv + R.xy * 0.36 - vec2(0.11, 0.0));
  vec4 reflFire3 = sampleFluid(worldUv + R.xy * 0.56 - vec2(0.19, 0.0));
  vec3 liveFireRefl = blackbodyFluidFlame(reflFire1.r * 1.18 + reflFire2.r * 0.76 + reflFire3.r * 0.42)
    * (0.62 + 0.78 * smoothstep(-0.25, 0.65, -R.x));

  vec3 F_env = baseF0 + (1.0 - baseF0) * pow(1.0 - NdotV, 5.0);
  vec3 envCol = F_env * (envChrome * 1.02 + liveFireRefl * 1.18);

  vec3 keyCol = vec3(0.96, 0.99, 1.04) * specKey * NdotL1 * 0.65 + envCol;

  // 3. Sharp Fiery Specular Reflection from Left Flames
  vec3 H2 = normalize(V + L_fire);
  float NdotL2 = max(dot(N, L_fire), 0.0);
  float NdotH2 = max(dot(N, H2), 0.0);
  float VdotH2 = max(dot(V, H2), 0.0);
  vec3 F2 = baseF0 + (1.0 - baseF0) * pow(1.0 - VdotH2, 5.0);
  float D2 = D_GGX(NdotH2, clamp(roughness * 1.8, 0.08, 0.36));
  vec3 specFire = D2 * F2 * 0.40;
  vec3 fireCol = fireRadiance * (specFire * NdotL2 + baseF0 * 0.12 * NdotL2);

  return (keyCol + fireCol) * ao;
}

float burnEdgeX(float y) {
  float curve = -0.215 + 0.44 * (y + 0.04) * (y + 0.04) + 0.08 * y;
  float jag1 = (fbm(vec2(y * 10.5 + 1.7, 3.4)) - 0.5) * 0.072;
  float crag = (abs(fract(y * 19.0 + jag1 * 6.0) - 0.5) - 0.25) * 0.032;
  float micro = (noise(vec2(y * 58.0, 8.2)) - 0.5) * 0.012;
  return curve + jag1 + crag + micro;
}

vec3 renderEmberSparks(vec2 uv, float t, float activity) {
  vec3 sparks = vec3(0.0);
  float spine = -0.25 - 0.05 * max(0.0, uv.y);

  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 18.0 : 28.0;
    float speed = layer == 0 ? 0.34 : 0.48;
    vec2 p = vec2(uv.x - spine, uv.y - t * speed);
    p.x += sin(uv.y * 7.5 - t * 2.4 + float(layer) * 3.1) * 0.032;

    vec2 cell = floor(p * scale);
    vec2 f = fract(p * scale);
    vec2 rnd = hash22(cell + float(layer) * 41.7);

    if (rnd.x > 0.70) {
      vec2 dotPos = vec2(0.2 + rnd.x * 0.6, 0.2 + rnd.y * 0.6);
      float d = length(f - dotPos);
      float radius = mix(0.032, 0.072, rnd.y);
      float glow = smoothstep(radius, 0.0, d);
      float twinkle = 0.5 + 0.5 * sin(t * (7.0 + rnd.x * 9.0) + rnd.y * 30.0);
      float mask = exp(-abs(uv.x - spine) * 5.2) * smoothstep(-0.22, 0.14, uv.y) * (1.0 - smoothstep(0.36, 0.56, uv.y));
      sparks += vec3(1.15, 0.58, 0.12) * glow * twinkle * mask * activity * 1.15;
    }
  }
  return sparks;
}

void main() {
  float minDim = min(u_resolution.x, u_resolution.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / minDim;
  uv.y -= 0.025;

  float aa = 1.35 / minDim;
  // Sequenced thermal phases:
  //   1) u_flameProg (0 -> 1): fire ignites at bottom-left corner & spreads right/up to full burnEdge
  //   2) u_lavaHeat  (0 -> 1): appears AFTER the flame arrives, melting the left hammered gold into glowing lava!
  float fireActivity = u_flameProg * (1.0 + 0.36 * u_fireBoost);
  float lavaActivity = u_lavaHeat * (1.0 + 0.28 * u_fireBoost);

  // Sample LIVE Full-Widescreen Navier-Stokes Fluid Fire + 5-Tap Dynamic Metal Glow Bloom!
  vec4 fluid = sampleFluid(uv);
  float fluidBloom =
    sampleFluid(uv + vec2(-0.04, 0.0)).r * 0.28 +
    sampleFluid(uv + vec2(-0.09, 0.02)).r * 0.24 +
    sampleFluid(uv + vec2(-0.14, 0.04)).r * 0.18 +
    sampleFluid(uv + vec2(-0.04, -0.05)).r * 0.15 +
    sampleFluid(uv + vec2(-0.04, 0.06)).r * 0.15;

  float flicker = 0.84 + 0.16 * sin(u_time * 11.0 + uv.y * 14.0) * cos(u_time * 6.5) + fluidBloom * 0.45;

  vec3 V = normalize(vec3(-uv.x * 0.28, -uv.y * 0.28, 1.0));
  vec3 L_key = normalize(vec3(0.46 + u_mouse.x * 0.22, 0.58 - u_mouse.y * 0.14, 0.72));
  // Fire light center tracks the creeping flame from bottom-left corner (-0.35,-0.35) to full burn position (-0.26,0.02)!
  vec3 firePos = vec3(mix(-0.35, -0.26, u_flameProg), mix(-0.34, 0.02, u_flameProg), 0.16);
  vec3 toFire = firePos - vec3(uv, 0.0);
  float fireDist = length(toFire);
  vec3 L_fire = toFire / max(0.001, fireDist);
  float liveLight = max(fireActivity, fluidBloom * 0.92);
  vec3 fireRadiance = vec3(1.65, 0.52, 0.05) * (0.42 / (fireDist * fireDist + 0.07)) * liveLight * flicker;

  // 1. Deep Obsidian Matte Charcoal Studio Backdrop
  float bgGrain = (noise(uv * 240.0) - 0.5) * 0.018 + (noise(uv * 48.0) - 0.5) * 0.012;
  float bgVig = 1.0 - 0.34 * length(uv);
  vec3 col = vec3(0.026, 0.024, 0.023) * bgVig + bgGrain;

  float halfBox = 0.355;
  vec2 boxD = abs(uv) - vec2(halfBox);
  float boxSdf = max(boxD.x, boxD.y);
  float inBox = 1.0 - smoothstep(-aa, aa, boxSdf);

  float shD = max(max(abs(uv.x - 0.016) - halfBox, abs(uv.y + 0.020) - halfBox), 0.0);
  float boxShadow = 1.0 - smoothstep(0.0, 0.068, shD);
  col *= (1.0 - boxShadow * 0.72);

  // 2. GLOSSY PICTURE-VINYL RECORD (centered vertically inside the metal sleeve, peeking cleanly out the right edge!)
  vec2 discCenter = vec2(0.026, 0.0);
  vec2 dUv = uv - discCenter;
  float r = length(dUv);
  float outerR = 0.344;
  float labelR = 0.106;
  float holeR = 0.013;
  float discMask = 1.0 - smoothstep(outerR - aa, outerR + aa, r);

  float theta = atan(dUv.y, dUv.x);
  float rotTheta = theta + u_angle;
  float ca = cos(u_angle);
  float sa = sin(u_angle);
  vec2 rotUv = vec2(dUv.x * ca - dUv.y * sa, dUv.x * sa + dUv.y * ca);
  vec2 texUv = (rotUv / (outerR * 2.0)) + 0.5;
  texUv.y = 1.0 - texUv.y;

  float grooveWave = sin(r * 1650.0) * 0.55 + sin(r * 3300.0 + noise(vec2(r * 220.0, rotTheta * 3.0)) * 3.0) * 0.30;
  float radialScratch = (noise(vec2(r * 460.0, rotTheta * 22.0)) - 0.5) * 0.34;
  float trackDiv =
    exp(-pow((r - 0.175) * 320.0, 2.0)) +
    exp(-pow((r - 0.248) * 320.0, 2.0)) +
    exp(-pow((r - 0.308) * 320.0, 2.0));

  vec2 radDir = dUv / max(0.0001, r);
  vec2 tanDir = vec2(-radDir.y, radDir.x);

  // Diagonal burning cover-art transition wave (bottom-left flame -> sweeps across disc -> vanishes into air top-right!)
  float sweepActive = step(0.0, u_burnSweep) * (1.0 - step(0.995, u_burnSweep));
  float diagCoord = (dUv.x * 0.78 + dUv.y * 0.62) / (outerR * 1.95) + 0.52;
  float sweepJag = (fbm(dUv * 16.0 + vec2(u_time * 0.35, 2.3)) - 0.5) * 0.14
                 + (noise(dUv * 48.0) - 0.5) * 0.04;
  float frontPos = mix(-0.16, 1.24, max(0.0, u_burnSweep));
  // sweepSdf > 0 => ahead of fire (still OLD cover art); sweepSdf < 0 => burned away (NEW cover art revealed!)
  float sweepSdf = (diagCoord + sweepJag) - frontPos;
  float newArtMask = sweepActive > 0.5 && u_hasPrevCover > 0.5
    ? (1.0 - smoothstep(-0.022, 0.022, sweepSdf))
    : 1.0;

  vec3 coverRgb = vec3(0.5);
  float coverLuma = 0.5;
  float etchBump = 0.0;
  float etchRough = 0.0;
  if (u_hasCover > 0.5 && r < outerR) {
    float e = 0.0045;
    vec3 newRgb = texture(u_coverTex, texUv).rgb;
    vec3 oldRgb = u_hasPrevCover > 0.5 ? texture(u_prevCoverTex, texUv).rgb : newRgb;
    coverRgb = mix(oldRgb, newRgb, newArtMask);
    coverLuma = dot(coverRgb, vec3(0.299, 0.587, 0.114));

    // Blend Sobel engraved micro-relief seamlessly across the burning cover transition!
    float lRn = dot(texture(u_coverTex, texUv + vec2(e, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float lLn = dot(texture(u_coverTex, texUv - vec2(e, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float lUn = dot(texture(u_coverTex, texUv + vec2(0.0, e)).rgb, vec3(0.299, 0.587, 0.114));
    float lDn = dot(texture(u_coverTex, texUv - vec2(0.0, e)).rgb, vec3(0.299, 0.587, 0.114));
    float bumpNew = ((lRn - lLn) + (lUn - lDn)) * 1.35;

    float bumpOld = bumpNew;
    if (sweepActive > 0.5 && u_hasPrevCover > 0.5 && newArtMask < 0.99) {
      float lRo = dot(texture(u_prevCoverTex, texUv + vec2(e, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
      float lLo = dot(texture(u_prevCoverTex, texUv - vec2(e, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
      float lUo = dot(texture(u_prevCoverTex, texUv + vec2(0.0, e)).rgb, vec3(0.299, 0.587, 0.114));
      float lDo = dot(texture(u_prevCoverTex, texUv - vec2(0.0, e)).rgb, vec3(0.299, 0.587, 0.114));
      bumpOld = ((lRo - lLo) + (lUo - lDo)) * 1.35;
    }
    etchBump = clamp(mix(bumpOld, bumpNew, newArtMask), -0.36, 0.36);
    etchRough = (0.5 - coverLuma) * 0.22;
  }

  // CLEAN GLOSSY PICTURE-VINYL DISC (crisp, untextured song cover art + delicate authentic vinyl grooves & fire light!)
  vec3 CHROME_F0 = vec3(0.92, 0.95, 0.98);
  vec3 vinylCol = vec3(0.055, 0.058, 0.064);
  float lightAng = 2.32 + u_mouse.x * 0.24;
  float anisoCone = pow(abs(cos(theta - lightAng)), 3.8) * 0.34 + pow(abs(cos(theta - lightAng)), 16.0) * 0.28;
  float vinylAO = 1.0 - clamp(trackDiv, 0.0, 1.0) * 0.26;

  if (u_hasCover > 0.5 && r < outerR) {
    // Pure, crisp, untextured album cover art — zero brushed-metal overlay or monochrome wash!
    vec3 artBase = coverRgb;
    // Subtle glossy vinyl groove light-catch & warm fire-light bounce on the left edge
    float grooveSheen = (0.5 + 0.5 * grooveWave) * anisoCone;
    float fireProxDisc = exp(-max(0.0, dUv.x + 0.26) * 4.4) * liveLight;
    vinylCol = artBase * (0.86 + 0.14 * max(0.0, dot(vec3(radDir * grooveWave * 0.06, 1.0), L_key))) * vinylAO;
    vinylCol += vec3(0.16, 0.17, 0.19) * grooveSheen * 0.55;
    vinylCol += artBase * vec3(1.15, 0.48, 0.10) * fireProxDisc * 0.42 + fireRadiance * 0.08 * anisoCone;
  } else {
    // Fallback sleek black gloss vinyl when no cover art is loaded
    vec3 N_vinyl = normalize(vec3(radDir * grooveWave * 0.16, 1.0));
    vinylCol = shadeMirrorChromePBR(N_vinyl, V, uv, L_key, L_fire, fireRadiance, vec3(0.09, 0.095, 0.105), 0.18, vinylAO);
    vinylCol += vec3(0.16, 0.18, 0.20) * (grooveWave * 0.5 + 0.5) * anisoCone;
  }

  float outerRim = exp(-pow((r - (outerR - 0.0028)) * 360.0, 2.0));
  vinylCol += vec3(0.75, 0.80, 0.88) * outerRim * (0.45 + 0.65 * max(0.0, dot(radDir, L_key.xy)));

  // Clean Center Label Ring + Chrome Spindle Bevel
  float labelGroove = exp(-pow((r - labelR) * 360.0, 2.0));
  float labelChamfer = exp(-pow((r - (labelR - 0.0045)) * 380.0, 2.0));
  vinylCol = mix(vinylCol, vec3(0.02), labelGroove * 0.68);
  vinylCol += vec3(0.55, 0.60, 0.68) * labelChamfer * (0.38 + 0.48 * max(0.0, dot(radDir, L_key.xy)));

  float holeChamfer = exp(-pow((r - (holeR + 0.0025)) * 420.0, 2.0));
  float holeMask = 1.0 - smoothstep(holeR - aa, holeR + aa, r);
  vinylCol += vec3(0.76, 0.80, 0.88) * holeChamfer;
  vinylCol = mix(vinylCol, vec3(0.01), holeMask);

  // Sizzling molten burn line + charred carbon leading edge sweeping diagonally across the vinyl disc!
  if (sweepActive > 0.5 && discMask > 0.001) {
    float sweepEnv = smoothstep(0.0, 0.06, u_burnSweep) * (1.0 - smoothstep(0.84, 0.99, u_burnSweep));
    // Narrow blackened scorch band right ahead of the fire front as the old cover art chars!
    float charLead = exp(-pow((sweepSdf - 0.022) * 38.0, 2.0)) * sweepEnv;
    // Blazing incandescent molten-lava burning seam right on sweepSdf == 0!
    float burnLine = exp(-pow(sweepSdf * 48.0, 2.0)) * sweepEnv;
    // Warm trailing glowing embers cooling behind the fire front onto the newly revealed cover art!
    float trailEmber = exp(-max(0.0, -sweepSdf) * 14.0) * smoothstep(0.02, -0.01, sweepSdf) * sweepEnv;
    float crackle = 0.65 + 0.55 * noise(dUv * 45.0 + vec2(u_time * 4.5, -u_time * 6.0));
    vinylCol *= (1.0 - charLead * 0.82);
    vinylCol += lavaColor((burnLine * 1.35 + trailEmber * 0.55) * crackle) * (1.0 - holeMask);
  }

  if (discMask > 0.001 && inBox < 0.5 && uv.x > halfBox - aa) {
    float rightEdgeAO = smoothstep(halfBox, halfBox + 0.020, uv.x);
    col = mix(col, vinylCol * (0.34 + 0.62 * rightEdgeAO), discMask);
  }

  // 3. POLIIGON #7174 MATTE BRUSHED METAL SLEEVE + RAZOR-SHARP FRACTURED EDGES + INTENSE MOLTEN GLOW!
  float bEdge = burnEdgeX(uv.y);
  float distFromBurn = uv.x - bEdge;

  float j1 = (fbm(uv * 15.0 + vec2(2.4, 5.1)) - 0.5) * 0.038;
  float angularShard = (abs(fract(uv.x * 16.0 + j1 * 7.0) - 0.5) - 0.25) * 0.028;
  float microCrack = (noise(uv * 68.0) - 0.5) * 0.008;
  float peelY = 0.072 + 0.72 * min(0.0, uv.x) - 0.14 * max(0.0, uv.x);
  float peelSdf = (uv.y - peelY) + j1 + angularShard + microCrack;

  float sleeveMask = smoothstep(-aa, aa, peelSdf);
  float exposeVinyl = (1.0 - sleeveMask) * discMask;

  if (inBox > 0.001) {
    // SLEEK MIRROR-CHROME SLEEVE WITH SUBTLE BRUSHED-STEEL MICRO-TEXTURE (Poliigon #7174 + fine hairlines!)
    vec2 sMetalUv = uv * 1.45 + 0.5;
    vec3 sPbrBase = u_hasMetalPBR > 0.5 ? texture(u_metalBaseTex, sMetalUv).rgb : vec3(0.84, 0.87, 0.92);
    vec3 sPbrNorm = u_hasMetalPBR > 0.5 ? (texture(u_metalNormalTex, sMetalUv).xyz * 2.0 - 1.0) : vec3(0.0, 0.0, 1.0);
    vec3 sPbrOrm  = u_hasMetalPBR > 0.5 ? texture(u_metalOrmTex, sMetalUv).rgb : vec3(1.0, 0.16, 1.0);

    // Subtle fine brushed-chrome grain so reflections stay sharp & mirror-like with realistic metallic tactile texture
    float fineBrush = (noise(vec2(uv.x * 16.0, uv.y * 620.0)) - 0.5) * 0.65
                    + (noise(vec2(uv.x * 38.0 + 3.1, uv.y * 1240.0)) - 0.5) * 0.35;
    float sheetX = (fbm(uv * 2.8 + vec2(1.1, 2.3)) - 0.5) * 0.10;
    float sheetY = (fbm(uv * 2.8 + vec2(4.7, 0.9)) - 0.5) * 0.10;
    float h0 = clamp(0.68 + (dot(sPbrBase, vec3(0.333)) - 0.5) * 0.25 + fineBrush * 0.12, 0.0, 1.0);

    float embossSlope = -2.0 * (r - outerR) * 85.0 * exp(-pow((r - outerR) * 85.0, 2.0)) * 0.30;
    float fractureLift = exp(-max(0.0, peelSdf) * 140.0) * sleeveMask;
    vec2 tearGrad = normalize(vec2(-0.45, 1.0)) * fractureLift * 0.66;

    vec3 N_sleeve = normalize(vec3(
      sheetX + sPbrNorm.x * 0.16 + radDir.x * embossSlope + tearGrad.x,
      sheetY + sPbrNorm.y * 0.20 + fineBrush * 0.09 + radDir.y * embossSlope + tearGrad.y,
      1.0
    ));

    // Keep mirror chrome crisp & shiny, lightly kissed by brushed steel micro-grain & subtle roughness variation
    vec3 chromeBrushedF0 = mix(CHROME_F0, sPbrBase * 1.24, 0.22) * (0.95 + 0.10 * fineBrush);
    float sleeveRough = clamp(0.068 + sPbrOrm.g * 0.045 + abs(fineBrush) * 0.03, 0.06, 0.14);
    float sleeveToneAO = mix(1.0, sPbrOrm.r, 0.22) * clamp(0.88 + 0.18 * (uv.x * 0.45 + uv.y * 0.65 + 0.18), 0.72, 1.12);
    vec3 sleeveCol = shadeMirrorChromePBR(N_sleeve, V, uv, L_key, L_fire, fireRadiance, chromeBrushedF0, sleeveRough, sleeveToneAO);

    // Razor-crisp polished chrome outer edge bevels!
    float topRightBevel = smoothstep(halfBox - 0.0042, halfBox, max(uv.x, uv.y));
    float bottomEdgeBevel = smoothstep(halfBox - 0.0036, halfBox, -uv.y) * smoothstep(-halfBox, halfBox, uv.x);
    sleeveCol += vec3(0.95, 0.98, 1.05) * topRightBevel * (0.62 + 0.38 * clamp(uv.x + uv.y, 0.0, 1.0));
    sleeveCol += vec3(0.38, 0.42, 0.48) * bottomEdgeBevel * 0.55;

    vec3 surfaceCol = mix(sleeveCol, vinylCol, clamp(exposeVinyl, 0.0, 1.0));

    float sharpCutRim = exp(-pow((peelSdf - 0.0020) * 520.0, 2.0)) * sleeveMask;
    float sharpDropShadow = exp(-max(0.0, -peelSdf) * 115.0) * (1.0 - sleeveMask) * discMask;
    float contactCrevice = exp(-max(0.0, -peelSdf) * 420.0) * (1.0 - sleeveMask) * discMask;
    surfaceCol *= (1.0 - sharpDropShadow * 0.68) * (1.0 - contactCrevice * 0.58);
    surfaceCol += vec3(1.25, 1.30, 1.38) * sharpCutRim;

    float ash0 = fbm(uv * 32.0 + vec2(4.1, 1.9)) * 0.62 + noise(uv * 135.0) * 0.38;
    float ashX = fbm((uv + vec2(0.002, 0.0)) * 32.0 + vec2(4.1, 1.9)) * 0.62 + noise((uv + vec2(0.002, 0.0)) * 135.0) * 0.38;
    float ashY = fbm((uv + vec2(0.0, 0.002)) * 32.0 + vec2(4.1, 1.9)) * 0.62 + noise((uv + vec2(0.0, 0.002)) * 135.0) * 0.38;
    vec3 N_char = normalize(vec3(-(ashX - ash0) * 16.0, -(ashY - ash0) * 16.0, 1.0));
    float charFireDiff = max(dot(N_char, L_fire), 0.0);

    // =========================================================================
    // DELAYED VOLCANIC MOLTEN LAVA CRUST (appears AFTER the flame ignites & spreads from bottom-left!)
    // =========================================================================
    vec2 lavaWarp = vec2(fbm(uv * 11.0 + vec2(1.4, 3.2)), fbm(uv * 11.0 + vec2(6.7, 2.1))) - 0.5;
    float crackMacro = voronoiCrack(uv * 20.0 + lavaWarp * 1.45);
    float crackMicro = voronoiCrack(uv * 46.0 + lavaWarp * 1.85);

    // Lava spreads upward from the bottom-left corner right behind the creeping flame!
    float lavaHeightMask = 1.0 - smoothstep(mix(-0.36, 0.38, u_lavaHeat) - 0.14, mix(-0.36, 0.38, u_lavaHeat) + 0.04, uv.y);
    float burnProx = exp(-max(0.0, -distFromBurn) * 6.8);
    float leftEdgeFade = smoothstep(-halfBox, -halfBox + 0.025, uv.x);
    float breathe = 0.78 + 0.22 * sin(u_time * 2.6 + uv.y * 11.0 + ash0 * 7.0) + fluidBloom * 0.45;

    float macroWidth = mix(0.055, 0.22, burnProx);
    float microWidth = mix(0.035, 0.14, burnProx);
    float veinMacro = 1.0 - smoothstep(0.0, macroWidth, crackMacro);
    float veinMicro = 1.0 - smoothstep(0.0, microWidth, crackMicro);
    float magmaVeins = clamp(veinMacro * 1.15 + veinMicro * 0.72, 0.0, 1.35);

    float lavaHeat = (magmaVeins * (0.62 + 0.78 * burnProx) + burnProx * 0.36 * smoothstep(0.25, 0.85, ash0))
      * breathe * lavaActivity * lavaHeightMask * (0.45 + 0.55 * leftEdgeFade);

    vec3 crustBase = vec3(0.025, 0.016, 0.012) * (0.35 + 0.85 * ash0)
      + vec3(0.85, 0.26, 0.025) * (0.25 + 0.75 * burnProx + fluidBloom) * (0.14 + 0.86 * charFireDiff) * 0.42 * liveLight;
    vec3 charCol = crustBase + lavaColor(lavaHeat);

    // Hammered 24K gold stays 100% gleaming & intact until lavaHeat builds AFTER flame ignition!
    float burnPresence = smoothstep(0.0, 0.65, u_lavaHeat) * lavaHeightMask;
    float intactArea = smoothstep(-aa, aa, distFromBurn);
    float scorchZone = (1.0 - smoothstep(0.0, 0.075, distFromBurn)) * intactArea * burnPresence;
    vec3 burnedLeftCol = mix(surfaceCol, charCol, burnPresence);
    vec3 boxFinal = mix(burnedLeftCol, surfaceCol, intactArea);
    boxFinal = mix(boxFinal, crustBase * 1.05, scorchZone * (0.56 + 0.32 * ash0));

    // Creeping superheated hairline lava stress-cracks appear ONLY after lavaHeat warms up!
    float creepMask = exp(-max(0.0, distFromBurn) * 34.0) * intactArea * lavaHeightMask;
    float creepCracks = (1.0 - smoothstep(0.0, 0.085, crackMicro)) * creepMask;
    boxFinal += lavaColor(creepCracks * 1.15 * breathe * lavaActivity);

    // Molten burn rim + glowing heated gold conduction band + radiant live flame reflection!
    float burnSpan = smoothstep(-0.355, -0.24, uv.y) * smoothstep(0.355, 0.24, uv.y) * lavaHeightMask;
    float emberPulse = 0.76 + 0.24 * sin(u_time * 7.6 + uv.y * 32.0 + ash0 * 9.0) + fluidBloom * 0.60;
    float hotCracks = smoothstep(0.28, 0.76, ash0);

    float moltenRim = exp(-pow((distFromBurn - 0.001) * 125.0, 2.0)) * burnSpan;
    vec3 moltenEdgeGlow = vec3(3.20, 1.05, 0.14) * moltenRim * (0.68 + 0.72 * hotCracks) * emberPulse * lavaActivity;

    float heatedSteelBand = exp(-max(0.0, distFromBurn) * 16.5) * intactArea * burnSpan;
    vec3 heatedMetalGlow = vec3(1.85, 0.44, 0.03) * heatedSteelBand * (0.50 + 0.50 * h0) * emberPulse * lavaActivity;

    float metalWash = exp(-max(0.0, distFromBurn + 0.015) * 5.2) * intactArea;
    vec3 radiantMetalWash = vec3(1.45, 0.48, 0.045) * metalWash * (0.25 + 1.05 * fluidBloom) * (0.55 + 0.55 * h0) * liveLight;

    float burnHardShadow = exp(-max(0.0, distFromBurn) * 190.0) * intactArea * burnPresence;
    boxFinal *= (1.0 - burnHardShadow * 0.40);
    boxFinal += moltenEdgeGlow + heatedMetalGlow + radiantMetalWash;

    col = mix(col, boxFinal, inBox);
  }

  // 4. FULL-WIDESCREEN NAVIER-STOKES EULERIAN FLUID FIRE + SMOKE + EMBER SPARKS!
  float temp = fluid.r;
  float core = fluid.g;
  float smoke = fluid.b;

  float smokeAlpha = clamp(smoke * 0.42 * (1.0 - smoothstep(0.15, 0.55, temp)), 0.0, 0.48);
  col = mix(col, vec3(0.045, 0.032, 0.025), smokeAlpha);

  // Keep flame core rich fiery solar gold-orange rather than flat chalky white!
  float flameVis = smoothstep(0.06, 1.45, temp + core * 0.25);
  vec3 flameRGB = blackbodyFluidFlame(temp * 0.92 + core * 0.34);
  float flameAlpha = clamp(smoothstep(0.06, 0.72, temp) * 0.86, 0.0, 0.92);

  vec3 fluidHalo = vec3(1.10, 0.34, 0.028) * fluidBloom * 0.34;
  vec3 sparks = renderEmberSparks(uv, u_time, fireActivity);

  col += fluidHalo;
  col = mix(col, flameRGB * (1.02 + 0.28 * flameVis), flameAlpha * 0.84)
      + flameRGB * flameVis * 0.42
      + sparks;

  col = acesFilm(col * 1.06);
  col = pow(col, vec3(0.95));

  outColor = vec4(col, 1.0);
}
`;

function compileShaderGL2(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('Ember GL2 shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgramGL2(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compileShaderGL2(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShaderGL2(gl, gl.FRAGMENT_SHADER, fsSrc);
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
    console.warn('Ember GL2 link error:', gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

export const EmberVinylView: React.FC<SharedViewProps> = ({
  tracks,
  activeIndex,
  isPlaying,
  currentTime,
  duration,
  onSelectTrack,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onSetPlaybackRate,
}) => {
  const activeTrack = tracks[activeIndex] || tracks[0];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouseRef = useRef({ x: 0, y: 0 });
  const fluidMouseRef = useRef({ u: -10, v: -10, vx: 0, vy: 0 });
  const angleRadRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const flameProgRef = useRef(isPlaying ? 1 : 0);
  const lavaHeatRef = useRef(isPlaying ? 1 : 0);
  const fireBoostRef = useRef(0);

  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const coverTexRef = useRef<WebGLTexture | null>(null);
  const prevCoverTexRef = useRef<WebGLTexture | null>(null);
  const lastCoverCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasCoverRef = useRef(0);
  const hasPrevCoverRef = useRef(0);
  const burnSweepRef = useRef(-1); // < 0 = idle, 0..1 = active bottom-left -> top-right cover burn transition!

  const [upNextOffset, setUpNextOffset] = useState(0);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    setUpNextOffset(0);
  }, [activeIndex, tracks.length]);

  const { containerRef, isScrubbing, scrubTime, scrubDelta, intensityBadge, handlers } =
    useDiscScrub({
      isPlaying,
      currentTime,
      duration,
      baseSpeed: 0.44,
      onTogglePlay,
      onSeek,
      onSetPlaybackRate,
      onFrame: (deg, speed) => {
        angleRadRef.current = (deg * Math.PI) / 180;
        const targetBoost = Math.min(1, Math.abs(speed) * 0.45);
        fireBoostRef.current += (targetBoost - fireBoostRef.current) * 0.08;
      },
    });

  useEffect(() => {
    if (!activeTrack) return;
    let cancelled = false;

    const load = (url: string, fallback: boolean) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        if (activeTrack.youtubeId && img.naturalWidth <= 120 && fallback) {
          load(`https://i.ytimg.com/vi/${activeTrack.youtubeId}/mqdefault.jpg`, false);
          return;
        }
        const gl = glRef.current;
        const tex = coverTexRef.current;
        if (!gl || !tex) return;

        const sq = document.createElement('canvas');
        sq.width = 512;
        sq.height = 512;
        const ctx = sq.getContext('2d');
        if (!ctx) return;
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        const aspect = nw / nh;
        const crop =
          activeTrack.youtubeId && aspect > 1.25 && aspect < 1.48 ? nh * 0.72 : Math.min(nw, nh);
        ctx.drawImage(img, (nw - crop) / 2, (nh - crop) / 2, crop, crop, 0, 0, 512, 512);

        try {
          const prevTex = prevCoverTexRef.current;
          // If a previous song's cover art was already on the disc, snapshot it to u_prevCoverTex
          // and trigger the bottom-left -> top-right burning cover transition!
          if (prevTex && lastCoverCanvasRef.current) {
            gl.bindTexture(gl.TEXTURE_2D, prevTex);
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGBA,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              lastCoverCanvasRef.current
            );
            hasPrevCoverRef.current = 1;
            burnSweepRef.current = 0.0;
          }

          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sq);
          lastCoverCanvasRef.current = sq;
          hasCoverRef.current = 1;
        } catch {
          hasCoverRef.current = 0;
        }
      };
      img.onerror = () => {
        if (!cancelled && activeTrack.youtubeId && fallback) {
          load(`https://i.ytimg.com/vi/${activeTrack.youtubeId}/mqdefault.jpg`, false);
        }
      };
      img.src = url;
    };

    load(getBestCoverUrl(activeTrack), true);
    return () => {
      cancelled = true;
    };
  }, [activeTrack]);

  // WebGL2 Full-Widescreen Navier-Stokes Fluid Fire + PBR Brushed Metal Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) return;
    glRef.current = gl;

    const fluidSim = new WebGLFireFluid(gl, isPlayingRef.current);
    const program = createProgramGL2(gl, EMBER_VS_GL2, EMBER_FS_GL2);
    if (!program) {
      fluidSim.dispose();
      return;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const createCoverTex = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([160, 160, 160, 255])
      );
      return t;
    };

    const tex = createCoverTex();
    const prevTex = createCoverTex();
    coverTexRef.current = tex;
    prevCoverTexRef.current = prevTex;

    // Load REAL Poliigon #7174 Matte Brushed Steel PBR Maps (BaseColor, Tangent Normal, ORM) with mipmaps + anisotropy!
    const anisoExt =
      gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    const maxAniso = anisoExt
      ? Math.min(8, gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4)
      : 1;

    let metalMapsLoaded = 0;
    let isDisposed = false;
    const createPbrTex = (url: string, fallbackRgb: [number, number, number]) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (anisoExt) {
        gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
      }
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([...fallbackRgb, 255])
      );
      gl.generateMipmap(gl.TEXTURE_2D);

      const img = new Image();
      img.onload = () => {
        if (isDisposed) return;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        metalMapsLoaded += 1;
      };
      img.src = url;
      return t;
    };

    const metalBaseTex = createPbrTex('/textures/poliigon-steel/basecolor.jpg', [156, 160, 165]);
    const metalNormalTex = createPbrTex('/textures/poliigon-steel/normal.png', [128, 128, 255]);
    const metalOrmTex = createPbrTex('/textures/poliigon-steel/orm.jpg', [255, 108, 255]);

    const uCoverTex = gl.getUniformLocation(program, 'u_coverTex');
    const uPrevCoverTex = gl.getUniformLocation(program, 'u_prevCoverTex');
    const uFireTex = gl.getUniformLocation(program, 'u_fireTex');
    const uMetalBaseTex = gl.getUniformLocation(program, 'u_metalBaseTex');
    const uMetalNormalTex = gl.getUniformLocation(program, 'u_metalNormalTex');
    const uMetalOrmTex = gl.getUniformLocation(program, 'u_metalOrmTex');
    const uHasCover = gl.getUniformLocation(program, 'u_hasCover');
    const uHasPrevCover = gl.getUniformLocation(program, 'u_hasPrevCover');
    const uHasMetalPBR = gl.getUniformLocation(program, 'u_hasMetalPBR');
    const uBurnSweep = gl.getUniformLocation(program, 'u_burnSweep');
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uAngle = gl.getUniformLocation(program, 'u_angle');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uFlameProg = gl.getUniformLocation(program, 'u_flameProg');
    const uLavaHeat = gl.getUniformLocation(program, 'u_lavaHeat');
    const uFireBoost = gl.getUniformLocation(program, 'u_fireBoost');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');

    let rafId = 0;
    const start = performance.now();
    let lastNow = start;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const render = (now: number) => {
      const dt = Math.min(0.033, Math.max(0.004, (now - lastNow) / 1000));
      lastNow = now;
      const tSec = (now - start) / 1000;

      resize();
      smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.06;
      smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.06;

      // Advance bottom-left -> top-right burning cover transition wave (~1.38s)
      let easedSweep = -1.0;
      if (burnSweepRef.current >= 0) {
        burnSweepRef.current += dt / 1.38;
        if (burnSweepRef.current >= 1.0) {
          burnSweepRef.current = -1.0;
          easedSweep = -1.0;
        } else {
          const s = burnSweepRef.current;
          easedSweep = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
        }
      }

      // Phase 1: Flame ignites at the bottom-left corner & spreads right/up into position (~1.35s on Play, dies faster on Pause)
      if (isPlayingRef.current) {
        flameProgRef.current = Math.min(1.0, flameProgRef.current + dt / 1.35);
      } else {
        flameProgRef.current = Math.max(0.0, flameProgRef.current - dt / 0.65);
      }
      const easedFlame =
        flameProgRef.current * flameProgRef.current * (3 - 2 * flameProgRef.current);

      // Phase 2: Molten lava appears ONLY AFTER the flame has arrived on the steel!
      const targetLava = isPlayingRef.current && flameProgRef.current > 0.36 ? 1.0 : 0.0;
      const lavaRate = targetLava > 0.5 ? 1.45 : 1.15;
      lavaHeatRef.current += (targetLava - lavaHeatRef.current) * (1 - Math.exp(-lavaRate * dt));
      if (lavaHeatRef.current < 0.002 && targetLava === 0) lavaHeatRef.current = 0;

      const activity = easedFlame * (1.06 + fireBoostRef.current * 0.42);
      const fm = fluidMouseRef.current;
      fluidSim.step(dt, tSec, activity, fm.u, fm.v, fm.vx, fm.vy, easedSweep, easedFlame);
      fm.vx *= 0.72;
      fm.vy *= 0.72;

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uCoverTex, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fluidSim.fireTexture);
      gl.uniform1i(uFireTex, 1);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, prevTex);
      gl.uniform1i(uPrevCoverTex, 2);

      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, metalBaseTex);
      gl.uniform1i(uMetalBaseTex, 3);

      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, metalNormalTex);
      gl.uniform1i(uMetalNormalTex, 4);

      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, metalOrmTex);
      gl.uniform1i(uMetalOrmTex, 5);

      gl.uniform1f(uHasCover, hasCoverRef.current);
      gl.uniform1f(uHasPrevCover, hasPrevCoverRef.current);
      gl.uniform1f(uHasMetalPBR, metalMapsLoaded >= 3 ? 1.0 : 0.0);
      gl.uniform1f(uBurnSweep, easedSweep);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uAngle, angleRadRef.current);
      gl.uniform1f(uTime, tSec);
      gl.uniform1f(uFlameProg, easedFlame);
      gl.uniform1f(uLavaHeat, lavaHeatRef.current);
      gl.uniform1f(uFireBoost, fireBoostRef.current);
      gl.uniform2f(uMouse, smoothMouseRef.current.x, smoothMouseRef.current.y);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      fluidSim.dispose();
      gl.deleteTexture(tex);
      gl.deleteTexture(prevTex);
      gl.deleteTexture(metalBaseTex);
      gl.deleteTexture(metalNormalTex);
      gl.deleteTexture(metalOrmTex);
      gl.deleteBuffer(quad);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      glRef.current = null;
      coverTexRef.current = null;
      prevCoverTexRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        sound.playSwitch();
        onTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        sound.playDiscSpin();
        onNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        sound.playDiscSpin();
        onPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onTogglePlay, onNext, onPrev]);

  const title = cleanDisplayTitle(activeTrack?.title || 'UNTITLED');
  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;

  const upcomingTracks =
    tracks.length > 1
      ? Array.from({ length: tracks.length - 1 }, (_, i) => {
          const idx = (activeIndex + 1 + i) % tracks.length;
          return { track: tracks[idx], index: idx };
        })
      : [];
  const maxOffset = Math.max(0, upcomingTracks.length - 2);
  const visibleUpcoming = upcomingTracks.slice(upNextOffset, upNextOffset + 2);

  return (
    <div
      onPointerMove={(e) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        mouseRef.current = {
          x: (e.clientX / w - 0.5) * 2,
          y: (e.clientY / h - 0.5) * 2,
        };
        // Map cursor into full-widescreen Navier-Stokes fluid domain [0, 1]^2 (ZERO left/top cutoff!)
        const minDim = Math.min(w, h);
        const worldX = (e.clientX - 0.5 * w) / minDim;
        const worldY = (0.5 * h - e.clientY) / minDim - 0.025;
        const nextU = (worldX - FLUID_WORLD_MIN_X) / FLUID_WORLD_W;
        const nextV = (worldY - FLUID_WORLD_MIN_Y) / FLUID_WORLD_H;
        const fm = fluidMouseRef.current;
        if (fm.u > -5) {
          // Compute world-space velocity so horizontal & vertical wind swipes feel equally responsive
          const dxWorld = (nextU - fm.u) * FLUID_WORLD_W;
          const dyWorld = (nextV - fm.v) * FLUID_WORLD_H;
          fm.vx = Math.max(-3.0, Math.min(3.0, dxWorld * 34));
          fm.vy = Math.max(-3.0, Math.min(3.0, dyWorld * 34));
        }
        fm.u = nextU;
        fm.v = nextV;
      }}
      className="relative w-full h-full bg-[#0b0a0a] overflow-hidden select-none flex items-center justify-center"
    >
      {/* Fullscreen WebGL2 Full-Widescreen Navier-Stokes Fluid Fire + PBR Brushed Metal Shader */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Interactive Circular Drag-to-Scrub Target Aligned Over the Exposed Steel Vinyl */}
      <div
        ref={containerRef}
        {...handlers}
        title="Click to Play/Pause • Hold & rotate steel vinyl to scrub • Swipe across flames for wind!"
        className={`relative z-10 w-[min(66vh,66vw)] h-[min(66vh,66vw)] -translate-y-[1.5vh] rounded-full touch-none ${
          isScrubbing ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      />

      {/* Bottom Translucent Obsidian-Ember Player Card (with Up Next Titles!) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(92vw,470px)] rounded-2xl bg-black/65 backdrop-blur-2xl border border-orange-500/25 text-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.82)] px-4 py-2.5">
        {/* Top Row: Transport Controls + Active Track Title + Time */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                sound.playDiscSpin();
                onPrev();
              }}
              className="p-1 text-white/60 hover:text-white transition-colors active:scale-90"
              title="Previous"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                sound.playSwitch();
                onTogglePlay();
              }}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ffb338] to-[#e0420c] text-black flex items-center justify-center hover:brightness-110 transition-all active:scale-90 shadow-[0_0_16px_rgba(255,110,20,0.45)]"
            >
              {isPlaying ? (
                <Pause className="w-3 h-3 fill-black" />
              ) : (
                <Play className="w-3 h-3 fill-black translate-x-[0.5px]" />
              )}
            </button>
            <button
              onClick={() => {
                sound.playDiscSpin();
                onNext();
              }}
              className="p-1 text-white/60 hover:text-white transition-colors active:scale-90"
              title="Next"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-3.5 w-px bg-white/15 shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white truncate">
              {title}
            </div>
          </div>

          <div className="font-mono text-[10px] tracking-wider tabular-nums text-white/55 shrink-0 flex items-center gap-2">
            <span>
              <span className="text-orange-300">{formatTime(displayTime)}</span>
              <span className="mx-1 opacity-40">/</span>
              <span>{formatTime(duration)}</span>
            </span>

            <AnimatePresence>
              {isScrubbing && (intensityBadge || Math.abs(scrubDelta) >= 0.5) && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[9.5px] text-amber-300 font-semibold tracking-wider shrink-0"
                >
                  {intensityBadge} {Math.abs(scrubDelta) >= 0.5 ? formatDelta(scrubDelta) : ''}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Row: Scrollable & Clickable Up Next Titles */}
        {visibleUpcoming.length > 0 && (
          <div
            onWheel={(e) => {
              if (maxOffset <= 0) return;
              e.preventDefault();
              setUpNextOffset((prev) =>
                Math.max(0, Math.min(maxOffset, prev + (e.deltaY > 0 ? 1 : -1)))
              );
            }}
            className="mt-2 pt-2 border-t border-orange-500/15 flex items-center gap-2"
            title="Click an upcoming track • Scroll to browse queue"
          >
            <span className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.16em] text-orange-400/75 shrink-0">
              UP NEXT
            </span>
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-1.5">
              {visibleUpcoming.map(({ track, index }) => (
                <button
                  key={`${track.id}-${index}`}
                  type="button"
                  onClick={() => {
                    sound.playDiscSpin();
                    onSelectTrack(index);
                  }}
                  className="group flex items-center gap-1.5 min-w-0 px-2 py-0.5 rounded-lg bg-white/[0.04] hover:bg-orange-500/20 border border-white/[0.07] hover:border-orange-400/40 text-left transition-colors"
                >
                  <span className="font-mono text-[8.5px] tabular-nums text-orange-300/75 group-hover:text-orange-200 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-white/75 group-hover:text-white truncate">
                    {cleanDisplayTitle(track.title)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
