import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import {
  SharedViewProps,
  cleanDisplayTitle,
  formatTime,
} from '../../utils/viewCatalog';
import { SmartCover } from '../SmartCover';
import { sound } from '../../utils/soundEffects';
import { createMotorRamp, retargetMotorRamp, sampleMotorRamp } from '../../utils/motorRamp';

export const CassetteDeckView: React.FC<SharedViewProps> = ({
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
  const leftReelRef = useRef<HTMLDivElement | null>(null);
  const rightReelRef = useRef<HTMLDivElement | null>(null);

  const angleRef = useRef(0);
  const motorRampRef = useRef(createMotorRamp(isPlaying ? 1.15 : 0));

  const [isScrubbingTape, setIsScrubbingTape] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [intensityLabel, setIntensityLabel] = useState<string | null>(null);

  const dragRef = useRef({
    active: false,
    hasMoved: false,
    startX: 0,
    lastX: 0,
    lastTime: 0,
    lastSeek: 0,
    startSongTime: 0,
    currentTime: 0,
  });

  useEffect(() => {
    if (isScrubbingTape) {
      retargetMotorRamp(motorRampRef.current, 0, 80);
    } else if (isPlaying) {
      retargetMotorRamp(motorRampRef.current, 1.15, 900);
    } else {
      retargetMotorRamp(motorRampRef.current, 0, 1150);
    }
  }, [isPlaying, isScrubbingTape]);

  useEffect(() => {
    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.666, 3);
      last = now;

      if (!dragRef.current.active) {
        const speed = sampleMotorRamp(motorRampRef.current, now);
        if (Math.abs(speed) > 0.0005 || isPlaying) {
          angleRef.current = (angleRef.current + speed * dt) % 360;
          if (leftReelRef.current) {
            leftReelRef.current.style.transform = `rotate(${angleRef.current}deg)`;
          }
          if (rightReelRef.current) {
            rightReelRef.current.style.transform = `rotate(${angleRef.current * 1.08}deg)`;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  useEffect(() => {
    return () => onSetPlaybackRate(1);
  }, [onSetPlaybackRate]);

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

  const handleTapeDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const now = performance.now();
    dragRef.current = {
      active: true,
      hasMoved: false,
      startX: e.clientX,
      lastX: e.clientX,
      lastTime: now,
      lastSeek: now,
      startSongTime: currentTime,
      currentTime,
    };
    setIsScrubbingTape(true);
    setScrubTime(currentTime);
    setIntensityLabel(null);
  };

  const handleTapeMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;

    const now = performance.now();
    const dtMs = Math.max(6, now - d.lastTime);
    const dx = e.clientX - d.lastX;
    d.lastX = e.clientX;
    d.lastTime = now;

    if (!d.hasMoved && Math.abs(e.clientX - d.startX) > 5) {
      d.hasMoved = true;
    }
    if (!d.hasMoved) return;

    // Spin both reels directly with drag speed!
    angleRef.current = (angleRef.current + dx * 1.4) % 360;
    if (leftReelRef.current) leftReelRef.current.style.transform = `rotate(${angleRef.current}deg)`;
    if (rightReelRef.current) rightReelRef.current.style.transform = `rotate(${angleRef.current * 1.08}deg)`;

    const vel = (dx / dtMs) * 1000;
    if (vel > 220) {
      onSetPlaybackRate(2.0);
      setIntensityLabel('FF 2×');
    } else if (vel > 40) {
      onSetPlaybackRate(1.5);
      setIntensityLabel('FF 1.5×');
    } else if (vel < -40) {
      onSetPlaybackRate(0.5);
      setIntensityLabel('REW');
    } else {
      onSetPlaybackRate(0.75);
      setIntensityLabel('HOLD');
    }

    const totalDx = e.clientX - d.startX;
    const nextTime = Math.max(0, Math.min(duration, d.startSongTime + (totalDx / 220) * (duration * 0.4 || 60)));
    d.currentTime = nextTime;
    setScrubTime(nextTime);

    if (now - d.lastSeek >= 150) {
      d.lastSeek = now;
      onSeek(nextTime);
    }
  };

  const handleTapeUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const moved = d.hasMoved;
    const finalT = d.currentTime;
    d.active = false;
    setIsScrubbingTape(false);
    setScrubTime(null);
    setIntensityLabel(null);
    onSetPlaybackRate(1);

    if (moved) {
      onSeek(finalT);
    } else {
      sound.playSwitch();
      onTogglePlay();
    }
  };

  const displayTime = isScrubbingTape && scrubTime !== null ? scrubTime : currentTime;
  const progress = duration > 0 ? Math.max(0, Math.min(1, displayTime / duration)) : 0;

  // Dynamic magnetic brown tape diameter transferring from Left Reel -> Right Reel!
  const leftTapeSize = 110 - progress * 46; // shrinks as tape plays
  const rightTapeSize = 64 + progress * 46; // grows as tape plays

  const title = cleanDisplayTitle(activeTrack?.title || 'UNTITLED');
  const leftSideTracks = tracks.slice(0, 4);
  const rightSideTracks = tracks.slice(4, 8);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none p-6"
      style={{
        background:
          'radial-gradient(circle at 50% 42%, #dc1446 0%, #c40c38 55%, #9c072b 100%)',
      }}
    >
      {/* Photorealistic Matte-Black ABS Cassette Shell */}
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        className="relative w-[min(90vw,640px)] aspect-[1.58/1] rounded-[14px] bg-gradient-to-b from-[#2b2a2c] via-[#1f1e20] to-[#161517] p-[4.2%] shadow-[0_36px_80px_rgba(65,0,15,0.58),0_12px_24px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.16)] border border-black/70"
      >
        {/* 4 Corner Phillips Screws */}
        {[
          'top-2.5 left-2.5',
          'top-2.5 right-2.5',
          'bottom-2.5 left-2.5',
          'bottom-2.5 right-2.5',
        ].map((pos, i) => (
          <div
            key={i}
            className={`absolute ${pos} w-4 h-4 rounded-full bg-[#111] shadow-[inset_0_1px_2px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center`}
          >
            <div className="w-2.5 h-[1.5px] bg-neutral-700 rotate-45" />
            <div className="w-2.5 h-[1.5px] bg-neutral-700 -rotate-45 absolute" />
          </div>
        ))}

        {/* Printed Vivid Crimson & Yellow Cassette Label */}
        <div className="relative w-full h-[74%] rounded-[8px] bg-gradient-to-b from-[#cf112d] via-[#b80c24] to-[#9b081d] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_rgba(0,0,0,0.5)] px-5 py-3.5 flex flex-col justify-between">
          {/* Top Label Row: Mini Left Tracklist | Center Bold Title | Mini Right Tracklist */}
          <div className="grid grid-cols-[1fr_2fr_1fr] items-start gap-2 z-10">
            {/* Left Tracklist Column */}
            <div className="space-y-0.5 text-center">
              {leftSideTracks.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => {
                    sound.playDiscSpin();
                    onSelectTrack(i);
                  }}
                  className={`block w-full font-sans font-extrabold text-[7.5px] sm:text-[8.5px] tracking-wide uppercase truncate transition-opacity ${
                    i === activeIndex
                      ? 'text-white underline underline-offset-2'
                      : 'text-[#f8e13a]/85 hover:text-white'
                  }`}
                >
                  {cleanDisplayTitle(t.title)}
                </button>
              ))}
            </div>

            {/* Center Bold Yellow Headline */}
            <div className="text-center px-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTrack?.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                >
                  <h1
                    title={title}
                    className="font-sans font-black text-xl sm:text-3xl tracking-tight uppercase text-[#f8e13a] leading-none truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                  >
                    {title}
                  </h1>
                  <div className="font-sans font-extrabold text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-[#f8e13a]/90 mt-1 truncate">
                    SIDE A • {activeTrack?.artist}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Tracklist Column */}
            <div className="space-y-0.5 text-center">
              {rightSideTracks.map((t, idx) => {
                const realIdx = idx + 4;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      sound.playDiscSpin();
                      onSelectTrack(realIdx);
                    }}
                    className={`block w-full font-sans font-extrabold text-[7.5px] sm:text-[8.5px] tracking-wide uppercase truncate transition-opacity ${
                      realIdx === activeIndex
                        ? 'text-white underline underline-offset-2'
                        : 'text-[#f8e13a]/85 hover:text-white'
                    }`}
                  >
                    {cleanDisplayTitle(t.title)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Corner Song Cover Portrait (matching The Weeknd cutout corner!) */}
          <div className="pointer-events-none absolute right-2 bottom-0 w-[23%] h-[62%] rounded-t-[6px] overflow-hidden opacity-90 shadow-[0_0_16px_rgba(0,0,0,0.45)]">
            <SmartCover track={activeTrack} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#9b081d]/65 via-transparent to-transparent" />
          </div>

          {/* Interactive Center Dual-Reel Tape Window */}
          <div
            onPointerDown={handleTapeDown}
            onPointerMove={handleTapeMove}
            onPointerUp={handleTapeUp}
            onPointerCancel={handleTapeUp}
            title="Click to Play/Pause • Drag left/right across tape to rewind / fast-forward"
            className={`relative z-20 mx-auto w-[62%] h-[42%] rounded-[24px] bg-[#1b1a1c] shadow-[inset_0_3px_10px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.18)] border border-black/80 px-4 flex items-center justify-between overflow-hidden touch-none ${
              isScrubbingTape ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Left Dynamic Magnetic Tape Spool */}
            <div
              className="pointer-events-none absolute left-[13%] top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#3a2822] via-[#221612] to-[#140c09] border border-white/10 shadow-inner transition-[width,height] duration-300"
              style={{ width: `${leftTapeSize}px`, height: `${leftTapeSize}px` }}
            />

            {/* Right Dynamic Magnetic Tape Spool */}
            <div
              className="pointer-events-none absolute right-[13%] top-1/2 translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#3a2822] via-[#221612] to-[#140c09] border border-white/10 shadow-inner transition-[width,height] duration-300"
              style={{ width: `${rightTapeSize}px`, height: `${rightTapeSize}px` }}
            />

            {/* Left Toothed White Cassette Reel */}
            <div className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#c80d3a] shadow-[inset_0_2px_6px_rgba(0,0,0,0.75)] flex items-center justify-center border-[4px] border-[#ecece8]">
              <div ref={leftReelRef} className="w-full h-full relative will-change-transform">
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <span
                    key={deg}
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[4px] h-[6px] bg-[#ecece8] rounded-b-[1px]"
                    style={{ transformOrigin: '50% 24px', transform: `translateX(-50%) rotate(${deg}deg)` }}
                  />
                ))}
              </div>
            </div>

            {/* Center Clear Window with Ruler Scale (100 · 50 · 0) & Tape Strip */}
            <div className="relative z-10 flex-1 mx-3 h-[76%] rounded-[4px] bg-black/55 border border-white/15 overflow-hidden flex flex-col items-center justify-between py-1 px-2">
              <div className="w-full flex items-center justify-between font-mono text-[7px] text-white/55 tracking-widest">
                <span>100</span>
                <span>50</span>
                <span>0</span>
              </div>
              {/* Visible Moving Tape Progress Bar */}
              <div className="w-full h-[3px] bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#f8e13a] transition-[width] duration-150"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="font-mono text-[8px] text-white/80 tabular-nums tracking-wider">
                {intensityLabel ? intensityLabel : `${formatTime(displayTime)} / ${formatTime(duration)}`}
              </div>
            </div>

            {/* Right Toothed White Cassette Reel */}
            <div className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#c80d3a] shadow-[inset_0_2px_6px_rgba(0,0,0,0.75)] flex items-center justify-center border-[4px] border-[#ecece8]">
              <div ref={rightReelRef} className="w-full h-full relative will-change-transform">
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <span
                    key={deg}
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[4px] h-[6px] bg-[#ecece8] rounded-b-[1px]"
                    style={{ transformOrigin: '50% 24px', transform: `translateX(-50%) rotate(${deg}deg)` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Micro Legal Print Line */}
          <div className="z-10 text-center font-mono text-[6px] sm:text-[7px] tracking-[0.16em] uppercase text-[#f8e13a]/70 truncate px-10">
            HIGH BIAS CrO2 • YOUTUBE MUSIC ANALOG EDITION • {String(activeIndex + 1).padStart(2, '0')} OF {String(tracks.length).padStart(2, '0')}
          </div>
        </div>

        {/* Bottom Trapezoidal Magnetic Head Bay + Hardware Transport Buttons */}
        <div className="relative w-full h-[26%] flex items-end justify-center pt-2">
          <div className="w-[68%] h-full rounded-t-[10px] bg-gradient-to-b from-[#252426] to-[#1a191b] border-t border-x border-white/10 shadow-[inset_0_2px_8px_rgba(0,0,0,0.65)] flex items-center justify-around px-8">
            <button
              onClick={() => {
                sound.playDiscSpin();
                onPrev();
              }}
              title="Previous Track (←)"
              className="w-8 h-8 rounded-full bg-[#101012] border border-white/10 text-white/60 hover:text-[#f8e13a] flex items-center justify-center shadow-inner active:scale-90 transition-all"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                sound.playSwitch();
                onTogglePlay();
              }}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="w-10 h-10 rounded-full bg-[#101012] border border-[#f8e13a]/35 text-[#f8e13a] hover:bg-[#f8e13a] hover:text-black flex items-center justify-center shadow-inner active:scale-90 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current translate-x-[1px]" />
              )}
            </button>

            <button
              onClick={() => {
                sound.playDiscSpin();
                onNext();
              }}
              title="Next Track (→)"
              className="w-8 h-8 rounded-full bg-[#101012] border border-white/10 text-white/60 hover:text-[#f8e13a] flex items-center justify-center shadow-inner active:scale-90 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
