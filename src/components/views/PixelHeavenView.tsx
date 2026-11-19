import React, { useEffect, useRef, useState } from 'react';
import {
  SharedViewProps,
  cleanDisplayTitle,
  formatTime,
  formatDelta,
  getBestCoverUrl,
} from '../../utils/viewCatalog';
import { useDiscScrub } from '../../hooks/useDiscScrub';
import { sound } from '../../utils/soundEffects';

// Fixed vertical pixel-art resolution (270px tall -> exact 3x/4x razor-sharp pixels on 1080p/1440p!)
// Width dynamically matches viewport aspect ratio so BOTH hands always stay flush to the screen edges!
const PH = 270;

// Exact sprite geometry matching /public/pixel-heaven/*.png generated at SCALE = 0.52
const LEFT_BLEED_X = 18;
const LEFT_BLEED_Y = 25;
const VINYL_BASE_X = 124;
const VINYL_BASE_Y = 108;
const VINYL_R = 90;
const LABEL_R = 30;
// Note: hand-right.png is 464x344px with a seamlessly extended forearm so it ALWAYS reaches past the screen edge!

// 4x4 Bayer Ordered Dithering Matrix normalized to [-0.5, +0.5]
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16 - 0.5));

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  bright: boolean;
}

/**
 * Pre-renders the hyper-detailed 16-bit Bayer-dithered glossy black LP disc once into an offscreen buffer
 * matching the exact reflective grooves and proportions of the original Renaissance vinyl artwork.
 */
