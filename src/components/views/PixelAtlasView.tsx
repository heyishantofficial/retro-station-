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

// Native 16-bit/32-bit pixel-art scene geometry matching /public/pixel-atlas/*.png (612 x 320)
const SCENE_W = 612;
const SCENE_H = 320;
const VINYL_CX = 240;
const VINYL_CY = 86;
const VINYL_R = 63;
const HANDS_X = 177;
const HANDS_Y = 99;

// Exact flat top surface of the carved Greek stone half-pillar on the right foreground
const PILLAR_CENTER_X = 472;
const PILLAR_TOP_Y = 266;
const PILLAR_WIDTH = 182;

// 4x4 Bayer Ordered Dithering Matrix normalized to [-0.5, +0.5]
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16 - 0.5));

interface SparkMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  bright: boolean;
}

/**
 * Pre-renders a transparent 16-bit pixel-art glossy vinyl overlay (concentric micro-grooves,
 * diagonal studio reflection cones, subtle outer bevel rim, and crisp center spindle hole)
 * composited OVER the full-bleed rotating song cover art so the whole disc is a glossy picture-disc LP!
 */
function buildPictureDiscSheenOverlay(): HTMLCanvasElement {
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

  for (let y = 0; y < size; y++) {
    const dy = y - cy;
    const bRow = BAYER_4X4[y & 3];
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dist2 = dx * dx + dy * dy;
      if (dist2 > r2) continue;

      const dist = Math.sqrt(dist2);
      const theta = Math.atan2(dy, dx);
      const p = (y * size + x) * 4;

      // Crisp dark beveled outer vinyl rim (2px)
      if (dist > VINYL_R - 1.9) {
        const rimSheen = Math.pow(Math.abs(Math.cos(theta - 0.72)), 3.0);
        const c = rimSheen > 0.45 ? 168 : 26;
        data[p] = c;
        data[p + 1] = c;
        data[p + 2] = c + 4;
        data[p + 3] = 235;
        continue;
      }

      // Subtle center spindle ring bevel (r = 5..8)
      if (dist < 6.5 && dist > 3.5) {
        data[p] = 22;
        data[p + 1] = 20;
        data[p + 2] = 18;
        data[p + 3] = 165;
        continue;
      }

      // Glossy diagonal specular reflection cones + crisp concentric micro-grooves
      const sheenPrimary = Math.pow(Math.abs(Math.cos(theta - 0.72)), 5.2);
      const sheenSecondary = Math.pow(Math.abs(Math.cos(theta + 0.88)), 14.0) * 0.35;
      const sheen = sheenPrimary + sheenSecondary;
      const isGroove = Math.floor(dist) % 2 === 0;
      const isTrackGap = Math.abs(dist - 32) < 0.7 || Math.abs(dist - 48) < 0.7;

      const dither = bRow[x & 3] * 0.14;
      const highlight = sheen * 0.62 + (isGroove ? sheen * 0.18 : 0) + dither;

      if (highlight > 0.30) {
        // Bright crisp pixel specular sheen glinting across the spinning cover art
        data[p] = 255;
        data[p + 1] = 250;
        data[p + 2] = 236;
        data[p + 3] = highlight > 0.48 ? 112 : 66;
      } else if (isTrackGap) {
        data[p] = 12;
        data[p + 1] = 10;
        data[p + 2] = 10;
        data[p + 3] = 95;
      } else if (isGroove) {
        // Subtle dark groove lines so you feel the pressed vinyl texture over the cover art
        data[p] = 14;
        data[p + 1] = 12;
        data[p + 2] = 12;
        data[p + 3] = 44;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return buf;
}

/**
 * Fallback dark glossy pixel disc before cover art loads.
 */
function buildFallbackDiscBuffer(): HTMLCanvasElement {
  const size = VINYL_R * 2;
  const buf = document.createElement('canvas');
  buf.width = size;
  buf.height = size;
  const ctx = buf.getContext('2d');
  if (!ctx) return buf;
  ctx.fillStyle = '#1b1a19';
  ctx.beginPath();
  ctx.arc(VINYL_R, VINYL_R, VINYL_R, 0, Math.PI * 2);
  ctx.fill();
  return buf;
}

export const PixelAtlasView: React.FC<SharedViewProps> = ({
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

  const sceneImgRef = useRef<HTMLImageElement | null>(null);
  const handsImgRef = useRef<HTMLImageElement | null>(null);
  const sheenOverlayRef = useRef<HTMLCanvasElement | null>(null);

  // Dual picture-disc buffers so the NEW disc descends and SITS DIRECTLY ON TOP of the EXISTING disc!
  const activeDiscBufRef = useRef<HTMLCanvasElement | null>(null);
  const prevDiscBufRef = useRef<HTMLCanvasElement | null>(null);
  const prevDiscAngleRef = useRef<number>(0);
  const sparksRef = useRef<SparkMote[]>([]);

  // Pixel-exact responsive screen coordinates for BOTH the spinning vinyl hitbox AND the half-pillar player card!
  const [layout, setLayout] = useState({
    vinylLeftPx: 200,
    vinylTopPx: 40,
    vinylDiamPx: 260,
    pillarCenterXPx: 900,
    pillarTopPx: 540,
    pillarWidthPx: 380,
    stageH: 700,
    stageW: 1280,
  });

  const angleDegRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const isScrubbingRef = useRef(false);
  const stackProgressRef = useRef(1); // 0 -> 1: new disc descending onto existing disc!

  const [hoveredBtn, setHoveredBtn] = useState<'prev' | 'play' | 'next' | null>(null);
  const [upNextOffset, setUpNextOffset] = useState<number>(0);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    setUpNextOffset(0);
  }, [activeIndex, tracks.length]);

  // Compute exact screen-space positions for the vinyl hitbox & half-pillar shelf on any viewport size
  useEffect(() => {
    const syncLayout = () => {
      const el = stageRef.current;
      const w = el ? el.clientWidth : window.innerWidth;
      const h = el ? el.clientHeight : window.innerHeight;
      if (w <= 0 || h <= 0) return;

      const scale = Math.max(w / SCENE_W, h / SCENE_H);
      const drawW = SCENE_W * scale;
      const drawH = SCENE_H * scale;
      const offsetX = (w - drawW) * 0.5;
      const offsetY = (h - drawH) * 0.5;

      setLayout({
        vinylLeftPx: offsetX + (VINYL_CX - VINYL_R) * scale,
        vinylTopPx: offsetY + (VINYL_CY - VINYL_R) * scale,
        vinylDiamPx: VINYL_R * 2 * scale,
        pillarCenterXPx: offsetX + PILLAR_CENTER_X * scale,
        pillarTopPx: offsetY + PILLAR_TOP_Y * scale,
        pillarWidthPx: PILLAR_WIDTH * scale,
        stageH: h,
        stageW: w,
      });
    };
    syncLayout();
    window.addEventListener('resize', syncLayout);
    return () => window.removeEventListener('resize', syncLayout);
  }, []);

  // Load crisp pre-baked pixel-art layers + build picture-disc sheen overlay once
  useEffect(() => {
    sheenOverlayRef.current = buildPictureDiscSheenOverlay();
    if (!activeDiscBufRef.current) {
      activeDiscBufRef.current = buildFallbackDiscBuffer();
    }

    const loadImg = (src: string, target: React.MutableRefObject<HTMLImageElement | null>) => {
      const img = new Image();
      img.onload = () => {
        target.current = img;
      };
      img.src = src;
    };

    loadImg('/pixel-atlas/scene.png', sceneImgRef);
    loadImg('/pixel-atlas/hands-front.png', handsImgRef);
  }, []);

  // Pre-bake FULL-DISC 16-bit Bayer-dithered picture-disc from song cover art!
  // When a new track loads, keep the EXISTING disc in Atlas's hands while the NEW disc descends and sits ON TOP!
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

        const sz = VINYL_R * 2;
        const disc = document.createElement('canvas');
        disc.width = sz;
        disc.height = sz;
        const sctx = disc.getContext('2d');
        if (!sctx) return;
        sctx.imageSmoothingEnabled = true;

        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        const aspect = nw / nh;
        const crop =
          activeTrack.youtubeId && aspect > 1.25 && aspect < 1.48 ? nh * 0.72 : Math.min(nw, nh);
        sctx.drawImage(img, (nw - crop) / 2, (nh - crop) / 2, crop, crop, 0, 0, sz, sz);

        // Quantize full disc cover pixels with 4x4 Bayer ordered dithering so it harmonizes 100% with the 16-bit scene!
        const imgData = sctx.getImageData(0, 0, sz, sz);
        const d = imgData.data;
        const r2 = VINYL_R * VINYL_R;
        for (let y = 0; y < sz; y++) {
          const dy = y - VINYL_R;
          const bRow = BAYER_4X4[y & 3];
          for (let x = 0; x < sz; x++) {
            const dx = x - VINYL_R;
            const idx = (y * sz + x) * 4;
            if (dx * dx + dy * dy > r2) {
              d[idx + 3] = 0;
              continue;
            }
            const bayer = bRow[x & 3] * 22;
            d[idx] = Math.max(0, Math.min(255, Math.round((d[idx] + bayer) / 22) * 22));
            d[idx + 1] = Math.max(0, Math.min(255, Math.round((d[idx + 1] + bayer) / 22) * 22));
            d[idx + 2] = Math.max(0, Math.min(255, Math.round((d[idx + 2] + bayer) / 22) * 22));
            d[idx + 3] = 255;
          }
        }
        sctx.putImageData(imgData, 0, 0);

        // Snapshot existing disc underneath & start stacking descent of the new disc on top!
        if (activeDiscBufRef.current) {
          prevDiscBufRef.current = activeDiscBufRef.current;
          prevDiscAngleRef.current = angleDegRef.current;
          stackProgressRef.current = 0;
        }
        activeDiscBufRef.current = disc;
      };
      img.onerror = () => {
        if (!cancelled && activeTrack.youtubeId && allowFallback) {
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

  // Main 16-Bit Pixel-Art Render Loop (612 x 320 native crisp pixel buffer!)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = SCENE_W;
    canvas.height = SCENE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();
    let lastNow = start;

    // Helper: draw one complete spinning 16-bit full-cover picture-disc + glossy grooves + spindle hole
    const drawPictureDisc = (
      cx: number,
      cy: number,
      discBuf: HTMLCanvasElement,
      angleDeg: number,
      scaleY = 1
    ) => {
      const rad = (angleDeg * Math.PI) / 180;

      // Rotating full-bleed cover art picture disc
      ctx.save();
      ctx.translate(Math.round(cx), Math.round(cy));
      if (scaleY !== 1) ctx.scale(1, scaleY);
      ctx.rotate(rad);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(discBuf, -VINYL_R, -VINYL_R, VINYL_R * 2, VINYL_R * 2);
      ctx.restore();

      // Static directional glossy vinyl sheen cones & concentric grooves (reflecting studio sky light!)
      const sheen = sheenOverlayRef.current;
      if (sheen) {
        ctx.save();
        ctx.translate(Math.round(cx), Math.round(cy));
        if (scaleY !== 1) ctx.scale(1, scaleY);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sheen, -sheen.width / 2, -sheen.height / 2);
        ctx.restore();
      }

      // Crisp bright center spindle hole
      ctx.fillStyle = '#141210';
      ctx.fillRect(Math.round(cx) - 3, Math.round(cy) - 3, 6, 6);
      ctx.fillStyle = '#f8f0dc';
      ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 4, 4);
    };

    const render = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;
      const tSec = (now - start) / 1000;
      ctx.imageSmoothingEnabled = false;

      // 1. Draw Panoramic 16-Bit Ancient Greece + Sculpted Atlas + Carved Stone Half-Pillar on Right
      if (sceneImgRef.current) {
        ctx.drawImage(sceneImgRef.current, 0, 0, SCENE_W, SCENE_H);
      } else {
        ctx.fillStyle = '#4e463c';
        ctx.fillRect(0, 0, SCENE_W, SCENE_H);
      }

      // Subtle sunlit golden Olympus pixel dust motes drifting across the Greek sky
      for (let i = 0; i < 12; i++) {
        const mx = Math.round(((i * 57 + tSec * (2.6 + (i % 3) * 1.1)) % (SCENE_W + 20)) - 10);
        const my = Math.round(20 + (i % 6) * 42 + Math.sin(tSec * 1.2 + i) * 3);
        const twinkle = Math.sin(tSec * 2.1 + i * 1.7);
        if (twinkle > 0.2) {
          ctx.fillStyle =
            twinkle > 0.7 ? 'rgba(255, 248, 224, 0.72)' : 'rgba(242, 222, 174, 0.36)';
          ctx.fillRect(mx, my, 1, 1);
        }
      }

      // Advance stacking transition (0 -> 1 over ~0.78s):
      // Existing disc STAYS right in Atlas's hands while the NEW disc descends from above and sits right ON TOP!
      if (stackProgressRef.current < 1) {
        stackProgressRef.current = Math.min(1, stackProgressRef.current + dt / 0.78);
      }
      const p = stackProgressRef.current;
      const isStacking = p < 0.999 && prevDiscBufRef.current !== null;

      // Atmospheric shadow behind the disc held by Atlas
      ctx.save();
      ctx.beginPath();
      ctx.arc(VINYL_CX + 2, VINYL_CY + 4, VINYL_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(28, 22, 16, 0.26)';
      ctx.fill();
      ctx.restore();

      // 2. If stacking a new track: keep the EXISTING disc spinning right in Atlas's hands underneath!
      if (isStacking && prevDiscBufRef.current) {
        // Slowly keep previous disc rotating while new disc descends onto it
        if (isPlayingRef.current) {
          prevDiscAngleRef.current += dt * 24;
        }
        drawPictureDisc(VINYL_CX, VINYL_CY, prevDiscBufRef.current, prevDiscAngleRef.current);

        // Cast shadow from the descending new disc darkening the existing disc as it approaches!
        const shadowProgress = Math.min(1, p / 0.84);
        const shadowEase = 1 - Math.pow(1 - shadowProgress, 3);
        const shadowOffset = Math.round((1 - shadowEase) * 18);
        ctx.save();
        ctx.beginPath();
        ctx.arc(VINYL_CX, VINYL_CY, VINYL_R, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        ctx.arc(VINYL_CX, VINYL_CY - shadowOffset + 5, VINYL_R, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(18, 14, 10, ${(0.38 * shadowEase).toFixed(2)})`;
        ctx.fill();
        ctx.restore();
      }

      // 3. Draw Active Full-Cover Picture-Disc (descending from above onto the existing disc when stacking!)
      const dropY = isStacking
        ? p < 0.84
          ? Math.round((1 - Math.pow(1 - p / 0.84, 3.2)) * 168 - 168)
          : Math.round(Math.sin(((p - 0.84) / 0.16) * Math.PI) * 2.5)
        : 0;

      if (activeDiscBufRef.current) {
        drawPictureDisc(VINYL_CX, VINYL_CY + dropY, activeDiscBufRef.current, angleDegRef.current);
      }

      // 4. Draw Atlas's Foreground Gripping Hands & Hair Crown OVER the lower rim of the disc!
      if (handsImgRef.current) {
        ctx.drawImage(handsImgRef.current, HANDS_X, HANDS_Y);
      }

      // 5. Golden Sunbeam Pixel Sparks rising off the spinning picture-disc rim when Playing/Scrubbing!
      if ((isPlayingRef.current || isScrubbingRef.current) && p > 0.78) {
        if (Math.random() < (isScrubbingRef.current ? 0.55 : 0.24)) {
          const ang = -Math.PI * 0.85 + Math.random() * Math.PI * 0.7;
          sparksRef.current.push({
            x: VINYL_CX + Math.cos(ang) * (VINYL_R + 1),
            y: VINYL_CY + Math.sin(ang) * (VINYL_R + 1),
            vx: Math.cos(ang) * 0.16 + (Math.random() - 0.5) * 0.15,
            vy: -0.25 - Math.random() * 0.32,
            life: 0,
            maxLife: 28 + Math.random() * 24,
            bright: Math.random() > 0.45,
          });
        }
      }

      const nextSparks: SparkMote[] = [];
      for (const sp of sparksRef.current) {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life += 1;
        if (sp.life < sp.maxLife) {
          const fade = 1 - sp.life / sp.maxLife;
          ctx.fillStyle = sp.bright
            ? `rgba(255, 246, 214, ${fade.toFixed(2)})`
            : `rgba(232, 198, 128, ${fade.toFixed(2)})`;
          ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 1, 1);
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

  const upcomingTracks =
    tracks.length > 1
      ? Array.from({ length: tracks.length - 1 }, (_, i) => {
          const idx = (activeIndex + 1 + i) % tracks.length;
          return { track: tracks[idx], index: idx };
        })
      : [];
  const maxOffset = Math.max(0, upcomingTracks.length - 2);
  const visibleUpcoming = upcomingTracks.slice(upNextOffset, upNextOffset + 2);

  // On desktop (>= 768px): anchor card physically ON TOP of the right stone half-pillar surface!
  // On mobile portrait (< 768px): the right pillar is off-screen, so dock cleanly at bottom-center with safe-area!
  const isMobileCard = layout.stageW < 768;
  const cardWidthPx = isMobileCard
    ? Math.max(280, layout.stageW - 24)
    : Math.max(300, Math.min(430, Math.round(layout.pillarWidthPx * 1.06)));
  const cardLeftPx = isMobileCard
    ? Math.round((layout.stageW - cardWidthPx) / 2)
    : Math.max(
        16,
        Math.min(layout.stageW - cardWidthPx - 16, layout.pillarCenterXPx - cardWidthPx / 2)
      );
  const cardBottomPx = isMobileCard
    ? 14
    : Math.max(12, Math.round(layout.stageH - layout.pillarTopPx - 3));

  return (
    <div
      ref={stageRef}
      className="relative w-full h-full overflow-hidden select-none bg-[#3a332a]"
    >
      {/* Razor-Sharp 16-Bit Pixel-Art Canvas (612x320 wide panorama -> ZERO top vinyl clipping!) */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block object-cover"
        style={{ imageRendering: 'pixelated', objectPosition: '50% 50%' }}
      />

      {/* Interactive Click-Hold-Rotate Scrub Hitbox locked directly over Atlas's Spinning Picture-Disc */}
      <div
        ref={containerRef}
        {...handlers}
        title="Click to Play/Pause • Hold & rotate picture-disc to scrub"
        className={`absolute rounded-full z-20 ${
          isScrubbing ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          left: `${layout.vinylLeftPx}px`,
          top: `${layout.vinylTopPx}px`,
          width: `${layout.vinylDiamPx}px`,
          height: `${layout.vinylDiamPx}px`,
        }}
      />

      {/* Crisp 16-Bit Pixel Scrub Intensity Badge */}
      {isScrubbing && (
        <div
          className="pointer-events-none absolute z-30 px-3 py-1 border-2 border-[#e9cf92] text-[#fff4d4] font-mono text-[11px] uppercase tracking-[0.14em] flex items-center gap-2 shadow-[4px_4px_0_rgba(0,0,0,0.65)]"
          style={{
            backgroundColor: 'rgba(20, 17, 14, 0.94)',
            left: `${layout.vinylLeftPx + layout.vinylDiamPx / 2}px`,
            top: `${layout.vinylTopPx + layout.vinylDiamPx + 10}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <span className="text-[#f3cf7a] font-bold">{intensityBadge}</span>
          <span>{formatDelta(scrubDelta)}</span>
        </div>
      )}

      {/* Retro 16-Bit Classical Gold Player Card (Desktop: on right stone half-pillar | Mobile: bottom-center safe-area!) */}
      <div
        className="absolute z-30"
        style={{
          left: `${cardLeftPx}px`,
          bottom: isMobileCard
            ? `max(${cardBottomPx}px, env(safe-area-inset-bottom, 0px))`
            : `${cardBottomPx}px`,
          width: `${cardWidthPx}px`,
        }}
      >
        <div
          className="relative border-2 border-[#e5c98a]/90 px-3.5 py-2.5 shadow-[0_8px_18px_rgba(10,8,5,0.82)]"
          style={{ backgroundColor: 'rgba(22, 18, 14, 0.94)' }}
        >
          {/* Decorative antique-gold corner studs so card looks like a carved temple console */}
          <span className="pointer-events-none absolute top-1 left-1 w-1 h-1 bg-[#e5c98a]/75" />
          <span className="pointer-events-none absolute top-1 right-1 w-1 h-1 bg-[#e5c98a]/75" />
          <span className="pointer-events-none absolute bottom-1 left-1 w-1 h-1 bg-[#e5c98a]/75" />
          <span className="pointer-events-none absolute bottom-1 right-1 w-1 h-1 bg-[#e5c98a]/75" />

          {/* Single-Line Pixel Track Title + Time */}
          <div className="flex items-center justify-between gap-2.5 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-[9.5px] font-bold text-[#e5c478] shrink-0">
                {String(activeIndex + 1).padStart(2, '0')}
              </span>
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#fff6df] truncate">
                {cleanDisplayTitle(activeTrack?.title || 'UNTITLED')}
              </span>
            </div>
            <span className="font-mono text-[9.5px] tabular-nums text-[#e5c98a] shrink-0">
              {formatTime(displayTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Pixel Transport Buttons + Crisp Chunky Pixel Seek Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playDiscSpin();
                onPrev();
              }}
              onMouseEnter={() => setHoveredBtn('prev')}
              onMouseLeave={() => setHoveredBtn(null)}
              className={`px-2 py-1 font-mono text-[10px] font-bold border transition-colors ${
                hoveredBtn === 'prev'
                  ? 'bg-[#e5c98a] text-[#14110e] border-[#e5c98a]'
                  : 'bg-[#28221b] text-[#e5c98a] border-[#e5c98a]/45'
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
              className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] border transition-colors ${
                hoveredBtn === 'play' || isPlaying
                  ? 'bg-[#e5c98a] text-[#14110e] border-[#e5c98a]'
                  : 'bg-[#28221b] text-[#fff6df] border-[#e5c98a]/65'
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
                  ? 'bg-[#e5c98a] text-[#14110e] border-[#e5c98a]'
                  : 'bg-[#28221b] text-[#e5c98a] border-[#e5c98a]/45'
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
              className="relative flex-1 h-3 bg-[#0e0c0a] border border-[#e5c98a]/60 cursor-pointer p-[2px]"
              title="Click to seek"
            >
              <div
                className="h-full bg-[#e5c98a] transition-[width] duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          {/* Scrollable & Clickable Up Next Titles Strip */}
          {visibleUpcoming.length > 0 && (
            <div
              onWheel={(e) => {
                if (maxOffset <= 0) return;
                e.preventDefault();
                setUpNextOffset((prev) =>
                  Math.max(0, Math.min(maxOffset, prev + (e.deltaY > 0 ? 1 : -1)))
                );
              }}
              className="mt-2 pt-1.5 border-t border-[#e5c98a]/25 flex items-center gap-1.5"
              title="Click an upcoming track • Scroll to browse queue"
            >
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-[#e5c478]/80 shrink-0">
                NEXT
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
                    className="group flex items-center gap-1 min-w-0 px-1.5 py-0.5 bg-[#231e18]/85 hover:bg-[#e5c98a] border border-[#e5c98a]/25 hover:border-[#e5c98a] text-left transition-colors"
                  >
                    <span className="font-mono text-[8px] tabular-nums text-[#e5c478] group-hover:text-[#14110e] shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.05em] text-[#ede0c4] group-hover:text-[#14110e] font-semibold truncate">
                      {cleanDisplayTitle(track.title)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Carved bronze plinth feet + dark stone contact shadow grounding the card onto the half-pillar! */}
        <div className="mx-3 h-[3px] bg-[#6e5c42] border-x border-b border-[#1c1610]" />
        <div className="mx-1 h-[4px] bg-black/55 blur-[1.5px]" />
      </div>
    </div>
  );
};
