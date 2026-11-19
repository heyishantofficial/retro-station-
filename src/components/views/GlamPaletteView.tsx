import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  ListMusic,
  MoreHorizontal,
} from 'lucide-react';
import {
  SharedViewProps,
  cleanDisplayTitle,
  formatTime,
  formatDelta,
  getBestCoverUrl,
} from '../../utils/viewCatalog';
import { useDiscScrub } from '../../hooks/useDiscScrub';
import { useViewportMode } from '../../hooks/useViewportMode';
import { sound } from '../../utils/soundEffects';

// ============================================================================
// REAL-TIME WEBGL2 HOLOGRAPHIC PRISM CD + HIGHLIGHTER GLITTER BRUSH TRANSITION
// Renders a spinning prismatic rainbow-rose CD with crisp song cover art,
// rotating etched 4-point sparkle, machined rose-gold hub, live glowing groove
// progress arc, AND a shimmering rose-gold & champagne makeup glitter brush
// sweep transition whenever tracks change!
// ============================================================================
const GLAM_CD_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const GLAM_CD_FS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_coverTex;
uniform sampler2D u_prevCoverTex;
uniform float u_hasCover;
uniform float u_hasPrevCover;
uniform float u_holoCover;    // 1.0 = cover-art rose hologram CD, 0.0 = pure prismatic rainbow chrome CD
uniform float u_glitterSweep; // < 0 idle, 0.0 -> 1.0 diagonal highlighter glitter brush sweep on song switch!
uniform vec2 u_resolution;
uniform float u_angle;        // spinning disc angle in radians
uniform float u_progress;     // 0.0 .. 1.0 song progress for outer glowing groove arc
uniform float u_time;
uniform vec2 u_mouse;         // normalized [-1, 1] cursor light angle
uniform float u_playing;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

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

float noise1D(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), u);
}

