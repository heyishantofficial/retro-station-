import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Track } from '../types';
import { createMotorRamp, retargetMotorRamp, sampleMotorRamp } from '../utils/motorRamp';

interface CDDiscProps {
  track: Track;
  size?: number;
  isPlaying?: boolean;
  isHero?: boolean;
  currentTime?: number;
  duration?: number;
  className?: string;
  onClick?: () => void;
  onSeek?: (seconds: number) => void;
  onSetPlaybackRate?: (rate: number) => void;
  onScrubPreview?: (time: number | null) => void;
}

function getBestCoverUrl(track: Track): string {
  if (track.youtubeId) {
    return `https://i.ytimg.com/vi/${track.youtubeId}/maxresdefault.jpg`;
  }
  return track.coverUrl;
}

function formatDelta(deltaSecs: number) {
  const sign = deltaSecs >= 0 ? '+' : '−';
  const abs = Math.abs(Math.round(deltaSecs));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

const ELEVATION_SPRING = {
  type: 'spring' as const,
  stiffness: 110,
  damping: 22,
  mass: 1,
};

export const CDDisc: React.FC<CDDiscProps> = ({
  track,
  size = 380,
  isPlaying = false,
  isHero = false,
  currentTime = 0,
  duration = 210,
  className = '',
  onClick,
  onSeek,
  onSetPlaybackRate,
  onScrubPreview,
}) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const discRef = useRef<HTMLDivElement | null>(null);

  const spinAngleRef = useRef(0);
  const motorRampRef = useRef(createMotorRamp(isPlaying ? 0.38 : 0));

  const [imgSrc, setImgSrc] = useState(() => getBestCoverUrl(track));
  const [coverScale, setCoverScale] = useState(1.06);

  // Direct hero-CD scrubbing state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubDelta, setScrubDelta] = useState(0);
  const [intensityBadge, setIntensityBadge] = useState<string | null>(null);

  const dragRef = useRef<{
    active: boolean;
    hasMoved: boolean;
    startClientX: number;
    startClientY: number;
    lastAngleDeg: number;
    lastMoveTime: number;
    lastSeekCommitTime: number;
    lastAppliedRate: number;
    lastAngularVel: number;
    accumulatedDeg: number;
    startSongTime: number;
    currentScrubTime: number;
    idleSlowTimer: number | null;
  }>({
    active: false,
    hasMoved: false,
    startClientX: 0,
    startClientY: 0,
    lastAngleDeg: 0,
    lastMoveTime: 0,
    lastSeekCommitTime: 0,
    lastAppliedRate: 1,
    lastAngularVel: 0,
    accumulatedDeg: 0,
    startSongTime: 0,
    currentScrubTime: 0,
    idleSlowTimer: null,
  });

  useEffect(() => {
    setImgSrc(getBestCoverUrl(track));
    setCoverScale(1.06);
  }, [track]);

  // Clean up playback rate if unmounted mid-scrub
  useEffect(() => {
    return () => {
      if (dragRef.current.idleSlowTimer !== null) {
        window.clearTimeout(dragRef.current.idleSlowTimer);
      }
      if (dragRef.current.active) {
        onSetPlaybackRate?.(1);
        onScrubPreview?.(null);
      }
    };
  }, [onSetPlaybackRate, onScrubPreview]);

  // Smooth Cubic S-curve ease-in-out spin ramp (950ms spool-up, 1250ms coast-down)
  useEffect(() => {
    if (isScrubbing) {
      retargetMotorRamp(motorRampRef.current, 0, 80);
    } else if (isPlaying) {
      retargetMotorRamp(motorRampRef.current, 0.38, 950);
    } else {
      retargetMotorRamp(motorRampRef.current, 0, 1250);
    }
  }, [isPlaying, isScrubbing]);

  useEffect(() => {
    let lastTime = performance.now();
    let rafId = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.666, 3);
      lastTime = now;

      if (!dragRef.current.active) {
        const speed = sampleMotorRamp(motorRampRef.current, now);

        if (Math.abs(speed) > 0.0005 || isPlaying) {
          spinAngleRef.current = (spinAngleRef.current + speed * dt) % 360;
          if (discRef.current) {
            discRef.current.style.setProperty('--disc-rotation', `${spinAngleRef.current}deg`);
          }
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (track.youtubeId && naturalWidth <= 120) {
      setImgSrc(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`);
      return;
    }

    if (naturalWidth > 0 && naturalHeight > 0) {
      const aspect = naturalWidth / naturalHeight;
      if (track.youtubeId && aspect > 1.25 && aspect < 1.48) {
        setCoverScale(1.38);
      } else {
        setCoverScale(1.06);
      }
    }
  };

  const handleImageError = () => {
    if (track.youtubeId && !imgSrc.includes('mqdefault')) {
      setImgSrc(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`);
    } else if (imgSrc !== track.coverUrl) {
      setImgSrc(track.coverUrl);
    }
  };

  const applyIntensityRate = useCallback(
    (angularVelDegPerSec: number) => {
      const speed = Math.abs(angularVelDegPerSec);
      const isForward = angularVelDegPerSec >= 0;

      let rate = 1;
      let label: string | null = null;

      if (isForward) {
        if (speed > 260) {
          rate = 2.0;
          label = 'FWD 2×';
        } else if (speed > 110) {
          rate = 1.5;
          label = 'FWD 1.5×';
        } else if (speed > 18) {
          rate = 1.25;
          label = 'FWD 1.25×';
        } else {
          rate = 0.5;
          label = 'HOLD';
        }
      } else {
        if (speed > 200) {
          rate = 0.5;
          label = 'REW 2×';
        } else if (speed > 20) {
          rate = 0.75;
          label = 'REW';
        } else {
          rate = 0.5;
          label = 'HOLD';
        }
      }

      if (dragRef.current.lastAppliedRate !== rate) {
        dragRef.current.lastAppliedRate = rate;
        onSetPlaybackRate?.(rate);
      }
      setIntensityBadge(label);
    },
    [onSetPlaybackRate]
  );

  const getPointerAngleFromCenter = (clientX: number, clientY: number) => {
    if (!outerRef.current) return 0;
    const rect = outerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Side discs let the carousel handle drag/click normally
    if (!isHero || e.button !== 0) return;

    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const now = performance.now();
    const startAngle = getPointerAngleFromCenter(e.clientX, e.clientY);
    retargetMotorRamp(motorRampRef.current, 0, 1, 0);

    dragRef.current = {
      active: true,
      hasMoved: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastAngleDeg: startAngle,
      lastMoveTime: now,
      lastSeekCommitTime: now,
      lastAppliedRate: 1,
      lastAngularVel: 0,
      accumulatedDeg: 0,
      startSongTime: currentTime,
      currentScrubTime: currentTime,
      idleSlowTimer: null,
    };

    setIsScrubbing(true);
    setScrubDelta(0);
    setIntensityBadge(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!isHero || !drag.active) return;

    const now = performance.now();
    const dtMs = Math.max(6, now - drag.lastMoveTime);
    drag.lastMoveTime = now;

    const currentAngle = getPointerAngleFromCenter(e.clientX, e.clientY);
    let deltaDeg = currentAngle - drag.lastAngleDeg;
    if (deltaDeg > 180) deltaDeg -= 360;
    if (deltaDeg < -180) deltaDeg += 360;
    drag.lastAngleDeg = currentAngle;

    const dist = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
    if (!drag.hasMoved && (dist > 6 || Math.abs(drag.accumulatedDeg + deltaDeg) > 3.5)) {
      drag.hasMoved = true;
    }

    if (!drag.hasMoved) return;

    // 1:1 physical CD rotation directly under pointer
    spinAngleRef.current = (spinAngleRef.current + deltaDeg) % 360;
    if (discRef.current) {
      discRef.current.style.setProperty('--disc-rotation', `${spinAngleRef.current}deg`);
    }

    const angularVelDegPerSec = (deltaDeg / dtMs) * 1000;
    drag.lastAngularVel = angularVelDegPerSec;
    drag.accumulatedDeg += deltaDeg;

    // Drive real song speed intensity based on forward / rewind spin
    applyIntensityRate(angularVelDegPerSec);

    if (drag.idleSlowTimer !== null) {
      window.clearTimeout(drag.idleSlowTimer);
    }
    drag.idleSlowTimer = window.setTimeout(() => {
      if (dragRef.current.active && dragRef.current.hasMoved) {
        if (dragRef.current.lastAppliedRate !== 0.5) {
          dragRef.current.lastAppliedRate = 0.5;
          onSetPlaybackRate?.(0.5);
        }
        setIntensityBadge('HOLD');
      }
    }, 110);

    // 1 full 360° turn = ~50s (or ~25% of track)
    const secondsPerFullTurn = Math.max(30, Math.min(75, duration * 0.25 || 50));
    const deltaSecs = (drag.accumulatedDeg / 360) * secondsPerFullTurn;
    const nextTime = Math.max(0, Math.min(duration, drag.startSongTime + deltaSecs));

    drag.currentScrubTime = nextTime;
    setScrubDelta(nextTime - drag.startSongTime);
    onScrubPreview?.(nextTime);

    // Stream live throttled seeks so you hear the real song moving with your rotation
    if (now - drag.lastSeekCommitTime >= 150) {
      drag.lastSeekCommitTime = now;
      onSeek?.(nextTime);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!isHero || !drag.active) return;

    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (drag.idleSlowTimer !== null) {
      window.clearTimeout(drag.idleSlowTimer);
    }

    const wasScrub = drag.hasMoved;
    const finalTime = drag.currentScrubTime;
    const releaseDegPerFrame = Math.max(-5, Math.min(5, (drag.lastAngularVel / 1000) * 16.666 * 0.35));

    drag.active = false;
    setIsScrubbing(false);
    setScrubDelta(0);
    setIntensityBadge(null);
    onScrubPreview?.(null);

    // Always restore normal 1× speed immediately on release
    onSetPlaybackRate?.(1);

    if (wasScrub) {
      retargetMotorRamp(motorRampRef.current, isPlaying ? 0.38 : 0, 850, releaseDegPerFrame);
      onSeek?.(finalTime);
    } else {
      onClick?.();
    }
  };

  const spindleHoleSize = Math.round(size * 0.13);
  const clampingRingSize = Math.round(size * 0.27);
  const transparentHubSize = Math.round(size * 0.34);

  const isElevated = isHero && (isPlaying || isScrubbing);

  return (
    <div
      ref={outerRef}
      onClick={!isHero ? onClick : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title={
        isHero
          ? 'Click to Play/Pause • Hold & rotate disc to fast-forward / rewind'
          : track.title
      }
      className={`relative select-none group touch-none ${
        isHero ? (isScrubbing ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'
      } ${className}`}
      style={{
        width: size,
        height: size,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Layer 0: Distant Floating Penumbra Shadow (wide detached air-gap depth gradient) */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none will-change-transform"
        initial={false}
        animate={{
          x: isElevated ? 56 : 36,
          y: isElevated ? 104 : 68,
          scaleX: isElevated ? 1.18 : 1.06,
          scaleY: isElevated ? 1.04 : 0.96,
          opacity: isElevated ? 0.96 : 0.84,
        }}
        transition={ELEVATION_SPRING}
        style={{
          transform: 'translateZ(-115px)',
          background:
            'radial-gradient(ellipse at 48% 50%, rgba(10,10,14,0.34) 0%, rgba(12,12,16,0.22) 34%, rgba(15,15,20,0.10) 60%, rgba(0,0,0,0.03) 78%, rgba(0,0,0,0) 90%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Layer 1: Mid-Air Directional Umbra Depth Shadow (shifts farther as disc rises!) */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none will-change-transform"
        initial={false}
        animate={{
          x: isElevated ? 34 : 22,
          y: isElevated ? 64 : 42,
          scale: isElevated ? 1.04 : 0.96,
          opacity: isElevated ? 0.94 : 0.88,
        }}
        transition={ELEVATION_SPRING}
        style={{
          transform: 'translateZ(-64px)',
          background:
            'radial-gradient(ellipse at center, rgba(8,8,12,0.44) 0%, rgba(12,12,16,0.28) 42%, rgba(0,0,0,0.10) 66%, rgba(0,0,0,0) 82%)',
          filter: 'blur(24px)',
        }}
      />

      {/* Layer 2: Sculpted Core Depth Shadow (crisp directional drop directly under lower-right rim) */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none will-change-transform"
        initial={false}
        animate={{
          x: isElevated ? 17 : 11,
          y: isElevated ? 30 : 20,
          scale: isElevated ? 0.96 : 0.92,
          opacity: isElevated ? 0.82 : 0.96,
        }}
        transition={ELEVATION_SPRING}
        style={{
          transform: 'translateZ(-28px)',
          background:
            'radial-gradient(ellipse at center, rgba(6,6,10,0.46) 0%, rgba(10,10,14,0.22) 48%, rgba(0,0,0,0.05) 68%, rgba(0,0,0,0) 78%)',
          filter: 'blur(12px)',
        }}
      />

      {/* Layer 3: Subtle Physical Polycarbonate Edge Rim (gives real 3D disc thickness) */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          transform: 'translate3d(2.5px, 3.5px, -3px)',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.76) 0%, rgba(125,125,132,0.68) 52%, rgba(28,28,34,0.82) 100%)',
        }}
      />

      {/* Main Rotating Disc Body */}
      <div
        ref={discRef}
        className="absolute inset-0 rounded-full overflow-hidden will-change-transform"
        style={{
          transform: 'rotate(var(--disc-rotation, 0deg))',
          boxShadow: `
            inset 0 0 0 1.5px rgba(255, 255, 255, 0.82),
            inset 0 0 0 3px rgba(0, 0, 0, 0.24),
            0 24px 48px -10px rgba(0, 0, 0, 0.36),
            0 10px 22px -6px rgba(0, 0, 0, 0.24)
          `,
        }}
      >
        {/* Exact Song Cover Art Only — Full Bleed & Centered */}
        <div className="absolute inset-0 w-full h-full bg-[#181818] overflow-hidden rounded-full">
          <img
            src={imgSrc}
            alt={track.title}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="w-full h-full object-cover object-center filter contrast-[1.04] saturate-[1.08]"
            style={{
              transform: `scale(${coverScale})`,
              transformOrigin: 'center center',
            }}
            draggable={false}
          />
        </div>

        {/* Subtle Concentric Micro-Grooves */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none opacity-20 mix-blend-overlay"
          style={{
            backgroundImage:
              'repeating-radial-gradient(circle at center, transparent 0, transparent 1.5px, rgba(255,255,255,0.14) 2px, transparent 3px)',
          }}
        />

        {/* Delicate Iridescent CD Diffraction Sheen */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none mix-blend-color-dodge"
          style={{
            opacity: isHero ? 0.34 : 0.24,
            background: `
              conic-gradient(
                from calc(var(--disc-rotation, 0deg) * -1 + 40deg) at 50% 50%,
                transparent 0deg,
                rgba(255, 0, 110, 0.35) 28deg,
                rgba(255, 200, 0, 0.35) 54deg,
                rgba(0, 255, 160, 0.35) 80deg,
                rgba(0, 175, 255, 0.35) 106deg,
                rgba(170, 0, 255, 0.28) 132deg,
                transparent 165deg,
                transparent 180deg,
                rgba(255, 0, 110, 0.35) 208deg,
                rgba(255, 200, 0, 0.35) 234deg,
                rgba(0, 255, 160, 0.35) 260deg,
                rgba(0, 175, 255, 0.35) 286deg,
                rgba(170, 0, 255, 0.28) 312deg,
                transparent 345deg
              )
            `,
          }}
        />

        {/* Soft Directional Specular Glare */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none mix-blend-screen opacity-35"
          style={{
            background:
              'linear-gradient(125deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.06) 36%, transparent 55%, rgba(255,255,255,0.18) 100%)',
          }}
        />

        {/* Physical Center Hub & Spindle Hole (Zero backdrop-filter for locked 120fps!) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="rounded-full flex items-center justify-center shadow-[inset_0_0_6px_rgba(0,0,0,0.4),0_0_3px_rgba(255,255,255,0.35)]"
            style={{
              width: transparentHubSize,
              height: transparentHubSize,
              background:
                'radial-gradient(circle, rgba(255,255,255,0.26) 0%, rgba(220,220,220,0.12) 70%, rgba(0,0,0,0.18) 100%)',
              border: '1px solid rgba(255,255,255,0.45)',
            }}
          >
            <div
              className="rounded-full flex items-center justify-center shadow-[inset_0_1px_3px_rgba(255,255,255,0.9),0_1px_4px_rgba(0,0,0,0.35)]"
              style={{
                width: clampingRingSize,
                height: clampingRingSize,
                background:
                  'conic-gradient(from 30deg, #cfd4dc 0deg, #f3f4f6 85deg, #a3aab5 175deg, #e7eaef 265deg, #cfd4dc 360deg)',
                border: '1px solid rgba(156, 163, 175, 0.75)',
              }}
            >
              <div
                className="rounded-full relative shadow-[inset_0_2px_5px_rgba(0,0,0,0.52),0_0_2px_rgba(255,255,255,0.8)]"
                style={{
                  width: spindleHoleSize,
                  height: spindleHoleSize,
                  background: '#ececeb',
                  border: '1.5px solid rgba(110, 115, 125, 0.55)',
                }}
              >
                <div className="absolute inset-[2px] rounded-full border border-neutral-400/30" />
              </div>
            </div>
          </div>
        </div>

        {/* Crisp Silver Perimeter Edge (highlights subtly while actively scrubbing) */}
        <div
          className={`absolute inset-0 rounded-full pointer-events-none transition-colors duration-200 ${
            isScrubbing ? 'border-[2px] border-neutral-900/50' : 'border-[1.5px] border-white/65'
          }`}
        />
      </div>

      {/* Minimal Floating Forward / Rewind Intensity Pill while rotating the hero CD */}
      <AnimatePresence>
        {isHero && isScrubbing && (intensityBadge || Math.abs(scrubDelta) >= 0.5) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-full bg-neutral-900/90 text-white font-mono text-[10px] tracking-wider shadow-md"
          >
            {intensityBadge ? intensityBadge : ''}
            {Math.abs(scrubDelta) >= 0.5
              ? `${intensityBadge ? ' · ' : ''}${formatDelta(scrubDelta)}`
              : ''}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
