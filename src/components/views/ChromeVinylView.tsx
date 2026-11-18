import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { SkipBack, SkipForward, Play, Pause, Volume2, VolumeX } from 'lucide-react';
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

const CHROME_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_uv;

  uniform sampler2D u_coverTex;
  uniform float u_hasCover;
  uniform vec2 u_resolution;
  uniform float u_angle;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform float u_playing;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float noise1D(float x) {
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), u);
  }

  float getCoverLuma(vec2 uv) {
    vec3 c = texture2D(u_coverTex, uv).rgb;
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    float minDim = min(u_resolution.x, u_resolution.y);
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / minDim;

    float r = length(uv);
    float outerR = 0.445;
    float labelR = 0.155;
    float holeR = 0.021;

    float aa = 1.6 / minDim;
    float discMask = 1.0 - smoothstep(outerR - aa, outerR + aa, r);
    if (discMask <= 0.001) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    float theta = atan(uv.y, uv.x);
    // WebGL Y points up: +u_angle inverse UV rotation spins the disc CLOCKWISE
    float rotTheta = theta + u_angle;

    vec2 rotUv = vec2(
      uv.x * cos(u_angle) - uv.y * sin(u_angle),
      uv.x * sin(u_angle) + uv.y * cos(u_angle)
    );
    vec2 texUv = (rotUv / (outerR * 2.0)) + 0.5;
    texUv.y = 1.0 - texUv.y;

    // Procedural brushed aluminum + fine vinyl micro-grooves
    float grooveBase = sin(r * 1380.0) * 0.5 + 0.5;
    float grooveFine = sin(r * 2850.0 + noise1D(r * 220.0) * 6.28) * 0.5 + 0.5;
    float trackBands = smoothstep(labelR + 0.018, labelR + 0.022, r) * (1.0 - smoothstep(outerR - 0.012, outerR - 0.008, r));

    // Subtle LP track dividers
    float band1 = exp(-pow((r - 0.250) * 260.0, 2.0));
    float band2 = exp(-pow((r - 0.335) * 260.0, 2.0));
    float band3 = exp(-pow((r - 0.405) * 260.0, 2.0));
    float trackGap = clamp(band1 + band2 + band3, 0.0, 1.0);

    // Anisotropic metallic radial streaks
    float streakNoise =
      noise1D(r * 540.0) * 0.55 +
      noise1D(r * 1120.0 + sin(rotTheta * 2.0) * 0.6) * 0.30 +
      noise1D(r * 2100.0 + cos(rotTheta * 3.0) * 0.4) * 0.15;

    // Dual studio softbox lights subtly tracking mouse parallax
    float lightAngle = 0.68 + u_mouse.x * 0.28 + sin(u_time * 0.35) * 0.03;
    vec2 lightDir = vec2(cos(lightAngle), sin(lightAngle));

    float anisoPrimary = pow(abs(cos(theta - lightAngle)), 5.2);
    float anisoSharp = pow(abs(cos(theta - lightAngle)), 22.0);
    float anisoSecondary = pow(abs(cos(theta - (lightAngle + 1.48))), 12.0) * 0.22;
    float anisoCross = pow(abs(sin(theta - lightAngle)), 3.0) * 0.11;

    // Laser-etched / chrome-plated cover art relief
    float coverAlbedo = 1.0;
    float coverBump = 0.0;
    vec3 chromeTint = vec3(0.97, 0.985, 1.0);

    if (u_hasCover > 0.5) {
      vec3 coverRgb = texture2D(u_coverTex, texUv).rgb;
      float luma = dot(coverRgb, vec3(0.299, 0.587, 0.114));

      float eps = 0.0045;
      float lR = getCoverLuma(texUv + vec2(eps, 0.0));
      float lL = getCoverLuma(texUv - vec2(eps, 0.0));
      float lU = getCoverLuma(texUv + vec2(0.0, eps));
      float lD = getCoverLuma(texUv - vec2(0.0, eps));
      vec2 grad = vec2(lR - lL, lD - lU);

      coverBump = dot(grad, lightDir) * 1.85;

      float contrastLuma = smoothstep(0.05, 0.94, luma);
      coverAlbedo = mix(0.36, 1.24, contrastLuma);

      vec3 silverMono = vec3(0.97, 0.985, 1.0);
      chromeTint = mix(silverMono, clamp(coverRgb * 1.15 + 0.18, 0.25, 1.15), 0.24);
    }

    float metalBase = (0.16 + anisoCross + anisoSecondary) * coverAlbedo;
    float metalSpec =
      anisoPrimary * (0.52 + 0.28 * streakNoise) * mix(0.65, 1.18, clamp(coverAlbedo * 0.85, 0.0, 1.0)) +
      anisoSharp * (0.50 + 0.24 * grooveBase) +
      max(0.0, coverBump) * (0.34 + 0.55 * anisoPrimary);

    float grooveMod = mix(0.84 + 0.22 * grooveFine + 0.12 * grooveBase, 1.15, trackGap * 0.65);
    float chromeVal = max(0.02, (metalBase + metalSpec + coverBump * 0.18) * grooveMod);

    float rimBevel = exp(-pow((r - (outerR - 0.0025)) * 420.0, 2.0)) * (0.45 + 0.55 * anisoPrimary);
    float innerRim = exp(-pow((r - (labelR + 0.002)) * 380.0, 2.0)) * 0.38;

    vec3 vinylColor = vec3(chromeVal) * chromeTint + vec3(rimBevel + innerRim);
    vinylColor += vec3(1.0) * pow(anisoSharp, 1.6) * 0.35;

    // Matte brushed-silver center label
    float labelMask = 1.0 - smoothstep(labelR - aa, labelR + aa, r);
    float labelGrain = (noise1D(uv.x * 420.0 + uv.y * 310.0) - 0.5) * 0.015;
    float labelGrad = 0.68 + 0.06 * dot(normalize(uv + vec2(0.0001)), lightDir) + labelGrain;
    float centerRing = exp(-pow((r - 0.058) * 650.0, 2.0));
    vec3 labelColor = vec3(labelGrad) * (1.0 - centerRing * 0.35);

    float labelShadow = exp(-pow((r - labelR) * 140.0, 2.0)) * 0.32;
    vinylColor *= (1.0 - labelShadow * (1.0 - labelMask));

    vec3 col = mix(vinylColor * trackBands + vinylColor * (1.0 - trackBands) * 0.80, labelColor, labelMask);

    float holeMask = 1.0 - smoothstep(holeR - aa, holeR + aa, r);
    col = mix(col, vec3(0.01), holeMask);

    col = col / (1.0 + col * 0.22);
    col = pow(clamp(col, 0.0, 1.0), vec3(0.95));
    col *= discMask;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const ChromeVinylView: React.FC<SharedViewProps> = ({
  playlistTitle,
  tracks,
  activeIndex,
  isPlaying,
  currentTime,
  duration,
  isMuted,
  onSelectTrack,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onSetPlaybackRate,
  onToggleMute,
}) => {
  const activeTrack = tracks[activeIndex] || tracks[0];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouseRef = useRef({ x: 0, y: 0 });
  const angleRadRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);

  // Single, deterministic 180° 3D Record Flip using MotionValues (zero double-flip or React race!)
  const prevIndexRef = useRef(activeIndex);
  const lastFlippedIdRef = useRef(activeTrack?.id);
  const flipSeqRef = useRef(0);
  const [displayedTrack, setDisplayedTrack] = React.useState(activeTrack);
  const [flipSide, setFlipSide] = React.useState<'A' | 'B'>('A');

  const flipRotateY = useMotionValue(0);
  const flipScale = useMotionValue(1);

  const glRef = useRef<WebGLRenderingContext | null>(null);
  const coverTexRef = useRef<WebGLTexture | null>(null);
  const hasCoverRef = useRef(0);
  // Instant in-memory 512x512 square cover cache so flipped faces are ALREADY ready on GPU at exact 90°!
  const coverCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const loadCoverCanvas = React.useCallback((track: typeof activeTrack): Promise<HTMLCanvasElement | null> => {
    if (!track) return Promise.resolve(null);
    const cached = coverCacheRef.current.get(track.id);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve) => {
      const makeSquare = (img: HTMLImageElement) => {
        const sq = document.createElement('canvas');
        sq.width = 512;
        sq.height = 512;
        const ctx = sq.getContext('2d');
        if (!ctx) return null;

        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        const aspect = nw / nh;
        let cropSize = Math.min(nw, nh);
        if (track.youtubeId && aspect > 1.25 && aspect < 1.48) {
          cropSize = nh * 0.72;
        }
        const sx = (nw - cropSize) / 2;
        const sy = (nh - cropSize) / 2;
        ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, 512, 512);
        coverCacheRef.current.set(track.id, sq);
        return sq;
      };

      const tryUrl = (url: string, allowFallback: boolean) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (track.youtubeId && img.naturalWidth <= 120 && allowFallback) {
            tryUrl(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`, false);
            return;
          }
          resolve(makeSquare(img));
        };
        img.onerror = () => {
          if (track.youtubeId && allowFallback) {
            tryUrl(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`, false);
          } else {
            resolve(null);
          }
        };
        img.src = url;
      };

      tryUrl(getBestCoverUrl(track), true);
    });
  }, []);

  const uploadCanvasToGPU = React.useCallback((sq: HTMLCanvasElement | null) => {
    const gl = glRef.current;
    const tex = coverTexRef.current;
    if (!gl || !tex || !sq) return;
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sq);
      hasCoverRef.current = 1;
    } catch {
      hasCoverRef.current = 0;
    }
  }, []);

  // Quietly pre-warm neighboring playlist track covers into memory so flips are 100% instant
  useEffect(() => {
    const neighbors = [
      tracks[(activeIndex + 1) % tracks.length],
      tracks[(activeIndex - 1 + tracks.length) % tracks.length],
      tracks[(activeIndex + 2) % tracks.length],
    ].filter(Boolean);
    neighbors.forEach((t) => {
      if (t && !coverCacheRef.current.has(t.id)) {
        loadCoverCanvas(t);
      }
    });
  }, [activeIndex, tracks, loadCoverCanvas]);

  // Trigger ONE slow, luxurious 180° flip per song change — preloading the new cover in parallel
  // so the GPU swaps cover art synchronously at the EXACT invisible 90° edge-on frame!
  useEffect(() => {
    if (!activeTrack?.id || activeTrack.id === lastFlippedIdRef.current) return;

    const dir = activeIndex >= prevIndexRef.current ? 1 : -1;
    prevIndexRef.current = activeIndex;
    lastFlippedIdRef.current = activeTrack.id;

    const seq = ++flipSeqRef.current;

    const runSingleFlip = async () => {
      // Start fetching & square-cropping the new song's cover art IMMEDIATELY in parallel!
      const coverPromise = Promise.race([
        loadCoverCanvas(activeTrack),
        new Promise<null>((r) => window.setTimeout(() => r(null), 900)),
      ]);

      // Half 1: Slow, weighted ease-in from current angle -> ±90° (edge-on)
      const outRot = animate(flipRotateY, dir * 90, {
        duration: 0.56,
        ease: [0.36, 0, 0.82, 0.52],
      });
      const outScale = animate(flipScale, 0.92, {
        duration: 0.56,
        ease: [0.36, 0, 0.82, 0.52],
      });

      // Wait for BOTH Half 1 reaching 90° edge-on AND the new cover art being ready!
      const [, readyCanvas] = await Promise.all([
        Promise.all([outRot.finished, outScale.finished]),
        coverPromise,
      ]);

      if (seq !== flipSeqRef.current) return;

      // Exact edge-on 90° instant: synchronously upload the NEW cover texture to GPU + swap label + Side A/B!
      if (readyCanvas) {
        uploadCanvasToGPU(readyCanvas);
      }
      setDisplayedTrack(activeTrack);
      setFlipSide((s) => (s === 'A' ? 'B' : 'A'));
      flipRotateY.jump(-dir * 90);

      // Half 2: Slow, velvety ease-out reveal from -/+90° -> 0° with the new cover already rendered!
      animate(flipRotateY, 0, {
        duration: 0.68,
        ease: [0.16, 1, 0.3, 1],
      });
      animate(flipScale, 1, {
        duration: 0.68,
        ease: [0.16, 1, 0.3, 1],
      });
    };

    runSingleFlip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrack?.id]);

  useEffect(() => {
    const activeRow = rowRefs.current[activeIndex];
    if (activeRow) {
      activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex]);

  const { containerRef, isScrubbing, scrubTime, scrubDelta, intensityBadge, handlers } =
    useDiscScrub({
      isPlaying,
      currentTime,
      duration,
      baseSpeed: 0.42,
      onTogglePlay,
      onSeek,
      onSetPlaybackRate,
      onFrame: (deg) => {
        angleRadRef.current = (deg * Math.PI) / 180;
      },
    });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) return;
    glRef.current = gl;

    const program = createShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, CHROME_FRAGMENT_SHADER);
    if (!program) return;

    gl.useProgram(program);
    const quadBuffer = bindFullscreenQuad(gl, program);

    const tex = gl.createTexture();
    coverTexRef.current = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
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
      new Uint8Array([180, 180, 180, 255])
    );

    const uCoverTex = gl.getUniformLocation(program, 'u_coverTex');
    const uHasCover = gl.getUniformLocation(program, 'u_hasCover');
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uAngle = gl.getUniformLocation(program, 'u_angle');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uPlaying = gl.getUniformLocation(program, 'u_playing');

    gl.uniform1i(uCoverTex, 0);

    if (displayedTrack) {
      loadCoverCanvas(displayedTrack).then((sq) => {
        uploadCanvasToGPU(sq);
      });
    }

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

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);

      gl.uniform1f(uHasCover, hasCoverRef.current);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uAngle, angleRadRef.current);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, smoothMouseRef.current.x, smoothMouseRef.current.y);
      gl.uniform1f(uPlaying, isPlayingRef.current ? 1.0 : 0.0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      gl.deleteTexture(tex);
      gl.deleteBuffer(quadBuffer);
      gl.deleteProgram(program);
      glRef.current = null;
      coverTexRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const discLabelTitle = cleanDisplayTitle(displayedTrack?.title || 'UNTITLED');
  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const pct = duration > 0 ? Math.max(0, Math.min(100, (displayTime / duration) * 100)) : 0;

  return (
    <div
      onPointerMove={(e) => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        mouseRef.current = { x: nx, y: ny };
      }}
      className="relative w-full h-full bg-black overflow-hidden select-none flex items-center"
    >
      {/* LEFT STAGE: Dedicated WebGL Laser-Etched Brushed-Chrome Vinyl with Physical 180° 3D Flip! */}
      <div
        className="relative w-[54%] sm:w-[56%] h-full flex items-center justify-center shrink-0"
        style={{ perspective: '1400px' }}
      >
        <motion.div
          style={{
            rotateY: flipRotateY,
            scale: flipScale,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
          className="relative w-full h-full flex items-center justify-center"
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

          {/* Interactive Circular Hit-Target Centered Over the Left-Stage WebGL Vinyl */}
          <div
            ref={containerRef}
            {...handlers}
            title="Click to Play/Pause • Hold & rotate chrome vinyl to forward / rewind"
            className={`relative z-10 w-[min(86vh,48vw)] h-[min(86vh,48vw)] rounded-full flex items-center justify-center touch-none ${isScrubbing ? 'cursor-grabbing' : 'cursor-grab'
              }`}
          >
            {/* Cleanly Spaced Matte-Silver Center Label Typography (Swaps Invisibly at 90° Edge-On) */}
            <div className="pointer-events-none relative w-[34.5%] h-[34.5%] rounded-full text-[#121212] text-center">
              <div className="absolute top-[15%] inset-x-[12%]">
                <div className="font-sans font-bold text-[clamp(7.5px,0.95vw,12px)] tracking-[0.2em] uppercase truncate">
                  {discLabelTitle}
                </div>
              </div>

              <div className="absolute top-1/2 -translate-y-1/2 inset-x-[10%] flex items-center justify-between font-mono text-[clamp(5px,0.52vw,7px)] tracking-[0.14em] uppercase opacity-55">
                <span>SIDE {flipSide}</span>
                <span>33⅓ RPM</span>
              </div>

              <div className="absolute bottom-[15%] inset-x-[14%] font-mono text-[clamp(5.5px,0.58vw,8px)] tracking-[0.14em] uppercase opacity-65 truncate">
                {displayedTrack?.artist}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* RIGHT STAGE: Translucent Smoked-Glass Playlist & Playback Controls */}
      <div className="flex-1 h-full flex items-center justify-center pr-6 sm:pr-10 lg:pr-14 pl-2 py-12 z-20">
        <div className="w-full max-w-[440px] max-h-[82vh] rounded-2xl bg-white/[0.035] backdrop-blur-2xl border border-white/[0.09] shadow-[0_24px_60px_rgba(0,0,0,0.65)] p-5 sm:p-6 flex flex-col">
          {/* Active Track Single-Line Header */}
          <div className="pb-4 border-b border-white/[0.08]">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1.5">
              <span className="truncate pr-3">{playlistTitle}</span>
              <span className="tabular-nums shrink-0">
                {String(activeIndex + 1).padStart(2, '0')} / {String(tracks.length).padStart(2, '0')}
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTrack?.id + '-title'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.24 }}
              >
                <h1
                  title={title}
                  className="font-sans font-semibold text-xl sm:text-2xl tracking-tight text-white uppercase truncate whitespace-nowrap"
                >
                  {title}
                </h1>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50 mt-1 truncate">
                  {activeTrack?.artist}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Translucent Scrollable Playlist */}
          <div className="flex-1 min-h-0 overflow-y-auto py-3 pr-1 space-y-1">
            {tracks.map((track, idx) => {
              const isActive = idx === activeIndex;
              const thumbUrl = track.youtubeId
                ? `https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`
                : track.coverUrl;

              return (
                <button
                  key={track.id}
                  ref={(el) => {
                    rowRefs.current[idx] = el;
                  }}
                  onClick={() => {
                    if (isActive) {
                      sound.playSwitch();
                      onTogglePlay();
                    } else {
                      sound.playDiscSpin();
                      onSelectTrack(idx);
                    }
                  }}
                  className="relative w-full group flex items-center gap-3 py-1.5 px-2.5 rounded-xl transition-colors text-left hover:bg-white/[0.05]"
                >
                  {isActive && (
                    <motion.div
                      layoutId="chrome-active-row"
                      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                      className="absolute inset-0 rounded-xl bg-white/[0.09] border border-white/[0.08] pointer-events-none"
                    />
                  )}

                  <span
                    className={`relative z-10 w-5 font-mono text-[9.5px] tabular-nums ${isActive ? 'text-white font-semibold' : 'text-white/35 group-hover:text-white/60'
                      }`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <div className="relative z-10 w-8 h-8 rounded-[4px] overflow-hidden shrink-0 bg-white/10 border border-white/10">
                    <img
                      src={thumbUrl}
                      alt={track.title}
                      className="w-full h-full object-cover scale-[1.06] filter grayscale-[45%] contrast-[1.1]"
                      draggable={false}
                    />
                  </div>

                  <div className="relative z-10 flex-1 min-w-0">
                    <div
                      className={`font-mono text-[10.5px] uppercase tracking-[0.06em] truncate ${isActive ? 'text-white font-semibold' : 'text-white/75'
                        }`}
                    >
                      {cleanDisplayTitle(track.title)}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-white/35 truncate mt-0.5">
                      {track.artist}
                    </div>
                  </div>

                  <div className="relative z-10 shrink-0 font-mono text-[9.5px] tabular-nums">
                    {isActive && isPlaying ? (
                      <span className="text-white text-[8.5px] tracking-[0.16em] uppercase">
                        PLAYING
                      </span>
                    ) : (
                      <span className="text-white/40">{formatTime(track.duration)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Translucent Progress Bar + Playback Controls */}
          <div className="pt-3.5 border-t border-white/[0.08] space-y-3">
            {/* Clickable Silver Hairline Scrubber */}
            <div className="space-y-1.5">
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  sound.playClick(1100, 0.015);
                  onSeek(ratio * duration);
                }}
                className="w-full h-1 bg-white/15 rounded-full overflow-hidden cursor-pointer group"
              >
                <div
                  className="h-full bg-white transition-[width] duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between font-mono text-[9.5px] tracking-wider tabular-nums text-white/45">
                <span className="text-white/85">{formatTime(displayTime)}</span>
                <AnimatePresence>
                  {isScrubbing && (intensityBadge || Math.abs(scrubDelta) >= 0.5) && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-white font-semibold tracking-widest"
                    >
                      {intensityBadge} {Math.abs(scrubDelta) >= 0.5 ? formatDelta(scrubDelta) : ''}
                    </motion.span>
                  )}
                </AnimatePresence>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Minimal Controls Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    sound.playDiscSpin();
                    onPrev();
                  }}
                  title="Previous (←)"
                  className="p-1.5 text-white/55 hover:text-white transition-colors active:scale-90"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    sound.playSwitch();
                    onTogglePlay();
                  }}
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-colors active:scale-90"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-black" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-black translate-x-[0.5px]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    sound.playDiscSpin();
                    onNext();
                  }}
                  title="Next (→)"
                  className="p-1.5 text-white/55 hover:text-white transition-colors active:scale-90"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => {
                  sound.playClick();
                  onToggleMute();
                }}
                title={isMuted ? 'Unmute' : 'Mute'}
                className="p-1.5 text-white/45 hover:text-white transition-colors active:scale-90"
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