function buildPixelVinylBuffer(): HTMLCanvasElement {
  const size = (VINYL_R + 2) * 2;
  const cx = size / 2;
  const cy = size / 2;
  const buf = document.createElement('canvas');
  buf.width = size;
  buf.height = size;
  const ctx = buf.getContext('2d');
  if (!ctx) return buf;

  const img = ctx.createImageData(size, size);
  const data = img.data;
  const r2 = VINYL_R * VINYL_R;
  const labelR2 = (LABEL_R - 1) * (LABEL_R - 1);

  for (let y = 0; y < size; y++) {
    const dy = y - cy;
    const bRow = BAYER_4X4[y & 3];
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dist2 = dx * dx + dy * dy;
      if (dist2 > r2 || dist2 < labelR2) continue;

      const dist = Math.sqrt(dist2);
      const theta = Math.atan2(dy, dx);

      // Authentic diagonal anisotropic reflection cones (matching the reference photo's upper-left & lower-right sheen!)
      const sheenPrimary = Math.pow(Math.abs(Math.cos(theta - 0.62)), 5.5);
      const sheenSecondary = Math.pow(Math.abs(Math.cos(theta + 0.95)), 14) * 0.35;
      const sheen = sheenPrimary + sheenSecondary;

      // Crisp concentric micro-grooves + 3 subtle LP track divider bands
      const fineGroove = (Math.floor(dist) % 2 === 0 ? 1 : 0) * 0.085;
      const midGroove = Math.sin(dist * 1.9) * 0.035;
      const trackGap =
        Math.abs(dist - 47) < 0.85 || Math.abs(dist - 66) < 0.85 || Math.abs(dist - 81) < 0.85
          ? 0.14
          : 0;

      // Subtle crisp silver-grey outer vinyl lip highlight + lead-out inner groove sheen
      const outerBevel = dist > VINYL_R - 1.7 ? 0.22 + sheenPrimary * 0.22 : 0;
      const innerRunout = dist < LABEL_R + 4.5 ? 0.08 * sheenPrimary : 0;

      const lum =
        0.045 +
        sheen * 0.31 +
        fineGroove * (0.45 + sheen * 1.4) +
        midGroove * (0.5 + sheen) +
        trackGap * (0.35 + sheen) +
        outerBevel +
        innerRunout;

      const q = lum + bRow[x & 3] * 0.095;

      let r = 10,
        g = 11,
        b = 13;
      if (q > 0.44) {
        r = 124;
        g = 128;
        b = 132;
      } else if (q > 0.34) {
        r = 88;
        g = 92;
        b = 96;
      } else if (q > 0.24) {
        r = 58;
        g = 60;
        b = 64;
      } else if (q > 0.16) {
        r = 35;
        g = 37;
        b = 40;
      } else if (q > 0.095) {
        r = 20;
        g = 22;
        b = 25;
      }

      const p = (y * size + x) * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return buf;
}

export const PixelHeavenView: React.FC<SharedViewProps> = ({
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Preloaded razor-sharp pixel art layers
  const skyImgRef = useRef<HTMLImageElement | null>(null);
  const handLeftImgRef = useRef<HTMLImageElement | null>(null);
  const handRightImgRef = useRef<HTMLImageElement | null>(null);
  const vinylBufRef = useRef<HTMLCanvasElement | null>(null);
  const coverBufRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<SparkParticle[]>([]);

  // Dynamic virtual canvas width so pixel grid fills 100% of any desktop viewport with 1:1 square pixels;
  // on portrait phones (< md), lock a crisp 1:1-pixel 420x270 stage so the vinyl NEVER stretches into an oval!
  const [virtualWidth, setVirtualWidth] = useState<number>(480);
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(false);
  const virtualWidthRef = useRef<number>(480);

  // Live animation refs
  const angleDegRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const isScrubbingRef = useRef(false);
  const handReachRef = useRef(isPlaying ? 1 : 0);
  const handoffProgressRef = useRef(1);
  const lastTrackIdRef = useRef(activeTrack?.id);

  // Hover states for crisp retro pixel HUD buttons + scrollable Up Next offset
  const [hoveredBtn, setHoveredBtn] = useState<'prev' | 'play' | 'next' | null>(null);
  const [upNextOffset, setUpNextOffset] = useState<number>(0);

  // Reset Up Next scroll offset whenever active track changes
  useEffect(() => {
    setUpNextOffset(0);
  }, [activeIndex, tracks.length]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Subtle divine hand-down settle when changing songs
  useEffect(() => {
    if (activeTrack?.id && activeTrack.id !== lastTrackIdRef.current) {
      lastTrackIdRef.current = activeTrack.id;
      handoffProgressRef.current = 0;
    }
  }, [activeTrack?.id]);

  // Track viewport aspect ratio so PW matches exact screen aspect (both hands stay flush to screen edges!)
  useEffect(() => {
    const updateSize = () => {
      const el = stageRef.current;
      const w = el ? el.clientWidth : window.innerWidth;
      const h = el ? el.clientHeight : window.innerHeight;
      if (w > 0 && h > 0) {
        const portrait = w < 768 && h > w;
        setIsPortraitMobile(portrait);
        const nextPW = portrait
          ? 400
          : Math.max(360, Math.min(620, Math.round(PH * (w / h))));
        virtualWidthRef.current = nextPW;
        setVirtualWidth(nextPW);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Load crisp pre-baked pixel-art layers + build pixel vinyl buffer once
  useEffect(() => {
    vinylBufRef.current = buildPixelVinylBuffer();

    const loadImg = (src: string, target: React.MutableRefObject<HTMLImageElement | null>) => {
      const img = new Image();
      img.onload = () => {
        target.current = img;
      };
      img.src = src;
    };

    loadImg('/pixel-heaven/sky.png', skyImgRef);
    loadImg('/pixel-heaven/hand-left.png', handLeftImgRef);
    loadImg('/pixel-heaven/hand-right.png', handRightImgRef);
  }, []);

  // Pre-bake 16-bit Bayer-dithered circular center label from active song cover art
  useEffect(() => {
    if (!activeTrack) return;
    let cancelled = false;

    const loadCover = (url: string, allowFallback: boolean) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        if (activeTrack.youtubeId && img.naturalWidth <= 120 && allowFallback) {
          loadCover(`https://i.ytimg.com/vi/${activeTrack.youtubeId}/mqdefault.jpg`, false);
          return;
        }
        const sz = LABEL_R * 2;
        const small = document.createElement('canvas');
        small.width = sz;
        small.height = sz;
        const sctx = small.getContext('2d');
        if (!sctx) return;
        sctx.imageSmoothingEnabled = true;

        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        const aspect = nw / nh;
        const crop =
          activeTrack.youtubeId && aspect > 1.25 && aspect < 1.48 ? nh * 0.72 : Math.min(nw, nh);
        sctx.drawImage(img, (nw - crop) / 2, (nh - crop) / 2, crop, crop, 0, 0, sz, sz);

        // Quantize & subtly mute into cohesive dark vintage LP label aesthetic with 4x4 Bayer dither
        const imgData = sctx.getImageData(0, 0, sz, sz);
        const d = imgData.data;
        for (let y = 0; y < sz; y++) {
          const bRow = BAYER_4X4[y & 3];
          for (let x = 0; x < sz; x++) {
            const idx = (y * sz + x) * 4;
            const bayer = bRow[x & 3] * 24;
            // Subtle warm sepia-charcoal vintage pressing tint so it harmonizes with the black vinyl
            const r = d[idx] * 0.72 + 22;
            const g = d[idx + 1] * 0.7 + 20;
            const b = d[idx + 2] * 0.68 + 18;
            d[idx] = Math.max(0, Math.min(255, Math.round((r + bayer) / 26) * 26));
            d[idx + 1] = Math.max(0, Math.min(255, Math.round((g + bayer) / 26) * 26));
            d[idx + 2] = Math.max(0, Math.min(255, Math.round((b + bayer) / 26) * 26));
          }
        }
        sctx.putImageData(imgData, 0, 0);
        coverBufRef.current = small;
      };
      img.onerror = () => {
        if (cancelled) return;
        if (activeTrack.youtubeId && allowFallback) {
          loadCover(`https://i.ytimg.com/vi/${activeTrack.youtubeId}/mqdefault.jpg`, false);
        }
      };
      img.src = url;
    };

    loadCover(getBestCoverUrl(activeTrack), true);
    return () => {
      cancelled = true;
    };
  }, [activeTrack]);

  // Interactive 1:1 click-hold-rotate disc scrubbing with real playback speed intensity
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
        angleDegRef.current = deg;
      },
    });

  useEffect(() => {
    isScrubbingRef.current = isScrubbing;
  }, [isScrubbing]);

  // Keyboard shortcuts (Space, Left, Right)
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

  // Main Crisp Pixel-Art 60/120fps Compositing Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();
    let lastNow = start;

    const render = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;

      const pw = virtualWidthRef.current;
      if (canvas.width !== pw || canvas.height !== PH) {
        canvas.width = pw;
        canvas.height = PH;
      }

      const tSec = (now - start) / 1000;
      ctx.imageSmoothingEnabled = false;

      // 1. Draw Crisp 16-Bit Renaissance Cloudscape Background (cover-fitted cleanly across viewport)
      const sky = skyImgRef.current;
      if (sky) {
        const skyAspect = sky.width / sky.height;
        const viewAspect = pw / PH;
        let dw = pw;
        let dh = PH;
        let dx = 0;
        let dy = 0;
        if (viewAspect > skyAspect) {
          dh = Math.ceil(pw / skyAspect);
          dy = Math.round((PH - dh) * 0.42);
        } else {
          dw = Math.ceil(PH * skyAspect);
          dx = Math.round((pw - dw) * 0.5);
        }
        ctx.drawImage(sky, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = '#2d4154';
        ctx.fillRect(0, 0, pw, PH);
      }

      // Subtle sunlit pixel dust motes drifting across the golden heaven band
      for (let i = 0; i < 10; i++) {
        const mx = Math.round(((i * 57 + tSec * (3.2 + (i % 3) * 1.3)) % (pw + 20)) - 10);
        const my = Math.round(92 + (i % 5) * 26 + Math.sin(tSec * 1.1 + i) * 4);
        const twinkle = Math.sin(tSec * 2.4 + i * 1.9);
        if (twinkle > 0.15) {
          ctx.fillStyle = twinkle > 0.65 ? 'rgba(255, 245, 210, 0.72)' : 'rgba(246, 218, 152, 0.38)';
          ctx.fillRect(mx, my, 1, 1);
        }
      }

      // Dramatic full-screen entrance on track change:
      // God's hand + new vinyl sweep ALL THE WAY IN from out of the top-left corner of the screen (~0.82s)!
      if (handoffProgressRef.current < 1) {
        handoffProgressRef.current = Math.min(1, handoffProgressRef.current + dt / 0.82);
      }
      const easeOut = 1 - Math.pow(1 - handoffProgressRef.current, 4);
      const settleX = Math.round((1 - easeOut) * -215);
      const settleY = Math.round((1 - easeOut) * -225);

      // Gentle breathing float once settled (only ±1.5 virtual px so arm NEVER detaches from screen corner!)
      const floatY = Math.round(Math.sin(tSec * 1.35) * 1.5 * easeOut);

      const vinylCx = VINYL_BASE_X + settleX;
      const vinylCy = VINYL_BASE_Y + floatY + settleY;
      const rad = (angleDegRef.current * Math.PI) / 180;

      // 2. Soft Pixel-Dithered Atmospheric Drop Shadow behind the floating Vinyl
      ctx.save();
      ctx.beginPath();
      ctx.arc(vinylCx + 4, vinylCy + 5, VINYL_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14, 22, 32, 0.24)';
      ctx.fill();
      ctx.restore();

      // 3. Draw High-Detail Pixel-Art Glossy Black Vinyl Record
      const vBuf = vinylBufRef.current;
      if (vBuf) {
        ctx.drawImage(vBuf, Math.round(vinylCx - vBuf.width / 2), Math.round(vinylCy - vBuf.height / 2));

        // Subtle animated specular groove glints that visibly rotate clockwise as the vinyl spins!
        for (let k = 0; k < 4; k++) {
          const a = rad + k * (Math.PI * 0.5);
          const gr = 42 + (k % 2) * 24;
          const gx = Math.round(vinylCx + Math.cos(a) * gr);
          const gy = Math.round(vinylCy + Math.sin(a) * gr);
          ctx.fillStyle = 'rgba(190, 196, 204, 0.24)';
          ctx.fillRect(gx, gy, 2, 1);
        }
      }

      // 4. Draw Rotating 16-Bit Pixel-Quantized Cover Art Center Label + Classic Ring + White Spindle Hole
      ctx.save();
      ctx.beginPath();
      ctx.arc(vinylCx, vinylCy, LABEL_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;

      if (coverBufRef.current) {
        ctx.translate(vinylCx, vinylCy);
        ctx.rotate(rad);
        ctx.drawImage(coverBufRef.current, -LABEL_R, -LABEL_R, LABEL_R * 2, LABEL_R * 2);
      } else {
        ctx.fillStyle = '#313235';
        ctx.fillRect(vinylCx - LABEL_R, vinylCy - LABEL_R, LABEL_R * 2, LABEL_R * 2);
      }
      ctx.restore();

      // Crisp pixel rim ring around center label + rotating micro-glint + crisp bright spindle hole
      ctx.strokeStyle = '#52555b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(vinylCx, vinylCy, LABEL_R, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle inner matte shadow ring around spindle hole
      ctx.fillStyle = '#18191b';
      ctx.fillRect(vinylCx - 3, vinylCy - 3, 6, 6);
      ctx.fillStyle = '#f4efe0';
      ctx.fillRect(vinylCx - 2, vinylCy - 2, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(vinylCx - 1, vinylCy - 1, 2, 2);

      // 5. Draw Upper-Left Michelangelo Hand OVER the vinyl rim (anchored flush to top-left corner 0,0!)
      const handLeft = handLeftImgRef.current;
      if (handLeft) {
        // Subtle contact shadow directly beneath the thumb pressing onto the black vinyl
        ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
        ctx.fillRect(vinylCx - 86, vinylCy - 34, 34, 8);
        ctx.drawImage(
          handLeft,
          Math.round(-LEFT_BLEED_X + settleX),
          Math.round(-LEFT_BLEED_Y + floatY + settleY)
        );
      }

      // 6. Draw Lower-Right Reaching Michelangelo Hand (barely touching / seeking the vinyl rim!)
      // During new-track arrival, yield slightly back and then glide right up to barely touch the spinning groove!
      const targetReach = isScrubbingRef.current
        ? 1.12
        : isPlayingRef.current
          ? 1.0
          : 0.0;
      const smoothRate = 1 - Math.exp(-5.2 * dt);
      handReachRef.current += (targetReach - handReachRef.current) * smoothRate;

      // Subtle yield while the new vinyl descends from out of the top-left screen
      const yieldBack = (1 - easeOut) * 28;
      // Paused: (248, 150) poised near vinyl | Playing: (208, 128) index fingertip ~4px from vinyl rim!
      // Scrubbing: (203, 125) fingertip literally grazing the spinning black groove!
      // Extended forearm in hand-right.png (464x344) ALWAYS reaches seamlessly past the right & bottom edges!
      const seekPulse = isPlayingRef.current ? Math.sin(tSec * 2.2) * 1.2 : 0;
      const handRightX = Math.round(248 - handReachRef.current * 40 + yieldBack + seekPulse);
      const handRightY = Math.round(150 - handReachRef.current * 22 + yieldBack * 0.55 + Math.cos(tSec * 1.45) * 1.2);

      const handRight = handRightImgRef.current;
      if (handRight) {
        ctx.drawImage(handRight, handRightX, handRightY);
      }

      // 7. Divine Golden Pixel Sparks flickering right across the razor-thin gap between fingertip & vinyl rim!
      const tipX = handRightX + 7;
      const tipY = handRightY + 5;

      if ((isPlayingRef.current || isScrubbingRef.current) && easeOut > 0.72) {
        if (Math.random() < (isScrubbingRef.current ? 0.72 : 0.34)) {
          sparksRef.current.push({
            x: tipX - 2 + (Math.random() - 0.5) * 5,
            y: tipY - 1 + (Math.random() - 0.5) * 5,
            vx: -0.28 - Math.random() * 0.45,
            vy: -0.22 - Math.random() * 0.38,
            life: 0,
            maxLife: 28 + Math.random() * 24,
            size: Math.random() > 0.72 ? 2 : 1,
            bright: Math.random() > 0.35,
          });
        }
      }

      const nextSparks: SparkParticle[] = [];
      for (const sp of sparksRef.current) {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life += 1;
        if (sp.life < sp.maxLife) {
          const fade = 1 - sp.life / sp.maxLife;
          ctx.fillStyle = sp.bright
            ? `rgba(255, 246, 208, ${fade.toFixed(2)})`
            : `rgba(242, 198, 108, ${fade.toFixed(2)})`;
          ctx.fillRect(Math.round(sp.x), Math.round(sp.y), sp.size, sp.size);
          nextSparks.push(sp);
        }
      }
      sparksRef.current = nextSparks;

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const progress = duration > 0 ? Math.min(1, Math.max(0, displayTime / duration)) : 0;

  // Responsive exact percentage positions of the interactive vinyl & right hand overlays
  const vinylLeftPct = ((VINYL_BASE_X - VINYL_R) / virtualWidth) * 100;
  const vinylTopPct = ((VINYL_BASE_Y - VINYL_R) / PH) * 100;
  const vinylWidthPct = ((VINYL_R * 2) / virtualWidth) * 100;
  const vinylHeightPct = ((VINYL_R * 2) / PH) * 100;

  // Build ordered upcoming queue after activeIndex (wrapping around playlist)
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
      ref={stageRef}
      className="relative w-full h-full overflow-hidden select-none bg-[#1c2a38] flex items-center justify-center"
      style={
        isPortraitMobile
          ? {
              background:
                'linear-gradient(180deg, #162230 0%, #24374a 36%, #2c4154 62%, #131d29 100%)',
            }
          : undefined
      }
    >
      {/* Aspect-locked stage wrapper: full-bleed on desktop, crisp 1:1 square pixels (400:270) on portrait phones! */}
      <div
        className={
          isPortraitMobile
            ? 'relative w-full aspect-[400/270] -translate-y-[8dvh]'
            : 'relative w-full h-full'
        }
      >
        {/* Full-Viewport Razor-Sharp Pixel-Art Canvas (1:1 square pixels!) */}
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Interactive Click-Hold-Rotate Scrub Hitbox locked directly over the Pixel Vinyl */}
        <div
          ref={containerRef}
          {...handlers}
          title="Click to Play/Pause • Hold & rotate to scrub"
          className={`absolute rounded-full z-20 touch-none ${
            isScrubbing ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            left: `${vinylLeftPct}%`,
            top: `${vinylTopPct}%`,
            width: `${vinylWidthPct}%`,
            height: `${vinylHeightPct}%`,
          }}
        />

        {/* Clickable Reaching Hand Zone (toggles Play/Pause so clicking Adam's hand sparks the vinyl!) */}
        <button
          type="button"
          aria-label={isPlaying ? 'Pause playback' : 'Reach out and play'}
          onClick={() => {
            sound.playSwitch();
            onTogglePlay();
          }}
          className="absolute right-0 bottom-0 w-[52%] h-[50%] z-20 cursor-pointer bg-transparent border-0 focus:outline-none"
        />

        {/* Crisp 16-Bit Pixel Scrub Intensity HUD Badge */}
        {isScrubbing && (
          <div
            className="pointer-events-none absolute z-30 px-3 py-1 border-2 border-[#f3d99b] text-[#fff2cc] font-mono text-[11px] uppercase tracking-[0.14em] flex items-center gap-2 shadow-[4px_4px_0_rgba(0,0,0,0.65)]"
            style={{
              backgroundColor: 'rgba(13, 20, 30, 0.94)',
              left: `${(VINYL_BASE_X / virtualWidth) * 100}%`,
              top: `${((VINYL_BASE_Y + VINYL_R + 8) / PH) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <span className="text-[#ffd26a] font-bold">{intensityBadge}</span>
            <span>{formatDelta(scrubDelta)}</span>
          </div>
        )}
      </div>

      {/* Minimal Retro 16-Bit Pixel Player Rectangle at Bottom Center (with Up Next Titles + Safe Area!) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-30 w-[min(92vw,490px)]"
        style={{ bottom: 'max(0.875rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className="border-2 border-[#e9cf92]/85 px-3.5 py-2.5 shadow-[5px_5px_0_rgba(8,12,18,0.78)]"
          style={{ backgroundColor: 'rgba(13, 20, 30, 0.92)' }}
        >
          {/* Single-Line Pixel Track Title + Time */}
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[9.5px] font-bold text-[#f3cf7a] shrink-0">
                {String(activeIndex + 1).padStart(2, '0')}
              </span>
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.09em] text-[#fff6df] truncate">
                {cleanDisplayTitle(activeTrack?.title || 'UNTITLED')}
              </span>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-[#f3d99b] shrink-0">
              {formatTime(displayTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Pixel Transport Buttons + Crisp Chunky Pixel Seek Bar */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                sound.playDiscSpin();
                onPrev();
              }}
              onMouseEnter={() => setHoveredBtn('prev')}
              onMouseLeave={() => setHoveredBtn(null)}
              className={`px-2 py-1 font-mono text-[10px] font-bold border transition-colors ${
                hoveredBtn === 'prev'
                  ? 'bg-[#f3d99b] text-[#111923] border-[#f3d99b]'
                  : 'bg-[#1d2836] text-[#f3d99b] border-[#f3d99b]/45'
              }`}
              title="Previous"
            >
              &lt;&lt;
            </button>

            <button
              onClick={() => {
                sound.playSwitch();
                onTogglePlay();
              }}
              onMouseEnter={() => setHoveredBtn('play')}
              onMouseLeave={() => setHoveredBtn(null)}
              className={`px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] border transition-colors ${
                hoveredBtn === 'play' || isPlaying
                  ? 'bg-[#f3d99b] text-[#111923] border-[#f3d99b]'
                  : 'bg-[#1d2836] text-[#fff6df] border-[#f3d99b]/65'
              }`}
            >
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>

            <button
              onClick={() => {
                sound.playDiscSpin();
                onNext();
              }}
              onMouseEnter={() => setHoveredBtn('next')}
              onMouseLeave={() => setHoveredBtn(null)}
              className={`px-2 py-1 font-mono text-[10px] font-bold border transition-colors ${
                hoveredBtn === 'next'
                  ? 'bg-[#f3d99b] text-[#111923] border-[#f3d99b]'
                  : 'bg-[#1d2836] text-[#f3d99b] border-[#f3d99b]/45'
              }`}
              title="Next"
            >
              &gt;&gt;
            </button>

            {/* Clickable 16-Bit Pixel Progress Bar */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                sound.playClick(920, 0.014);
                onSeek(ratio * duration);
              }}
              className="relative flex-1 h-3 bg-[#080d14] border border-[#f3d99b]/60 cursor-pointer p-[2px]"
              title="Click to seek"
            >
              <div
                className="h-full bg-[#f3d99b] transition-[width] duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          {/* Up Next Titles Strip at Bottom of Player Rectangle (Scrollable & Clickable!) */}
          {visibleUpcoming.length > 0 && (
            <div
              onWheel={(e) => {
                if (maxOffset <= 0) return;
                e.preventDefault();
                setUpNextOffset((prev) =>
                  Math.max(0, Math.min(maxOffset, prev + (e.deltaY > 0 ? 1 : -1)))
                );
              }}
              className="mt-2 pt-1.5 border-t border-[#f3d99b]/25 flex items-center gap-2"
              title="Click an upcoming track to deliver it • Scroll to browse queue"
            >
              <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#f3cf7a]/75 shrink-0">
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
                    className="group flex items-center gap-1.5 min-w-0 px-1.5 py-0.5 bg-[#192433]/80 hover:bg-[#f3d99b] border border-[#f3d99b]/25 hover:border-[#f3d99b] text-left transition-colors"
                  >
                    <span className="font-mono text-[8.5px] tabular-nums text-[#f3cf7a] group-hover:text-[#111923] shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#e7dcc0] group-hover:text-[#111923] font-semibold truncate">
                      {cleanDisplayTitle(track.title)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