float noise2D(vec2 p) {
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
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise2D(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

// Crisp 4-point diamond star SDF (matches the etched sparkle on the CD!)
float sdSparkle4(vec2 p, float s) {
  p = abs(p) / s;
  float d = pow(p.x, 0.52) + pow(p.y, 0.52) - 1.0;
  return d * s * 0.45;
}

// Vivid holographic jelly-pink rainbow CD diffraction spectrum (matches the revamped reference!)
vec3 prismHoloSpectrum(float t) {
  vec3 pink      = vec3(1.00, 0.54, 0.82);
  vec3 champagne = vec3(1.00, 0.88, 0.68);
  vec3 mint      = vec3(0.68, 0.98, 0.90);
  vec3 sky       = vec3(0.64, 0.84, 1.00);
  vec3 lilac     = vec3(0.80, 0.62, 1.00);
  float f = fract(t) * 5.0;
  if (f < 1.0) return mix(pink, champagne, f);
  if (f < 2.0) return mix(champagne, mint, f - 1.0);
  if (f < 3.0) return mix(mint, sky, f - 2.0);
  if (f < 4.0) return mix(sky, lilac, f - 3.0);
  return mix(lilac, pink, f - 4.0);
}

// Multi-layer twinkling champagne / rose-gold / diamond micro-glitter flakes for the brush sweep transition!
vec3 glitterLayer(vec2 p, float scale, float t, float bandMask) {
  vec2 cell = floor(p * scale);
  vec2 f = fract(p * scale);
  vec2 rnd = hash22(cell);
  vec2 center = vec2(0.18) + rnd * 0.64;
  vec2 d = f - center;
  float dist = length(d);

  // Tiny shimmering circular flake + occasional 4-point diamond star glint!
  float dotFlake = smoothstep(0.22, 0.02, dist);
  float starGlint = rnd.x > 0.72
    ? smoothstep(0.06, 0.0, sdSparkle4(d, 0.34)) * 1.45
    : 0.0;

  // Rapid diamond-like shimmer twinkle as the brush light passes
  float twinkle = pow(0.5 + 0.5 * sin(t * (12.0 + rnd.y * 18.0) + rnd.x * 62.8), 2.4);
  vec3 flakeCol = mix(
    vec3(1.00, 0.88, 0.72), // champagne gold
    mix(vec3(1.00, 0.72, 0.90), vec3(1.00, 0.98, 1.00), rnd.y), // rose-pearl diamond
    rnd.x
  );
  return flakeCol * (dotFlake * 0.85 + starGlint) * (0.28 + 0.95 * twinkle) * bandMask;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float r = length(uv);
  float aa = 1.6 / min(u_resolution.x, u_resolution.y);

  float wellOuterR = 0.496;
  float grooveR    = 0.478;
  float cdOuterR   = 0.460;
  float hubOuterR  = 0.130;
  float hubInnerR  = 0.088;

  if (r > wellOuterR + aa) {
    outColor = vec4(0.0);
    return;
  }

  float theta = atan(uv.y, uv.x);
  float ca = cos(u_angle);
  float sa = sin(u_angle);
  vec2 rotUv = vec2(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca);
  float rotTheta = theta + u_angle;

  // 1. RECESSED JELLY-PINK GROOVE WELL + LIVE GLOWING PROGRESS ARC
  float inWell = 1.0 - smoothstep(wellOuterR - aa, wellOuterR + aa, r);
  float inCd   = 1.0 - smoothstep(cdOuterR - aa, cdOuterR + aa, r);

  vec3 grooveBase = mix(vec3(0.46, 0.18, 0.32), vec3(0.78, 0.38, 0.56), 0.5 + 0.5 * sin(theta + 1.1));
  float outerWellRim = exp(-pow((r - (wellOuterR - 0.008)) * 120.0, 2.0));
  grooveBase += vec3(0.55, 0.32, 0.44) * outerWellRim * (0.4 + 0.6 * cos(theta - 2.2));

  float startAngle = 2.42; // upper-left start matching the reference compact!
  float cwAngle = mod(startAngle - theta, 6.2831853);
  float arcProgress = cwAngle / 6.2831853;
  float progClamped = clamp(u_progress, 0.015, 1.0);
  float onTrack = smoothstep(0.013, 0.004, abs(r - grooveR));
  float inArc = (1.0 - smoothstep(progClamped - 0.006, progClamped + 0.004, arcProgress))
              * smoothstep(0.0, 0.006, arcProgress);

  vec2 tipPos = vec2(cos(startAngle - progClamped * 6.2831853), sin(startAngle - progClamped * 6.2831853)) * grooveR;
  float tipGlow = exp(-length(uv - tipPos) * 44.0);
  float arcHalo = exp(-abs(r - grooveR) * 48.0) * inArc;

  vec3 wellCol = grooveBase;
  wellCol += vec3(1.00, 0.93, 0.98) * onTrack * inArc * 1.18;
  wellCol += vec3(1.00, 0.66, 0.88) * arcHalo * 0.55;
  wellCol += vec3(1.00, 0.96, 1.00) * tipGlow * 0.88;

  // 2. SPINNING HOLOGRAPHIC PRISM ROSE-PINK CD
  float lightAngle = 2.48 + u_mouse.x * 0.26 + sin(u_time * 0.45) * 0.02;
  float lobePrimary = pow(abs(cos(theta - lightAngle)), 5.2);
  float lobeSharp   = pow(abs(cos(theta - lightAngle)), 22.0);
  float lobeCross   = pow(abs(cos(theta - (lightAngle + 1.50))), 7.5);
  float lobeSoft    = 0.5 + 0.5 * cos(2.0 * (theta - lightAngle));

  float microGroove = sin(r * 1480.0) * 0.5 + 0.5;
  float fineTrack   = sin(r * 2960.0 + noise1D(r * 180.0) * 5.0) * 0.5 + 0.5;
  float spinStreak  = noise1D(rotTheta * 14.0 + r * 35.0) * 0.55 + noise1D(rotTheta * 34.0) * 0.45;

  vec3 basePink = mix(vec3(0.68, 0.44, 0.64), vec3(0.92, 0.66, 0.84), lobeSoft);
  float rainbowPhase = (theta - lightAngle) * 0.72 + r * 1.75 + spinStreak * 0.14;
  vec3 holoPrism = prismHoloSpectrum(rainbowPhase);

  vec3 cdCol = basePink * (0.78 + 0.22 * microGroove);
  cdCol = mix(cdCol, holoPrism, 0.52 + 0.28 * lobePrimary);
  cdCol += mix(vec3(1.00, 0.88, 0.96), vec3(1.0), 0.56) * (lobePrimary * 0.54 + lobeSharp * 0.58);
  cdCol += vec3(0.76, 0.88, 1.00) * lobeCross * 0.26;
  cdCol *= (0.94 + 0.08 * fineTrack + 0.04 * spinStreak);

  // =========================================================================
  // HIGHLIGHTER GLITTER BRUSH SWEEP COVER TRANSITION (bottom-left -> top-right!)
  // =========================================================================
  float sweepActive = step(0.0, u_glitterSweep) * (1.0 - step(0.995, u_glitterSweep));
  float diagCoord = (uv.x * 0.74 + uv.y * 0.67) / (cdOuterR * 2.0) + 0.50;
  // Soft feathery highlighter brush bristle wave!
  float bristleWave = (fbm(uv * 11.0 + vec2(1.7, u_time * 0.4)) - 0.5) * 0.14
                    + (noise2D(uv * 34.0) - 0.5) * 0.04;
  float brushPos = mix(-0.18, 1.24, max(0.0, u_glitterSweep));
  // sweepSdf > 0 => ahead of brush (old cover); sweepSdf < 0 => behind brush (new cover revealed!)
  float sweepSdf = (diagCoord + bristleWave) - brushPos;
  float newArtMask = sweepActive > 0.5 && u_hasPrevCover > 0.5
    ? (1.0 - smoothstep(-0.045, 0.045, sweepSdf))
    : 1.0;

  // Cover-Art Rose Hologram Imprint (visible by default; smoothly swept by the glitter brush!)
  if (u_hasCover > 0.5 && u_holoCover > 0.01 && r < cdOuterR && r > hubOuterR) {
    vec2 texUv = (rotUv / (cdOuterR * 2.0)) + 0.5;
    texUv.y = 1.0 - texUv.y;
    vec3 newCov = texture(u_coverTex, texUv).rgb;
    vec3 oldCov = u_hasPrevCover > 0.5 ? texture(u_prevCoverTex, texUv).rgb : newCov;
    vec3 cov = mix(oldCov, newCov, newArtMask);

    vec3 glazedCover = cov * (0.88 + 0.16 * microGroove) * mix(vec3(1.0), vec3(1.04, 0.94, 0.99), 0.30);
    vec3 holoOverlay = holoPrism * (0.20 + 0.34 * lobePrimary)
                     + mix(vec3(1.00, 0.88, 0.96), vec3(1.0), 0.56) * (lobePrimary * 0.26 + lobeSharp * 0.40)
                     + vec3(0.76, 0.88, 1.00) * lobeCross * 0.14;
    cdCol = mix(cdCol, glazedCover + holoOverlay, u_holoCover * 0.86);
  }

  // Shimmering Highlighter Glitter Brush Wave + Sparkling Micro-Glitter Trail!
  if (sweepActive > 0.5 && r < cdOuterR) {
    float sweepEnv = smoothstep(0.0, 0.08, u_glitterSweep) * (1.0 - smoothstep(0.82, 0.99, u_glitterSweep));
    // Silky luminous champagne-rose highlighter sheen right along the brush stroke
    float brushCore  = exp(-pow(sweepSdf * 13.5, 2.0)) * sweepEnv;
    // Soft trailing shimmer dust lingering & fading behind the brush
    float glitterTrail = exp(-max(0.0, -sweepSdf) * 5.2) * smoothstep(0.08, -0.02, sweepSdf) * sweepEnv;
    float sparkleMask = clamp(brushCore * 1.25 + glitterTrail * 0.85, 0.0, 1.35);

    // Three stacked micro-glitter flake scales (fine dust + medium shimmer + diamond stars!)
    vec2 driftUv = uv - vec2(u_glitterSweep * 0.14, u_glitterSweep * 0.12);
    vec3 g1 = glitterLayer(driftUv + vec2(0.1, 0.2), 24.0, u_time, sparkleMask);
    vec3 g2 = glitterLayer(driftUv * 1.15 - vec2(0.3, 0.1), 46.0, u_time * 1.15, sparkleMask);
    vec3 g3 = glitterLayer(uv * 0.95 + vec2(0.5, 0.4), 78.0, u_time * 0.9, brushCore + glitterTrail * 0.6);

    vec3 brushCream = mix(vec3(1.00, 0.80, 0.92), vec3(1.00, 0.95, 0.86), 0.55) * brushCore * 0.62;
    cdCol += brushCream + (g1 * 0.95 + g2 * 0.80 + g3 * 0.55) * 1.15;
  }

  // Spinning Engraved 4-Point Diamond Sparkle on the CD
  vec2 sparkleCenter = vec2(0.185, 0.145);
  float dSpk = sdSparkle4(rotUv - sparkleCenter, 0.088);
  float spkOutline = exp(-abs(dSpk) * 190.0);
  float spkInner   = smoothstep(0.004, -0.008, dSpk);
  cdCol += vec3(1.00, 0.94, 0.98) * spkOutline * (0.68 + 0.52 * lobePrimary);
  cdCol += vec3(0.98, 0.78, 0.92) * spkInner * 0.12;

  // Delicate outer metallic chamfer rim of the CD
  float cdRimBevel  = exp(-pow((r - (cdOuterR - 0.006)) * 210.0, 2.0));
  float cdRimShadow = exp(-pow((r - (cdOuterR - 0.001)) * 280.0, 2.0));
  cdCol += vec3(1.00, 0.90, 0.96) * cdRimBevel * (0.45 + 0.62 * max(0.0, cos(theta - 2.35)));
  cdCol *= (1.0 - cdRimShadow * 0.36);

  // 3. MACHINED 3D ROSE-GOLD METALLIC CENTER HUB
  float inHub = 1.0 - smoothstep(hubOuterR - aa, hubOuterR + aa, r);
  if (inHub > 0.001) {
    float hubGroove = exp(-pow((r - hubOuterR) * 160.0, 2.0));
    float midBevel  = exp(-pow((r - hubInnerR) * 210.0, 2.0));
    float innerCap  = 1.0 - smoothstep(hubInnerR - aa, hubInnerR + aa, r);

    float hubGrad = 0.5 + 0.5 * dot(normalize(uv + vec2(0.0001)), normalize(vec2(-0.55, 0.82)));
    vec3 ringMetal = mix(vec3(0.56, 0.30, 0.42), vec3(0.98, 0.80, 0.88), hubGrad);
    vec3 capMetal  = mix(vec3(0.66, 0.40, 0.52), vec3(0.98, 0.78, 0.86), 0.38 + 0.62 * (0.5 - uv.y * 4.5 - uv.x * 2.5));

    vec3 hubCol = mix(ringMetal, capMetal, innerCap);
    hubCol *= (1.0 - hubGroove * 0.58);
    hubCol = mix(hubCol, vec3(0.32, 0.14, 0.22), midBevel * 0.68);
    hubCol += vec3(1.00, 0.90, 0.95) * exp(-pow((r - (hubInnerR - 0.007)) * 280.0, 2.0)) * 0.52;
    cdCol = mix(cdCol, hubCol, inHub);
  }

  float bezelAO = smoothstep(cdOuterR - 0.032, cdOuterR, r) * max(0.0, -cos(theta + 0.85)) * 0.20;
  cdCol *= (1.0 - bezelAO);

  vec3 finalCol = mix(wellCol, cdCol, inCd);
  finalCol = finalCol / (1.0 + finalCol * 0.12);
  finalCol = clamp(finalCol, 0.0, 1.0);

  outColor = vec4(finalCol, inWell);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('Glam CD shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
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
    console.warn('Glam CD link error:', gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

interface SparkleBurst {
  id: number;
  x: number;
  y: number;
}

// ============================================================================
// MAIN JELLY-PINK TRANSLUCENT LUCITE MAKEUP COMPACT CD PLAYER ("Glam")
// ============================================================================
export const GlamPaletteView: React.FC<SharedViewProps> = ({
  playlistTitle,
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
  const { isMobile } = useViewportMode();

  const cdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const coverTexRef = useRef<WebGLTexture | null>(null);
  const prevCoverTexRef = useRef<WebGLTexture | null>(null);
  const lastCoverCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasCoverRef = useRef(0);
  const hasPrevCoverRef = useRef(0);
  const glitterSweepRef = useRef(-1); // < 0 idle, 0..1 active Highlighter Glitter Brush Sweep!
  const angleRadRef = useRef(0);
  const progressRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const holoCoverRef = useRef(1);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouseRef = useRef({ x: 0, y: 0 });

  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [showQueue, setShowQueue] = useState(false);
  const [holoCoverMode, setHoloCoverMode] = useState(true);
  const [fairyDust, setFairyDust] = useState(true);
  const [upNextStep, setUpNextStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [bursts, setBursts] = useState<SparkleBurst[]>([]);
  const [thumbSrc, setThumbSrc] = useState(() => getBestCoverUrl(activeTrack));
  const [nextThumbSrc, setNextThumbSrc] = useState('');

  const isLiked = activeTrack ? Boolean(likedIds[activeTrack.id]) : false;
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  // Compute the single "Up Next" track currently shown in the upper strip (cycles 1 at a time!)
  const upcomingCount = Math.max(0, tracks.length - 1);
  const clampedNextStep =
    upcomingCount > 0 ? ((upNextStep % upcomingCount) + upcomingCount) % upcomingCount : 0;
  const upNextIndex = tracks.length > 1 ? (activeIndex + 1 + clampedNextStep) % tracks.length : activeIndex;
  const upNextTrack = tracks.length > 1 ? tracks[upNextIndex] : undefined;

  useEffect(() => {
    setUpNextStep(0);
  }, [activeIndex, tracks.length]);

  useEffect(() => {
    setNextThumbSrc(upNextTrack ? getBestCoverUrl(upNextTrack) : '');
  }, [upNextTrack]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    progressRef.current = progressRatio;
  }, [progressRatio]);

  useEffect(() => {
    holoCoverRef.current = holoCoverMode ? 1 : 0;
  }, [holoCoverMode]);

  useEffect(() => {
    setThumbSrc(getBestCoverUrl(activeTrack));
  }, [activeTrack]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const spawnBurst = (xPct: number, yPct: number) => {
    const id = Date.now() + Math.random();
    setBursts((prev) => [...prev.slice(-6), { id, x: xPct, y: yPct }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 900);
  };

  const toggleLike = (xPct = 64, yPct = 74) => {
    if (!activeTrack) return;
    sound.playClick(1180, 0.02);
    setLikedIds((prev) => {
      const next = !prev[activeTrack.id];
      if (next) spawnBurst(xPct, yPct);
      return { ...prev, [activeTrack.id]: next };
    });
  };

  // Interactive circular CD scrubbing (click = Play/Pause, drag in circle = FF / REW!)
  const { containerRef: cdContainerRef, isScrubbing, scrubTime, scrubDelta, intensityBadge, handlers } =
    useDiscScrub({
      isPlaying,
      currentTime,
      duration,
      baseSpeed: 0.46,
      onTogglePlay,
      onSeek,
      onSetPlaybackRate,
      onFrame: (deg) => {
        angleRadRef.current = (deg * Math.PI) / 180;
      },
    });

  // Upload cover art to WebGL2 & trigger the Highlighter Glitter Brush Sweep transition on song switch!
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
          // Snapshot previous cover to u_prevCoverTex and sweep the Highlighter Glitter Brush!
          const prevTex = prevCoverTexRef.current;
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
            glitterSweepRef.current = 0.0;
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

  // WebGL2 Holographic Prism CD + Glitter Brush Transition Render Loop
  useEffect(() => {
    const canvas = cdCanvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) return;
    glRef.current = gl;

    const program = createProgram(gl, GLAM_CD_VS, GLAM_CD_FS);
    if (!program) return;

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

    const makeTex = () => {
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
        new Uint8Array([230, 175, 205, 255])
      );
      return t;
    };

    const tex = makeTex();
    const prevTex = makeTex();
    coverTexRef.current = tex;
    prevCoverTexRef.current = prevTex;

    // Re-upload cached cover art immediately when switching between mobile & desktop canvases
    if (lastCoverCanvasRef.current) {
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lastCoverCanvasRef.current);
        hasCoverRef.current = 1;
      } catch {
        hasCoverRef.current = 0;
      }
    }

    const uCoverTex = gl.getUniformLocation(program, 'u_coverTex');
    const uPrevCoverTex = gl.getUniformLocation(program, 'u_prevCoverTex');
    const uHasCover = gl.getUniformLocation(program, 'u_hasCover');
    const uHasPrevCover = gl.getUniformLocation(program, 'u_hasPrevCover');
    const uHoloCover = gl.getUniformLocation(program, 'u_holoCover');
    const uGlitterSweep = gl.getUniformLocation(program, 'u_glitterSweep');
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uAngle = gl.getUniformLocation(program, 'u_angle');
    const uProgress = gl.getUniformLocation(program, 'u_progress');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uPlaying = gl.getUniformLocation(program, 'u_playing');

    let rafId = 0;
    const t0 = performance.now();
    let lastNow = t0;
    let smoothHolo = holoCoverRef.current;

    const render = (now: number) => {
      const dt = Math.min(0.033, Math.max(0.004, (now - lastNow) / 1000));
      lastNow = now;

      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
      const cw = Math.floor(canvas.clientWidth * dpr);
      const ch = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.08;
      smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.08;
      smoothHolo += (holoCoverRef.current - smoothHolo) * 0.09;

      // Advance Highlighter Glitter Brush Sweep (~1.22s smooth ease-in-out)
      let easedSweep = -1.0;
      if (glitterSweepRef.current >= 0) {
        glitterSweepRef.current += dt / 1.22;
        if (glitterSweepRef.current >= 1.0) {
          glitterSweepRef.current = -1.0;
          easedSweep = -1.0;
        } else {
          const s = glitterSweepRef.current;
          easedSweep = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
        }
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uCoverTex, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, prevTex);
      gl.uniform1i(uPrevCoverTex, 1);

      gl.uniform1f(uHasCover, hasCoverRef.current);
      gl.uniform1f(uHasPrevCover, hasPrevCoverRef.current);
      gl.uniform1f(uHoloCover, smoothHolo);
      gl.uniform1f(uGlitterSweep, easedSweep);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uAngle, angleRadRef.current);
      gl.uniform1f(uProgress, progressRef.current);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform2f(uMouse, smoothMouseRef.current.x, smoothMouseRef.current.y);
      gl.uniform1f(uPlaying, isPlayingRef.current ? 1.0 : 0.0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      gl.deleteTexture(tex);
      gl.deleteTexture(prevTex);
      gl.deleteBuffer(quad);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      glRef.current = null;
      coverTexRef.current = null;
      prevCoverTexRef.current = null;
    };
  }, [isMobile]);

  // Keyboard shortcuts
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

  const displayTitle = activeTrack ? cleanDisplayTitle(activeTrack.title) : 'NO TRACK';
  const prettyTitle = displayTitle
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  const displayArtist = activeTrack?.artist || playlistTitle || 'YouTube Music';
  const shownTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const shownPct = duration > 0 ? Math.min(100, Math.max(0, (shownTime / duration) * 100)) : 0;

  // ============================================================================
  // PORTRAIT MOBILE TRANSLUCENT JELLY-PINK LUCITE COMPACT (< 768px ONLY)
  // Desktop (>= 768px) below stays 100% untouched!
  // ============================================================================
  if (isMobile) {
    return (
      <div
        className="relative w-full h-full overflow-hidden select-none flex flex-col items-center justify-center px-3 pt-[calc(3.6rem+env(safe-area-inset-top))] pb-[calc(0.9rem+env(safe-area-inset-bottom))]"
        style={{
          background: 'radial-gradient(circle at 50% 25%, #ffd9ec 0%, #f9c8e1 55%, #f2b4d6 100%)',
        }}
        onPointerMove={(e) => {
          mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
          mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
        }}
      >
        <style>{`
          @keyframes glamTwinkle {
            0%, 100% { opacity: 0.24; transform: scale(0.75) rotate(0deg); }
            50% { opacity: 0.96; transform: scale(1.18) rotate(18deg); }
          }
        `}</style>

        {/* Vertical Translucent Jelly-Pink Lucite Makeup Compact Shell */}
        <div
          className="relative w-full max-w-[404px] h-full max-h-[740px] rounded-[34px] p-[9px] flex flex-col overflow-hidden"
          style={{
            background:
              'linear-gradient(155deg, rgba(255,222,240,0.88) 0%, rgba(235,146,192,0.86) 45%, rgba(212,110,164,0.90) 100%)',
            border: '1.5px solid rgba(255,244,250,0.82)',
            boxShadow:
              '0 22px 50px rgba(154,54,106,0.34), inset 0 2px 5px rgba(255,255,255,0.78), inset 0 -4px 10px rgba(158,52,106,0.38)',
          }}
        >
          {/* Molded Acrylic Top Hinge Tabs */}
          <div className="pointer-events-none absolute top-[2px] left-1/2 -translate-x-1/2 flex gap-16 z-20">
            <div className="w-12 h-[5px] rounded-b-full bg-white/50 shadow-inner" />
            <div className="w-12 h-[5px] rounded-b-full bg-white/50 shadow-inner" />
          </div>

          {/* Inner Recessed Acrylic Tray */}
          <div
            className="relative flex-1 rounded-[26px] px-3.5 pt-3.5 pb-3 flex flex-col justify-between overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, rgba(218,120,170,0.68) 0%, rgba(196,94,148,0.76) 52%, rgba(178,78,132,0.82) 100%)',
              border: '1px solid rgba(255,232,245,0.65)',
              boxShadow:
                'inset 0 6px 18px rgba(110,24,68,0.28), inset 0 -2px 6px rgba(255,230,245,0.45)',
            }}
          >
            {/* Ambient Fairy Shimmer Sparkles */}
            {fairyDust && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
                {[
                  { l: '8%', t: '18%', d: '3.1s', s: 11 },
                  { l: '89%', t: '17%', d: '3.8s', s: 12 },
                  { l: '7%', t: '58%', d: '3.5s', s: 10 },
                  { l: '91%', t: '54%', d: '2.9s', s: 11 },
                ].map((sp, i) => (
                  <span
                    key={i}
                    className="absolute text-white drop-shadow-[0_0_8px_rgba(255,210,240,0.95)]"
                    style={{
                      left: sp.l,
                      top: sp.t,
                      fontSize: sp.s,
                      animation: `glamTwinkle ${sp.d} ease-in-out infinite`,
                      animationDelay: `${i * 0.45}s`,
                    }}
                  >
                    ✦
                  </span>
                ))}
              </div>
            )}

            {/* TOP BAR: Etched cursive branding + 3 Lucite Circular Action Buttons */}
            <div className="relative z-20 flex items-center justify-between gap-2 shrink-0">
              <div
                className="text-white/95 drop-shadow-[0_1px_4px_rgba(120,24,72,0.45)] truncate pl-0.5"
                style={{ fontFamily: "'Dancing Script', cursive", fontSize: 22 }}
              >
                ✦ certifiedbaddie.club ♡
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleLike(74, 10)}
                  aria-label="Love track"
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                    isLiked
                      ? 'bg-[#ff74bd]/45 border-[#ffe8f5] text-white shadow-[0_0_14px_rgba(255,140,205,0.7)]'
                      : 'bg-white/15 border-white/45 text-white/90 active:bg-white/25'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-white' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick(980, 0.02);
                    setShowQueue((q) => !q);
                  }}
                  aria-label="Open playlist queue"
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                    showQueue
                      ? 'bg-white/32 border-white text-white shadow-[0_0_14px_rgba(255,220,240,0.65)]'
                      : 'bg-white/15 border-white/45 text-white/90 active:bg-white/25'
                  }`}
                >
                  <ListMusic className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick(1360, 0.02);
                    setHoloCoverMode((v) => !v);
                    glitterSweepRef.current = 0.0;
                    spawnBurst(88, 10);
                    setToast(!holoCoverMode ? 'Cover Hologram CD ✦' : 'Pure Rainbow Chrome CD ✦');
                  }}
                  aria-label="Toggle CD hologram finish"
                  className="w-9 h-9 rounded-full flex items-center justify-center border bg-white/15 border-white/45 text-white/90 active:bg-white/25 active:scale-90 transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CENTER HERO: Recessed Holographic Prism CD + Highlighter Glitter Brush Transition */}
            <div className="relative z-20 flex-1 flex items-center justify-center min-h-0 my-1">
              <div
                ref={cdContainerRef}
                {...handlers}
                className={`relative rounded-full touch-none p-[6px] ${
                  isScrubbing ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                style={{
                  width: 'min(64vw, 31dvh, 250px)',
                  height: 'min(64vw, 31dvh, 250px)',
                  background:
                    'linear-gradient(145deg, rgba(138,44,92,0.55) 0%, rgba(255,212,235,0.45) 100%)',
                  boxShadow:
                    'inset 0 4px 12px rgba(72,14,44,0.45), 0 8px 24px rgba(100,22,62,0.28), 0 0 0 1.5px rgba(255,232,245,0.52)',
                }}
              >
                <canvas
                  ref={cdCanvasRef}
                  className="w-full h-full block rounded-full pointer-events-none"
                />

                <AnimatePresence>
                  {isScrubbing && (intensityBadge || Math.abs(scrubDelta) >= 0.5) && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="pointer-events-none absolute top-[12%] left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#4a1832]/90 border border-[#ffd8ec]/55 text-[#fff2f8] font-mono text-[10px] tracking-wider whitespace-nowrap shadow-lg backdrop-blur-md"
                    >
                      {intensityBadge || ''}
                      {Math.abs(scrubDelta) >= 0.5
                        ? `${intensityBadge ? ' · ' : ''}${formatDelta(scrubDelta)}`
                        : ''}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* INTERACTIVE MAKEUP PANS ROW: Butterfly Blush · 4 Glossy Shimmer Pans · Star Highlighter */}
            <div className="relative z-20 flex items-center justify-between gap-2.5 px-1 mb-2 shrink-0">
              {/* Left Pan: Butterfly Blush (Fairy Shimmer Toggle) */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick(1280, 0.02);
                  setFairyDust((v) => !v);
                  spawnBurst(15, 62);
                  setToast(!fairyDust ? 'Fairy Shimmer On ✦' : 'Fairy Shimmer Off');
                }}
                aria-label="Toggle fairy shimmer"
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                style={{
                  background:
                    'radial-gradient(circle at 35% 30%, #ff9dce 0%, #f06da9 65%, #c74782 100%)',
                  border: '1.5px solid rgba(255,235,246,0.75)',
                  boxShadow:
                    'inset 0 2px 6px rgba(255,255,255,0.45), 0 4px 12px rgba(108,24,68,0.34)',
                }}
              >
                <span className="text-[15px] text-white/90 drop-shadow">✿</span>
              </button>

              {/* Center 4 Mini Glossy Eyeshadow Shimmer Pans */}
              <div className="flex-1 grid grid-cols-4 gap-1.5 px-2 py-1.5 rounded-[14px] bg-[#7a2852]/35 border border-[#ffd8ec]/35 shadow-inner">
                {[
                  'linear-gradient(135deg, #ffdbe9, #f7a6c8)',
                  'linear-gradient(135deg, #f376b0, #cf4686)',
                  'linear-gradient(135deg, #e05b98, #a42f66)',
                  'linear-gradient(135deg, #8b335f, #521836)',
                ].map((bg, i) => (
                  <div
                    key={i}
                    className="h-7 rounded-[7px] border border-white/30 shadow-inner"
                    style={{ background: bg }}
                  />
                ))}
              </div>

              {/* Right Pan: Star Highlighter (Glitter Sweep & CD Finish Toggle) */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick(1420, 0.02);
                  setHoloCoverMode((v) => !v);
                  glitterSweepRef.current = 0.0;
                  spawnBurst(85, 62);
                  setToast(!holoCoverMode ? 'Cover Hologram CD ✦' : 'Pure Rainbow Chrome CD ✦');
                }}
                aria-label="Trigger glitter sweep and toggle CD finish"
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                style={{
                  background:
                    'radial-gradient(circle at 35% 30%, #fff4e8 0%, #f7c7db 62%, #d98fb2 100%)',
                  border: '1.5px solid rgba(255,244,250,0.85)',
                  boxShadow:
                    'inset 0 2px 6px rgba(255,255,255,0.65), 0 4px 12px rgba(108,24,68,0.32)',
                }}
              >
                <span className="text-[16px] text-white drop-shadow-[0_0_6px_rgba(255,150,210,0.9)]">
                  ✦
                </span>
              </button>
            </div>

            {/* BOTTOM RECESSED FROSTED BERRY-GLASS DISPLAY:
                UPPER: [Now Playing (Left)] | [Up Next 1-at-a-time (Right)]
                LOWER: [44px Prev / Play-Pause / Next] + [Glowing Scrub Bar] + [Heart] */}
            <div
              className="relative z-20 rounded-[18px] overflow-hidden shrink-0 flex flex-col"
              style={{
                background:
                  'linear-gradient(160deg, rgba(106,36,72,0.92) 0%, rgba(74,22,50,0.95) 100%)',
                border: '1px solid rgba(255,218,238,0.42)',
                boxShadow:
                  'inset 0 2px 8px rgba(32,6,20,0.45), 0 6px 18px rgba(96,20,60,0.28)',
              }}
            >
              {/* UPPER SECTION: Now Playing + Up Next */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[#ffd8ec]/18">
                {/* Left: Now Playing */}
                <div className="flex items-center gap-2.5 min-w-0 flex-[1.28]">
                  <div className="w-10 h-10 rounded-[8px] overflow-hidden shrink-0 border border-[#ffd8ec]/35 bg-[#461a32] shadow">
                    {thumbSrc && (
                      <img
                        src={thumbSrc}
                        alt={prettyTitle}
                        draggable={false}
                        onError={() => {
                          if (activeTrack?.youtubeId && !thumbSrc.includes('mqdefault')) {
                            setThumbSrc(`https://i.ytimg.com/vi/${activeTrack.youtubeId}/mqdefault.jpg`);
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[13px] text-white font-sans font-semibold truncate leading-tight">
                        {prettyTitle}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#ffe2f1]/80 font-sans truncate leading-tight mt-0.5">
                      {displayArtist}
                    </div>
                  </div>
                </div>

                <div className="w-[1px] h-8 bg-[#ffd8ec]/20 shrink-0" />

                {/* Right: Up Next 1-at-a-time */}
                <div className="flex items-center gap-1 min-w-0 flex-[0.95]">
                  {upNextTrack ? (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playDiscSpin();
                        onSelectTrack(upNextIndex);
                      }}
                      className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#ffc6e5]/85 leading-none">
                          UP NEXT
                        </div>
                        <div className="font-sans text-[11px] text-[#fff4fa] truncate leading-tight mt-0.5">
                          {cleanDisplayTitle(upNextTrack.title)
                            .toLowerCase()
                            .replace(/\b\w/g, (ch) => ch.toUpperCase())}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <span className="font-mono text-[9px] text-[#ffe4f2]/55 truncate flex-1">
                      UP NEXT · —
                    </span>
                  )}

                  {upcomingCount > 1 && (
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick(820, 0.012);
                          setUpNextStep((s) => s - 1);
                        }}
                        aria-label="Previous up next"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[#ffe6f3]/80 active:bg-white/15"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick(920, 0.012);
                          setUpNextStep((s) => s + 1);
                        }}
                        aria-label="Next up next"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[#ffe6f3]/80 active:bg-white/15"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* LOWER SECTION: Glowing Scrub Bar + Touch-Friendly Transport Controls */}
              <div className="px-3 pt-2 pb-2.5 bg-black/15 flex flex-col gap-1.5">
                {/* Glowing Rose-Pearl Scrub Bar */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9.5px] text-[#ffedf7]/85 tabular-nums shrink-0">
                    {formatTime(shownTime)}
                  </span>
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      sound.playClick(960, 0.015);
                      onSeek(ratio * duration);
                    }}
                    className="relative h-6 flex-1 flex items-center cursor-pointer"
                  >
                    <div className="w-full h-[3.5px] rounded-full bg-white/22 relative">
                      <div
                        className="h-full rounded-full relative"
                        style={{
                          width: `${shownPct}%`,
                          background: 'linear-gradient(90deg, #ff9fd0 0%, #ffdcf0 75%, #ffffff 100%)',
                          boxShadow: '0 0 10px rgba(255,180,224,0.88)',
                        }}
                      >
                        <div
                          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white"
                          style={{ boxShadow: '0 0 10px 3px rgba(255,205,235,0.95)' }}
                        />
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[9.5px] text-[#ffedf7]/85 tabular-nums shrink-0">
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Transport Row (44px touch targets) */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#ffd4ec]/70 w-10">
                    {String(activeIndex + 1).padStart(2, '0')}/{String(tracks.length).padStart(2, '0')}
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playDiscSpin();
                        onPrev();
                      }}
                      aria-label="Previous track"
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white/90 active:bg-white/15 active:scale-90 transition-all"
                    >
                      <SkipBack className="w-5 h-5 fill-current" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playSwitch();
                        onTogglePlay();
                      }}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-90 transition-all"
                      style={{
                        background:
                          'radial-gradient(circle at 35% 30%, rgba(255,228,244,0.52) 0%, rgba(214,120,170,0.68) 100%)',
                        border: '1px solid rgba(255,238,248,0.72)',
                        boxShadow:
                          '0 4px 14px rgba(74,20,48,0.45), inset 0 1px 1.5px rgba(255,255,255,0.65)',
                      }}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playDiscSpin();
                        onNext();
                      }}
                      aria-label="Next track"
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white/90 active:bg-white/15 active:scale-90 transition-all"
                    >
                      <SkipForward className="w-5 h-5 fill-current" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleLike(85, 86)}
                    aria-label="Favorite track"
                    className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/15 active:scale-90 transition-all"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        isLiked ? 'fill-[#ff9fd0] text-[#ff9fd0]' : 'text-[#ffe6f3]/85'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Sparkle Bursts */}
            <AnimatePresence>
              {bursts.map((b) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 1, scale: 0.4 }}
                  animate={{ opacity: 0, scale: 1.8, y: -26 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="pointer-events-none absolute z-40 text-white drop-shadow-[0_0_10px_rgba(255,160,215,1)]"
                  style={{ left: `${b.x}%`, top: `${b.y}%` }}
                >
                  <Sparkles className="w-6 h-6" />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Feedback Toast Pill */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1 rounded-full bg-[#4a1832]/92 border border-[#ffd8ec]/50 text-[#fff0f8] font-mono text-[10px] uppercase tracking-[0.16em] whitespace-nowrap backdrop-blur-xl shadow-lg"
                >
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Full-Width Frosted Jelly-Pink Queue Overlay inside the portrait case */}
            <AnimatePresence>
              {showQueue && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.22 }}
                  className="absolute inset-2.5 z-40 rounded-[20px] overflow-hidden flex flex-col backdrop-blur-2xl"
                  style={{
                    background:
                      'linear-gradient(155deg, rgba(84,28,58,0.95) 0%, rgba(52,16,36,0.97) 100%)',
                    border: '1px solid rgba(255,214,238,0.5)',
                    boxShadow: '0 22px 60px rgba(48,10,30,0.6)',
                  }}
                >
                  <div className="px-4 py-3 border-b border-[#ffd8ec]/20 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#ffc4e2]/80">
                        UP NEXT · {tracks.length} TRACKS
                      </div>
                      <div
                        className="text-white leading-tight mt-0.5 truncate max-w-[230px]"
                        style={{ fontFamily: "'Dancing Script', cursive", fontSize: 20 }}
                      >
                        {playlistTitle || 'certifiedbaddie.club'} ♡
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setShowQueue(false);
                      }}
                      aria-label="Close queue"
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[#ffd8ec]/85 active:bg-white/15"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1">
                    {tracks.map((tr, idx) => {
                      const isCurr = idx === activeIndex;
                      return (
                        <button
                          key={`${tr.id}-${idx}`}
                          type="button"
                          onClick={() => {
                            sound.playDiscSpin();
                            onSelectTrack(idx);
                            setShowQueue(false);
                          }}
                          className={`w-full px-3 py-2.5 rounded-[12px] flex items-center gap-2.5 text-left transition-all ${
                            isCurr
                              ? 'bg-[#ffaad6]/26 border border-[#ffd8ec]/45 text-white'
                              : 'active:bg-white/[0.1] text-[#fce4ef]/88 border border-transparent'
                          }`}
                        >
                          <span className="font-mono text-[10px] text-[#ffb8de] w-5 shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-sans text-[12.5px] truncate flex-1">
                            {cleanDisplayTitle(tr.title)}
                          </span>
                          {isCurr && (
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isPlaying ? 'bg-[#ffaad6] animate-pulse' : 'bg-white/50'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none flex items-center justify-center bg-[#f9c8e1]"
      onPointerMove={(e) => {
        mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
      }}
    >
      <style>{`
        @keyframes glamTwinkle {
          0%, 100% { opacity: 0.24; transform: scale(0.75) rotate(0deg); }
          50% { opacity: 0.96; transform: scale(1.18) rotate(18deg); }
        }
      `}</style>

      {/* Responsive 1440x840 Translucent Jelly-Pink Lucite Makeup Compact Stage */}
      <div
        className="relative shrink-0"
        style={{
          width: 'min(100vw, calc(100vh * 1440 / 840))',
          height: 'min(100vh, calc(100vw * 840 / 1440))',
        }}
      >
        {/* 1. Photorealistic Revamped Translucent Jelly-Pink Acrylic Compact (certifiedbaddie.club ♡ etched!) */}
        <img
          src="/palette/jelly-compact.jpg"
          alt="CertifiedBaddie.club Translucent Jelly-Pink Makeup Compact CD Player"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Ambient Fairy Shimmer Sparkles (toggle via Butterfly Blush pan!) */}
        {fairyDust && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
            {[
              { l: '11%', t: '24%', d: '3.1s', s: 11 },
              { l: '87%', t: '22%', d: '3.9s', s: 12 },
              { l: '9%', t: '73%', d: '3.6s', s: 10 },
              { l: '89%', t: '69%', d: '2.9s', s: 11 },
              { l: '27%', t: '29%', d: '3.4s', s: 9 },
              { l: '74%', t: '72%', d: '3.2s', s: 10 },
            ].map((sp, i) => (
              <span
                key={i}
                className="absolute text-white drop-shadow-[0_0_8px_rgba(255,210,240,0.95)]"
                style={{
                  left: sp.l,
                  top: sp.t,
                  fontSize: sp.s,
                  animation: `glamTwinkle ${sp.d} ease-in-out infinite`,
                  animationDelay: `${i * 0.42}s`,
                }}
              >
                ✦
              </span>
            ))}
          </div>
        )}

        {/* 2. TOP-RIGHT LUCITE ICON HITBOXES (aligned dead-center onto the compact's etched ♡, ☰, ••• buttons!) */}
        <button
          type="button"
          onClick={() => toggleLike(64, 21)}
          title={isLiked ? 'Liked ♡' : 'Love this track'}
          aria-label="Love track"
          className={`absolute z-30 rounded-full transition-all active:scale-90 cursor-pointer flex items-center justify-center ${
            isLiked
              ? 'bg-[#ff74bd]/35 ring-2 ring-[#ffe3f3]/80 shadow-[0_0_16px_rgba(255,120,195,0.65)]'
              : 'hover:bg-white/15'
          }`}
          style={{
            left: '62.55%',
            top: '18.9%',
            width: '3.55%',
            height: '6.1%',
          }}
        >
          {isLiked && <Heart className="w-[48%] h-[48%] fill-[#ffeaf5] text-[#ffeaf5]" />}
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick(980, 0.02);
            setShowQueue((q) => !q);
          }}
          title="Open Playlist Queue"
          aria-label="Open playlist queue"
          className={`absolute z-30 rounded-full transition-all active:scale-90 cursor-pointer ${
            showQueue
              ? 'bg-white/28 ring-2 ring-white/80 shadow-[0_0_16px_rgba(255,215,240,0.7)]'
              : 'hover:bg-white/15'
          }`}
          style={{
            left: '67.25%',
            top: '18.9%',
            width: '3.55%',
            height: '6.1%',
          }}
        />

        <button
          type="button"
          onClick={() => {
            sound.playClick(1360, 0.02);
            setHoloCoverMode((v) => !v);
            spawnBurst(73, 21);
            setToast(!holoCoverMode ? 'Cover Hologram CD ✦' : 'Pure Rainbow Chrome CD ✦');
          }}
          title="Toggle Cover Hologram / Pure Rainbow Chrome CD"
          aria-label="Toggle CD hologram finish"
          className="absolute z-30 rounded-full hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
          style={{
            left: '71.95%',
            top: '18.9%',
            width: '3.55%',
            height: '6.1%',
          }}
        />

        {/* 3. CENTER RECESSED HOLOGRAPHIC PRISM CD + HIGHLIGHTER GLITTER BRUSH TRANSITION */}
        <div
          ref={cdContainerRef}
          {...handlers}
          className={`absolute z-20 rounded-full touch-none ${
            isScrubbing ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            left: '37.67%',
            top: '24.29%',
            width: '24.31%',
            height: '41.67%',
          }}
          title="Click to Play/Pause · Hold & spin CD to scrub"
        >
          <canvas ref={cdCanvasRef} className="w-full h-full block rounded-full pointer-events-none" />

          {/* Scrubbing Intensity Pill */}
          <AnimatePresence>
            {isScrubbing && (intensityBadge || Math.abs(scrubDelta) >= 0.5) && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="pointer-events-none absolute top-[14%] left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#4a1832]/88 border border-[#ffd8ec]/55 text-[#fff2f8] font-mono text-[9.5px] tracking-wider whitespace-nowrap shadow-lg backdrop-blur-md"
              >
                {intensityBadge || ''}
                {Math.abs(scrubDelta) >= 0.5
                  ? `${intensityBadge ? ' · ' : ''}${formatDelta(scrubDelta)}`
                  : ''}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4. BOTTOM RECESSED FROSTED BERRY-GLASS DISPLAY:
               UPPER SECTION: [NOW PLAYING (Left)]  |  [UP NEXT 1-at-a-time (Right)]
               LOWER SECTION: [Prev / Play-Pause / Next] + [Glowing Progress Scrub Bar] + [Heart] */}
        <div
          className="absolute z-20 rounded-[14px] flex flex-col overflow-hidden"
          style={{
            left: '34.85%',
            top: '67.65%',
            width: '30.15%',
            height: '12.90%',
          }}
        >
          {/* UPPER SECTION: Current Playing (Left) + Up Next 1-at-a-time (Right) */}
          <div className="flex items-center h-[54%] shrink-0 border-b border-[#ffd8ec]/16 px-[0.95vw] gap-[0.65vw]">
            {/* Left: Currently Playing Song */}
            <div className="flex items-center gap-[0.6vw] min-w-0 flex-[1.22]">
              <div className="relative h-[clamp(22px,2.5vw,34px)] w-[clamp(22px,2.5vw,34px)] rounded-[6px] overflow-hidden shrink-0 shadow-[0_3px_10px_rgba(32,8,20,0.45)] border border-[#ffd8ec]/35 bg-[#461a32]">
                {thumbSrc && (
                  <img
                    src={thumbSrc}
                    alt={prettyTitle}
                    draggable={false}
                    onError={() => {
                      if (activeTrack?.youtubeId && !thumbSrc.includes('mqdefault')) {
                        setThumbSrc(`https://i.ytimg.com/vi/${activeTrack.youtubeId}/mqdefault.jpg`);
                      }
                    }}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className="text-white font-sans font-medium truncate tracking-[-0.01em] leading-tight drop-shadow-[0_1px_2px_rgba(32,6,18,0.45)]"
                    style={{ fontSize: 'clamp(9px, 0.95vw, 13.5px)' }}
                  >
                    {prettyTitle}
                  </span>
                  <span className="shrink-0 px-1 py-[1px] rounded-[3px] bg-white/18 text-[#fff0f8] font-mono text-[clamp(6px,0.52vw,7.5px)] leading-none">
                    {String(activeIndex + 1).padStart(2, '0')}
                  </span>
                </div>
                <div
                  className="text-[#ffe2f1]/82 font-sans truncate leading-tight mt-[1px]"
                  style={{ fontSize: 'clamp(7.5px, 0.72vw, 10.5px)' }}
                >
                  {displayArtist}
                </div>
              </div>
            </div>

            {/* Subtle Vertical Frosted Hairline Divider */}
            <div className="w-[1px] h-[64%] bg-[#ffd8ec]/20 shrink-0" />

            {/* Right: Up Next (1 upcoming track at a time, clickable & wheel-scrollable!) */}
            <div
              onWheel={(e) => {
                if (upcomingCount <= 1) return;
                e.stopPropagation();
                const dir = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) > 0 ? 1 : -1;
                setUpNextStep((s) => s + dir);
              }}
              className="flex items-center gap-[0.4vw] min-w-0 flex-[0.95]"
            >
              {upNextTrack ? (
                <button
                  type="button"
                  onClick={() => {
                    sound.playDiscSpin();
                    onSelectTrack(upNextIndex);
                  }}
                  title={`Play up next: ${cleanDisplayTitle(upNextTrack.title)}`}
                  className="flex items-center gap-[0.45vw] min-w-0 flex-1 text-left group"
                >
                  <div className="w-[clamp(18px,2.05vw,28px)] h-[clamp(18px,2.05vw,28px)] rounded-[5px] overflow-hidden shrink-0 border border-[#ffd8ec]/30 bg-[#461a32]">
                    {nextThumbSrc && (
                      <img
                        src={nextThumbSrc}
                        alt={upNextTrack.title}
                        draggable={false}
                        onError={() => {
                          if (upNextTrack.youtubeId && !nextThumbSrc.includes('mqdefault')) {
                            setNextThumbSrc(`https://i.ytimg.com/vi/${upNextTrack.youtubeId}/mqdefault.jpg`);
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-mono uppercase tracking-[0.14em] text-[#ffc6e5]/85 leading-none"
                      style={{ fontSize: 'clamp(6px, 0.52vw, 7.5px)' }}
                    >
                      UP NEXT
                    </div>
                    <div
                      className="font-sans text-[#fff4fa]/92 group-hover:text-white truncate leading-tight mt-[2px] transition-colors"
                      style={{ fontSize: 'clamp(8px, 0.78vw, 11px)' }}
                    >
                      {cleanDisplayTitle(upNextTrack.title)
                        .toLowerCase()
                        .replace(/\b\w/g, (ch) => ch.toUpperCase())}
                    </div>
                  </div>
                </button>
              ) : (
                <span
                  className="font-mono text-[#ffe4f2]/55 truncate flex-1"
                  style={{ fontSize: 'clamp(7.5px, 0.68vw, 9.5px)' }}
                >
                  UP NEXT · —
                </span>
              )}

              {upcomingCount > 1 && (
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick(820, 0.012);
                      setUpNextStep((s) => s - 1);
                    }}
                    aria-label="Previous up next"
                    className="w-[clamp(13px,1.25vw,18px)] h-[clamp(13px,1.25vw,18px)] rounded-full flex items-center justify-center text-[#ffe6f3]/75 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                  >
                    <ChevronLeft className="w-[75%] h-[75%]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick(920, 0.012);
                      setUpNextStep((s) => s + 1);
                    }}
                    aria-label="Next up next"
                    className="w-[clamp(13px,1.25vw,18px)] h-[clamp(13px,1.25vw,18px)] rounded-full flex items-center justify-center text-[#ffe6f3]/75 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                  >
                    <ChevronRight className="w-[75%] h-[75%]" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* LOWER SECTION: Transport Controls (Prev / Play-Pause / Next) + Glowing Progress Scrub Bar + Heart */}
          <div className="flex-1 flex items-center gap-[0.65vw] px-[0.95vw] bg-black/10 min-h-0">
            {/* Frosted Rose-Glass Transport Controls */}
            <div className="flex items-center gap-[0.35vw] shrink-0">
              <button
                type="button"
                onClick={() => {
                  sound.playDiscSpin();
                  onPrev();
                }}
                aria-label="Previous track"
                className="w-[clamp(18px,1.8vw,25px)] h-[clamp(18px,1.8vw,25px)] rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
              >
                <SkipBack className="w-[62%] h-[62%] fill-current" />
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playSwitch();
                  onTogglePlay();
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-[clamp(24px,2.35vw,32px)] h-[clamp(24px,2.35vw,32px)] rounded-full flex items-center justify-center text-white active:scale-90 hover:scale-105 transition-all"
                style={{
                  background:
                    'radial-gradient(circle at 35% 30%, rgba(255,228,244,0.48) 0%, rgba(214,120,170,0.62) 100%)',
                  border: '1px solid rgba(255,238,248,0.65)',
                  boxShadow:
                    '0 3px 12px rgba(74,20,48,0.40), inset 0 1px 1.5px rgba(255,255,255,0.6)',
                }}
              >
                {isPlaying ? (
                  <Pause className="w-[44%] h-[44%] fill-current" />
                ) : (
                  <Play className="w-[44%] h-[44%] fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playDiscSpin();
                  onNext();
                }}
                aria-label="Next track"
                className="w-[clamp(18px,1.8vw,25px)] h-[clamp(18px,1.8vw,25px)] rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
              >
                <SkipForward className="w-[62%] h-[62%] fill-current" />
              </button>
            </div>

            {/* Glowing Rose-Pearl Scrub Progress Bar + Crisp Timestamps */}
            <div className="flex-1 flex items-center gap-[0.5vw] min-w-0">
              <span
                className="font-mono text-[#ffedf7]/85 tabular-nums leading-none shrink-0"
                style={{ fontSize: 'clamp(7px, 0.64vw, 9.5px)' }}
              >
                {formatTime(shownTime)}
              </span>

              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  sound.playClick(960, 0.015);
                  onSeek(ratio * duration);
                }}
                className="relative h-[12px] flex-1 flex items-center cursor-pointer group"
              >
                <div className="w-full h-[2.5px] rounded-full bg-white/22 overflow-visible relative">
                  <div
                    className="h-full rounded-full relative"
                    style={{
                      width: `${shownPct}%`,
                      background: 'linear-gradient(90deg, #ff9fd0 0%, #ffdcf0 75%, #ffffff 100%)',
                      boxShadow: '0 0 10px rgba(255,180,224,0.88)',
                    }}
                  >
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-[clamp(6.5px,0.68vw,9px)] h-[clamp(6.5px,0.68vw,9px)] rounded-full bg-white transition-transform group-hover:scale-125"
                      style={{
                        boxShadow: '0 0 10px 3px rgba(255,205,235,0.95)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <span
                className="font-mono text-[#ffedf7]/85 tabular-nums leading-none shrink-0"
                style={{ fontSize: 'clamp(7px, 0.64vw, 9.5px)' }}
              >
                {formatTime(duration)}
              </span>
            </div>

            {/* Favorite Heart */}
            <button
              type="button"
              onClick={() => toggleLike(63, 76)}
              aria-label="Favorite track"
              className="shrink-0 p-1 rounded-full hover:bg-white/10 active:scale-90 transition-all"
            >
              <Heart
                className={`w-[clamp(11px,1.08vw,15px)] h-[clamp(11px,1.08vw,15px)] transition-colors ${
                  isLiked ? 'fill-[#ff9fd0] text-[#ff9fd0]' : 'text-[#ffe6f3]/85 hover:text-white'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 5. INTERACTIVE MAKEUP PANS — Butterfly Blush (Fairy Shimmer) & Star Highlighter (Glitter CD Mode!) */}
        <button
          type="button"
          onClick={() => {
            sound.playClick(1280, 0.02);
            setFairyDust((v) => !v);
            spawnBurst(28, 74);
            setToast(!fairyDust ? 'Fairy Shimmer On ✦' : 'Fairy Shimmer Off');
          }}
          title="Tap Butterfly Blush — Toggle Fairy Shimmer"
          aria-label="Toggle fairy shimmer"
          className="absolute z-20 rounded-full hover:bg-white/[0.10] active:scale-[0.97] transition-all cursor-pointer"
          style={{
            left: '23.4%',
            top: '65.6%',
            width: '10.3%',
            height: '17.6%',
          }}
        />

        <button
          type="button"
          onClick={() => {
            sound.playClick(1420, 0.02);
            setHoloCoverMode((v) => !v);
            glitterSweepRef.current = 0.0;
            spawnBurst(71, 74);
            setToast(!holoCoverMode ? 'Cover Hologram CD ✦' : 'Pure Rainbow Chrome CD ✦');
          }}
          title="Tap Star Highlighter — Glitter Sweep & Switch CD Finish"
          aria-label="Toggle cover hologram CD"
          className="absolute z-20 rounded-full hover:bg-white/[0.12] active:scale-[0.97] transition-all cursor-pointer"
          style={{
            left: '66.2%',
            top: '65.6%',
            width: '10.3%',
            height: '17.6%',
          }}
        />

        {/* Sparkle Bursts when liking or tapping pans */}
        <AnimatePresence>
          {bursts.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 1, scale: 0.4 }}
              animate={{ opacity: 0, scale: 1.8, y: -26 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="pointer-events-none absolute z-40 text-white drop-shadow-[0_0_10px_rgba(255,160,215,1)]"
              style={{ left: `${b.x}%`, top: `${b.y}%` }}
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Subtle Luxury Rose-Pink Feedback Pill */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="pointer-events-none absolute bottom-[3.5%] left-1/2 -translate-x-1/2 z-40 px-3.5 py-1 rounded-full bg-[#4a1832]/88 border border-[#ffd8ec]/50 text-[#fff0f8] font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur-xl shadow-lg"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Frosted Jelly-Pink Playlist Queue Overlay (triggered from the top-right ☰ Lucite button!) */}
        <AnimatePresence>
          {showQueue && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="absolute right-[15%] top-[26.5%] z-40 w-[29%] min-w-[230px] max-w-[340px] max-h-[58%] rounded-[18px] overflow-hidden flex flex-col backdrop-blur-2xl"
              style={{
                background:
                  'linear-gradient(155deg, rgba(84,28,58,0.92) 0%, rgba(52,16,36,0.95) 100%)',
                border: '1px solid rgba(255,214,238,0.48)',
                boxShadow: '0 22px 60px rgba(48,10,30,0.55), inset 0 1px 0 rgba(255,235,246,0.34)',
              }}
            >
              <div className="px-4 py-3 border-b border-[#ffd8ec]/20 flex items-center justify-between">
                <div>
                  <div className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-[#ffc4e2]/80">
                    UP NEXT · {tracks.length} TRACKS
                  </div>
                  <div
                    className="text-white leading-tight mt-0.5 truncate max-w-[210px]"
                    style={{ fontFamily: "'Dancing Script', cursive", fontSize: 19 }}
                  >
                    {playlistTitle || 'certifiedbaddie.club'} ♡
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setShowQueue(false);
                  }}
                  className="p-1.5 rounded-full text-[#ffd8ec]/80 hover:text-white hover:bg-white/10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                {tracks.map((tr, idx) => {
                  const isCurr = idx === activeIndex;
                  return (
                    <button
                      key={`${tr.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        sound.playDiscSpin();
                        onSelectTrack(idx);
                      }}
                      className={`w-full px-2.5 py-2 rounded-[10px] flex items-center gap-2.5 text-left transition-all ${
                        isCurr
                          ? 'bg-[#ffaad6]/26 border border-[#ffd8ec]/45 text-white'
                          : 'hover:bg-white/[0.08] text-[#fce4ef]/85 border border-transparent'
                      }`}
                    >
                      <span className="font-mono text-[9px] text-[#ffb8de] w-5 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-sans text-[11.5px] truncate flex-1">
                        {cleanDisplayTitle(tr.title)}
                      </span>
                      {isCurr && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isPlaying ? 'bg-[#ffaad6] animate-pulse' : 'bg-white/50'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
