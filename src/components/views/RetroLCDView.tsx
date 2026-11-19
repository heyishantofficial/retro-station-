import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  SharedViewProps,
  cleanDisplayTitle,
  formatTime,
  getBestCoverUrl,
} from '../../utils/viewCatalog';
import {
  FULLSCREEN_VERTEX_SHADER,
  createShaderProgram,
  bindFullscreenQuad,
} from '../../utils/webgl';
import { sound } from '../../utils/soundEffects';

// Shared geometry constants between GLSL shader & exact TypeScript hit-testing
const LCD_W = 400;
const LCD_H = 310;
const SCREEN_SCALE_Y = 0.88;
const SCREEN_ASPECT_X = 1.28;
const BARREL_K = 0.14;

// Single-slot UP NEXT card geometry (spacious, clean 1-song-at-a-time vertical reel)
const UP_X = 24;
const UP_Y = 192;
const UP_W = LCD_W - 48;
const UP_H = 48;

const CRT_LCD_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_uv;

  uniform sampler2D u_tex;
  uniform vec2 u_resolution;
  uniform float u_time;

  vec2 barrelDistort(vec2 uv, float k) {
    vec2 c = uv * 2.0 - 1.0;
    float r2 = dot(c, c);
    c *= (1.0 + k * r2 + 0.04 * r2 * r2);
    return c * 0.5 + 0.5;
  }

  void main() {
    float aspectX = u_resolution.x / u_resolution.y;
    float scaleY = min(${SCREEN_SCALE_Y.toFixed(3)}, (aspectX * 0.90) / ${SCREEN_ASPECT_X.toFixed(3)});
    vec2 centered = (v_uv - 0.5) * vec2(aspectX, 1.0);
    vec2 lcdUv = centered / vec2(scaleY * ${SCREEN_ASPECT_X.toFixed(3)}, scaleY) + 0.5;

    vec2 curved = barrelDistort(lcdUv, ${BARREL_K.toFixed(3)});

    vec2 edge = abs(curved - 0.5) * 2.0;
    float bezelMask = (1.0 - smoothstep(0.968, 1.008, edge.x)) * (1.0 - smoothstep(0.968, 1.008, edge.y));

    if (bezelMask <= 0.001) {
      float distOut = length(max(abs(curved - 0.5) - vec2(0.5), 0.0));
      vec3 spill = vec3(1.0, 0.36, 0.28) * exp(-distOut * 13.0) * 0.15;
      gl_FragColor = vec4(spill, 1.0);
      return;
    }

    vec2 texUv = vec2(curved.x, 1.0 - curved.y);

    float chromaOffset = 0.0018 * length(curved - 0.5);
    float rCh = texture2D(u_tex, texUv + vec2(chromaOffset, 0.0)).r;
    float gCh = texture2D(u_tex, texUv).g;
    float bCh = texture2D(u_tex, texUv - vec2(chromaOffset, 0.0)).b;
    vec3 lcdInk = vec3(rCh, gCh, bCh);

    vec3 baseBacklight = mix(
      vec3(1.0, 0.38, 0.25),
      vec3(0.98, 0.55, 0.54),
      smoothstep(0.0, 0.68, curved.x)
    );
    float vig = 1.0 - 0.26 * pow(length(curved - vec2(0.52, 0.48)), 1.9);
    float subtleFlicker = 0.993 + 0.007 * sin(u_time * 38.0);

    float scanline = 0.94 + 0.06 * sin(curved.y * ${LCD_H.toFixed(1)} * 3.14159);
    float pixelGrid = 0.95 + 0.05 * sin(curved.x * ${LCD_W.toFixed(1)} * 3.14159);

    vec3 col = baseBacklight * lcdInk * vig * scanline * pixelGrid * subtleFlicker;

    float leftLedGlow = exp(-curved.x * 7.5) * 0.24;
    col += vec3(1.0, 0.28, 0.12) * leftLedGlow;

    col *= bezelMask;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

type HitZone = 'prev' | 'play' | 'next' | 'progress' | 'upnext' | null;

function screenToLcdCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect
): { x: number; y: number; inside: boolean } {
  const vx = (clientX - rect.left) / rect.width;
  const vy = 1 - (clientY - rect.top) / rect.height;

  const aspectX = rect.width / rect.height;
  const scaleY = Math.min(SCREEN_SCALE_Y, (aspectX * 0.9) / SCREEN_ASPECT_X);

  const centeredX = (vx - 0.5) * aspectX;
  const centeredY = vy - 0.5;

  const lcdUvX = centeredX / (scaleY * SCREEN_ASPECT_X) + 0.5;
  const lcdUvY = centeredY / scaleY + 0.5;

  const cx = lcdUvX * 2 - 1;
  const cy = lcdUvY * 2 - 1;
  const r2 = cx * cx + cy * cy;
  const factor = 1 + BARREL_K * r2 + 0.04 * r2 * r2;

  const curvedX = cx * factor * 0.5 + 0.5;
  const curvedY = cy * factor * 0.5 + 0.5;

  const inside = curvedX >= 0 && curvedX <= 1 && curvedY >= 0 && curvedY <= 1;
  return {
    x: curvedX * LCD_W,
    y: (1 - curvedY) * LCD_H,
    inside,
  };
}

