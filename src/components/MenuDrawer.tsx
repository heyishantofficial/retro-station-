import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Tv,
  Trash2,
  Plus,
  Search,
  Share2,
  FolderPlus,
  TrendingUp,
  Cloud,
  Disc3,
  Layers,
  Music,
  ArrowRight,
  Trophy,
  Globe2,
} from 'lucide-react';
import { Playlist, Track } from '../types';
import { YouTubeIcon } from './YouTubeIcon';
import { sound } from '../utils/soundEffects';
import { VIEW_CATALOG, PlayerViewMode } from '../utils/viewCatalog';
import { UserProfile } from '../services/cloudSync';

export type { PlayerViewMode };

interface MenuDrawerProps {
  isOpen: boolean;
  viewMode: PlayerViewMode;
  playlists: Playlist[];
  activePlaylist: Playlist | null;
  activeTrackIndex: number;
  isPlaying: boolean;
  showMiniVideo: boolean;
  user?: UserProfile | null;
  onClose: () => void;
  onChangeViewMode: (mode: PlayerViewMode) => void;
  onSelectPlaylist: (id: string) => void;
  onDeletePlaylist: (id: string) => void;
  onSelectTrack: (index: number) => void;
  onDeleteTrack?: (index: number) => void;
  onOpenSyncModal: () => void;
  onOpenSearch?: () => void;
  onOpenCharts?: () => void;
  onOpenAuthModal?: () => void;
  onCreateNewCrate?: () => void;
  onShareCrate?: () => void;
  onOpenCommunityLeaderboard?: (preselectedPlaylistId?: string) => void;
  onToggleMiniVideo: () => void;
}

