import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Link2,
  Disc3,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  LogIn,
  ClipboardPaste,
} from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';
import { parseYouTubeInput } from '../services/youtube';
import { sound } from '../utils/soundEffects';
import {
  initiateSpotifyLogin,
  checkAndHandleSpotifyCallback,
  fetchUserSpotifyPlaylists,
  convertSpotifyPlaylistToCrate,
  SpotifyPlaylistItem,
} from '../services/spotifyAuth';
import {
  loginWithGoogleYouTube,
  fetchUserGoogleYouTubePlaylists,
  GooglePlaylistItem,
} from '../services/googleAuth';
import { Playlist } from '../types';

interface YouTubeSyncModalProps {
  isOpen: boolean;
  isSyncing: boolean;
  syncStatus: string | null;
  syncError: string | null;
  onClose: () => void;
  onSyncPlaylist: (playlistId: string, customTitle?: string) => void;
  onAddSingleVideo: (videoId: string) => void;
  onOpenCharts?: () => void;
  onImportCustomPlaylist?: (playlist: Playlist) => void;
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
  onOpenCharts,
  onImportCustomPlaylist,
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'spotify' | 'google'>('link');
  const [urlInput, setUrlInput] = useState('');
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Spotify State
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylistItem[]>([]);
  const [isLoadingSpotify, setIsLoadingSpotify] = useState(false);