function hitTestLcd(x: number, y: number): HitZone {
  if (y >= 254 && y <= 304) {
    if (x >= 10 && x <= 125) return 'prev';
    if (x >= 135 && x <= 265) return 'play';
    if (x >= 275 && x <= 390) return 'next';
  }
  if (y >= 158 && y <= 184 && x >= 22 && x <= LCD_W - 22) {
    return 'progress';
  }
  if (y >= UP_Y && y <= UP_Y + UP_H && x >= UP_X && x <= UP_X + UP_W) {
    return 'upnext';
  }
  return null;
}

function fitTextToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(trimmed + '…').width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed + '…';
}

export const RetroLCDView: React.FC<SharedViewProps> = ({
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
}) => {
  const activeTrack = tracks[activeIndex] || tracks[0];

  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const thumbCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const hoveredZoneRef = useRef<HitZone>(null);
  const isScrubbingRef = useRef(false);
  const [cursorPointer, setCursorPointer] = useState(false);

  // Clean 1-song-at-a-time scrollable reel state (ONLY resets when activeIndex actually changes!)
  const upcomingItemsRef = useRef<{ track: (typeof tracks)[number]; originalIndex: number }[]>([]);
  const targetSlotRef = useRef(0); // integer index into upcomingItemsRef
  const visualSlotRef = useRef(0); // smoothly interpolated slot position for buttery vertical slide!
  const wheelAccumRef = useRef(0);
  const wheelCooldownRef = useRef(0);

  const stateRef = useRef({
    title: '',
    artist: '',
    activeTrackId: '',
    isPlaying,
    currentTime,
    duration,
    trackIndex: activeIndex,
    totalTracks: tracks.length,
  });

  // Update playback telemetry without ever resetting scroll position!
  useEffect(() => {
    stateRef.current = {
      title: cleanDisplayTitle(activeTrack?.title || 'NO TRACK'),
      artist: activeTrack?.artist || 'UNKNOWN',
      activeTrackId: activeTrack?.id || '',
      isPlaying,
      currentTime,
      duration,
      trackIndex: activeIndex,
      totalTracks: tracks.length,
    };
  }, [activeTrack, isPlaying, currentTime, duration, activeIndex, tracks.length]);

  // Rebuild ordered upcoming queue & reset UP NEXT slot ONLY when song or playlist changes
  useEffect(() => {
    const ordered: { track: (typeof tracks)[number]; originalIndex: number }[] = [];
    for (let i = 1; i < tracks.length; i++) {
      const idx = (activeIndex + i) % tracks.length;
      ordered.push({ track: tracks[idx], originalIndex: idx });
    }
    upcomingItemsRef.current = ordered;
    targetSlotRef.current = 0;
    visualSlotRef.current = 0;
  }, [tracks, activeIndex]);

  // Preload & cache cover thumbnails for active + all upcoming songs
  useEffect(() => {
    let cancelled = false;
    const loadThumb = (t: (typeof tracks)[number]) => {
      if (!t || thumbCacheRef.current.has(t.id)) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        thumbCacheRef.current.set(t.id, img);
      };
      img.src = t.youtubeId
        ? `https://i.ytimg.com/vi/${t.youtubeId}/mqdefault.jpg`
        : getBestCoverUrl(t);
    };
    tracks.forEach((t) => loadThumb(t));
    return () => {
      cancelled = true;
    };
  }, [tracks]);

  const stepUpcomingSlot = useCallback((delta: number) => {
    const count = upcomingItemsRef.current.length;
    if (count <= 1) return;
    const next = Math.max(0, Math.min(count - 1, targetSlotRef.current + delta));
    if (next !== targetSlotRef.current) {
      targetSlotRef.current = next;
      sound.playClick(delta > 0 ? 1150 : 880, 0.012);
    }
  }, []);

  const drawSquareThumb = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | undefined,
    x: number,
    y: number,
    size: number,
    invertedBorder = false
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    if (img && img.naturalWidth > 0) {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const aspect = nw / nh;
      const crop = aspect > 1.25 && aspect < 1.48 ? nh * 0.72 : Math.min(nw, nh);
      const sx = (nw - crop) / 2;
      const sy = (nh - crop) / 2;
      ctx.filter = 'grayscale(100%) contrast(170%) brightness(106%)';
      ctx.drawImage(img, sx, sy, crop, crop, x, y, size, size);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#2a1412';
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
    ctx.strokeStyle = invertedBorder ? '#ffffff' : '#190b0a';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x, y, size, size);
    ctx.strokeStyle = '#190b0a';
  };

  // WebGL shader + 400x310 offscreen dot-matrix pixel LCD render loop
  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    if (!glCanvas) return;
    const gl = glCanvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) return;

    const program = createShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, CRT_LCD_FRAGMENT_SHADER);
    if (!program) return;

    gl.useProgram(program);
    const quad = bindFullscreenQuad(gl, program);

    const offscreen = document.createElement('canvas');
    offscreen.width = LCD_W;
    offscreen.height = LCD_H;
    const ctx = offscreen.getContext('2d');

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uTex = gl.getUniformLocation(program, 'u_tex');
    gl.uniform1i(uTex, 0);

    let rafId = 0;
    const start = performance.now();

    const drawPixelLCD = (tSec: number) => {
      if (!ctx) return;
      const s = stateRef.current;
      const hovered = hoveredZoneRef.current;
      const upcoming = upcomingItemsRef.current;

      // Smoothly ease visualSlotRef -> targetSlotRef for crisp single-card vertical slide!
      const slotDiff = targetSlotRef.current - visualSlotRef.current;
      if (Math.abs(slotDiff) > 0.002) {
        visualSlotRef.current += slotDiff * 0.2;
      } else {
        visualSlotRef.current = targetSlotRef.current;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, LCD_W, LCD_H);

      const ink = '#190b0a';
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;

      // 1. Top Status Bar
      ctx.fillRect(22, 17, 2, 13);
      ctx.fillRect(19, 15, 8, 2);
      ctx.fillRect(28, 26, 3, 4);
      ctx.fillRect(33, 23, 3, 7);
      ctx.fillRect(38, 20, 3, 10);
      ctx.fillRect(43, 17, 3, 13);

      ctx.lineWidth = 1.6;
      ctx.strokeRect(55, 18, 17, 11);
      ctx.beginPath();
      ctx.moveTo(55, 18);
      ctx.lineTo(63.5, 24.5);
      ctx.lineTo(72, 18);
      ctx.stroke();

      const nowDate = new Date();
      const hh = String(nowDate.getHours()).padStart(2, '0');
      const mm = String(nowDate.getMinutes()).padStart(2, '0');
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${hh}:${mm}`, 338, 29);

      ctx.strokeRect(348, 18, 28, 11);
      ctx.fillRect(345, 21, 3, 5);
      ctx.fillRect(353, 20, 21, 7);

      ctx.fillRect(20, 37, LCD_W - 40, 1.5);

      // 2. NOW PLAYING Hero Row (Spacious 70x70 Cover + Bounded Info + Right Equalizer)
      drawSquareThumb(ctx, thumbCacheRef.current.get(s.activeTrackId), 22, 48, 70);

      const textX = 104;
      const maxTextW = 158;
      ctx.textAlign = 'left';
      ctx.fillStyle = ink;

      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText('NOW PLAYING:', textX, 62);

      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText(fitTextToWidth(ctx, s.title, maxTextW), textX, 81);

      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(fitTextToWidth(ctx, `♪ ${s.artist}`, maxTextW), textX, 98);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(
        `◎ ${String(s.trackIndex + 1).padStart(2, '0')} / ${String(s.totalTracks).padStart(2, '0')}`,
        textX,
        115
      );

      // Right Pixel Equalizer (Zero Overlap!)
      const wfX = 276;
      const wfY = 85;
      const bars = 21;
      for (let i = 0; i < bars; i++) {
        const wave = s.isPlaying
          ? Math.abs(Math.sin(tSec * 5.2 + i * 0.58) * Math.cos(tSec * 2.4 + i * 0.92))
          : 0.14 + Math.abs(Math.sin(i * 0.72)) * 0.24;
        const barH = Math.max(4, Math.round(wave * 38));
        ctx.fillRect(wfX + i * 5, wfY - Math.floor(barH / 2), 2.5, barH);
      }

      // 3. Centered Timing Line & Pixel Progress Bar
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText(
        s.isPlaying
          ? `${formatTime(s.currentTime)} / ${formatTime(s.duration)}`
          : `PAUSED  ${formatTime(s.currentTime)} / ${formatTime(s.duration)}`,
        LCD_W / 2,
        152
      );

      const pbX = 24;
      const pbY = 164;
      const pbW = LCD_W - 48;
      const pbH = 11;
      ctx.lineWidth = hovered === 'progress' ? 2.2 : 1.6;
      ctx.strokeRect(pbX, pbY, pbW, pbH);
      const pct = s.duration > 0 ? Math.max(0, Math.min(1, s.currentTime / s.duration)) : 0;
      ctx.fillRect(pbX + 2, pbY + 2, Math.round((pbW - 4) * pct), pbH - 4);

      // 4. SINGLE-SONG SCROLLABLE UP NEXT SLOT (Exact spacious box, smoothly slides 1 song at a time!)
      if (upcoming.length > 0) {
        const isHov = hovered === 'upnext';

        ctx.save();
        if (isHov) {
          ctx.fillStyle = ink;
          ctx.fillRect(UP_X, UP_Y, UP_W, UP_H);
        } else {
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.2;
          ctx.strokeRect(UP_X, UP_Y, UP_W, UP_H);
          ctx.setLineDash([]);
        }

        // Clip inside the 48px single-card window so outgoing/incoming cards glide smoothly!
        ctx.beginPath();
        ctx.rect(UP_X + 1, UP_Y + 1, UP_W - 2, UP_H - 2);
        ctx.clip();

        const vSlot = visualSlotRef.current;
        const idxA = Math.max(0, Math.min(upcoming.length - 1, Math.floor(vSlot)));
        const idxB = Math.max(0, Math.min(upcoming.length - 1, Math.ceil(vSlot)));
        const indicesToDraw = idxA === idxB ? [idxA] : [idxA, idxB];

        indicesToDraw.forEach((slotIdx) => {
          const item = upcoming[slotIdx];
          if (!item) return;
          const cardY = UP_Y + (slotIdx - vSlot) * UP_H;

          // Mini square monochrome cover thumbnail
          drawSquareThumb(
            ctx,
            thumbCacheRef.current.get(item.track.id),
            UP_X + 7,
            cardY + 7,
            34,
            isHov
          );

          ctx.fillStyle = isHov ? '#ffffff' : ink;
          ctx.textAlign = 'left';
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.fillText(
            `UP NEXT  #${String(item.originalIndex + 1).padStart(2, '0')}`,
            UP_X + 50,
            cardY + 19
          );

          ctx.font = 'bold 12px "JetBrains Mono", monospace';
          ctx.fillText(
            fitTextToWidth(ctx, cleanDisplayTitle(item.track.title), UP_W - 104),
            UP_X + 50,
            cardY + 35
          );

          // Right-side scroll position indicator (e.g. ↕ 1/12)
          ctx.textAlign = 'right';
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.fillText(
            `↕ ${slotIdx + 1}/${upcoming.length}`,
            UP_X + UP_W - 10,
            cardY + 28
          );
        });

        ctx.restore();
        ctx.fillStyle = ink;
      }

      // 5. Bottom Softkeys (PREV / PLAY-PAUSE / NEXT)
      ctx.fillRect(20, 254, LCD_W - 40, 1.2);

      const drawSoftkey = (label: string, zone: HitZone, boxX: number, boxW: number) => {
        const isHov = hovered === zone;
        const boxY = 263;
        const boxH = 30;
        if (isHov) {
          ctx.fillStyle = ink;
          ctx.fillRect(boxX, boxY, boxW, boxH);
        }
        ctx.fillStyle = isHov ? '#ffffff' : ink;
        ctx.font = 'bold 16px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, boxX + boxW / 2, boxY + 21);
        ctx.fillStyle = ink;
      };

      drawSoftkey('PREV', 'prev', 20, 96);
      drawSoftkey(s.isPlaying ? 'PAUSE' : 'PLAY', 'play', 148, 104);
      drawSoftkey('NEXT', 'next', 284, 96);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(glCanvas.clientWidth * dpr);
      const h = Math.floor(glCanvas.clientHeight * dpr);
      if (glCanvas.width !== w || glCanvas.height !== h) {
        glCanvas.width = w;
        glCanvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const render = (now: number) => {
      resize();
      const tSec = (now - start) / 1000;
      drawPixelLCD(tSec);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);

      gl.uniform2f(uRes, glCanvas.width, glCanvas.height);
      gl.uniform1f(uTime, tSec);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      gl.deleteTexture(texture);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
    };
  }, []);

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
        sound.playClick(1200, 0.02);
        onNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        sound.playClick(900, 0.02);
        onPrev();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        stepUpcomingSlot(1);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        stepUpcomingSlot(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onTogglePlay, onNext, onPrev, stepUpcomingSlot]);

  const seekFromLcdX = useCallback(
    (lcdX: number) => {
      const pbX = 24;
      const pbW = LCD_W - 48;
      const ratio = Math.max(0, Math.min(1, (lcdX - pbX) / pbW));
      onSeek(ratio * duration);
    },
    [duration, onSeek]
  );

  // Clean debounced snap-step scroll on trackpad/mouse wheel -> flips 1 song smoothly inside UP NEXT!
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const now = performance.now();
    if (now - wheelCooldownRef.current < 150) return;

    wheelAccumRef.current += e.deltaY;
    if (Math.abs(wheelAccumRef.current) >= 24) {
      const dir = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current = 0;
      wheelCooldownRef.current = now;
      stepUpcomingSlot(dir);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pt = screenToLcdCoords(e.clientX, e.clientY, rect);

    if (isScrubbingRef.current) {
      seekFromLcdX(pt.x);
      return;
    }

    const zone = pt.inside ? hitTestLcd(pt.x, pt.y) : null;
    hoveredZoneRef.current = zone;
    setCursorPointer(zone !== null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pt = screenToLcdCoords(e.clientX, e.clientY, rect);
    if (!pt.inside) return;

    const zone = hitTestLcd(pt.x, pt.y);
    if (zone === 'progress') {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      isScrubbingRef.current = true;
      sound.playClick(1100, 0.015);
      seekFromLcdX(pt.x);
    } else if (zone === 'prev') {
      sound.playClick(900, 0.02);
      onPrev();
    } else if (zone === 'play') {
      sound.playSwitch();
      onTogglePlay();
    } else if (zone === 'next') {
      sound.playClick(1200, 0.02);
      onNext();
    } else if (zone === 'upnext') {
      const chosen = upcomingItemsRef.current[targetSlotRef.current];
      if (chosen) {
        sound.playClick(1250, 0.02);
        onSelectTrack(chosen.originalIndex);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScrubbingRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    isScrubbingRef.current = false;
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none flex flex-col md:block items-center justify-center">
      <div className="relative w-full flex-1 md:h-full flex items-center justify-center">
        <canvas
          ref={glCanvasRef}
          onWheel={handleWheel}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            hoveredZoneRef.current = null;
            setCursorPointer(false);
          }}
          className={`w-full h-full block touch-none ${
            cursorPointer ? 'cursor-pointer' : 'cursor-default'
          }`}
        />
      </div>

      {/* Mobile-Only Tactile Phosphor Control Deck below CRT (hidden on md+ desktop so desktop stays 100% pure CRT!) */}
      <div
        className="md:hidden w-full px-4 pt-2 shrink-0 z-20"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="rounded-xl bg-[#1a0d0b]/95 border border-[#ff6b4f]/35 px-4 py-3 text-[#ff8b78] shadow-[0_0_24px_rgba(255,90,60,0.18)]">
          <div className="flex items-center justify-between gap-2 mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em]">
            <span className="truncate text-[#ffb3a3]">
              {String(activeIndex + 1).padStart(2, '0')} · {cleanDisplayTitle(activeTrack?.title || 'UNTITLED')}
            </span>
            <span className="shrink-0 tabular-nums text-[#ff6b4f]">
              {formatTime(currentTime)}/{formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center justify-around gap-3">
            <button
              type="button"
              onClick={() => {
                sound.playDiscSpin();
                onPrev();
              }}
              className="touch-target flex-1 py-2 rounded-lg border border-[#ff6b4f]/40 bg-[#ff5a3c]/10 active:bg-[#ff5a3c]/30 font-mono text-xs font-bold tracking-widest uppercase text-[#ffb8aa]"
            >
              &lt;&lt; PREV
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playSwitch();
                onTogglePlay();
              }}
              className="touch-target flex-1 py-2 rounded-lg border border-[#ff8b78] bg-[#ff5a3c] active:scale-95 font-mono text-xs font-bold tracking-widest uppercase text-black"
            >
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playDiscSpin();
                onNext();
              }}
              className="touch-target flex-1 py-2 rounded-lg border border-[#ff6b4f]/40 bg-[#ff5a3c]/10 active:bg-[#ff5a3c]/30 font-mono text-xs font-bold tracking-widest uppercase text-[#ffb8aa]"
            >
              NEXT &gt;&gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
