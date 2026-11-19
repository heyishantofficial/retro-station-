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
  FULLSCREEN_VERTEX_SHADER,
  createShaderProgram,
  bindFullscreenQuad,
} from '../../utils/webgl';
import { useDiscScrub } from '../../hooks/useDiscScrub';
import { sound } from '../../utils/soundEffects';

const CHROMA_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_uv;

  uniform vec2 u_resolution;
  uniform vec3 u_color;      // Smoothly interpolated dominant color extracted from song cover art!
  uniform float u_angle;
  uniform float u_time;
  uniform vec2 u_mouse;

  float hash1(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
      mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    float minDim = min(u_resolution.x, u_resolution.y);
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / minDim;
    // Slight upward lift so bottom minimal controls never clip the vinyl rim
    uv.y -= 0.032;

    float aa = 1.6 / minDim;

    // 1. Painted Fine Vertical Wood-Grain Studio Tabletop (matched to dominant cover color!)
    float grainFine = noise(vec2(uv.x * 260.0, uv.y * 8.0));
    float grainMed = noise(vec2(uv.x * 58.0, uv.y * 2.5));
    float woodStreak = (grainFine - 0.5) * 0.065 + (grainMed - 0.5) * 0.045;

    // Directional studio softbox light from top-left -> subtle vignette bottom-right
    float studioLight = 1.12 - 0.38 * length(uv - vec2(-0.36, 0.36));
    vec3 tableCol = u_color * (0.94 + woodStreak) * studioLight;
    // Subtle sunlit sheen in upper-left corner
    tableCol += vec3(0.14) * exp(-length(uv - vec2(-0.55, 0.45)) * 2.2);

    float outerR = 0.375;
    float labelR = 0.125;
    float holeR = 0.017;

    // 2. Deep Realistic Directional Cast Shadow (offset down-right from top-left light)
    vec2 shadowUv = uv - vec2(0.028, -0.032);
    float sDist = length(shadowUv);
    float dropShadow = 1.0 - smoothstep(outerR - 0.025, outerR + 0.055, sDist);
    float contactShadow = 1.0 - smoothstep(outerR - 0.005, outerR + 0.018, length(uv - vec2(0.008, -0.010)));
    tableCol *= (1.0 - dropShadow * 0.48) * (1.0 - contactShadow * 0.36);

    vec3 col = tableCol;

    // 3. Glossy Monochromatic Translucent Colored Vinyl Record
    float r = length(uv);
    float discMask = 1.0 - smoothstep(outerR - aa, outerR + aa, r);

    if (discMask > 0.001) {
      float theta = atan(uv.y, uv.x);
      // WebGL Y-up: +u_angle spins clockwise!
      float rotTheta = theta + u_angle;

      // Concentric fine vinyl grooves + subtle LP track dividers
      float groove1 = sin(r * 1350.0) * 0.5 + 0.5;
      float groove2 = sin(r * 2700.0 + hash1(floor(r * 450.0)) * 6.28) * 0.5 + 0.5;
      float band1 = exp(-pow((r - 0.205) * 280.0, 2.0));
      float band2 = exp(-pow((r - 0.290) * 280.0, 2.0));
      float band3 = exp(-pow((r - 0.348) * 280.0, 2.0));
      float trackGap = clamp(band1 + band2 + band3, 0.0, 1.0);

      // Sharp glossy specular reflection cones (top-left & bottom-right like reference photo!)
      float lightAng = 2.38 + u_mouse.x * 0.22 + sin(u_time * 0.3) * 0.02;
      float anisoBroad = pow(abs(cos(theta - lightAng)), 4.2);
      float anisoSharp = pow(abs(cos(theta - lightAng)), 16.0);
      float anisoRazor = pow(abs(cos(theta - lightAng)), 42.0);
      float rotShimmer = 0.94 + 0.06 * sin(rotTheta * 3.0 + r * 40.0);

      // Deep rich translucent acrylic vinyl body color
      float grooveShade = mix(0.82 + 0.20 * groove1 + 0.10 * groove2, 1.08, trackGap * 0.6);
      vec3 deepVinyl = u_color * (0.58 + 0.38 * anisoBroad) * grooveShade * rotShimmer;

      // Crisp bright white specular sheen streaking across the grooves
      float specHighlight = (anisoSharp * 0.52 + anisoRazor * 0.62) * (0.72 + 0.45 * groove1);
      // Raised outer glossy rim catchlight (bright top-left, shadowed bottom-right)
      float rimDir = clamp(dot(normalize(uv + vec2(0.0001)), normalize(vec2(-0.7, 0.7))), 0.0, 1.0);
      float rimBevel = exp(-pow((r - (outerR - 0.0035)) * 340.0, 2.0)) * (0.28 + 0.85 * rimDir);
      // Inner lip step around center label
      float innerLip = exp(-pow((r - (labelR + 0.018)) * 180.0, 2.0)) * (0.18 + 0.32 * anisoBroad);

      vec3 vinylCol = deepVinyl + vec3(1.0, 0.98, 0.98) * (specHighlight + rimBevel + innerLip);

      // Matte obsidian black center label with razor-thin crisp white concentric circle!
      float labelMask = 1.0 - smoothstep(labelR - aa, labelR + aa, r);
      float labelGrain = (noise(uv * 240.0) - 0.5) * 0.022;
      vec3 labelCol = vec3(0.065, 0.065, 0.07) + labelGrain + vec3(0.03) * rimDir;

      // Thin crisp white hairline ring inside black center label (exact match to reference!)
      float whiteRing = exp(-pow((r - (labelR - 0.011)) * 680.0, 2.0));
      labelCol = mix(labelCol, vec3(0.92), whiteRing * 0.85);

      // Subtle inner shadow around label edge
      float labelEdgeShadow = exp(-pow((r - labelR) * 180.0, 2.0)) * 0.35;
      vinylCol *= (1.0 - labelEdgeShadow * (1.0 - labelMask));

      vinylCol = mix(vinylCol, labelCol, labelMask);

      // Center spindle hole showing the exact painted tabletop color straight through + crisp white inner bevel!
      float holeMask = 1.0 - smoothstep(holeR - aa, holeR + aa, r);
      float holeWhiteRim = exp(-pow((r - (holeR + 0.0018)) * 720.0, 2.0));
      vinylCol = mix(vinylCol, vec3(0.92), holeWhiteRim * 0.9);
      vinylCol = mix(vinylCol, tableCol * 0.88, holeMask);

      col = mix(col, vinylCol, discMask);
    }

    col = pow(clamp(col, 0.0, 1.0), vec3(0.96));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Perceptual Dominant Vivid Color Extractor from any song cover art!
function extractProminentColor(img: HTMLImageElement): [number, number, number] {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d');
  if (!ctx) return [0.76, 0.11, 0.09];

  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const crop = Math.min(nw, nh);
  ctx.drawImage(img, (nw - crop) / 2, (nh - crop) / 2, crop, crop, 0, 0, 48, 48);

  const data = ctx.getImageData(0, 0, 48, 48).data;

  // Hue histogram (24 buckets of 15 deg) weighted by perceptual chroma so the true hero color wins!
  const buckets = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

    // Ignore washed-out whites, pure blacks, and muddy greys
    if (s < 0.18 || l < 0.10 || l > 0.88) continue;

    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }

    const bIdx = Math.min(23, Math.floor(h * 24));
    // Favor vivid, mid-luminance iconic colors
    const weight = s * s * (1 - Math.abs(l - 0.45) * 1.4);
    if (weight <= 0) continue;

    buckets[bIdx].w += weight;
    buckets[bIdx].r += r * weight;
    buckets[bIdx].g += g * weight;
    buckets[bIdx].b += b * weight;
  }

  let best = buckets[0];
  for (const b of buckets) {
    if (b.w > best.w) best = b;
  }

  // Fallback to iconic gallery crimson if cover art is pure monochrome black & white
  if (best.w < 1.2) {
    return [0.76, 0.11, 0.09];
  }

  let r = best.r / best.w;
  let g = best.g / best.w;
  let b = best.b / best.w;

  // Normalize lightness slightly so the painted tabletop & glossy vinyl always look rich & gallery-balanced
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 0.24) {
    const boost = 0.28 / Math.max(0.05, lum);
    r = Math.min(0.88, r * boost);
    g = Math.min(0.88, g * boost);
    b = Math.min(0.88, b * boost);
  } else if (lum > 0.62) {
    const damp = 0.56 / lum;
    r *= damp;
    g *= damp;
    b *= damp;
  }

  return [r, g, b];
}

