import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X, Command } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Playback',
    shortcuts: [
      { key: 'Space', desc: 'Play / Pause' },
      { key: 'K  /  →', desc: 'Next Disc / Track' },
      { key: 'J  /  ←', desc: 'Previous Track' },
      { key: 'M', desc: 'Mute / Unmute' },
    ],
  },
  {
    title: 'Navigation & Discovery',
    shortcuts: [
      { key: 'S  /  /', desc: 'Search & Add Songs' },
      { key: 'V', desc: 'Cycle Console Theme' },
      { key: 'H', desc: 'Sharing is Caring Lounge' },
      { key: 'T', desc: 'Community Leaderboard' },
    ],
  },
  {
    title: 'View & System',
    shortcuts: [
      { key: 'F', desc: 'Toggle Fullscreen' },
      { key: '?', desc: 'Keyboard Shortcuts HUD' },
      { key: 'Esc', desc: 'Close Drawers & Modals' },
    ],
  },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden">
        {/* Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
        />

        {/* Liquid Glass Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 14 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-lg rounded-3xl liquid-glass-drawer border border-white/25 p-5 text-white font-sans shadow-[0_32px_80px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.4)] z-10 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.14]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Keyboard Shortcuts
                </h3>
                <p className="text-[11px] text-white/60">Tactile controls for power listeners</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/[0.10] hover:bg-white/[0.22] border border-white/25 text-white/80 hover:text-white flex items-center justify-center transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Shortcut Categories */}
          <div className="space-y-3.5">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 px-1 font-semibold">
                  {group.title}
                </span>
                <div className="space-y-1">
                  {group.shortcuts.map((sc) => (
                    <div
                      key={sc.key}
                      className="p-2 rounded-xl liquid-glass-interactive flex items-center justify-between"
                    >
                      <span className="text-xs text-white/80 font-medium">{sc.desc}</span>
                      <kbd className="px-2 py-0.5 rounded-lg bg-black/50 border border-white/20 text-white font-mono text-[11px] font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                        {sc.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer tip */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50 font-mono">
            <span>Press <kbd className="text-white px-1 py-0.5 rounded bg-white/10">?</kbd> anytime to toggle</span>
            <span className="flex items-center gap-1">
              <Command className="w-3 h-3 text-white/40" /> Retro Station
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