const VIEW_GRADIENTS: Record<PlayerViewMode, string> = {
  arc: 'from-neutral-200 to-neutral-400',
  vinyl: 'from-stone-200 to-red-950/40',
  chrome: 'from-neutral-400 via-neutral-700 to-black',
  crt: 'from-orange-500 to-rose-600',
  sleeve: 'from-amber-800 to-stone-900',
  braun: 'from-stone-300 to-neutral-500',
  cassette: 'from-rose-600 to-neutral-900',
  pixel: 'from-blue-900 via-amber-700 to-amber-200',
  atlas: 'from-amber-700 to-stone-950',
  ember: 'from-orange-600 via-stone-800 to-black',
  chroma: 'from-red-600 via-rose-950 to-black',
  binder: 'from-pink-400 via-purple-950 to-black',
  glam: 'from-pink-300 via-rose-500 to-purple-950',
};

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  viewMode,
  playlists,
  activePlaylist,
  activeTrackIndex,
  isPlaying,
  showMiniVideo,
  user,
  onClose,
  onChangeViewMode,
  onSelectPlaylist,
  onDeletePlaylist,
  onSelectTrack,
  onDeleteTrack,
  onOpenSyncModal,
  onOpenSearch,
  onOpenCharts,
  onOpenAuthModal,
  onCreateNewCrate,
  onShareCrate,
  onOpenCommunityLeaderboard,
  onToggleMiniVideo,
}) => {
  const [activeTab, setActiveTab] = useState<'tracks' | 'playlists' | 'themes'>(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'playlists' || tabParam === 'crates' || tabParam === 'themes' || tabParam === 'tracks') {
        return tabParam === 'crates' ? 'playlists' : tabParam;
      }
    }
    return 'tracks';
  });
  const [sfxEnabled, setSfxEnabled] = useState(sound.enabled);

  const toggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    sound.enabled = next;
    if (next) sound.playClick(1000, 0.02);
  };

  const trackCount = activePlaylist?.tracks.length ?? 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Deep Dark Backdrop Scrim to block underlying white/black themes from washing out */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/75 backdrop-blur-md"
          />

          {/* Solid Obsidian Console Drawer — 100% High Contrast on Both White and Black Themes */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 h-[100dvh] w-full sm:w-[420px] sm:max-w-[420px] z-50 bg-[#0f0f12] text-white border-l border-white/10 shadow-[-24px_0_60px_rgba(0,0,0,0.9)] flex flex-col font-sans select-none pb-safe"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            {/* Header: Title, Playing Status & Close */}
            <div className="px-5 pt-4 pb-3.5 border-b border-white/10 bg-[#141418] flex items-center justify-between relative z-10">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isPlaying
                          ? 'bg-emerald-400 animate-pulse ring-2 ring-emerald-400/30'
                          : 'bg-zinc-400'
                      }`}
                    />
                    <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-200">
                      {isPlaying ? 'Playing' : 'Standby'}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-300 font-medium">
                    {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-1 truncate">
                  {activePlaylist?.title || 'No Playlist Selected'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                aria-label="Close dashboard"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center transition-all border border-white/15 active:scale-95 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Google Cloud Account Status Deck */}
            <div className="px-5 pt-3 pb-2 relative z-10">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                  onOpenAuthModal?.();
                }}
                className="w-full p-2.5 rounded-xl bg-[#18181d] hover:bg-[#22222a] border border-white/10 hover:border-white/20 flex items-center justify-between text-left transition-all active:scale-[0.99] group shadow-sm cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-8 h-8 rounded-full border border-emerald-500/40 ring-2 ring-emerald-500/20 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/35 text-blue-400 flex items-center justify-center shrink-0">
                      <Cloud className="w-4 h-4" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">
                        {user ? user.name : 'Sign in with Google'}
                      </span>
                      {user && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20 shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-zinc-300 block truncate mt-0.5">
                      {user ? 'Playlists backed up to cloud' : 'Keep playlists synced across devices'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-zinc-300 group-hover:text-white shrink-0 ml-2">
                  <span>{user ? 'Account' : 'Sign In'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>

            {/* Quick Actions Deck: 4 Solid, High-Contrast Grid Cards */}
            <div className="px-5 py-2 relative z-10">
              <div className="grid grid-cols-2 gap-2">
                {/* 1. Search & Add */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onClose();
                    onOpenSearch?.();
                  }}
                  className="p-2.5 rounded-xl bg-[#18181d] hover:bg-[#22222a] border border-white/10 hover:border-white/20 flex items-center gap-2.5 text-left transition-all active:scale-[0.98] group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">Search Songs</div>
                    <div className="text-[11px] text-zinc-300 truncate">Add to playlist</div>
                  </div>
                </button>

                {/* 2. YouTube Charts */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onClose();
                    onOpenCharts?.();
                  }}
                  className="p-2.5 rounded-xl bg-[#18181d] hover:bg-[#22222a] border border-white/10 hover:border-white/20 flex items-center gap-2.5 text-left transition-all active:scale-[0.98] group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/35 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">Live Charts</div>
                    <div className="text-[11px] text-zinc-300 truncate">Daily Top 100</div>
                  </div>
                </button>

                {/* 3. New Playlist */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onCreateNewCrate?.();
                  }}
                  className="p-2.5 rounded-xl bg-[#18181d] hover:bg-[#22222a] border border-white/10 hover:border-white/20 flex items-center gap-2.5 text-left transition-all active:scale-[0.98] group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/35 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform shrink-0">
                    <FolderPlus className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">New Playlist</div>
                    <div className="text-[11px] text-zinc-300 truncate">Create empty</div>
                  </div>
                </button>

                {/* 4. Sync YouTube */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onClose();
                    onOpenSyncModal();
                  }}
                  className="p-2.5 rounded-xl bg-[#18181d] hover:bg-[#22222a] border border-white/10 hover:border-white/20 flex items-center gap-2.5 text-left transition-all active:scale-[0.98] group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/35 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform shrink-0">
                    <YouTubeIcon className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">Sync YouTube</div>
                    <div className="text-[11px] text-zinc-300 truncate">Import link</div>
                  </div>
                </button>
              </div>
            </div>

            {/* High-Contrast Segmented Navigation Tabs */}
            <div className="px-5 pt-2 pb-2 relative z-10">
              <div className="grid grid-cols-3 p-1 rounded-xl bg-[#18181d] border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('tracks');
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'tracks'
                      ? 'bg-white text-neutral-950 shadow-md font-bold'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Music className="w-3 h-3" />
                  <span>Tracks</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeTab === 'tracks'
                        ? 'bg-neutral-900/10 text-neutral-950'
                        : 'bg-white/15 text-zinc-200'
                    }`}
                  >
                    {trackCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('playlists');
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'playlists'
                      ? 'bg-white text-neutral-950 shadow-md font-bold'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Disc3 className="w-3 h-3" />
                  <span>Playlists</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeTab === 'playlists'
                        ? 'bg-neutral-900/10 text-neutral-950'
                        : 'bg-white/15 text-zinc-200'
                    }`}
                  >
                    {playlists.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('themes');
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'themes'
                      ? 'bg-white text-neutral-950 shadow-md font-bold'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Themes</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeTab === 'themes'
                        ? 'bg-neutral-900/10 text-neutral-950'
                        : 'bg-white/15 text-zinc-200'
                    }`}
                  >
                    {VIEW_CATALOG.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Scrollable Content Deck */}
            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2 relative z-10">
              {/* TAB 1: TRACKS */}
              {activeTab === 'tracks' && (
                <div className="space-y-2 pb-4">
                  {/* Secondary Toolbar: Add & Share */}
                  <div className="flex items-center justify-between pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onClose();
                        onOpenSearch?.();
                      }}
                      className="py-1.5 px-3 rounded-lg bg-[#18181d] hover:bg-[#22222a] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Add Song</span>
                    </button>

                    {activePlaylist && (
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onShareCrate?.();
                        }}
                        className="py-1.5 px-3 rounded-lg bg-[#18181d] hover:bg-[#22222a] text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                        title="Share playlist link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                    )}
                  </div>

                  {(!activePlaylist || activePlaylist.tracks.length === 0) && (
                    <div className="py-14 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-[#18181d] border border-white/10 flex items-center justify-center mx-auto text-zinc-400 mb-3">
                        <Music className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-semibold text-white">Playlist is Empty</h4>
                      <p className="text-xs text-zinc-300 mt-1 max-w-[240px] mx-auto">
                        Search songs or tap the Charts button to press your first tracks.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onClose();
                          onOpenSearch?.();
                        }}
                        className="mt-3.5 py-1.5 px-4 rounded-lg bg-white text-neutral-950 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                      >
                        Search Songs
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {(activePlaylist?.tracks ?? []).map((track: Track, idx: number) => {
                      const isActive = idx === activeTrackIndex;
                      const thumbSrc = track.youtubeId
                        ? `https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`
                        : track.coverUrl;
                      const durationStr = formatDuration(track.duration);

                      return (
                        <div
                          key={track.id}
                          className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-xl transition-all border ${
                            isActive
                              ? 'bg-white/[0.14] border-white/25 text-white shadow-sm ring-1 ring-white/10'
                              : 'bg-[#16161b] hover:bg-[#202026] border-white/[0.08] text-zinc-200'
                          }`}
                        >
                          {/* Track Play Trigger & Details */}
                          <button
                            type="button"
                            onClick={() => {
                              sound.playDiscSpin();
                              onSelectTrack(idx);
                            }}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                          >
                            {/* Artwork Thumbnail with Live Equalizer */}
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/15 shadow-sm bg-neutral-900">
                              <img
                                src={thumbSrc}
                                alt={track.title}
                                className="w-full h-full object-cover"
                              />

                              {/* Playing Equalizer Overlay */}
                              {isActive ? (
                                <div className="absolute inset-0 bg-black/60 flex items-end justify-center gap-0.5 pb-2">
                                  {isPlaying ? (
                                    <>
                                      <span className="w-1 bg-emerald-400 rounded-full animate-eq-1" />
                                      <span className="w-1 bg-emerald-400 rounded-full animate-eq-2" />
                                      <span className="w-1 bg-emerald-400 rounded-full animate-eq-3" />
                                    </>
                                  ) : (
                                    <Pause className="w-3.5 h-3.5 text-white my-auto" />
                                  )}
                                </div>
                              ) : (
                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                                </div>
                              )}
                            </div>

                            {/* Track Info (Crisp White and Zinc-300) */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono tabular-nums text-zinc-400 font-medium">
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <div className="text-xs font-semibold text-white truncate">
                                  {track.title}
                                </div>
                              </div>
                              <div className="text-xs text-zinc-300 truncate mt-0.5 font-medium">
                                {track.artist}
                              </div>
                            </div>
                          </button>

                          {/* Right Controls: Duration, Play & ALWAYS-VISIBLE Remove Button */}
                          <div className="flex items-center gap-1 shrink-0">
                            {durationStr && (
                              <span className="text-xs font-mono tabular-nums text-zinc-400 mr-1">
                                {durationStr}
                              </span>
                            )}

                            {/* ALWAYS-VISIBLE 1-Tap Remove Button (Mobile & Desktop) */}
                            {onDeleteTrack && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sound.playClick();
                                  onDeleteTrack(idx);
                                }}
                                title="Remove song from playlist"
                                aria-label={`Remove ${track.title} from playlist`}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all cursor-pointer touch-target-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Small Play/Spin Indicator */}
                            <div className="w-5 flex items-center justify-center">
                              {isActive ? (
                                <Disc3
                                  className={`w-3.5 h-3.5 text-emerald-400 ${
                                    isPlaying ? 'animate-spin' : 'opacity-70'
                                  }`}
                                />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: PLAYLISTS */}
              {activeTab === 'playlists' && (
                <div className="space-y-2 pb-4">
                  {/* Community Playlists Leaderboard Banner */}
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onClose();
                      onOpenCommunityLeaderboard?.();
                    }}
                    className="w-full p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-[#1a1a20] hover:from-amber-500/30 hover:via-orange-500/25 border border-amber-500/40 flex items-center justify-between text-left transition-all active:scale-[0.98] group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
                        <Trophy className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span>Community Leaderboard</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-neutral-950 text-[9px] font-bold">
                            HOT
                          </span>
                        </div>
                        <div className="text-xs text-zinc-300 truncate mt-0.5">
                          Explore most saved playlists by community
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>

                  {/* Create New Playlist Quick Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onCreateNewCrate?.();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-white/25 hover:border-white/50 bg-[#16161b] hover:bg-[#202026] text-xs font-semibold text-zinc-200 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Create New Playlist</span>
                  </button>

                  {playlists.length === 0 && (
                    <div className="py-12 text-center text-xs text-zinc-400">
                      No playlists found. Create or import your first playlist.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {playlists.map((pl) => {
                      const isActive = pl.id === activePlaylist?.id;
                      return (
                        <div
                          key={pl.id}
                          className={`w-full p-3 rounded-xl transition-all border ${
                            isActive
                              ? 'bg-white/[0.14] border-white/25 text-white shadow-sm ring-1 ring-white/10'
                              : 'bg-[#16161b] hover:bg-[#202026] border-white/[0.08] text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                sound.playDiscSpin();
                                onSelectPlaylist(pl.id);
                                setActiveTab('tracks');
                              }}
                              className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/15">
                                <Disc3
                                  className={`w-4 h-4 ${
                                    isActive ? 'text-emerald-400' : 'text-zinc-300'
                                  }`}
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-white truncate">
                                    {pl.title}
                                  </span>
                                  {isActive && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold tracking-wider uppercase shrink-0">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-300 truncate mt-0.5">
                                  {pl.tracks.length} {pl.tracks.length === 1 ? 'track' : 'tracks'} •{' '}
                                  {pl.category || 'Collection'}
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sound.playClick();
                                  onClose();
                                  onOpenCommunityLeaderboard?.(pl.id);
                                }}
                                title="Publish playlist to Community Leaderboard"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer touch-target-sm"
                              >
                                <Globe2 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sound.playClick();
                                  onShareCrate?.();
                                }}
                                title="Share playlist link"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/15 transition-colors cursor-pointer touch-target-sm"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sound.playClick();
                                  onDeletePlaylist(pl.id);
                                }}
                                title="Delete playlist"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer touch-target-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: THEMES / VISUAL VIEWS (13 CREATIVE NAMES) */}
              {activeTab === 'themes' && (
                <div className="space-y-2 pb-4">
                  <div className="text-xs font-medium text-zinc-300 px-0.5">
                    Choose a signature aesthetic player console:
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {VIEW_CATALOG.map((item, idx) => {
                      const isActive = item.id === viewMode;
                      const gradientClass = VIEW_GRADIENTS[item.id] || 'from-neutral-500 to-black';

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            sound.playSwitch();
                            onChangeViewMode(item.id);
                          }}
                          className={`p-3 rounded-xl text-left border transition-all active:scale-[0.98] flex flex-col justify-between gap-2.5 relative overflow-hidden group cursor-pointer ${
                            isActive
                              ? 'bg-white/[0.16] border-white/35 text-white shadow-md ring-1 ring-white/20'
                              : 'bg-[#16161b] hover:bg-[#202026] border-white/[0.08] text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full relative z-10">
                            {/* Visual Preview Swatch */}
                            <div
                              className={`w-6 h-6 rounded-lg bg-gradient-to-br ${gradientClass} border border-white/20 shadow-sm`}
                            />

                            <div className="flex items-center gap-1">
                              {isActive ? (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold tracking-wider uppercase flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                  Active
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-300 px-1 py-0.5 rounded bg-white/10 font-medium">
                                  {item.badge || idx + 1}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="relative z-10">
                            <div className="text-xs font-bold text-white truncate leading-tight">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-zinc-300 truncate mt-0.5 font-medium">
                              {item.subtitle}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Console: Sound FX & Mini Video Toggles */}
            <div className="px-5 py-3.5 border-t border-white/10 bg-[#141418] space-y-2 relative z-10">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={toggleSfx}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all active:scale-95 cursor-pointer ${
                    sfxEnabled
                      ? 'bg-white/15 border-white/25 text-white shadow-sm'
                      : 'bg-transparent border-white/10 text-zinc-400'
                  }`}
                >
                  {sfxEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span>Clicks {sfxEnabled ? 'On' : 'Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onToggleMiniVideo();
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all active:scale-95 cursor-pointer ${
                    showMiniVideo
                      ? 'bg-white text-neutral-950 font-bold shadow-sm'
                      : 'bg-[#18181d] border-white/10 text-zinc-200 hover:text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Video {showMiniVideo ? 'On' : 'Off'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 font-medium">
                <span>V Themes • Space Play</span>
                <span>Esc Close</span>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
