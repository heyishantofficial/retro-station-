import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Track } from '../types';
import { CDDisc } from './CDDisc';
import { sound } from '../utils/soundEffects';

interface CDCarouselProps {
  tracks: Track[];
  activeIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSelectTrack: (index: number) => void;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onScrubPreview: (time: number | null) => void;
}

export const CDCarousel: React.FC<CDCarouselProps> = ({
  tracks,
  activeIndex,
  isPlaying,
  currentTime,
  duration,
  onSelectTrack,
  onTogglePlay,
  onSeek,
  onSetPlaybackRate,
  onScrubPreview,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHeroScrubbing, setIsHeroScrubbing] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  // Pure MotionValues for cursor parallax — ZERO React re-renders on mouse move!
  const rawParallaxX = useMotionValue(0);
  const rawParallaxY = useMotionValue(0);
  const parallaxRotateX = useSpring(rawParallaxX, { stiffness: 140, damping: 26, mass: 0.6 });
  const parallaxRotateY = useSpring(rawParallaxY, { stiffness: 140, damping: 26, mass: 0.6 });

  const pointerStartRef = useRef<{ x: number; time: number } | null>(null);
  const lastMoveRef = useRef<{ x: number; time: number } | null>(null);
  const velocityRef = useRef(0);
  const wheelLockRef = useRef(0);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Balanced disc diameter + generous spacing so discs have crisp gallery separation with zero overlap
  const heroSize = Math.max(250, Math.min(380, Math.round(viewportWidth * 0.295)));
  const spacingX = Math.max(295, Math.min(450, Math.round(viewportWidth * 0.355)));

  const applyRubberBand = useCallback(
    (rawDelta: number) => {
      const atStart = activeIndex === 0 && rawDelta > 0;
      const atEnd = activeIndex === tracks.length - 1 && rawDelta < 0;
      if (atStart || atEnd) {
        const d = 280;
        const c = 0.45;
        return (rawDelta * d * c) / (d + c * Math.abs(rawDelta));
      }
      return rawDelta;
    },
    [activeIndex, tracks.length]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointerStartRef.current = { x: e.clientX, time: performance.now() };
    lastMoveRef.current = { x: e.clientX, time: performance.now() };
    velocityRef.current = 0;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      rawParallaxX.set(-ny * 3.5);
      rawParallaxY.set(nx * 4.5);
    }

    if (!isDragging || !pointerStartRef.current || !lastMoveRef.current) return;

    const now = performance.now();
    const dt = Math.max(1, now - lastMoveRef.current.time);
    const dx = e.clientX - lastMoveRef.current.x;
    velocityRef.current = (dx / dt) * 1000;
    lastMoveRef.current = { x: e.clientX, time: now };

    const totalDelta = e.clientX - pointerStartRef.current.x;
    setDragOffset(applyRubberBand(totalDelta));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging || !pointerStartRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const totalDelta = e.clientX - pointerStartRef.current.x;
    const velocity = velocityRef.current;

    const decel = 0.992;
    const projected = totalDelta + (velocity / 1000) * (decel / (1 - decel)) * 0.25;

    const threshold = spacingX * 0.28;
    if (projected < -threshold && activeIndex < tracks.length - 1) {
      sound.playDiscSpin();
      onSelectTrack(activeIndex + 1);
    } else if (projected > threshold && activeIndex > 0) {
      sound.playDiscSpin();
      onSelectTrack(activeIndex - 1);
    }

    setIsDragging(false);
    setDragOffset(0);
    pointerStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const now = performance.now();
    if (now - wheelLockRef.current < 340) return;

    const dominant = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(dominant) > 22) {
      wheelLockRef.current = now;
      if (dominant > 0 && activeIndex < tracks.length - 1) {
        sound.playDiscSpin();
        onSelectTrack(activeIndex + 1);
      } else if (dominant < 0 && activeIndex > 0) {
        sound.playDiscSpin();
        onSelectTrack(activeIndex - 1);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => {
        if (!isDragging) {
          rawParallaxX.set(0);
          rawParallaxY.set(0);
        }
      }}
      onWheel={handleWheel}
      className="relative w-full h-full flex items-center justify-center overflow-visible touch-none cursor-grab active:cursor-grabbing"
      style={{ perspective: '1300px' }}
    >
      {/* Ground-Plane Detached Floating Shadow Pool beneath the Hero Disc (creates tangible mid-air gap!) */}
      <motion.div
        className="pointer-events-none absolute rounded-full will-change-transform"
        initial={false}
        animate={{
          width: isPlaying || isHeroScrubbing ? heroSize * 0.92 : heroSize * 0.80,
          height: isPlaying || isHeroScrubbing ? heroSize * 0.24 : heroSize * 0.20,
          y: heroSize * 0.64 + (isPlaying || isHeroScrubbing ? 14 : 4),
          x: 22,
          opacity: isPlaying || isHeroScrubbing ? 0.56 : 0.44,
        }}
        transition={{ type: 'spring', stiffness: 105, damping: 24, mass: 1 }}
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(12,12,16,0.44) 0%, rgba(15,15,20,0.22) 44%, rgba(0,0,0,0.06) 70%, rgba(0,0,0,0) 86%)',
          filter: 'blur(26px)',
        }}
      />

      {/* Unified GPU-accelerated parallax stage */}
      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        style={{
          transformStyle: 'preserve-3d',
          rotateX: parallaxRotateX,
          rotateY: parallaxRotateY,
        }}
      >
        {tracks.map((track, idx) => {
          const offset = idx - activeIndex;
          if (Math.abs(offset) > 3) return null;

          const isHero = offset === 0;
          const isHeroPlaying = isHero && isPlaying;
          const isHeroEngaged = isHero && (isPlaying || isHeroScrubbing);
          const dragRatio = dragOffset / spacingX;
          const t = offset + dragRatio;

          // Sweeping curved arc line with crisp separation
          const translateX = t * spacingX * (1 + 0.04 * t) + 6;
          const translateY = (isHeroEngaged ? -2 : 12) - t * 106 - 20 * t * t;
          const translateZ = isHeroEngaged ? 54 : 12;

          // Perspective scale along curve + gentle elevation scale when playing or scrubbing
          const scale = isHeroEngaged
            ? 1.05
            : t < 0
            ? Math.max(0.64, 1 + t * 0.18)
            : Math.min(1.04, 1 + t * 0.03);

          // Single unified spring-animated 3D tilt:
          // Playing or scrubbing hero disc glides smoothly flatter toward the viewer;
          // Paused & neighboring discs stay tilted along the curved 3D line
          const rotateX = isHeroEngaged ? 6 : 28 - t * 4;
          const rotateY = isHeroEngaged ? -8 : -41 - t * 3;
          const rotateZ = isHeroEngaged ? 0 : -6 + t * 5;

          const opacity =
            Math.abs(t) > 2.35 ? 0 : Math.abs(t) > 1.65 ? 0.72 : 1;
          const zIndex = 30 - Math.abs(offset) * 4 + (offset > 0 ? 2 : 0);

          return (
            <motion.div
              key={track.id}
              initial={false}
              animate={{
                x: translateX,
                y: translateY,
                z: translateZ,
                scale,
                rotateX,
                rotateY,
                rotateZ,
                opacity,
              }}
              transition={
                isDragging
                  ? { type: 'tween', duration: 0.04, ease: 'linear' }
                  : {
                      type: 'spring',
                      stiffness: 115,
                      damping: 22,
                      mass: 0.95,
                    }
              }
              style={{
                position: 'absolute',
                zIndex,
                transformStyle: 'preserve-3d',
                willChange: 'transform, opacity',
              }}
            >
              <CDDisc
                track={track}
                size={heroSize}
                isHero={isHero}
                isPlaying={isHeroPlaying}
                currentTime={currentTime}
                duration={duration}
                onSeek={isHero ? onSeek : undefined}
                onSetPlaybackRate={isHero ? onSetPlaybackRate : undefined}
                onScrubPreview={
                  isHero
                    ? (previewTime) => {
                        setIsHeroScrubbing(previewTime !== null);
                        onScrubPreview(previewTime);
                      }
                    : undefined
                }
                onClick={() => {
                  if (Math.abs(dragOffset) > 10) return;
                  if (isHero) {
                    sound.playSwitch();
                    onTogglePlay();
                  } else {
                    sound.playDiscSpin();
                    onSelectTrack(idx);
                  }
                }}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};
