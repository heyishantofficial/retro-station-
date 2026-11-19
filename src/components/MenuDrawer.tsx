import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Disc3, Play, Volume2, VolumeX, Tv, Trash2, Plus, Search, Share2, FolderPlus } from 'lucide-react';
import { Playlist, Track } from '../types';
import { YouTubeIcon } from './YouTubeIcon';
import { sound } from '../utils/soundEffects';
import { VIEW_CATALOG, PlayerViewMode } from '../utils/viewCatalog';

export type { PlayerViewMode };

interface MenuDrawerProps {
  isOpen: boolean;
  viewMode: PlayerViewMode;
  playlists: Playlist[];
  activePlaylist: Playlist | null;
  activeTrackIndex: number;
  isPlaying: boolean;
  showMiniVideo: boolean;
  onClose: () => void;
  onChangeViewMode: (mode: PlayerViewMode) => void;
  onSelectPlaylist: (id: string) => void;
  onDeletePlaylist: (id: string) => void;
  onSelectTrack: (index: number) => void;
  onDeleteTrack?: (index: number) => void;
  onOpenSyncModal: () => void;
  onOpenSearch?: () => void;
  onCreateNewCrate?: () => void;
  onShareCrate?: () => void;
  onToggleMiniVideo: () => void;
}

const VIEW_SWATCH: Record<PlayerViewMode, string> = {
  arc: 'bg-[#ececeb] border-black/15',
  vinyl: 'bg-[#f8f8f7] border-[#a83838]/40',
  chrome: 'bg-gradient-to-br from-neutral-300 via-black to-neutral-500 border-white/25',
  crt: 'bg-gradient-to-br from-[#ff5a3c] to-[#ff8b80] border-black/20',
  sleeve: 'bg-gradient-to-br from-[#362c20] to-[#d94524] border-white/15',
  braun: 'bg-[#e6e6e4] border-black/20',
  cassette: 'bg-gradient-to-br from-[#c80d3a] to-[#1a191b] border-yellow-300/50',
  pixel: 'bg-gradient-to-br from-[#2c3f52] via-[#c79c5a] to-[#f8e6b8] border-[#f3d99b]',
  atlas: 'bg-gradient-to-br from-[#d9cbb2] via-[#8c7455] to-[#2e261d] border-[#e5c98a]',
  ember: 'bg-gradient-to-br from-[#ff7a18] via-[#4a4d52] to-[#0b0a0a] border-orange-400/60',
  chroma: 'bg-gradient-to-br from-[#d9211b] via-[#8a110e] to-[#111111] border-white/30',
  binder: 'bg-gradient-to-br from-[#f7b2e8] via-[#2b2333] to-[#0d0d10] border-[#f7b2e8]/60',
  glam: 'bg-gradient-to-br from-[#ffd4ea] via-[#d288a8] to-[#7a3c58] border-[#ffe0f0]/70',
};

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  viewMode,
  playlists,
  activePlaylist,
  activeTrackIndex,
  isPlaying,
  showMiniVideo,
  onClose,
  onChangeViewMode,
  onSelectPlaylist,
  onDeletePlaylist,
  onSelectTrack,
  onDeleteTrack,
  onOpenSyncModal,
  onOpenSearch,
  onCreateNewCrate,
  onShareCrate,
  onToggleMiniVideo,
}) => {
  const [activeTab, setActiveTab] = useState<'views' | 'tracks' | 'playlists'>('views');
  const [sfxEnabled, setSfxEnabled] = useState(sound.enabled);

  const toggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    sound.enabled = next;
    if (next) sound.playClick(1000, 0.02);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Click-outside light scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/15"
          />

          {/* Spatial Right-Edge Frosted Menu Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed right-0 top-0 bottom-0 h-[100dvh] w-full max-w-xs sm:max-w-[360px] z-50 bg-[#f2f2f0]/95 text-[#111111] backdrop-blur-2xl border-l border-black/10 shadow-[-16px_0_48px_rgba(0,0,0,0.18)] flex flex-col pb-safe"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3.5 border-b border-black/10 flex items-center justify-between">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-neutral-500 flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-emerald-500' : 'bg-neutral-400'
                      }`}
                  />
                  <span>{isPlaying ? 'SPINNING' : 'STANDBY'}</span>
                  <span>•</span>
                  <span>{activePlaylist?.tracks.length ?? 0} DISCS</span>
                </div>
                <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-neutral-900 mt-0.5 truncate max-w-[235px]">
                  {activePlaylist?.title || 'No Playlist Synced'}
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

            {/* Quick Action Buttons: Search Songs · New Crate · Sync YouTube */}
            <div className="px-5 py-3 border-b border-black/10 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    sound.playClick();
                    onClose();
                    onOpenSearch?.();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-medium tracking-wide flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-sm"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search Songs</span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    onCreateNewCrate?.();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 border border-black/15 text-[11px] font-medium tracking-wide flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-sm"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-neutral-600" />
                  <span>New Crate</span>
                </button>
              </div>

              <button
                onClick={() => {
                  sound.playClick();
                  onClose();
                  onOpenSyncModal();
                }}
                className="w-full py-2 px-3 rounded-xl bg-black/[0.04] hover:bg-black/[0.07] text-neutral-700 text-[10.5px] font-medium tracking-wide flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2">
                  <YouTubeIcon className="w-3.5 h-3.5 text-red-500" />
                  <span>Sync YouTube Playlist Link</span>
                </span>
                <Plus className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            </div>

            {/* 3-Tab Segmented Switcher: Views / Tracks / Playlists */}
            <div className="px-5 pt-3 pb-2">
              <div className="grid grid-cols-3 p-1 rounded-xl bg-black/[0.05] text-[9.5px] font-mono uppercase tracking-[0.14em]">
                <button
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('views');
                  }}
                  className={`py-1.5 rounded-lg transition-all ${activeTab === 'views'
                    ? 'bg-white text-neutral-950 shadow-sm font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                >
                  Views ({VIEW_CATALOG.length})
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('tracks');
                  }}
                  className={`py-1.5 rounded-lg transition-all ${activeTab === 'tracks'
                    ? 'bg-white text-neutral-950 shadow-sm font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                >
                  Tracks
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('playlists');
                  }}
                  className={`py-1.5 rounded-lg transition-all ${activeTab === 'playlists'
                    ? 'bg-white text-neutral-950 shadow-sm font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                >
                  Playlists
                </button>
              </div>
            </div>

            {/* Scrollable Tab Body */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {activeTab === 'views' ? (
                <div className="grid grid-cols-2 gap-2 pb-2">
                  {VIEW_CATALOG.map((item, idx) => {
                    const isActive = item.id === viewMode;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          sound.playSwitch();
                          onChangeViewMode(item.id);
                        }}
                        className={`p-2.5 rounded-xl text-left border transition-all active:scale-[0.97] flex flex-col justify-between gap-2 ${isActive
                          ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                          : 'bg-white/80 border-black/10 text-neutral-800 hover:bg-white'
                          }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`w-4 h-4 rounded-full border ${VIEW_SWATCH[item.id]}`}
                          />
                          <span
                            className={`font-mono text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest ${isActive
                              ? 'bg-white/15 text-white'
                              : 'bg-black/[0.05] text-neutral-500'
                              }`}
                          >
                            {item.badge || idx + 1}
                          </span>
                        </div>
                        <div>
                          <div className="text-[11.5px] font-semibold leading-tight truncate">
                            {item.name}
                          </div>
                          <div
                            className={`font-mono text-[8.5px] uppercase tracking-wider mt-0.5 truncate ${isActive ? 'text-neutral-400' : 'text-neutral-500'
                              }`}
                          >
                            {item.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : activeTab === 'tracks' ? (
                <div className="space-y-2">
                  {/* Tracks Sub-Actions */}
                  <div className="flex items-center gap-1.5 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onClose();
                        onOpenSearch?.();
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-black/[0.05] hover:bg-black/[0.09] text-[10.5px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3 h-3 text-neutral-600" />
                      <span>Add Song</span>
                    </button>

                    {activePlaylist && (
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onShareCrate?.();
                        }}
                        className="py-1.5 px-2.5 rounded-lg bg-black/[0.05] hover:bg-black/[0.09] text-[10.5px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                        title="Share this crate via link"
                      >
                        <Share2 className="w-3 h-3 text-neutral-600" />
                        <span>Share</span>
                      </button>
                    )}
                  </div>

                  {(!activePlaylist || activePlaylist.tracks.length === 0) && (
                    <div className="py-10 text-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-400">
                      Crate is empty. Search songs above to press discs.
                    </div>
                  )}

                  <div className="space-y-1">
                    {(activePlaylist?.tracks ?? []).map((track: Track, idx: number) => {
                      const active = idx === activeTrackIndex;
                      const thumbSrc = track.youtubeId
                        ? `https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`
                        : track.coverUrl;
                      return (
                        <div
                          key={track.id}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all group ${active
                            ? 'bg-neutral-900 text-white shadow-sm'
                            : 'hover:bg-black/[0.045] text-neutral-800'
                            }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              sound.playDiscSpin();
                              onSelectTrack(idx);
                            }}
                            className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                          >
                            <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 border border-black/15 shadow-sm bg-neutral-800">
                              <img
                                src={thumbSrc}
                                alt={track.title}
                                className={`w-full h-full object-cover scale-[1.08] ${active && isPlaying ? 'animate-spin-slow' : ''
                                  }`}
                              />
                              <div
                                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white/50 ${active ? 'bg-neutral-900' : 'bg-[#f2f2f0]'
                                  }`}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] tabular-nums text-neutral-400">
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <div className="font-serif text-[13px] font-semibold uppercase tracking-wide truncate">
                                  {track.title}
                                </div>
                              </div>
                              <div
                                className={`text-[10.5px] truncate ${active ? 'text-neutral-300' : 'text-neutral-500'
                                  }`}
                              >
                                {track.artist}
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            {onDeleteTrack && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sound.playClick();
                                  onDeleteTrack(idx);
                                }}
                                title="Remove track from crate"
                                className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                                  active
                                    ? 'hover:bg-white/15 text-neutral-300 hover:text-red-300'
                                    : 'hover:bg-black/5 text-neutral-400 hover:text-red-500'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <div className="shrink-0 w-4 flex justify-center">
                              {active ? (
                                <Disc3
                                  className={`w-3.5 h-3.5 text-white ${isPlaying ? 'animate-spin' : 'opacity-60'
                                    }`}
                                />
                              ) : (
                                <Play className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Playlists Sub-Actions */}
                  <div className="flex items-center gap-1.5 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onCreateNewCrate?.();
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-black/[0.05] hover:bg-black/[0.09] text-[10.5px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3 h-3 text-neutral-600" />
                      <span>New Crate</span>
                    </button>
                    {activePlaylist && (
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onShareCrate?.();
                        }}
                        className="py-1.5 px-2.5 rounded-lg bg-black/[0.05] hover:bg-black/[0.09] text-[10.5px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                        title="Share active crate link"
                      >
                        <Share2 className="w-3 h-3 text-neutral-600" />
                        <span>Share</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {playlists.length === 0 && (
                      <div className="py-10 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                        No playlists yet
                      </div>
                    )}
                    {playlists.map((pl) => {
                      const isActive = pl.id === activePlaylist?.id;
                      return (
                        <div
                          key={pl.id}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${isActive
                            ? 'bg-neutral-900 text-white'
                            : 'hover:bg-black/[0.045] text-neutral-800'
                            }`}
                        >
                          <button
                            onClick={() => {
                              sound.playDiscSpin();
                              onSelectPlaylist(pl.id);
                              setActiveTab('tracks');
                            }}
                            className="flex-1 text-left min-w-0 pr-2"
                          >
                            <div className="text-[12px] font-medium truncate">{pl.title}</div>
                            <div
                              className={`text-[9.5px] font-mono uppercase tracking-wider mt-0.5 ${isActive ? 'text-neutral-400' : 'text-neutral-500'
                                }`}
                            >
                              {pl.tracks.length} discs • {pl.category}
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sound.playClick();
                                onDeletePlaylist(pl.id);
                              }}
                              title="Remove playlist"
                              className={`p-1.5 rounded-lg transition-colors ${isActive
                                ? 'text-neutral-400 hover:text-red-400 hover:bg-white/10'
                                : 'text-neutral-400 hover:text-red-600 hover:bg-black/5'
                                }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {isActive && (
                              <Disc3
                                className={`w-3.5 h-3.5 ${isPlaying ? 'animate-spin' : 'opacity-60'}`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Controls */}
            <div className="px-5 py-3.5 border-t border-black/10 space-y-2.5 bg-black/[0.02]">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={toggleSfx}
                  className={`py-2 px-3 rounded-xl text-[10.5px] font-medium flex items-center justify-center gap-1.5 border transition-all active:scale-95 ${sfxEnabled
                    ? 'bg-white border-black/15 text-neutral-900'
                    : 'bg-transparent border-black/10 text-neutral-500'
                    }`}
                >
                  {sfxEnabled ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                  <span>Clicks {sfxEnabled ? 'On' : 'Off'}</span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    onToggleMiniVideo();
                  }}
                  className={`py-2 px-3 rounded-xl text-[10.5px] font-medium flex items-center justify-center gap-1.5 border transition-all active:scale-95 ${showMiniVideo
                    ? 'bg-neutral-900 border-neutral-900 text-white'
                    : 'bg-white border-black/15 text-neutral-800'
                    }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Video {showMiniVideo ? 'On' : 'Off'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.16em] text-neutral-400 pt-0.5">
                <span>V CYCLE VIEW • 1-0 JUMP</span>
                <span>SPACE PLAY</span>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
