import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Disc3, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';
import { parseYouTubeInput } from '../services/youtube';
import { sound } from '../utils/soundEffects';

interface YouTubeSyncModalProps {
  isOpen: boolean;
  isSyncing: boolean;
  syncStatus: string | null;
  syncError: string | null;
  onClose: () => void;
  onSyncPlaylist: (playlistId: string, customTitle?: string) => void;
  onAddSingleVideo: (videoId: string) => void;
}

const SAMPLE_PLAYLISTS = [
  {
    label: 'Lo-Fi Beats to Study / Relax',
    id: 'PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo',
    tag: 'ChilledCow / Lofi Girl',
  },
  {
    label: 'Jazz & Late Night Vinyl',
    id: 'PL8F6B0753B2CCA128',
    tag: 'Classic Jazz',
  },
  {
    label: 'Indie & Alternative Essentials',
    id: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    tag: 'YouTube Music',
  },
];

export const YouTubeSyncModal: React.FC<YouTubeSyncModalProps> = ({
  isOpen,
  isSyncing,
  syncStatus,
  syncError,
  onClose,
  onSyncPlaylist,
  onAddSingleVideo,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const parsed = parseYouTubeInput(urlInput);

    if (parsed.type === 'invalid') {
      setLocalError(
        'Please paste a valid YouTube or YouTube Music playlist URL, playlist ID (PL...), or track link.'
      );
      return;
    }

    sound.playDiscSpin();
    if (parsed.type === 'playlist') {
      onSyncPlaylist(parsed.id, playlistTitle.trim() || undefined);
    } else {
      onAddSingleVideo(parsed.id);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Dimming Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/25 backdrop-blur-[4px]"
          />

          {/* Translucent Apple-style Modal Sheet */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-lg max-h-[88dvh] overflow-y-auto rounded-2xl bg-[#f3f3f1]/95 backdrop-blur-2xl border border-black/10 shadow-[0_32px_80px_rgba(0,0,0,0.22)]"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-black/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center">
                  <YouTubeIcon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-semibold uppercase tracking-wide text-neutral-900 leading-none">
                    Sync YouTube Music
                  </h2>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-500 mt-1">
                    Import any public or unlisted playlist into spinning CDs
                  </p>
                </div>
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

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block font-mono text-[9.5px] uppercase tracking-[0.2em] text-neutral-500 mb-1.5">
                  YouTube Music Playlist or Track URL
                </label>
                <div className="relative">
                  <Link2 className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder="https://music.youtube.com/playlist?list=PL..."
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white/80 border border-black/15 text-[16px] sm:text-[12px] font-sans text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[9.5px] uppercase tracking-[0.2em] text-neutral-500 mb-1.5">
                  Collection Label (Optional)
                </label>
                <input
                  type="text"
                  value={playlistTitle}
                  onChange={(e) => setPlaylistTitle(e.target.value)}
                  placeholder="e.g. Late Night Rotation"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/80 border border-black/15 text-[16px] sm:text-[12px] font-sans text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>

              {/* Status & Errors */}
              {(localError || syncError) && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-800 text-[11px]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{localError || syncError}</span>
                </div>
              )}

              {syncStatus && !syncError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-neutral-900/5 border border-black/10 text-neutral-800 text-[11px]">
                  {isSyncing ? (
                    <Disc3 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span className="font-mono text-[10px] tracking-wide">{syncStatus}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-neutral-500">
                  Tip: Set playlist visibility to <strong>Unlisted</strong> or <strong>Public</strong>.
                </span>
                <button
                  type="submit"
                  disabled={isSyncing || !urlInput.trim()}
                  className="px-5 py-2.5 rounded-full bg-neutral-900 text-white text-[11px] font-medium tracking-wide hover:bg-neutral-800 disabled:opacity-40 transition-all active:scale-95 flex items-center gap-2"
                >
                  {isSyncing ? (
                    <>
                      <Disc3 className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing…</span>
                    </>
                  ) : (
                    <span>Sync & Press Discs</span>
                  )}
                </button>
              </div>
            </form>

            {/* Quick-Try Presets */}
            <div className="px-6 py-4 bg-black/[0.03] border-t border-black/10">
              <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500 mb-2.5">
                <Sparkles className="w-3 h-3" />
                <span>Quick-Sync Live YouTube Playlists</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SAMPLE_PLAYLISTS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isSyncing}
                    onClick={() => {
                      sound.playDiscSpin();
                      setUrlInput(`https://music.youtube.com/playlist?list=${preset.id}`);
                      setPlaylistTitle(preset.label);
                      onSyncPlaylist(preset.id, preset.label);
                    }}
                    className="text-left p-2.5 rounded-xl bg-white/70 hover:bg-white border border-black/10 transition-all active:scale-95 group"
                  >
                    <div className="text-[11px] font-medium text-neutral-900 leading-tight group-hover:underline">
                      {preset.label}
                    </div>
                    <div className="font-mono text-[8.5px] text-neutral-500 uppercase tracking-wider mt-1">
                      {preset.tag}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
