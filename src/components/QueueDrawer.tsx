import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Disc3, Play } from 'lucide-react';
import { Track } from '../types';
import { sound } from '../utils/soundEffects';

interface QueueDrawerProps {
  isOpen: boolean;
  playlistTitle: string;
  tracks: Track[];
  activeIndex: number;
  isPlaying: boolean;
  onClose: () => void;
  onSelectTrack: (index: number) => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  playlistTitle,
  tracks,
  activeIndex,
  isPlaying,
  onClose,
  onSelectTrack,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Click-outside light backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/5"
          />

          {/* Spatial right-edge frosted drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xs sm:max-w-sm z-50 bg-[#f1f1ef]/88 backdrop-blur-2xl border-l border-black/10 shadow-[-16px_0_48px_rgba(0,0,0,0.08)] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-black/10 flex items-center justify-between">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-neutral-500">
                  DISC INDEX • {tracks.length} TRACKS
                </div>
                <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-neutral-900 mt-0.5 truncate max-w-[230px]">
                  {playlistTitle}
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                className="p-1.5 rounded-full text-neutral-500 hover:text-black hover:bg-black/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Track List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {tracks.map((track, idx) => {
                const active = idx === activeIndex;
                return (
                  <button
                    key={track.id}
                    onClick={() => {
                      sound.playDiscSpin();
                      onSelectTrack(idx);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                      active
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'hover:bg-black/[0.04] text-neutral-800'
                    }`}
                  >
                    {/* Mini Disc Thumbnail */}
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-black/15 shadow-sm">
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className={`w-full h-full object-cover ${
                          active && isPlaying ? 'animate-spin-slow' : ''
                        }`}
                      />
                      {/* Mini Spindle Hole */}
                      <div
                        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white/50 ${
                          active ? 'bg-neutral-900' : 'bg-[#f1f1ef]'
                        }`}
                      />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[9px] tabular-nums ${
                            active ? 'text-neutral-400' : 'text-neutral-400'
                          }`}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="font-serif text-[13px] font-semibold uppercase tracking-wide truncate">
                          {track.title}
                        </div>
                      </div>
                      <div
                        className={`text-[10.5px] truncate mt-0.5 ${
                          active ? 'text-neutral-300' : 'text-neutral-500'
                        }`}
                      >
                        {track.artist}
                      </div>
                    </div>

                    {/* Status icon */}
                    <div className="shrink-0">
                      {active ? (
                        <Disc3
                          className={`w-3.5 h-3.5 text-white ${
                            isPlaying ? 'animate-spin' : 'opacity-60'
                          }`}
                        />
                      ) : (
                        <Play className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className="px-6 py-3 border-t border-black/10 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400">
              <span>← / → SWITCH DISC</span>
              <span>SPACE PLAY/PAUSE</span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
