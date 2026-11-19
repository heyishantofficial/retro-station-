import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Track } from '../types';
import { sound } from '../utils/soundEffects';
import { createMotorRamp, retargetMotorRamp, sampleMotorRamp } from '../utils/motorRamp';

interface VinylDeckViewProps {
  playlistTitle: string;
  tracks: Track[];
  activeIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onSelectTrack: (index: number) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onToggleMute: () => void;
}

function formatTime(secs: number) {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDelta(deltaSecs: number) {
  const sign = deltaSecs >= 0 ? '+' : '−';
  const abs = Math.abs(Math.round(deltaSecs));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function cleanDisplayTitle(rawTitle: string): string {
  const primary = rawTitle.split(/\s*\|\s*/)[0].trim();
  return (primary || rawTitle).toUpperCase();
}

function getBestCoverUrl(track?: Track): string {
  if (!track) return '';
  if (track.youtubeId) {
    return `https://i.ytimg.com/vi/${track.youtubeId}/maxresdefault.jpg`;
  }
  return track.coverUrl;
}

const VinylCoverImage: React.FC<{ track?: Track }> = ({ track }) => {
  const [src, setSrc] = useState(() => getBestCoverUrl(track));
  const [scale, setScale] = useState(1.06);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (track?.youtubeId && naturalWidth <= 120) {
      setSrc(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`);
      return;
    }
    if (naturalWidth > 0 && naturalHeight > 0) {
      const aspect = naturalWidth / naturalHeight;
      if (track?.youtubeId && aspect > 1.25 && aspect < 1.48) {
        setScale(1.38);
      } else {
        setScale(1.06);
      }
    }
  };

  const handleError = () => {
    if (track?.youtubeId && !src.includes('mqdefault')) {
      setSrc(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`);
    } else if (track && src !== track.coverUrl) {
      setSrc(track.coverUrl);
    }
  };

  if (!src) return null;

  return (
    <img
      src={src}
      alt={track?.title || 'Cover'}
      onLoad={handleLoad}
      onError={handleError}
      className="w-full h-full object-cover object-center filter contrast-[1.05] saturate-[1.06]"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
      draggable={false}
    />
  );
};

// Full-height concentric orbital ring geometry (viewBox 0 0 380 720)
const CX = 0;
const CY = 360;
const R = 354;
const START_DEG = -74;
const END_DEG = 74;
const TOTAL_DEG = END_DEG - START_DEG;

function degToPoint(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: CX + R * Math.cos(rad),
    y: CY + R * Math.sin(rad),
  };
}

const ARC_START = degToPoint(START_DEG);
const ARC_END = degToPoint(END_DEG);
const TRACK_PATH = `M ${ARC_START.x} ${ARC_START.y} A ${R} ${R} 0 0 1 ${ARC_END.x} ${ARC_END.y}`;