  // Google State
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googlePlaylists, setGooglePlaylists] = useState<GooglePlaylistItem[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  // Check Spotify callback on mount
  useEffect(() => {
    checkAndHandleSpotifyCallback().then((token) => {
      if (token) {
        setSpotifyToken(token);
        setIsLoadingSpotify(true);
        fetchUserSpotifyPlaylists(token).then((pls) => {
          setSpotifyPlaylists(pls);
          setIsLoadingSpotify(false);
          setActiveTab('spotify');
        });
      }
    });
  }, []);

  const handleSpotifyConnect = async () => {
    sound.playClick();
    await initiateSpotifyLogin();
  };

  const handleImportSpotify = async (pl: SpotifyPlaylistItem) => {
    if (!spotifyToken || !onImportCustomPlaylist) return;
    sound.playDiscSpin();
    setIsLoadingSpotify(true);
    try {
      const crate = await convertSpotifyPlaylistToCrate(spotifyToken, pl.id, pl.name);
      onImportCustomPlaylist(crate);
      onClose();
    } catch {
      setLocalError('Could not import Spotify playlist. Please try another.');
    } finally {
      setIsLoadingSpotify(false);
    }
  };

  const handleGoogleConnect = async () => {
    sound.playClick();
    setIsLoadingGoogle(true);
    setLocalError(null);
    loginWithGoogleYouTube(
      async (token) => {
        setGoogleToken(token);
        const pls = await fetchUserGoogleYouTubePlaylists(token);
        setGooglePlaylists(pls);
        setIsLoadingGoogle(false);
        setActiveTab('google');
      },
      (err) => {
        setLocalError(err);
        setIsLoadingGoogle(false);
      }
    );
  };

  const handleImportGoogle = (pl: GooglePlaylistItem) => {
    sound.playDiscSpin();
    onSyncPlaylist(pl.id, pl.title);
  };

  const handlePasteClipboard = async () => {
    sound.playClick();
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrlInput(text.trim());
          setLocalError(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const parsed = parseYouTubeInput(urlInput);

    if (parsed.type === 'invalid') {
      setLocalError(
        'Please paste a valid YouTube or YouTube Music playlist URL (e.g. https://music.youtube.com/playlist?list=PL...), playlist ID, or video track link.'
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 font-sans">
          {/* Dimming Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md cursor-pointer"
          />

          {/* Liquid Glass Modal Sheet */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl liquid-glass-drawer border border-white/25 text-white shadow-[0_32px_80px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.4)] flex flex-col z-10"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-3 border-b border-white/[0.14] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-400 shadow-[0_0_18px_rgba(239,68,68,0.3)]">
                  <YouTubeIcon className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                    <span>Import YouTube Playlist</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/25 border border-red-400/40 text-red-300 font-mono font-bold uppercase">
                      URL Fetch
                    </span>
                  </h2>
                  <p className="text-xs text-white/60 mt-0.5">
                    Paste any YouTube or YouTube Music playlist link to press your custom digital CDs
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Live Charts Banner */}
            {onOpenCharts && (
              <div className="px-6 py-2.5 bg-gradient-to-r from-purple-500/25 via-indigo-500/20 to-purple-500/25 border-b border-white/10 text-white flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <TrendingUp className="w-4 h-4 text-purple-300 shrink-0" />
                  <span className="text-xs text-white/90 truncate font-medium">
                    Looking for new music? Explore <strong>Live Charts</strong> (Top 100 & Trending)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onClose();
                    onOpenCharts();
                  }}
                  className="px-3 py-1 rounded-full bg-white text-neutral-950 text-[11px] font-bold shrink-0 hover:bg-purple-100 transition-colors shadow cursor-pointer active:scale-95"
                >
                  Browse Charts
                </button>
              </div>
            )}

            {/* 3-Tab Segmented Selector: Paste URL | Connect Spotify | Google YouTube */}
            <div className="px-6 pt-4 pb-2">
              <div className="grid grid-cols-3 p-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('link');
                  }}
                  className={`py-2 px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'link'
                      ? 'liquid-glass-pill text-neutral-950 font-bold'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Paste URL</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('spotify');
                  }}
                  className={`py-2 px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'spotify'
                      ? 'liquid-glass-pill text-neutral-950 font-bold'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Spotify</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('google');
                  }}
                  className={`py-2 px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'google'
                      ? 'liquid-glass-pill text-neutral-950 font-bold'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>YouTube</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT: 1. Paste Link */}
            {activeTab === 'link' && (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-white/80 uppercase tracking-wider font-mono">
                      YouTube / YouTube Music Playlist URL
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="text-[11px] text-rose-300 hover:text-rose-200 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      <span>Paste from Clipboard</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <Link2 className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => {
                        setUrlInput(e.target.value);
                        setLocalError(null);
                      }}
                      placeholder="https://music.youtube.com/playlist?list=PL..."
                      className="w-full pl-10 pr-20 py-2.5 rounded-2xl bg-black/40 border border-white/20 text-white placeholder-white/40 text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-rose-400/60 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="absolute right-2 py-1 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-mono text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                      Paste
                    </button>
                  </div>
                  <p className="text-[10.5px] text-white/50 mt-1.5">
                    Paste any public or unlisted YouTube playlist link, YouTube Music URL, or ID (e.g. <code>PL...</code>).
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/80 uppercase tracking-wider font-mono mb-1.5">
                    Custom Playlist Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={playlistTitle}
                    onChange={(e) => setPlaylistTitle(e.target.value)}
                    placeholder="e.g. Late Night Drives, Summer Vibes 2024…"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-black/40 border border-white/20 text-white placeholder-white/40 text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-rose-400/60 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                  />
                </div>

                {/* Status & Errors */}
                {(localError || syncError) && (
                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-500/20 border border-red-400/40 text-red-200 text-xs shadow-[0_0_16px_rgba(239,68,68,0.25)]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
                    <span>{localError || syncError}</span>
                  </div>
                )}

                {syncStatus && !syncError && (
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs shadow-[0_0_16px_rgba(16,185,129,0.25)]">
                    {isSyncing ? (
                      <Disc3 className="w-4 h-4 animate-spin shrink-0 text-emerald-300" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    )}
                    <span className="font-mono text-[11px] tracking-wide">{syncStatus}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-white/60">
                    Works with any <strong>Unlisted</strong> or <strong>Public</strong> YouTube playlist.
                  </span>
                  <button
                    type="submit"
                    disabled={isSyncing || !urlInput.trim()}
                    className="py-2.5 px-6 rounded-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(239,68,68,0.4)] disabled:opacity-40 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    {isSyncing ? (
                      <>
                        <Disc3 className="w-4 h-4 animate-spin" />
                        <span>Syncing Discs…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Fetch & Press Discs</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB CONTENT: 2. Spotify Library Connect */}
            {activeTab === 'spotify' && (
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Connect Spotify Library
                    </h3>
                    <p className="text-xs text-white/70 mt-1">
                      Import your Spotify playlists into Retro Station with <strong>100% free universal playback</strong>. (No Spotify Premium required!)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSpotifyConnect}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{spotifyToken ? 'Reconnect' : 'Connect'}</span>
                  </button>
                </div>

                {isLoadingSpotify ? (
                  <div className="py-12 flex flex-col items-center justify-center text-white/60">
                    <Disc3 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
                    <span className="font-mono text-xs">Loading your Spotify playlists…</span>
                  </div>
                ) : spotifyPlaylists.length > 0 ? (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    <span className="text-[10px] uppercase tracking-wider text-white/50 font-mono block pb-1">
                      Your Spotify Playlists ({spotifyPlaylists.length}):
                    </span>
                    {spotifyPlaylists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => handleImportSpotify(pl)}
                        className="w-full p-2.5 rounded-2xl liquid-glass-interactive text-left transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <img
                            src={pl.imageUrl}
                            alt={pl.name}
                            className="w-10 h-10 rounded-xl object-cover shadow-sm bg-neutral-800"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate group-hover:text-emerald-300">
                              {pl.name}
                            </div>
                            <div className="font-mono text-[10px] text-white/60">
                              {pl.trackCount} tracks
                            </div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold uppercase tracking-wider group-hover:bg-emerald-400 group-hover:text-black transition-colors">
                          Import
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl liquid-glass-card text-center font-mono text-xs text-white/60">
                    Click <strong>Connect</strong> above to sign in with Spotify and load your playlists.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: 3. Google / YouTube OAuth Login */}
            {activeTab === 'google' && (
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Sign in with Google / YouTube
                    </h3>
                    <p className="text-xs text-white/70 mt-1">
                      Read-only access to import your personal YouTube playlists & Liked Videos directly without copying links.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleConnect}
                    disabled={isLoadingGoogle}
                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{googleToken ? 'Signed In' : 'Sign In'}</span>
                  </button>
                </div>

                {isLoadingGoogle ? (
                  <div className="py-12 flex flex-col items-center justify-center text-white/60">
                    <Disc3 className="w-8 h-8 animate-spin text-red-400 mb-2" />
                    <span className="font-mono text-xs">Connecting to Google…</span>
                  </div>
                ) : googlePlaylists.length > 0 ? (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    <span className="text-[10px] uppercase tracking-wider text-white/50 font-mono block pb-1">
                      Your YouTube Playlists ({googlePlaylists.length}):
                    </span>
                    {googlePlaylists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => handleImportGoogle(pl)}
                        className="w-full p-2.5 rounded-2xl liquid-glass-interactive text-left transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <img
                            src={pl.thumbnailUrl}
                            alt={pl.title}
                            className="w-10 h-10 rounded-xl object-cover shadow-sm bg-neutral-800"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate group-hover:text-red-300">
                              {pl.title}
                            </div>
                            <div className="font-mono text-[10px] text-white/60">
                              {pl.itemCount} tracks
                            </div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-400/40 text-[10px] font-bold uppercase tracking-wider group-hover:bg-red-500 group-hover:text-white transition-colors">
                          Press
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl liquid-glass-card text-center font-mono text-xs text-white/60">
                    Click <strong>Sign In</strong> above to fetch your personal playlists and Liked Videos.
                  </div>
                )}
              </div>
            )}

            {/* Quick-Try Curated Presets */}
            <div className="px-6 py-4 border-t border-white/[0.14] bg-white/[0.02]">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>Quick-Sync Curated Playlists</span>
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
                    className="text-left p-2.5 rounded-2xl liquid-glass-interactive transition-all active:scale-95 group cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-white leading-tight group-hover:text-rose-300">
                      {preset.label}
                    </div>
                    <div className="font-mono text-[9px] text-white/50 uppercase tracking-wider mt-1">
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
