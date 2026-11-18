import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Rewind, FastForward, Repeat, Shuffle } from 'lucide-react';
import {
  SharedViewProps,
  cleanDisplayTitle,
  formatTime,
  formatDelta,
} from '../../utils/viewCatalog';
import { SmartCover } from '../SmartCover';
import { useDiscScrub } from '../../hooks/useDiscScrub';
import { sound } from '../../utils/soundEffects';

export const BraunTurntableView: React.FC<SharedViewProps> = ({
  tracks,
  activeIndex,
  isPlaying,
  currentTime,
  duration,
  volume,
  isShuffle,
  repeatMode,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onSetPlaybackRate,
  onVolumeChange,
  onToggleShuffle,
  onToggleRepeat,
}) => {
  const activeTrack = tracks[activeIndex] || tracks[0];
  const vinylSpinRef = useRef<HTMLDivElement | null>(null);

  const { containerRef, isScrubbing, scrubTime, scrubDelta, intensityBadge, handlers } =
    useDiscScrub({
      isPlaying,
      currentTime,
      duration,
      baseSpeed: 0.48,
      onTogglePlay,
      onSeek,
      onSetPlaybackRate,
      onFrame: (deg) => {
        if (vinylSpinRef.current) {
          vinylSpinRef.current.style.transform = `rotate(${deg}deg)`;
        }
      },
    });

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

  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const remaining = Math.max(0, duration - displayTime);
  const progress = duration > 0 ? Math.max(0, Math.min(1, displayTime / duration)) : 0;

  // Articulated Tonearm angle: parked (-15deg) when paused, sweeps across record (+7deg -> +23deg) while playing!
  const tonearmDeg = isPlaying || isScrubbing ? 7 + progress * 16 : -14;

  return (
    <div className="relative w-full h-full bg-[#e6e6e4] text-[#3a3a38] flex flex-col items-center justify-between py-10 px-6 overflow-hidden select-none">
      {/* Top Recessed Progress Trough Slider */}
      <div className="w-full max-w-[460px] flex items-center gap-4 z-20 pt-2">
        <span className="font-sans text-[12px] text-neutral-500 tabular-nums w-10 text-right">
          {formatTime(displayTime)}
        </span>

        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const r = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            sound.playClick(1100, 0.015);
            onSeek(r * duration);
          }}
          className="relative flex-1 h-2.5 rounded-full bg-[#d3d3d0] shadow-[inset_0_1px_3px_rgba(0,0,0,0.28),0_1px_0_rgba(255,255,255,0.8)] cursor-pointer"
        >
          <div
            className="h-full rounded-full bg-gradient-to-b from-[#7a7a78] to-[#9b9b98] transition-[width] duration-150"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gradient-to-b from-white to-[#e2e2df] shadow-[0_2px_5px_rgba(0,0,0,0.32),inset_0_1px_1px_white] border border-black/10 pointer-events-none transition-[left] duration-150"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        <span className="font-sans text-[12px] text-neutral-500 tabular-nums w-11 text-left">
          -{formatTime(remaining)}
        </span>
      </div>

      {/* Center Turntable Platter + Articulated Chrome Tonearm */}
      <div className="relative flex items-center justify-center my-2">
        {/* Recessed Matte Platter Well */}
        <div className="relative w-[min(48vh,74vw)] max-w-[390px] aspect-square rounded-full bg-[#dadad7] p-2.5 shadow-[inset_0_4px_12px_rgba(0,0,0,0.16),0_2px_0_rgba(255,255,255,0.85)] flex items-center justify-center">
          {/* Interactive Matte-Black Vinyl Record */}
          <div
            ref={containerRef}
            {...handlers}
            title="Click to Play/Pause • Hold & spin vinyl to forward / rewind"
            className={`relative w-full h-full rounded-full shadow-[0_14px_32px_rgba(0,0,0,0.34)] touch-none ${
              isScrubbing ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div
              ref={vinylSpinRef}
              className="w-full h-full rounded-full relative overflow-hidden bg-[#121213] will-change-transform"
            >
              {/* Concentric Matte Vinyl Grooves */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundImage: `
                    repeating-radial-gradient(
                      circle at center,
                      rgba(255,255,255,0.055) 0px,
                      rgba(12,12,13,0.95) 1.6px,
                      rgba(255,255,255,0.025) 3.2px,
                      rgba(10,10,11,0.98) 4.8px
                    )
                  `,
                }}
              />

              {/* Diagonal Vinyl Specular Sheen */}
              <div
                className="absolute inset-0 rounded-full opacity-35 pointer-events-none"
                style={{
                  background:
                    'conic-gradient(from 32deg, transparent 0deg, rgba(255,255,255,0.28) 24deg, transparent 52deg, transparent 180deg, rgba(255,255,255,0.22) 208deg, transparent 236deg)',
                }}
              />

              {/* Circular Song-Cover Center Label (exact proportion of reference image!) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[45%] h-[45%] rounded-full overflow-hidden shadow-[0_0_0_2px_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.6)] bg-[#1f1f1f]">
                <SmartCover track={activeTrack} />
              </div>

              {/* Machined Dark Aluminum Center Spindle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[7.5%] h-[7.5%] rounded-full bg-gradient-to-br from-[#666] via-[#2b2b2b] to-[#111] shadow-[0_2px_5px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.45)] flex items-center justify-center">
                <div className="w-[42%] h-[42%] rounded-full bg-gradient-to-br from-[#e0e0e0] to-[#6e6e6e]" />
              </div>
            </div>
          </div>

          {/* Articulated S-Curved Chrome Tonearm (Upper-Right Pivot) */}
          <motion.div
            onClick={() => {
              sound.playSwitch();
              onTogglePlay();
            }}
            title={isPlaying ? 'Lift tonearm (Pause)' : 'Drop tonearm (Play)'}
            animate={{ rotate: tonearmDeg }}
            transition={{ type: 'spring', stiffness: 75, damping: 18, mass: 1.1 }}
            style={{ transformOrigin: '78% 12%' }}
            className="absolute -right-[14%] top-[2%] w-[46%] h-[92%] z-20 cursor-pointer pointer-events-auto"
          >
            <svg viewBox="0 0 180 340" className="w-full h-full overflow-visible drop-shadow-[0_10px_14px_rgba(0,0,0,0.24)]">
              <defs>
                <linearGradient id="chromeArm" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#888" />
                  <stop offset="35%" stopColor="#ffffff" />
                  <stop offset="65%" stopColor="#cfcfcd" />
                  <stop offset="100%" stopColor="#6a6a68" />
                </linearGradient>
              </defs>

              {/* Matte White Gimbal Base */}
              <circle cx="140" cy="40" r="24" fill="#ecece9" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" />
              <circle cx="140" cy="40" r="12" fill="#f7f7f5" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />

              {/* Curved Chrome Tube */}
              <path
                d="M 145 16 L 122 185 C 118 214, 108 238, 86 258 L 62 280"
                fill="none"
                stroke="url(#chromeArm)"
                strokeWidth="7.5"
                strokeLinecap="round"
              />

              {/* Matte White Headshell + Cartridge Stylus */}
              <g transform="translate(56, 286) rotate(42)">
                <rect
                  x="-14"
                  y="-22"
                  width="28"
                  height="42"
                  rx="6"
                  fill="#f3f3f0"
                  stroke="rgba(0,0,0,0.12)"
                  strokeWidth="1.2"
                />
                <rect x="-5" y="18" width="10" height="10" rx="2" fill="#c7c7c4" />
              </g>
            </svg>
          </motion.div>
        </div>

        {/* Floating Subtle Song Name + Scrub Pill */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-neutral-500 max-w-[280px] truncate">
            {cleanDisplayTitle(activeTrack?.title || '')}
          </span>
          <AnimatePresence>
            {isScrubbing && (intensityBadge || Math.abs(scrubDelta) >= 0.5) && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-2 py-0.5 rounded-full bg-neutral-800 text-white font-mono text-[9px] tracking-wider"
              >
                {intensityBadge} {Math.abs(scrubDelta) >= 0.5 ? formatDelta(scrubDelta) : ''}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Tactile Circular Controls + Machined Volume Fader */}
      <div className="w-full max-w-[440px] flex flex-col items-center gap-6 z-20 pt-4">
        {/* Circular Tactile Transport Cluster */}
        <div className="w-full flex items-center justify-between px-2">
          <button
            onClick={() => {
              sound.playClick();
              onToggleRepeat();
            }}
            title={`Repeat: ${repeatMode}`}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              repeatMode !== 'off'
                ? 'text-neutral-800 shadow-[0_0_20px_rgba(255,255,255,0.95),inset_0_0_8px_rgba(255,255,255,0.9)] bg-white/60'
                : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Repeat className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              sound.playDiscSpin();
              onPrev();
            }}
            className="w-13 h-13 p-3.5 rounded-full bg-gradient-to-b from-[#f0f0ee] to-[#dededb] shadow-[0_4px_10px_rgba(0,0,0,0.14),inset_0_1px_1px_white] border border-black/[0.06] text-neutral-600 hover:text-neutral-900 active:scale-95 active:shadow-inner transition-all"
          >
            <Rewind className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => {
              sound.playSwitch();
              onTogglePlay();
            }}
            className="w-16 h-16 rounded-full bg-gradient-to-b from-[#f4f4f2] to-[#dcdcd9] shadow-[0_6px_16px_rgba(0,0,0,0.16),inset_0_1.5px_2px_white] border border-black/[0.08] text-neutral-700 hover:text-black active:scale-95 active:shadow-inner transition-all flex items-center justify-center"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current translate-x-[1.5px]" />
            )}
          </button>

          <button
            onClick={() => {
              sound.playDiscSpin();
              onNext();
            }}
            className="w-13 h-13 p-3.5 rounded-full bg-gradient-to-b from-[#f0f0ee] to-[#dededb] shadow-[0_4px_10px_rgba(0,0,0,0.14),inset_0_1px_1px_white] border border-black/[0.06] text-neutral-600 hover:text-neutral-900 active:scale-95 active:shadow-inner transition-all"
          >
            <FastForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onToggleShuffle();
            }}
            title={`Shuffle: ${isShuffle ? 'ON' : 'OFF'}`}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              isShuffle
                ? 'text-neutral-800 shadow-[0_0_20px_rgba(255,255,255,0.95)] bg-white/60'
                : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Recessed Braun Volume Fader */}
        <div className="relative w-full h-9 rounded-[4px] bg-[#dcdcd9] shadow-[inset_0_2px_6px_rgba(0,0,0,0.14),0_1px_0_rgba(255,255,255,0.8)] px-4 flex items-center">
          <div className="relative w-full h-2 rounded-full bg-[#c5c5c2] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
            <div
              className="h-full rounded-full bg-[#8d8d8a]"
              style={{ width: `${volume}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-8 rounded-[3px] bg-gradient-to-b from-[#f7f7f5] to-[#ddddda] shadow-[0_3px_8px_rgba(0,0,0,0.28),inset_0_1px_1px_white] border border-black/15 pointer-events-none flex items-center justify-center"
              style={{ left: `${volume}%` }}
            >
              <div className="w-[1.5px] h-4 bg-black/15" />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
