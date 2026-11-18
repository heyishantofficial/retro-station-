import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import {
  SharedViewProps,
  cleanDisplayTitle,
  formatTime,
  formatDelta,
} from '../../utils/viewCatalog';
import { SmartCover } from '../SmartCover';
import { useDiscScrub } from '../../hooks/useDiscScrub';
import { sound } from '../../utils/soundEffects';

export const VinylSleeveView: React.FC<SharedViewProps> = ({
  playlistTitle,
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
  const vinylSpinRef = useRef<HTMLDivElement | null>(null);

  const { containerRef, isScrubbing, scrubTime, scrubDelta, intensityBadge, handlers } =
    useDiscScrub({
      isPlaying,
      currentTime,
      duration,
      baseSpeed: 0.45,
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

  const title = cleanDisplayTitle(activeTrack?.title || 'UNTITLED');
  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const pct = duration > 0 ? Math.min(100, (displayTime / duration) * 100) : 0;
  const isVinylOut = isPlaying || isScrubbing;

  return (
    <div className="relative w-full h-full bg-[#362c20] text-[#e7d8bd] overflow-hidden select-none flex items-center justify-center">
      {/* Background Subtle Oversized Editorial Calligraphic Script Watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.14]">
        <span className="font-serif italic text-[clamp(8rem,22vw,20rem)] whitespace-nowrap text-[#c4a657] tracking-tight -rotate-6">
          {activeTrack?.artist || playlistTitle}
        </span>
      </div>

      {/* Top-Left Editorial Print Spec (exact match to Ed Sheeran Sleeve reference) */}
      <div className="absolute top-14 left-7 sm:left-11 z-20 max-w-[260px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTrack?.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
          >
            <div className="font-sans text-base sm:text-lg font-medium text-[#efe2ca] tracking-tight truncate">
              {activeTrack?.artist}
            </div>
            <div
              title={title}
              className="font-sans text-sm sm:text-base text-[#efe2ca]/90 tracking-tight truncate mt-0.5"
            >
              [{title}]
            </div>
            <div className="font-mono text-[9.5px] text-[#cbb894]/70 mt-1 tracking-wide truncate">
              {playlistTitle}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Hairline + Editorial 3-Swatch Color Palette */}
        <div className="mt-7">
          <div className="w-3 h-[1.5px] bg-[#cbb894]/70 mb-3" />
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#cbb894]/75 mb-2">
            COLOR
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e6c576]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#d94524]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#2c6392]" />
          </div>
        </div>
      </div>

      {/* Bottom-Left Editorial Numbering & Micro Controls */}
      <div className="absolute bottom-8 left-7 sm:left-11 z-20 max-w-[240px]">
        <div className="w-3 h-[1.5px] bg-[#cbb894]/60 mb-3" />
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => {
              sound.playDiscSpin();
              onPrev();
            }}
            className="p-1.5 rounded-full text-[#e7d8bd]/70 hover:text-white hover:bg-white/10 transition-colors active:scale-90"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              sound.playSwitch();
              onTogglePlay();
            }}
            className="w-8 h-8 rounded-full bg-[#e7d8bd] text-[#362c20] flex items-center justify-center hover:bg-white transition-colors active:scale-90"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current translate-x-[0.5px]" />
            )}
          </button>
          <button
            onClick={() => {
              sound.playDiscSpin();
              onNext();
            }}
            className="p-1.5 rounded-full text-[#e7d8bd]/70 hover:text-white hover:bg-white/10 transition-colors active:scale-90"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hairline Warm Progress Bar */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            onSeek(ratio * duration);
          }}
          className="w-44 h-[2px] bg-[#cbb894]/25 rounded-full overflow-hidden cursor-pointer mb-2"
        >
          <div
            className="h-full bg-[#e6c576] transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="font-mono text-[9.5px] tracking-widest text-[#cbb894]/70 tabular-nums flex items-center gap-2">
          <span>
            {String(activeIndex + 1).padStart(2, '0')} / {String(tracks.length).padStart(2, '0')}
          </span>
          <span>•</span>
          <span>
            {formatTime(displayTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* CENTERPIECE: Textured Cardboard Album Sleeve + Sliding Black Vinyl Record */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTrack?.id}
          initial={{ opacity: 0, x: -24, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 24, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 160, damping: 24 }}
          className="relative z-10 flex items-center justify-center ml-8 sm:ml-16"
        >
          {/* Container anchored around the square cardboard sleeve */}
          <div className="relative w-[min(56vh,62vw)] max-w-[430px] aspect-square">
            {/* Sliding Glossy Black Vinyl Disc peeking/sliding smoothly from the right! */}
            <motion.div
              initial={false}
              animate={{ x: isVinylOut ? '46%' : '18%' }}
              transition={{ type: 'spring', stiffness: 115, damping: 22 }}
              className="absolute inset-[2%] z-0"
            >
              <div
                ref={containerRef}
                {...handlers}
                title="Hold & rotate exposed vinyl to forward / rewind • Click to Play/Pause"
                className={`relative w-full h-full rounded-full shadow-[22px_20px_50px_rgba(0,0,0,0.65)] touch-none ${
                  isScrubbing ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <div
                  ref={vinylSpinRef}
                  className="w-full h-full rounded-full bg-[#09090a] relative overflow-hidden will-change-transform border border-white/10"
                >
                  {/* Glossy Black Vinyl Grooves */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundImage:
                        'repeating-radial-gradient(circle at center, rgba(255,255,255,0.05) 0px, rgba(8,8,9,0.95) 1.5px, rgba(255,255,255,0.02) 3px, rgba(6,6,7,0.98) 4.5px)',
                    }}
                  />
                  {/* Glossy Diagonal Specular Reflection */}
                  <div
                    className="absolute inset-0 rounded-full opacity-45 pointer-events-none"
                    style={{
                      background:
                        'conic-gradient(from 42deg, transparent 0deg, rgba(255,255,255,0.28) 20deg, transparent 48deg, transparent 190deg, rgba(255,255,255,0.22) 215deg, transparent 245deg)',
                    }}
                  />
                  {/* Warm Terracotta Center Label */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34%] h-[34%] rounded-full bg-[#c93f1d] shadow-[inset_0_0_12px_rgba(0,0,0,0.3)] flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full opacity-45 mix-blend-multiply">
                      <SmartCover track={activeTrack} />
                    </div>
                    <div className="absolute w-[14%] h-[14%] rounded-full bg-[#362c20] border border-black/40" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Front Matte Textured Cardboard Album Sleeve (Click to slide vinyl out / Play-Pause!) */}
            <div
              onClick={() => {
                sound.playSwitch();
                onTogglePlay();
              }}
              title={isPlaying ? 'Pause & slide vinyl back' : 'Play & slide vinyl out'}
              className="relative z-10 w-full h-full rounded-[3px] overflow-hidden cursor-pointer bg-[#c93f1d] shadow-[16px_22px_55px_rgba(0,0,0,0.62),0_4px_12px_rgba(0,0,0,0.4)] border border-white/10 group"
            >
              <SmartCover
                track={activeTrack}
                className="transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {/* Subtle Matte Paper Spine Crease & Cardboard Edge Highlight */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/15 via-transparent to-black/25" />
              <div className="pointer-events-none absolute left-2 inset-y-0 w-[1.5px] bg-black/20" />
              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_24px_rgba(0,0,0,0.22)]" />
            </div>

            {/* Live Forward / Rewind Pill while rotating the exposed vinyl */}
            <AnimatePresence>
              {isScrubbing && (intensityBadge || Math.abs(scrubDelta) >= 0.5) && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1e1812]/90 border border-[#e6c576]/30 text-[#efe2ca] font-mono text-[10px] tracking-widest whitespace-nowrap"
                >
                  {intensityBadge} {Math.abs(scrubDelta) >= 0.5 ? formatDelta(scrubDelta) : ''}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
