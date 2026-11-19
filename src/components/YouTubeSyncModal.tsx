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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5">
          {/* Dimming Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[5px]"
          />

          {/* Translucent Apple-style Modal Sheet */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-xl max-h-[88dvh] overflow-y-auto rounded-3xl bg-[#f5f5f3]/95 text-neutral-900 backdrop-blur-2xl border border-black/10 shadow-[0_32px_80px_rgba(0,0,0,0.25)] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-3 border-b border-black/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow">
                  <YouTubeIcon className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold uppercase tracking-wide text-neutral-900 leading-none">
                    Import & Sync Music
                  </h2>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500 mt-1">
                    YouTube Playlists, Spotify Library & Live Charts
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-black hover:bg-black/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Live Charts Banner */}
            {onOpenCharts && (
              <div className="px-6 py-2.5 bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <TrendingUp className="w-4 h-4 text-purple-300 shrink-0" />
                  <span className="font-mono text-[10.5px] uppercase tracking-wider truncate">
                    Live Charts: Trending 20, Top 100 India & Global
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onClose();
                    onOpenCharts();
                  }}
                  className="px-3 py-1 rounded-full bg-white text-neutral-950 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 hover:bg-purple-100 transition-colors shadow"
                >
                  Browse Charts
                </button>
              </div>
            )}

            {/* 3-Tab Segmented Selector: Paste Link | Connect Spotify | Google YouTube */}
            <div className="px-6 pt-3 pb-2 border-b border-black/[0.08]">
              <div className="grid grid-cols-3 p-1 rounded-2xl bg-black/[0.05] text-[10px] font-mono uppercase tracking-[0.12em]">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('link');
                  }}
                  className={`py-2 rounded-xl transition-all ${
                    activeTab === 'link'
                      ? 'bg-white text-neutral-950 shadow-sm font-bold'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  Paste URL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('spotify');
                  }}
                  className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'spotify'
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'text-neutral-500 hover:text-neutral-800'
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
                  className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'google'
                      ? 'bg-red-600 text-white shadow-sm font-bold'
                      : 'text-neutral-500 hover:text-neutral-800'
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
                  <label className="block font-mono text-[9.5px] uppercase tracking-[0.2em] text-neutral-500 mb-1.5">
                    YouTube / YouTube Music Playlist or Track Link
                  </label>
                  <div className="relative">
                    <Link2 className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => {
                        setUrlInput(e.target.value);
                        setLocalError(null);
                      }}
                      placeholder="https://music.youtube.com/playlist?list=PL..."
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-white border border-black/15 text-[15px] sm:text-[13px] font-sans text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
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
                    placeholder="e.g. My Favorite Tracks"
                    className="w-full px-3.5 py-2 rounded-2xl bg-white border border-black/15 text-[15px] sm:text-[13px] font-sans text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                  />
                </div>

                {/* Status & Errors */}
                {(localError || syncError) && (
                  <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-800 text-[11px]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{localError || syncError}</span>
                  </div>
                )}

                {syncStatus && !syncError && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-900/5 border border-black/10 text-neutral-800 text-[11px]">
                    {isSyncing ? (
                      <Disc3 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span className="font-mono text-[10px] tracking-wide">{syncStatus}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10.5px] text-neutral-500">
                    Works with any <strong>Unlisted</strong> or <strong>Public</strong> YouTube playlist.
                  </span>
                  <button
                    type="submit"
                    disabled={isSyncing || !urlInput.trim()}
                    className="px-5 py-2.5 rounded-full bg-neutral-900 text-white text-[11.5px] font-medium tracking-wide hover:bg-neutral-800 disabled:opacity-40 transition-all active:scale-95 flex items-center gap-2 shadow"
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
            )}

            {/* TAB CONTENT: 2. Spotify Library Connect */}
            {activeTab === 'spotify' && (
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-base font-semibold uppercase tracking-wide">
                      Connect Spotify Library
                    </h3>
                    <p className="font-sans text-xs text-neutral-600 mt-0.5">
                      Import your Spotify playlists into Retro Station with <strong>100% free universal playback</strong>. (No Spotify Premium required!)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSpotifyConnect}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{spotifyToken ? 'Reconnect' : 'Connect'}</span>
                  </button>
                </div>

                {isLoadingSpotify ? (
                  <div className="py-12 flex flex-col items-center justify-center text-neutral-400">
                    <Disc3 className="w-7 h-7 animate-spin text-emerald-600 mb-2" />
                    <span className="font-mono text-xs">Loading your Spotify playlists…</span>
                  </div>
                ) : spotifyPlaylists.length > 0 ? (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block pb-1">
                      Your Spotify Playlists ({spotifyPlaylists.length}):
                    </span>
                    {spotifyPlaylists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => handleImportSpotify(pl)}
                        className="w-full p-2.5 rounded-2xl hover:bg-black/[0.05] border border-black/10 text-left transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <img
                            src={pl.imageUrl}
                            alt={pl.name}
                            className="w-10 h-10 rounded-xl object-cover shadow-sm bg-neutral-200"
                          />
                          <div className="min-w-0">
                            <div className="font-serif text-[13px] font-semibold truncate group-hover:text-emerald-700">
                              {pl.name}
                            </div>
                            <div className="font-mono text-[9.5px] text-neutral-500">
                              {pl.trackCount} tracks
                            </div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 font-mono text-[10px] font-medium uppercase tracking-wider group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          Import
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/10 text-center font-mono text-xs text-neutral-500">
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
                    <h3 className="font-serif text-base font-semibold uppercase tracking-wide">
                      Sign in with Google / YouTube
                    </h3>
                    <p className="font-sans text-xs text-neutral-600 mt-0.5">
                      Read-only access to import your personal YouTube playlists & Liked Videos directly without copying links.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleConnect}
                    disabled={isLoadingGoogle}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{googleToken ? 'Signed In' : 'Sign In'}</span>
                  </button>
                </div>

                {isLoadingGoogle ? (
                  <div className="py-12 flex flex-col items-center justify-center text-neutral-400">
                    <Disc3 className="w-7 h-7 animate-spin text-red-600 mb-2" />
                    <span className="font-mono text-xs">Connecting to Google…</span>
                  </div>
                ) : googlePlaylists.length > 0 ? (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block pb-1">
                      Your YouTube Playlists ({googlePlaylists.length}):
                    </span>
                    {googlePlaylists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => handleImportGoogle(pl)}
                        className="w-full p-2.5 rounded-2xl hover:bg-black/[0.05] border border-black/10 text-left transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <img
                            src={pl.thumbnailUrl}
                            alt={pl.title}
                            className="w-10 h-10 rounded-xl object-cover shadow-sm bg-neutral-200"
                          />
                          <div className="min-w-0">
                            <div className="font-serif text-[13px] font-semibold truncate group-hover:text-red-700">
                              {pl.title}
                            </div>
                            <div className="font-mono text-[9.5px] text-neutral-500">
                              {pl.itemCount} tracks
                            </div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-700 font-mono text-[10px] font-medium uppercase tracking-wider group-hover:bg-red-600 group-hover:text-white transition-colors">
                          Press
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/10 text-center font-mono text-xs text-neutral-500">
                    Click <strong>Sign In</strong> above to fetch your personal playlists and Liked Videos.
                  </div>
                )}
              </div>
            )}

            {/* Quick-Try Curated Presets */}
            <div className="px-6 py-4 bg-black/[0.03] border-t border-black/10">
              <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500 mb-2.5">
                <Sparkles className="w-3 h-3" />
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
                    className="text-left p-2.5 rounded-2xl bg-white hover:bg-neutral-50 border border-black/10 transition-all active:scale-95 group shadow-sm"
                  >
                    <div className="text-[11.5px] font-medium text-neutral-900 leading-tight group-hover:underline">
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
