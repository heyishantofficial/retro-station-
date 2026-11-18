import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Volume1, VolumeX } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  previewTime?: number | null;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onSetPlaybackRate?: (rate: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  currentTime,
  previewTime = null,
  duration,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onSetPlaybackRate,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
}) => {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  const visualProgressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const lastSeekRef = useRef(0);
  const lastClientXRef = useRef(0);
  const lastMoveTimeRef = useRef(0);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentDisplayTime = isScrubbing
    ? scrubValue
    : previewTime !== null
    ? previewTime
    : currentTime;
  const targetPercent = duration > 0 ? Math.min(100, Math.max(0, (currentDisplayTime / duration) * 100)) : 0;

  useEffect(() => {
    targetProgressRef.current = targetPercent;
  }, [targetPercent]);

  // Smooth 60/120fps scrubber bar & thumb interpolation
  useEffect(() => {
    let lastTime = performance.now();
    let rafId = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.666, 3);
      lastTime = now;

      const diff = targetProgressRef.current - visualProgressRef.current;
      const smoothFactor = isScrubbing || previewTime !== null ? 0.38 : 0.16;
      if (Math.abs(diff) > 0.01) {
        visualProgressRef.current += diff * Math.min(1, smoothFactor * dt);
      } else {
        visualProgressRef.current = targetProgressRef.current;
      }

      const pct = Math.max(0, Math.min(100, visualProgressRef.current));
      if (fillRef.current) {
        fillRef.current.style.width = `${pct}%`;
      }
      if (thumbRef.current) {
        thumbRef.current.style.left = `${pct}%`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isScrubbing, previewTime]);

  const computeSeekFromClientX = (clientX: number) => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handleSeekStart = (e: React.PointerEvent) => {
    setIsScrubbing(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const val = computeSeekFromClientX(e.clientX);
    setScrubValue(val);
    lastClientXRef.current = e.clientX;
    lastMoveTimeRef.current = performance.now();
    lastSeekRef.current = performance.now();
  };

  const handleSeekMove = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    const now = performance.now();
    const dtMs = Math.max(6, now - lastMoveTimeRef.current);
    const dx = e.clientX - lastClientXRef.current;
    lastClientXRef.current = e.clientX;
    lastMoveTimeRef.current = now;

    const val = computeSeekFromClientX(e.clientX);
    setScrubValue(val);

    // Modulate real song speed intensity with scrubber drag direction & speed
    if (onSetPlaybackRate) {
      const vel = (dx / dtMs) * 1000;
      if (vel > 220) onSetPlaybackRate(2.0);
      else if (vel > 60) onSetPlaybackRate(1.5);
      else if (vel < -60) onSetPlaybackRate(0.5);
      else onSetPlaybackRate(0.75);
    }

    if (now - lastSeekRef.current >= 150) {
      lastSeekRef.current = now;
      onSeek(val);
    }
  };

  const handleSeekEnd = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const finalVal = computeSeekFromClientX(e.clientX);
    setIsScrubbing(false);
    onSetPlaybackRate?.(1);
    onSeek(finalVal);
    sound.playClick(1400, 0.015);
  };

  // Keyboard controls listener (Space, Left, Right, Up, Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        onVolumeChange(Math.min(100, volume + 10));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        onVolumeChange(Math.max(0, volume - 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onNext, onPrev, onVolumeChange, volume]);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 select-none">
      {/* Scrubber Bar */}
      <div className="flex items-center gap-3 mb-3 text-[10px] font-mono tracking-wider text-neutral-500">
        <span className="w-10 text-right tabular-nums">{formatTime(currentDisplayTime)}</span>

        <div
          ref={progressBarRef}
          onPointerDown={handleSeekStart}
          onPointerMove={handleSeekMove}
          onPointerUp={handleSeekEnd}
          onPointerCancel={handleSeekEnd}
          className="relative flex-1 h-5 flex items-center cursor-pointer group touch-none"
        >
          {/* Track background */}
          <div className="w-full h-[2px] bg-black/15 group-hover:h-[3px] transition-all rounded-full overflow-hidden">
            <div ref={fillRef} className="h-full bg-neutral-900" style={{ width: '0%' }} />
          </div>

          {/* Scrubber Thumb */}
          <div
            ref={thumbRef}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-neutral-900 shadow-sm transition-opacity pointer-events-none ${
              isScrubbing || previewTime !== null
                ? 'opacity-100 scale-110'
                : 'opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100'
            }`}
            style={{ left: '0%' }}
          />
        </div>

        <span className="w-10 text-left tabular-nums">{formatTime(duration)}</span>

        {/* Minimal Audio Visualizer Bars */}
        <div className="hidden sm:flex items-center gap-[2px] h-3 w-10 justify-end pl-1">
          {[40, 75, 100, 60, 85, 30, 90, 50].map((h, i) => (
            <div
              key={i}
              className={`w-[1.5px] bg-neutral-800 rounded-full transition-all duration-150 ${
                isPlaying ? 'opacity-80 animate-pulse' : 'opacity-25'
              }`}
              style={{
                height: isPlaying ? `${Math.max(15, h * (i % 2 === 0 ? 1 : 0.7)) % 100}%` : '20%',
                animationDelay: `${i * 120}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Primary Transport Controls */}
      <div className="flex items-center justify-between">
        {/* Left: Shuffle & Repeat */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playClick();
              onToggleShuffle();
            }}
            title={`Shuffle: ${isShuffle ? 'ON' : 'OFF'}`}
            className={`p-2 rounded-full transition-all active:scale-90 ${
              isShuffle ? 'text-black bg-black/10' : 'text-neutral-400 hover:text-black'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              sound.playClick();
              onToggleRepeat();
            }}
            title={`Repeat: ${repeatMode}`}
            className={`p-2 rounded-full transition-all active:scale-90 relative ${
              repeatMode !== 'off' ? 'text-black bg-black/10' : 'text-neutral-400 hover:text-black'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            {repeatMode === 'one' && (
              <span className="absolute top-1 right-1 text-[7px] font-mono font-bold leading-none">
                1
              </span>
            )}
          </button>
        </div>

        {/* Center: Playback Buttons */}
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={() => {
              sound.playDiscSpin();
              onPrev();
            }}
            title="Previous Disc (←)"
            className="p-2 text-neutral-700 hover:text-black transition-transform active:scale-90"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Master Play / Pause Button */}
          <button
            onClick={() => {
              sound.playSwitch();
              onTogglePlay();
            }}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:bg-neutral-800 transition-all active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white translate-x-[1px]" />
            )}
          </button>

          <button
            onClick={() => {
              sound.playDiscSpin();
              onNext();
            }}
            title="Next Disc (→)"
            className="p-2 text-neutral-700 hover:text-black transition-transform active:scale-90"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Volume Slider */}
        <div className="flex items-center gap-2 group/vol">
          <button
            onClick={() => {
              sound.playClick();
              onToggleMute();
            }}
            className="p-1.5 text-neutral-500 hover:text-black transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-neutral-400" />
            ) : volume < 50 ? (
              <Volume1 className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-16 sm:w-20 h-1 bg-black/15 rounded-lg appearance-none cursor-pointer accent-neutral-900 opacity-60 group-hover/vol:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </div>
  );
};
