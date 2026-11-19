import React, { useState, useRef, useEffect } from 'react';
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
  TrendingUp,
  Cloud,
  Disc3,
  Layers,
  Music,
  ArrowRight,
  Trophy,
  Globe2,
  Pencil,
  Check,
  ChevronDown,
  Moon,
  Keyboard,
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
  onRenamePlaylist?: (id: string, newTitle: string) => void;
  onCreateNewPlaylist?: () => void;
  onCreateNewCrate?: () => void;
  onSharePlaylist?: () => void;
  onShareCrate?: () => void;
  onOpenCommunityLeaderboard?: (preselectedPlaylistId?: string) => void;
  onToggleMiniVideo: () => void;
  vinylCrackleLevel?: 'off' | 'subtle' | 'warm';
  onChangeVinylCrackle?: (level: 'off' | 'subtle' | 'warm') => void;
  sleepTimerRemaining?: string | null;
  sleepTimerMinutes?: number | null;
  onSetSleepTimer?: (minutes: number | null) => void;
  onOpenShortcuts?: () => void;
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
  onRenamePlaylist,
  onCreateNewPlaylist,
  onCreateNewCrate,
  onSharePlaylist,
  onShareCrate,
  onOpenCommunityLeaderboard,
  onToggleMiniVideo,
  vinylCrackleLevel = 'off',
  onChangeVinylCrackle,
  sleepTimerRemaining,
  sleepTimerMinutes,
  onSetSleepTimer,
  onOpenShortcuts,
}) => {
  const [activeTab, setActiveTab] = useState<'tracks' | 'themes'>(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'themes') {
        return 'themes';
      }
    }
    return 'tracks';
  });
  const [sfxEnabled, setSfxEnabled] = useState(sound.enabled);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editingPlaylistTitle, setEditingPlaylistTitle] = useState('');
  const [isEditingActiveTitle, setIsEditingActiveTitle] = useState(false);
  const [activeTitleDraft, setActiveTitleDraft] = useState('');
  const [isPlaylistDropdownOpen, setIsPlaylistDropdownOpen] = useState(false);
  const playlistDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        playlistDropdownRef.current &&
        !playlistDropdownRef.current.contains(e.target as Node)
      ) {
        setIsPlaylistDropdownOpen(false);
      }
    };
    if (isPlaylistDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPlaylistDropdownOpen]);

  const triggerCreatePlaylist = onCreateNewPlaylist || onCreateNewCrate;
  const triggerSharePlaylist = onSharePlaylist || onShareCrate;

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
          {/* Ambient Frosted Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-md"
          />

          {/* Liquid Glass Console Drawer — VisionOS & macOS Translucent Frosted Glass Architecture */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 h-[100dvh] w-full sm:w-[420px] sm:max-w-[420px] z-50 text-white flex flex-col font-sans select-none pb-safe overflow-hidden"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              background: 'linear-gradient(145deg, rgba(22, 27, 40, 0.82) 0%, rgba(11, 14, 22, 0.92) 100%)',
              backdropFilter: 'blur(45px) saturate(190%)',
              WebkitBackdropFilter: 'blur(45px) saturate(190%)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2), -24px 0 80px rgba(0, 0, 0, 0.65)',
            }}
          >
            {/* Ambient Liquid Glass Specular Orbs */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/12 blur-3xl" />
            <div className="pointer-events-none absolute top-1/3 -left-24 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />

            {/* Header: Title, Playing Status & Liquid Glass Close */}
            <div
              className="px-5 pt-4 pb-3.5 border-b border-white/[0.12] flex items-center justify-between relative z-10"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 shadow-[0_0_12px_rgba(16,185,129,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isPlaying
                          ? 'bg-emerald-400 animate-pulse ring-2 ring-emerald-400/40'
                          : 'bg-zinc-400'
                      }`}
                    />
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      {isPlaying ? 'Playing' : 'Standby'}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-300/90 font-medium">
                    {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                  </span>
                </div>

                {isEditingActiveTitle && activePlaylist ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (activeTitleDraft.trim() && onRenamePlaylist) {
                        sound.playClick();
                        onRenamePlaylist(activePlaylist.id, activeTitleDraft.trim());
                      }
                      setIsEditingActiveTitle(false);
                    }}
                    className="flex items-center gap-1.5 mt-1.5"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={activeTitleDraft}
                      onChange={(e) => setActiveTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setIsEditingActiveTitle(false);
                      }}
                      placeholder="Rename playlist..."
                      className="flex-1 min-w-0 px-2.5 py-1 rounded-xl bg-white/[0.12] border border-emerald-400/50 text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]"
                    />
                    <button
                      type="submit"
                      disabled={!activeTitleDraft.trim()}
                      className="p-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black transition-colors cursor-pointer disabled:opacity-40 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                      title="Save name"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingActiveTitle(false)}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 transition-colors cursor-pointer shrink-0 border border-white/15"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 mt-1 min-w-0 group">
                    <h2
                      onClick={() => {
                        if (activePlaylist) {
                          sound.playClick();
                          setActiveTitleDraft(activePlaylist.title);
                          setIsEditingActiveTitle(true);
                        }
                      }}
                      className="text-base sm:text-lg font-bold text-white tracking-tight truncate cursor-pointer hover:text-emerald-300 transition-colors"
                      title="Click or tap pencil to rename playlist"
                    >
                      {activePlaylist?.title || 'No Playlist Selected'}
                    </h2>
                    {activePlaylist && (
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setActiveTitleDraft(activePlaylist.title);
                          setIsEditingActiveTitle(true);
                        }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-400 hover:text-emerald-300 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                        title="Rename playlist"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                aria-label="Close dashboard"
                className="w-8 h-8 rounded-full bg-white/[0.10] hover:bg-white/[0.22] border border-white/25 text-white/80 hover:text-white flex items-center justify-center transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.2)] active:scale-95 shrink-0 cursor-pointer"
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
                className="w-full p-3 rounded-2xl liquid-glass-interactive flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-9 h-9 rounded-full border border-emerald-400/50 ring-2 ring-emerald-500/20 object-cover shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_0_16px_rgba(59,130,246,0.25)]">
                      <Cloud className="w-4 h-4" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate">
                        {user ? user.name : 'Sign in with Google'}
                      </span>
                      {user && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30 shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-white/70 block truncate mt-0.5">
                      {user ? 'Playlists backed up to cloud' : 'Keep playlists synced across devices'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80 group-hover:text-white shrink-0 ml-2 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <span>{user ? 'Account' : 'Sign In'}</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>

            {/* Quick Actions Bar: 3 Clean, Dedicated Discovery & Sync Actions */}
            <div className="px-5 py-2 relative z-10">
              <div className="grid grid-cols-3 gap-2.5">
                {/* 1. Search Songs */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onClose();
                    onOpenSearch?.();
                  }}
                  className="p-3 rounded-2xl liquid-glass-interactive flex flex-col items-center text-center gap-2 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_0_16px_rgba(16,185,129,0.25)]">
                    <Search className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="text-xs font-bold text-white tracking-tight truncate">Search</div>
                    <div className="text-[10px] text-white/70 truncate mt-0.5 font-medium">Add Songs</div>
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
                  className="p-3 rounded-2xl liquid-glass-interactive flex flex-col items-center text-center gap-2 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_0_16px_rgba(168,85,247,0.25)]">
                    <TrendingUp className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="text-xs font-bold text-white tracking-tight truncate">Charts</div>
                    <div className="text-[10px] text-white/70 truncate mt-0.5 font-medium">Top 100</div>
                  </div>
                </button>

                {/* 3. Sync YouTube */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onClose();
                    onOpenSyncModal();
                  }}
                  className="p-3 rounded-2xl liquid-glass-interactive flex flex-col items-center text-center gap-2 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_0_16px_rgba(239,68,68,0.25)]">
                    <YouTubeIcon className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="text-xs font-bold text-white tracking-tight truncate">Sync</div>
                    <div className="text-[10px] text-white/70 truncate mt-0.5 font-medium">Import</div>
                  </div>
                </button>
              </div>
            </div>

            {/* High-Contrast Segmented Navigation Tabs: 2 Primary Tabs (Tracks & Themes) */}
            <div className="px-5 pt-2 pb-2 relative z-10">
              <div className="grid grid-cols-2 p-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('tracks');
                  }}
                  className={`py-2 px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'tracks'
                      ? 'liquid-glass-pill text-neutral-950 font-bold'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Tracks</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      activeTab === 'tracks'
                        ? 'bg-neutral-950/15 text-neutral-950'
                        : 'bg-white/15 text-white/90'
                    }`}
                  >
                    {trackCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('themes');
                  }}
                  className={`py-2 px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'themes'
                      ? 'liquid-glass-pill text-neutral-950 font-bold'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Themes</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      activeTab === 'themes'
                        ? 'bg-neutral-950/15 text-neutral-950'
                        : 'bg-white/15 text-white/90'
                    }`}
                  >
                    {VIEW_CATALOG.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Scrollable Content Deck */}
            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2 relative z-10">
              {/* TAB 1: TRACKS (MERGED PLAYLIST DROPDOWN + TRACKS LIST) */}
              {activeTab === 'tracks' && (
                <div className="space-y-2.5 pb-4">
                  {/* Playlist Selector Dropdown Bar */}
                  <div className="relative z-30" ref={playlistDropdownRef}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setIsPlaylistDropdownOpen((prev) => !prev);
                        }}
                        className="flex-1 min-w-0 p-2 sm:p-2.5 rounded-2xl liquid-glass-interactive flex items-center justify-between text-left cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 transition-transform shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_0_14px_rgba(16,185,129,0.25)]">
                            <Disc3 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9.5px] font-mono uppercase tracking-wider text-white/60 font-semibold">
                                PLAYLIST
                              </span>
                              <span className="text-[9.5px] text-white/40 font-sans">
                                • {playlists.length}
                              </span>
                            </div>
                            <div className="text-xs sm:text-[13px] font-bold text-white tracking-tight truncate leading-tight mt-0.5">
                              {activePlaylist?.title || 'Select a playlist'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                            {trackCount} {trackCount === 1 ? 'disc' : 'discs'}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-white/60 transition-transform duration-200 ${
                              isPlaylistDropdownOpen ? 'rotate-180 text-white' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Quick Rename Current Playlist */}
                      {activePlaylist && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setActiveTitleDraft(activePlaylist.title);
                            setIsEditingActiveTitle(true);
                          }}
                          title="Rename playlist"
                          className="w-8.5 h-8.5 rounded-xl liquid-glass-interactive flex items-center justify-center text-white/70 hover:text-emerald-300 cursor-pointer shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Quick Create New Playlist */}
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          triggerCreatePlaylist?.();
                        }}
                        title="Create new playlist"
                        className="w-8.5 h-8.5 rounded-xl liquid-glass-interactive flex items-center justify-center text-white/70 hover:text-white cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Dropdown Menu Popup Overlay */}
                    <AnimatePresence>
                      {isPlaylistDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 right-0 top-full mt-2 rounded-2xl p-2.5 flex flex-col gap-2 z-50 text-white font-sans border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.75),inset_0_1px_2px_rgba(255,255,255,0.35)]"
                          style={{
                            background: 'linear-gradient(160deg, rgba(24, 29, 44, 0.94) 0%, rgba(11, 14, 24, 0.98) 100%)',
                            backdropFilter: 'blur(48px) saturate(200%)',
                            WebkitBackdropFilter: 'blur(48px) saturate(200%)',
                          }}
                        >
                          {/* Dropdown Header */}
                          <div className="px-2 py-1 border-b border-white/10 flex items-center justify-between">
                            <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                              <Disc3 className="w-3.5 h-3.5 text-emerald-400" />
                              Select Playlist
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                sound.playClick();
                                setIsPlaylistDropdownOpen(false);
                                triggerCreatePlaylist?.();
                              }}
                              className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3 stroke-[2.5]" />
                              <span>New Playlist</span>
                            </button>
                          </div>

                          {/* Community Leaderboard Shortcut inside Dropdown */}
                          <button
                            type="button"
                            onClick={() => {
                              sound.playClick();
                              setIsPlaylistDropdownOpen(false);
                              onClose();
                              onOpenCommunityLeaderboard?.();
                            }}
                            className="w-full p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent hover:from-amber-500/30 border border-amber-400/35 flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-amber-500/25 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                                <Trophy className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                                  <span>Community Leaderboard</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/40 font-bold uppercase">
                                    Ranked
                                  </span>
                                </div>
                                <div className="text-[10px] text-white/70 truncate mt-0.5">Explore most saved playlists</div>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                          </button>

                          {/* Playlists List inside Dropdown */}
                          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
                            {playlists.map((pl) => {
                              const isActive = pl.id === activePlaylist?.id;
                              const isEditingThis = editingPlaylistId === pl.id;

                              return (
                                <div
                                  key={pl.id}
                                  className={`w-full p-2 rounded-xl transition-all border ${
                                    isActive
                                      ? 'bg-white/[0.18] border-emerald-400/50 text-white shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.4),0_0_16px_rgba(16,185,129,0.2)]'
                                      : 'bg-white/[0.05] hover:bg-white/[0.12] border-white/10 hover:border-white/20 text-white/90'
                                  }`}
                                >
                                  {isEditingThis ? (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        if (editingPlaylistTitle.trim() && onRenamePlaylist) {
                                          sound.playClick();
                                          onRenamePlaylist(pl.id, editingPlaylistTitle.trim());
                                        }
                                        setEditingPlaylistId(null);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-2 w-full py-0.5"
                                    >
                                      <input
                                        type="text"
                                        autoFocus
                                        value={editingPlaylistTitle}
                                        onChange={(e) => setEditingPlaylistTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') setEditingPlaylistId(null);
                                        }}
                                        placeholder="Playlist name..."
                                        className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-white/15 border border-emerald-400/60 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                                      />
                                      <button
                                        type="submit"
                                        disabled={!editingPlaylistTitle.trim()}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                                      >
                                        <Check className="w-3 h-3 stroke-[2.5]" />
                                        <span>Save</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingPlaylistId(null)}
                                        className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 cursor-pointer shrink-0 border border-white/10"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </form>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          sound.playDiscSpin();
                                          onSelectPlaylist(pl.id);
                                          setIsPlaylistDropdownOpen(false);
                                        }}
                                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                                      >
                                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                                          <Disc3
                                            className={`w-3.5 h-3.5 ${
                                              isActive ? 'text-emerald-400' : 'text-white/60'
                                            }`}
                                          />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-semibold text-white truncate">
                                              {pl.title}
                                            </span>
                                            {isActive && (
                                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 text-[9px] font-bold tracking-wider uppercase shrink-0">
                                                Active
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10.5px] text-white/60 truncate mt-0.5">
                                            {pl.tracks.length} {pl.tracks.length === 1 ? 'track' : 'tracks'} • {pl.category || 'Collection'}
                                          </div>
                                        </div>
                                      </button>

                                      <div className="flex items-center gap-0.5 shrink-0 ml-1.5">
                                        {/* Rename */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            sound.playClick();
                                            setEditingPlaylistId(pl.id);
                                            setEditingPlaylistTitle(pl.title);
                                          }}
                                          title="Rename playlist"
                                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>

                                        {/* Publish */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            sound.playClick();
                                            setIsPlaylistDropdownOpen(false);
                                            onClose();
                                            onOpenCommunityLeaderboard?.(pl.id);
                                          }}
                                          title="Publish to leaderboard"
                                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
                                        >
                                          <Globe2 className="w-3 h-3" />
                                        </button>

                                        {/* Delete */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            sound.playClick();
                                            onDeletePlaylist(pl.id);
                                          }}
                                          title="Delete playlist"
                                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Secondary Toolbar: Add & Share */}
                  <div className="flex items-center justify-between pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onClose();
                        onOpenSearch?.();
                      }}
                      className="py-1.5 px-3.5 rounded-full liquid-glass-interactive text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5]" />
                      <span>Add Song</span>
                    </button>

                    {activePlaylist && (
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          triggerSharePlaylist?.();
                        }}
                        className="py-1.5 px-3.5 rounded-full liquid-glass-interactive text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1.5 cursor-pointer"
                        title="Share playlist link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                    )}
                  </div>

                  {(!activePlaylist || activePlaylist.tracks.length === 0) && (
                    <div className="py-14 text-center">
                      <div className="w-12 h-12 rounded-2xl liquid-glass-card flex items-center justify-center mx-auto text-white/60 mb-3">
                        <Music className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-semibold text-white">Playlist is Empty</h4>
                      <p className="text-xs text-white/60 mt-1 max-w-[240px] mx-auto">
                        Search songs or tap the Charts button to press your first tracks.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onClose();
                          onOpenSearch?.();
                        }}
                        className="mt-3.5 py-2 px-5 rounded-full liquid-glass-pill text-neutral-950 font-bold text-xs transition-all active:scale-95 cursor-pointer"
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
                          className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-2xl transition-all border ${
                            isActive
                              ? 'liquid-glass-active text-white'
                              : 'liquid-glass-interactive text-white/90'
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
                            <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/20 shadow-sm bg-neutral-950">
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

                            {/* Track Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono tabular-nums text-white/60 font-medium">
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <div className="text-xs font-semibold text-white tracking-tight truncate">
                                  {track.title}
                                </div>
                              </div>
                              <div className="text-xs text-white/70 truncate mt-0.5 font-medium">
                                {track.artist}
                              </div>
                            </div>
                          </button>

                          {/* Right Controls: Duration, Play & ALWAYS-VISIBLE Remove Button */}
                          <div className="flex items-center gap-1 shrink-0">
                            {durationStr && (
                              <span className="text-xs font-mono tabular-nums text-white/60 mr-1 font-medium">
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
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:text-red-300 hover:bg-red-500/20 active:scale-90 transition-all cursor-pointer touch-target-sm"
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
                                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: THEMES / VISUAL VIEWS (13 CREATIVE NAMES) */}
              {activeTab === 'themes' && (
                <div className="space-y-2 pb-4">
                  <div className="text-xs font-medium text-white/70 px-0.5">
                    Choose a signature aesthetic player console:
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
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
                          className={`p-3 rounded-2xl text-left border transition-all active:scale-[0.98] flex flex-col justify-between gap-3 relative overflow-hidden group cursor-pointer ${
                            isActive
                              ? 'liquid-glass-active text-white'
                              : 'liquid-glass-interactive text-white/90'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full relative z-10">
                            {/* Visual Preview Swatch */}
                            <div
                              className={`w-7 h-7 rounded-xl bg-gradient-to-br ${gradientClass} border border-white/30 shadow-sm`}
                            />

                            <div className="flex items-center gap-1">
                              {isActive ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 text-[9px] font-bold tracking-wider uppercase flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                  Active
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono uppercase tracking-wider text-white/70 px-1.5 py-0.5 rounded-full bg-white/10 border border-white/15 font-medium">
                                  {item.badge || idx + 1}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="relative z-10">
                            <div className="text-xs font-bold text-white tracking-tight truncate leading-tight">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-white/70 truncate mt-0.5 font-medium">
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
            <div
              className="px-5 py-3.5 border-t border-white/[0.14] space-y-2 relative z-10"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
              }}
            >
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={toggleSfx}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all active:scale-95 cursor-pointer ${
                    sfxEnabled
                      ? 'liquid-glass-active text-white'
                      : 'liquid-glass-interactive text-white/60'
                  }`}
                >
                  {sfxEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-white/50" />
                  )}
                  <span>Clicks {sfxEnabled ? 'On' : 'Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onToggleMiniVideo();
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all active:scale-95 cursor-pointer ${
                    showMiniVideo
                      ? 'liquid-glass-pill text-neutral-950 font-bold'
                      : 'liquid-glass-interactive text-white/80 hover:text-white'
                  }`}
                >
                  <Tv className="w-4 h-4" />
                  <span>Video {showMiniVideo ? 'On' : 'Off'}</span>
                </button>
              </div>

              {/* Analog Warmth & Sleep Timer Row */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Vinyl Crackle */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playSwitch();
                    const next =
                      vinylCrackleLevel === 'off'
                        ? 'subtle'
                        : vinylCrackleLevel === 'subtle'
                        ? 'warm'
                        : 'off';
                    onChangeVinylCrackle?.(next);
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold flex items-center justify-between border transition-all active:scale-95 cursor-pointer ${
                    vinylCrackleLevel && vinylCrackleLevel !== 'off'
                      ? 'liquid-glass-active text-amber-200 border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                      : 'liquid-glass-interactive text-white/70 hover:text-white'
                  }`}
                  title="Cycle Vinyl Crackle: Off / Subtle / Warm"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Disc3
                      className={`w-3.5 h-3.5 shrink-0 ${
                        vinylCrackleLevel !== 'off' ? 'text-amber-400 animate-spin' : ''
                      }`}
                    />
                    <span className="truncate">Crackle</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white shrink-0">
                    {vinylCrackleLevel || 'off'}
                  </span>
                </button>

                {/* Sleep Timer */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    const nextMinutes =
                      !sleepTimerMinutes
                        ? 15
                        : sleepTimerMinutes === 15
                        ? 30
                        : sleepTimerMinutes === 30
                        ? 45
                        : sleepTimerMinutes === 45
                        ? 60
                        : null;
                    onSetSleepTimer?.(nextMinutes);
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold flex items-center justify-between border transition-all active:scale-95 cursor-pointer ${
                    sleepTimerRemaining
                      ? 'liquid-glass-active text-indigo-200 border-indigo-400/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                      : 'liquid-glass-interactive text-white/70 hover:text-white'
                  }`}
                  title="Cycle Sleep Timer: Off / 15m / 30m / 45m / 60m"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Moon className="w-3.5 h-3.5 shrink-0 text-indigo-300" />
                    <span className="truncate">Sleep</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white shrink-0">
                    {sleepTimerRemaining || (sleepTimerMinutes ? `${sleepTimerMinutes}m` : 'Off')}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-white/60 pt-1 font-medium">
                <span>V Themes • Space Play</span>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onOpenShortcuts?.();
                  }}
                  className="hover:text-white underline underline-offset-2 cursor-pointer flex items-center gap-1"
                >
                  <Keyboard className="w-3 h-3" />
                  <span>? Shortcuts</span>
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