export const ChromaVinylView: React.FC<SharedViewProps> = ({
  tracks,
  activeIndex,
  isPlaying,
  currentTime,
  duration,
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
  const angleRadRef = useRef(0);

  // Live RGB color refs smoothly interpolating whenever track changes!
  const targetColorRef = useRef<[number, number, number]>([0.76, 0.11, 0.09]);
  const liveColorRef = useRef<[number, number, number]>([0.76, 0.11, 0.09]);
  const [accentHex, setAccentHex] = useState('#c21c17');

  const { containerRef, isScrubbing, scrubTime, scrubDelta, intensityBadge, handlers } =
    useDiscScrub({
      isPlaying,
      currentTime,
      duration,
      baseSpeed: 0.44,
      onTogglePlay,
      onSeek,
      onSetPlaybackRate,
      onFrame: (deg) => {
        angleRadRef.current = (deg * Math.PI) / 180;
      },
    });

  // Extract dominant color from active song cover art whenever track changes
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
        try {
          const [r, g, b] = extractProminentColor(img);
          targetColorRef.current = [r, g, b];
          const toHex = (v: number) =>
            Math.max(0, Math.min(255, Math.round(v * 255)))
              .toString(16)
              .padStart(2, '0');
          setAccentHex(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
        } catch {
          // ignore tainted canvas
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

  // WebGL Monochromatic Colored Vinyl Shader Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) return;

    const program = createShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, CHROMA_FRAGMENT_SHADER);
    if (!program) return;

    gl.useProgram(program);
    const quad = bindFullscreenQuad(gl, program);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uColor = gl.getUniformLocation(program, 'u_color');
    const uAngle = gl.getUniformLocation(program, 'u_angle');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');

    let rafId = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const render = (now: number) => {
      resize();
      smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.06;
      smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.06;

      // Smoothly melt entire room + vinyl color into the new song's prominent color!
      for (let i = 0; i < 3; i++) {
        liveColorRef.current[i] += (targetColorRef.current[i] - liveColorRef.current[i]) * 0.045;
      }

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform3f(
        uColor,
        liveColorRef.current[0],
        liveColorRef.current[1],
        liveColorRef.current[2]
      );
      gl.uniform1f(uAngle, angleRadRef.current);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, smoothMouseRef.current.x, smoothMouseRef.current.y);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
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

  return (
    <div
      onPointerMove={(e) => {
        mouseRef.current = {
          x: (e.clientX / window.innerWidth - 0.5) * 2,
          y: (e.clientY / window.innerHeight - 0.5) * 2,
        };
      }}
      className="relative w-full h-full overflow-hidden select-none flex items-center justify-center"
      style={{ backgroundColor: accentHex }}
    >
      {/* Fullscreen WebGL Dominant-Color Monochromatic Translucent Vinyl Shader */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Interactive Circular Drag-to-Scrub Target Centered Over the Colored Vinyl */}
      <div
        ref={containerRef}
        {...handlers}
        title="Click to Play/Pause • Hold & rotate vinyl to forward / rewind"
        style={{ transform: 'translateY(-3.2%)' }}
        className={`relative z-10 w-[min(75vh,75vw)] h-[min(75vh,75vw)] rounded-full flex items-center justify-center touch-none ${
          isScrubbing ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Tiny Micro-Label inside Bottom of Black Center Label (matching reference!) */}
        <div className="pointer-events-none relative w-[33%] h-[33%] rounded-full flex items-end justify-center pb-[12%]">
          <span className="font-mono text-[clamp(5.5px,0.55vw,7.5px)] tracking-[0.22em] uppercase text-white/75 truncate max-w-[68%]">
            {activeTrack?.artist}
          </span>
        </div>
      </div>

      {/* Minimal Matte Obsidian Control Pill Cleanly Below the Vinyl (Zero Overlap + Safe Area!) */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-2 rounded-full bg-[#0e0e0f]/82 backdrop-blur-2xl border border-white/15 text-white/90 shadow-[0_14px_38px_rgba(0,0,0,0.42)] max-w-[92vw]"
        style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => {
              sound.playDiscSpin();
              onPrev();
            }}
            aria-label="Previous track"
            className="touch-target-sm p-1 flex items-center justify-center text-white/60 hover:text-white transition-colors active:scale-90"
          >
            <SkipBack className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
          <button
            onClick={() => {
              sound.playSwitch();
              onTogglePlay();
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-9 h-9 sm:w-7 sm:h-7 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-colors active:scale-90"
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
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-3.5 w-px bg-white/15 shrink-0" />

        {/* Live Extracted Color Dot + Single-Line Song Title */}
        <div className="flex items-center gap-2 min-w-0 max-w-[180px] sm:max-w-[240px]">
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/40 shrink-0 transition-colors duration-700"
            style={{ backgroundColor: accentHex }}
            title={`Extracted color: ${accentHex}`}
          />
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white truncate">
            {title}
          </span>
        </div>

        <div className="font-mono text-[10px] tracking-wider tabular-nums text-white/55 shrink-0">
          <span className="text-white">{formatTime(displayTime)}</span>
          <span className="mx-1 opacity-40">/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <AnimatePresence>
          {isScrubbing && (intensityBadge || Math.abs(scrubDelta) >= 0.5) && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-mono text-[9.5px] text-white font-semibold tracking-wider shrink-0"
            >
              {intensityBadge} {Math.abs(scrubDelta) >= 0.5 ? formatDelta(scrubDelta) : ''}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