export const VinylDeckView: React.FC<VinylDeckViewProps> = ({
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
  const vinylBodyRef = useRef<HTMLDivElement | null>(null);
  const vinylSpinRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activePathRef = useRef<SVGPathElement | null>(null);
  const knobGroupRef = useRef<SVGGElement | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Continuous 60/120fps motion refs (zero React jitter!)
  const spinAngleRef = useRef(0);
  const motorRampRef = useRef(createMotorRamp(isPlaying ? 0.48 : 0));
  const visualProgressRef = useRef(0);
  const targetProgressRef = useRef(0);

  // Scrubbing UI states
  const [isScrubbingArc, setIsScrubbingArc] = useState(false);
  const [scrubProgress, setScrubProgress] = useState(0);
  const [isDraggingDisc, setIsDraggingDisc] = useState(false);
  const [discScrubTime, setDiscScrubTime] = useState<number | null>(null);
  const [discScrubDelta, setDiscScrubDelta] = useState<number>(0);
  const [scrubIntensityBadge, setScrubIntensityBadge] = useState<string | null>(null);

  const discDragRef = useRef<{
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

  const arcDragRef = useRef<{
    lastProgress: number;
    lastTime: number;
    lastSeekCommitTime: number;
    lastAppliedRate: number;
  }>({
    lastProgress: 0,
    lastTime: 0,
    lastSeekCommitTime: 0,
    lastAppliedRate: 1,
  });

  // Reset rate cleanly on unmount
  useEffect(() => {
    return () => {
      onSetPlaybackRate(1);
    };
  }, [onSetPlaybackRate]);

  // Reset disc spin angle & smoothly scroll active track row into view when song changes
  useEffect(() => {
    spinAngleRef.current = 0;
    onSetPlaybackRate(1);
    const activeRow = rowRefs.current[activeIndex];
    if (activeRow) {
      activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeTrack?.id, activeIndex, onSetPlaybackRate]);

  // Unified displayed timestamp & target progress
  const effectiveTime =
    isDraggingDisc && discScrubTime !== null
      ? discScrubTime
      : isScrubbingArc
        ? scrubProgress * duration
        : currentTime;

  const targetProgress =
    duration > 0 ? Math.max(0, Math.min(1, effectiveTime / duration)) : 0;

  useEffect(() => {
    targetProgressRef.current = targetProgress;
  }, [targetProgress]);

  useEffect(() => {
    if (isDraggingDisc) {
      retargetMotorRamp(motorRampRef.current, 0, 80);
    } else if (isPlaying) {
      retargetMotorRamp(motorRampRef.current, 0.48, 950);
    } else {
      retargetMotorRamp(motorRampRef.current, 0, 1250);
    }
  }, [isPlaying, isDraggingDisc]);

  // Unified 60/120fps requestAnimationFrame loop:
  // 1) True cubic ease-in-out motor ramp for the vinyl disc
  // 2) Ultra-smooth GPU/SVG interpolation for the crimson orbital progress ring & knob!
  useEffect(() => {
    let lastTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.666, 3);
      lastTime = now;

      // 1. Vinyl disc cubic ease-in-out motor + release momentum blend
      if (!discDragRef.current.active) {
        const speed = sampleMotorRamp(motorRampRef.current, now);
        if (Math.abs(speed) > 0.0005 || isPlaying) {
          spinAngleRef.current = (spinAngleRef.current + speed * dt) % 360;
          if (vinylSpinRef.current) {
            vinylSpinRef.current.style.transform = `rotate(${spinAngleRef.current}deg)`;
          }
        }
      }

      // 2. Smoothly glide orbital progress arc & knob toward targetProgress at 60/120fps
      const diff = targetProgressRef.current - visualProgressRef.current;
      // Faster snappy tracking while actively dragging, velvety glide during click-seek or playback
      const smoothFactor = discDragRef.current.active || isScrubbingArc ? 0.34 : 0.14;
      if (Math.abs(diff) > 0.0001) {
        visualProgressRef.current += diff * Math.min(1, smoothFactor * dt);
      } else {
        visualProgressRef.current = targetProgressRef.current;
      }

      const p = Math.max(0, Math.min(1, visualProgressRef.current));
      const deg = START_DEG + p * TOTAL_DEG;
      const pt = degToPoint(deg);

      if (activePathRef.current) {
        activePathRef.current.setAttribute(
          'd',
          p > 0.0015
            ? `M ${ARC_START.x} ${ARC_START.y} A ${R} ${R} 0 0 1 ${pt.x} ${pt.y}`
            : ''
        );
      }
      if (knobGroupRef.current) {
        knobGroupRef.current.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isScrubbingArc]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        sound.playSwitch();
        onTogglePlay();
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        e.preventDefault();
        sound.playDiscSpin();
        onNext();
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault();
        sound.playDiscSpin();
        onPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onTogglePlay, onNext, onPrev]);

  // Helper: map spin velocity (deg/s) -> real song playback rate intensity (no synthetic scratch noise)
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

      if (discDragRef.current.lastAppliedRate !== rate) {
        discDragRef.current.lastAppliedRate = rate;
        onSetPlaybackRate(rate);
      }
      setScrubIntensityBadge(label);
    },
    [onSetPlaybackRate]
  );

  // --- DIRECT VINYL DISC CLICK-HOLD-ROTATE SCRUBBING (REAL SONG AUDIO INTENSITY) ---
  const getPointerAngleFromDiscCenter = (clientX: number, clientY: number) => {
    if (!vinylBodyRef.current) return 0;
    const rect = vinylBodyRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  };

  const handleDiscPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const startAngle = getPointerAngleFromDiscCenter(e.clientX, e.clientY);
    retargetMotorRamp(motorRampRef.current, 0, 1, 0);

    const now = performance.now();
    discDragRef.current = {
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

    setIsDraggingDisc(true);
    setDiscScrubTime(currentTime);
    setDiscScrubDelta(0);
    setScrubIntensityBadge(null);
  };

  const handleDiscPointerMove = (e: React.PointerEvent) => {
    const drag = discDragRef.current;
    if (!drag.active) return;

    const now = performance.now();
    const dtMs = Math.max(6, now - drag.lastMoveTime);
    drag.lastMoveTime = now;

    const currentAngle = getPointerAngleFromDiscCenter(e.clientX, e.clientY);
    let deltaDeg = currentAngle - drag.lastAngleDeg;
    if (deltaDeg > 180) deltaDeg -= 360;
    if (deltaDeg < -180) deltaDeg += 360;
    drag.lastAngleDeg = currentAngle;

    const dist = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
    if (!drag.hasMoved && (dist > 6 || Math.abs(drag.accumulatedDeg + deltaDeg) > 3.5)) {
      drag.hasMoved = true;
    }

    if (!drag.hasMoved) return;

    // 1:1 physical vinyl rotation directly under cursor
    spinAngleRef.current = (spinAngleRef.current + deltaDeg) % 360;
    if (vinylSpinRef.current) {
      vinylSpinRef.current.style.transform = `rotate(${spinAngleRef.current}deg)`;
    }

    const angularVelDegPerSec = (deltaDeg / dtMs) * 1000;
    drag.lastAngularVel = angularVelDegPerSec;
    drag.accumulatedDeg += deltaDeg;

    // Adjust real song speed intensity based on forward / rewind spin velocity
    applyIntensityRate(angularVelDegPerSec);

    // If user holds finger still on the record, softly slow playback until they move or release
    if (drag.idleSlowTimer !== null) {
      window.clearTimeout(drag.idleSlowTimer);
    }
    drag.idleSlowTimer = window.setTimeout(() => {
      if (discDragRef.current.active && discDragRef.current.hasMoved) {
        if (discDragRef.current.lastAppliedRate !== 0.5) {
          discDragRef.current.lastAppliedRate = 0.5;
          onSetPlaybackRate(0.5);
        }
        setScrubIntensityBadge('HOLD');
      }
    }, 110);

    // Calibrated scrub distance: 360° = ~50s (or ~25% of song)
    const secondsPerFullTurn = Math.max(30, Math.min(75, duration * 0.25 || 50));
    const deltaSecs = (drag.accumulatedDeg / 360) * secondsPerFullTurn;
    const nextTime = Math.max(0, Math.min(duration, drag.startSongTime + deltaSecs));

    drag.currentScrubTime = nextTime;
    setDiscScrubTime(nextTime);
    setDiscScrubDelta(nextTime - drag.startSongTime);

    // Stream live throttled seeks so you hear the real song moving forward/back as you spin!
    if (now - drag.lastSeekCommitTime >= 150) {
      drag.lastSeekCommitTime = now;
      onSeek(nextTime);
    }
  };

  const handleDiscPointerUp = (e: React.PointerEvent) => {
    const drag = discDragRef.current;
    if (!drag.active) return;

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
    // Hand off gentle release momentum to the vinyl motor (clamped so it smoothly eases back to playing RPM)
    const releaseDegPerFrame = Math.max(-5, Math.min(5, (drag.lastAngularVel / 1000) * 16.666 * 0.35));

    drag.active = false;
    setIsDraggingDisc(false);
    setDiscScrubTime(null);
    setDiscScrubDelta(0);
    setScrubIntensityBadge(null);

    // Always restore crisp 1.0x normal song speed immediately on release
    onSetPlaybackRate(1);

    if (wasScrub) {
      retargetMotorRamp(motorRampRef.current, isPlaying ? 0.48 : 0, 850, releaseDegPerFrame);
      onSeek(finalTime);
    } else {
      sound.playSwitch();
      onTogglePlay();
    }
  };

  // --- INTERACTIVE CONCENTRIC ORBITAL RING SCRUBBING (SMOOTH & REAL AUDIO) ---
  const pointerToProgress = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * 380;
    const svgY = ((clientY - rect.top) / rect.height) * 720;
    const angleDeg = (Math.atan2(svgY - CY, svgX - CX) * 180) / Math.PI;
    const clamped = Math.max(START_DEG, Math.min(END_DEG, angleDeg));
    return (clamped - START_DEG) / TOTAL_DEG;
  }, []);

  const handleArcPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = pointerToProgress(e.clientX, e.clientY);
    const now = performance.now();

    // Smoothly wind the vinyl subtly in the direction of the clicked timestamp
    const jumpDelta = p - visualProgressRef.current;
    const nudgeVel = Math.max(-4.5, Math.min(4.5, jumpDelta * 18));
    retargetMotorRamp(motorRampRef.current, isPlaying ? 0.48 : 0, 750, nudgeVel);

    arcDragRef.current = {
      lastProgress: p,
      lastTime: now,
      lastSeekCommitTime: now,
      lastAppliedRate: 1,
    };
    setIsScrubbingArc(true);
    setScrubProgress(p);
  };

  const handleArcPointerMove = (e: React.PointerEvent) => {
    if (!isScrubbingArc) return;
    const p = pointerToProgress(e.clientX, e.clientY);
    const now = performance.now();
    const dtMs = Math.max(6, now - arcDragRef.current.lastTime);
    const deltaP = p - arcDragRef.current.lastProgress;
    arcDragRef.current.lastProgress = p;
    arcDragRef.current.lastTime = now;

    // Spin the vinyl smoothly in lockstep with dragging the orbital knob
    const equivDeg = deltaP * 420;
    spinAngleRef.current = (spinAngleRef.current + equivDeg) % 360;
    if (vinylSpinRef.current) {
      vinylSpinRef.current.style.transform = `rotate(${spinAngleRef.current}deg)`;
    }

    const angularVel = (equivDeg / dtMs) * 1000;
    applyIntensityRate(angularVel);

    setScrubProgress(p);

    if (now - arcDragRef.current.lastSeekCommitTime >= 150) {
      arcDragRef.current.lastSeekCommitTime = now;
      onSeek(p * duration);
    }
  };

  const handleArcPointerUp = (e: React.PointerEvent) => {
    if (!isScrubbingArc) return;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const finalProgress = pointerToProgress(e.clientX, e.clientY);
    setIsScrubbingArc(false);
    setScrubIntensityBadge(null);
    onSetPlaybackRate(1);
    onSeek(finalProgress * duration);
  };

  const songHeadline = cleanDisplayTitle(activeTrack?.title || playlistTitle);

  return (
    <div className="relative w-full h-full bg-[#f8f8f7] text-[#111111] flex flex-col md:flex-row overflow-hidden select-none">
      {/* LEFT / TOP STAGE: Integrated Picture-Disc Vinyl + Concentric Orbital Scrubber */}
      <div className="relative h-[42dvh] md:h-full w-full md:w-auto flex items-center justify-start shrink-0 pt-safe md:pt-0">
        <div className="relative h-full md:h-[min(100dvh,86vw)] aspect-[380/720] flex items-center">
          {/* Interactive Picture-Disc with silky left-edge sleeve eject & load */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTrack?.id || 'vinyl-disc'}
              ref={vinylBodyRef}
              initial={{ x: '-108%', y: '-50%', rotate: -26, scale: 0.95, opacity: 0.45 }}
              animate={{
                x: '-50%',
                y: '-50%',
                rotate: 0,
                scale: 1,
                opacity: 1,
                transition: {
                  type: 'spring',
                  stiffness: 135,
                  damping: 24,
                  mass: 0.95,
                },
              }}
              exit={{
                x: '-108%',
                y: '-50%',
                rotate: 20,
                scale: 0.95,
                opacity: 0.35,
                transition: {
                  duration: 0.32,
                  ease: [0.32, 0, 0.2, 1],
                },
              }}
              onPointerDown={handleDiscPointerDown}
              onPointerMove={handleDiscPointerMove}
              onPointerUp={handleDiscPointerUp}
              onPointerCancel={handleDiscPointerUp}
              title="Click to Play/Pause • Hold & rotate disc to fast-forward / rewind"
              style={{ willChange: 'transform, opacity' }}
              className={`absolute left-0 top-1/2 h-[93%] aspect-square rounded-full group touch-none bg-[#141415] transition-shadow duration-300 ${isDraggingDisc
                ? 'cursor-grabbing shadow-[24px_28px_72px_rgba(0,0,0,0.28),8px_10px_24px_rgba(0,0,0,0.18)]'
                : 'cursor-grab shadow-[20px_24px_62px_rgba(0,0,0,0.22),6px_8px_18px_rgba(0,0,0,0.14)]'
                }`}
            >
              {/* Spinning Song Cover Art + Authentic Vinyl Micro-Groove Finish */}
              <div
                ref={vinylSpinRef}
                className="absolute inset-0 rounded-full overflow-hidden will-change-transform"
              >
                <VinylCoverImage track={activeTrack} />

                {/* Subtle Concentric Vinyl Micro-Grooves over Cover */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none opacity-35 mix-blend-overlay"
                  style={{
                    backgroundImage: `
                      repeating-radial-gradient(
                        circle at center,
                        rgba(255, 255, 255, 0.14) 0px,
                        transparent 1.5px,
                        rgba(0, 0, 0, 0.35) 3px,
                        transparent 4.5px
                      )
                    `,
                  }}
                />

                {/* Anisotropic Diagonal Light Sheen */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none opacity-30 mix-blend-screen"
                  style={{
                    background: `
                      conic-gradient(
                        from 25deg at 50% 50%,
                        transparent 0deg,
                        rgba(255, 255, 255, 0.35) 22deg,
                        transparent 48deg,
                        transparent 175deg,
                        rgba(255, 255, 255, 0.28) 202deg,
                        transparent 228deg,
                        transparent 360deg
                      )
                    `,
                  }}
                />

                {/* Crisp Outer Rim Bevel */}
                <div
                  className={`absolute inset-0 rounded-full pointer-events-none transition-colors duration-200 ${isDraggingDisc
                    ? 'border-[2px] border-[#a83838]/75'
                    : 'border-[1.5px] border-white/40'
                    }`}
                />
              </div>

              {/* Crisp White Center Label with Animated Crimson 4-Bar Equalizer */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[31%] h-[31%] rounded-full bg-[#f8f8f6] shadow-[0_6px_20px_rgba(0,0,0,0.28),inset_0_0_10px_rgba(0,0,0,0.08)] flex items-center justify-end pr-[13%] pointer-events-none">
                <div className="flex items-end gap-[3px] h-5">
                  {[0.55, 0.95, 0.72, 0.48].map((base, idx) => (
                    <motion.span
                      key={idx}
                      className="w-[2.5px] rounded-full bg-[#a83838]"
                      animate={
                        isPlaying && !isDraggingDisc
                          ? {
                            height: [
                              `${base * 17}px`,
                              `${((base + 0.4) % 1) * 19 + 4}px`,
                              `${base * 11}px`,
                              `${base * 19}px`,
                            ],
                          }
                          : { height: `${base * 13}px` }
                      }
                      transition={
                        isPlaying && !isDraggingDisc
                          ? {
                            duration: 0.75 + idx * 0.14,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }
                          : { duration: 0.2 }
                      }
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* 60/120fps Interpolated Concentric Orbital Scrubber Ring */}
          <svg
            ref={svgRef}
            viewBox="0 0 380 720"
            className="relative z-20 w-full h-full overflow-visible pointer-events-none"
          >
            <path
              d={TRACK_PATH}
              fill="none"
              stroke="#dededc"
              strokeWidth="2"
              strokeLinecap="round"
            />

            <path
              ref={activePathRef}
              d=""
              fill="none"
              stroke="#a83838"
              strokeWidth={isDraggingDisc || isScrubbingArc ? '2.8' : '2.2'}
              strokeLinecap="round"
            />

            <path
              d={TRACK_PATH}
              fill="none"
              stroke="transparent"
              strokeWidth="36"
              className="pointer-events-auto cursor-pointer"
              onPointerDown={handleArcPointerDown}
              onPointerMove={handleArcPointerMove}
              onPointerUp={handleArcPointerUp}
              onPointerCancel={handleArcPointerUp}
            />

            {/* Smoothly Gliding White & Crimson Knob */}
            <g
              ref={knobGroupRef}
              transform={`translate(${ARC_START.x}, ${ARC_START.y})`}
              className="pointer-events-auto cursor-grab active:cursor-grabbing"
              onPointerDown={handleArcPointerDown}
              onPointerMove={handleArcPointerMove}
              onPointerUp={handleArcPointerUp}
              onPointerCancel={handleArcPointerUp}
            >
              <circle
                r={isDraggingDisc || isScrubbingArc ? '15.5' : '14'}
                fill="#ffffff"
                stroke="rgba(0,0,0,0.06)"
                strokeWidth="1"
                style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.14))' }}
              />
              <circle r="3.8" fill="#a83838" />
            </g>
          </svg>

          {/* Bottom Timestamp + Live Forward/Rewind Intensity Pill */}
          <div className="absolute bottom-5 left-[44%] sm:left-[48%] z-30 flex items-center gap-2 font-mono text-[11px] tracking-wider tabular-nums whitespace-nowrap">
            <span>
              <span className="text-neutral-900 font-medium">{formatTime(effectiveTime)}</span>
              <span className="text-neutral-400 mx-1.5">/</span>
              <span className="text-neutral-400">{formatTime(duration)}</span>
            </span>

            <AnimatePresence>
              {(isDraggingDisc || isScrubbingArc) && (scrubIntensityBadge || Math.abs(discScrubDelta) >= 0.5) && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.14 }}
                  className="px-1.5 py-0.5 rounded bg-[#a83838]/10 text-[#a83838] text-[9.5px] font-semibold tracking-wider"
                >
                  {scrubIntensityBadge ? `${scrubIntensityBadge}` : ''}
                  {isDraggingDisc && Math.abs(discScrubDelta) >= 0.5
                    ? `${scrubIntensityBadge ? ' · ' : ''}${formatDelta(discScrubDelta)}`
                    : ''}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* RIGHT / BOTTOM STAGE: Centered & Proportioned Swiss Song Title + Editorial Tracklist */}
      <div className="flex-1 min-h-0 md:h-full flex items-start md:items-center justify-center px-5 sm:px-10 lg:px-14 pt-2 md:py-10 pb-safe overflow-hidden">
        <div className="w-full max-w-[540px] h-full md:h-auto max-h-full flex flex-col justify-start md:justify-center">
          {/* Top Song Name Block */}
          <div className="mb-3 md:mb-6 shrink-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTrack?.id + '-headline'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1
                  title={songHeadline}
                  className="font-sans font-semibold uppercase tracking-[-0.04em] leading-[1.06] text-[#111111] text-[clamp(1.25rem,3.3vw,2.9rem)] truncate whitespace-nowrap"
                >
                  {songHeadline}
                </h1>
                <div className="mt-1 md:mt-2 font-mono text-[10px] sm:text-[10.5px] uppercase tracking-[0.15em] text-neutral-500 truncate">
                  {activeTrack?.artist}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Middle Tracklist Section */}
          <div className="flex-1 md:flex-none flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 md:mb-3 shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a83838] font-medium truncate pr-4">
                {playlistTitle}
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-neutral-400 shrink-0">
                {String(activeIndex + 1).padStart(2, '0')} / {String(tracks.length).padStart(2, '0')}
              </span>
            </div>

            <div className="flex-1 md:flex-none md:max-h-[46vh] overflow-y-auto pr-1 space-y-1.5">
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
                    className="relative w-full group flex items-center gap-3.5 py-1.5 px-2.5 rounded-lg transition-colors text-left hover:bg-black/[0.025]"
                  >
                    {/* Smoothly sliding shared-layout highlight pill between active songs */}
                    {isActive && (
                      <motion.div
                        layoutId="vinyl-active-track-bg"
                        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                        className="absolute inset-0 rounded-lg bg-black/[0.045] pointer-events-none"
                      />
                    )}

                    <span
                      className={`relative z-10 w-5 font-mono text-[10px] tabular-nums transition-colors ${isActive
                        ? 'text-[#a83838] font-semibold'
                        : 'text-neutral-400 group-hover:text-neutral-700'
                        }`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="relative z-10 w-9 h-9 rounded-[3px] overflow-hidden shrink-0 bg-neutral-200 shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
                      <img
                        src={thumbUrl}
                        alt={track.title}
                        className="w-full h-full object-cover scale-[1.06] transition-transform duration-300 group-hover:scale-[1.12]"
                        draggable={false}
                      />
                    </div>

                    <div className="relative z-10 flex-1 min-w-0">
                      <div
                        className={`font-mono text-[10.5px] sm:text-[11px] uppercase tracking-[0.06em] truncate ${isActive ? 'text-neutral-950 font-semibold' : 'text-neutral-800 font-medium'
                          }`}
                      >
                        {cleanDisplayTitle(track.title)}
                      </div>
                      <div className="font-mono text-[9px] sm:text-[9.5px] uppercase tracking-[0.06em] text-neutral-400 truncate mt-0.5">
                        {track.artist}
                      </div>
                    </div>

                    <div className="relative z-10 shrink-0 font-mono text-[10px] tabular-nums tracking-wider">
                      {isActive && isPlaying ? (
                        <span className="text-[#a83838] text-[9px] tracking-[0.15em] uppercase">
                          PLAYING
                        </span>
                      ) : (
                        <span className="text-neutral-500">{formatTime(track.duration)}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Minimal Swiss Controls Row */}
          <div className="pt-4 mt-5 border-t border-black/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  sound.playDiscSpin();
                  onPrev();
                }}
                title="Previous (←)"
                className="p-1.5 text-neutral-500 hover:text-neutral-950 transition-colors active:scale-90"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  sound.playSwitch();
                  onTogglePlay();
                }}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center hover:bg-[#a83838] transition-colors active:scale-90"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-white" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white translate-x-[0.5px]" />
                )}
              </button>
              <button
                onClick={() => {
                  sound.playDiscSpin();
                  onNext();
                }}
                title="Next (→)"
                className="p-1.5 text-neutral-500 hover:text-neutral-950 transition-colors active:scale-90"
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
              className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors active:scale-90"
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
  );
};
