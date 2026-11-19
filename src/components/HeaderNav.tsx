import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize2,
  Minimize2,
  Search,
  ListMusic,
  Disc3,
  Check,
  FolderPlus,
  TrendingUp,
  User,
  Trophy,
} from 'lucide-react';
import { sound } from '../utils/soundEffects';
import { useViewportMode } from '../hooks/useViewportMode';
import { Playlist } from '../types';
import { UserProfile } from '../services/cloudSync';
import { CommunityLeaderboardDropdown } from './CommunityLeaderboardDropdown';

interface HeaderNavProps {
  isMenuOpen: boolean;
  isSyncedYouTube: boolean;
  isDark?: boolean;
  isFullscreen?: boolean;
  isHudHidden?: boolean;
  playlists?: Playlist[];
  activePlaylistId?: string;
  user?: UserProfile | null;
  onToggleFullscreen: () => void;
  onToggleMenu: () => void;
  onOpenSearch: () => void;
  onOpenAuthModal?: () => void;
  onSelectPlaylist?: (playlistId: string) => void;
  onCreatePlaylist?: (title: string) => void;
  onOpenCharts?: () => void;
  onOpenCommunityLeaderboard?: () => void;
  isCommunityLeaderboardOpen?: boolean;
  onCloseCommunityLeaderboard?: () => void;
  onImportCommunityPlaylist?: (playlist: Playlist) => void;
  onPlayCommunityPlaylist?: (playlist: Playlist) => void;
  initialPublishCrateId?: string;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  isMenuOpen,
  isSyncedYouTube,
  isDark = false,
  isFullscreen = false,
  isHudHidden = false,
  playlists = [],
  activePlaylistId,
  user,
  onToggleFullscreen,
  onToggleMenu,
  onOpenSearch,
  onOpenAuthModal,
  onSelectPlaylist,
  onCreatePlaylist,
  onOpenCharts,
  onOpenCommunityLeaderboard,
  isCommunityLeaderboardOpen = false,
  onCloseCommunityLeaderboard,
  onImportCommunityPlaylist,
  onPlayCommunityPlaylist,
  initialPublishCrateId,
}) => {
  const { isIOS } = useViewportMode();
  const [isPlaylistDropdownOpen, setIsPlaylistDropdownOpen] = useState(false);
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const leaderboardRef = useRef<HTMLDivElement | null>(null);

  const lineColor = isDark && !isMenuOpen ? 'bg-white' : 'bg-neutral-900';
  const iconColor =
    isDark && !isMenuOpen
      ? 'text-white/85 hover:text-white'
      : 'text-neutral-900/80 hover:text-neutral-900';
  const hoverBg = isDark && !isMenuOpen ? 'hover:bg-white/10' : 'hover:bg-black/[0.06]';

  // Close dropdown on click outside or escape key
  useEffect(() => {
    if (!isPlaylistDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsPlaylistDropdownOpen(false);
        setIsCreatingInline(false);
        setNewPlaylistTitle('');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPlaylistDropdownOpen(false);
        setIsCreatingInline(false);
        setNewPlaylistTitle('');
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaylistDropdownOpen]);

  // Close community leaderboard dropdown on click outside or escape key
  useEffect(() => {
    if (!isCommunityLeaderboardOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (leaderboardRef.current && !leaderboardRef.current.contains(e.target as Node)) {
        onCloseCommunityLeaderboard?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseCommunityLeaderboard?.();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCommunityLeaderboardOpen, onCloseCommunityLeaderboard]);

  const handleSelectCrate = (plId: string) => {
    sound.playClick(1080, 0.015);
    onSelectPlaylist?.(plId);
    setIsPlaylistDropdownOpen(false);
    setIsCreatingInline(false);
    setNewPlaylistTitle('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim() || !onCreatePlaylist) return;
    sound.playClick(1280, 0.02);
    onCreatePlaylist(newPlaylistTitle.trim());
    setIsCreatingInline(false);
    setNewPlaylistTitle('');
    setIsPlaylistDropdownOpen(false);
  };

  return (
    <header
      className="w-full px-4 sm:px-8 pb-2 flex items-center justify-end relative z-50 pointer-events-none app-drag-region"
      style={{ paddingTop: 'max(0.85rem, env(safe-area-inset-top, 0px))' }}
    >
      <div
        className={`flex items-center gap-1.5 no-drag transition-opacity duration-500 relative ${
          isHudHidden ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
      >
        {/* 1. Search & Add Song Trigger (Shifted to First Place) */}
        {!isMenuOpen && (
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setIsPlaylistDropdownOpen(false);
              onOpenSearch();
            }}
            aria-label="Search and add songs"
            title="Search & Add Songs (/ or S)"
            className={`touch-target w-9 h-9 rounded-full flex items-center justify-center ${iconColor} ${hoverBg} active:scale-90 transition-all cursor-pointer`}
          >
            <Search className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}

        {/* 2. Playlist Switcher Icon & Dropdown (Next to Search Icon) */}
        {!isMenuOpen && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setIsPlaylistDropdownOpen((o) => !o);
              }}
              aria-label="Switch playlist"
              title="Playlists"
              className={`touch-target w-9 h-9 rounded-full flex items-center justify-center ${iconColor} ${
                isPlaylistDropdownOpen ? 'bg-black/15 dark:bg-white/20' : hoverBg
              } active:scale-90 transition-all cursor-pointer`}
            >
              <ListMusic className="w-4 h-4" strokeWidth={1.75} />
            </button>

            {/* Floating Quick Playlist Switcher Dropdown */}
            <AnimatePresence>
              {isPlaylistDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white/95 dark:bg-[#1a1a1d]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.35)] p-2.5 flex flex-col gap-1.5 z-50 text-neutral-900 dark:text-white"
                >
                  {/* Dropdown Header */}
                  <div className="px-2 py-1 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
                      <Disc3 className="w-3 h-3 text-neutral-500 animate-spin" />
                      Select Playlist
                    </span>
                    <span className="font-mono text-[9px] text-neutral-400 dark:text-neutral-500">
                      {playlists.length} available
                    </span>
                  </div>

                  {/* Playlists List */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                    {playlists.length === 0 ? (
                      <div className="py-4 px-2 text-center text-xs font-mono text-neutral-400">
                        No playlists found
                      </div>
                    ) : (
                      playlists.map((pl) => {
                        const isActive = pl.id === activePlaylistId;
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onClick={() => handleSelectCrate(pl.id)}
                            className={`w-full px-2.5 py-2 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer ${
                              isActive
                                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                                : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-800 dark:text-neutral-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isActive
                                    ? 'bg-white/20 dark:bg-black/20 text-white dark:text-neutral-900'
                                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-neutral-400'
                                }`}
                              >
                                <ListMusic className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-sans font-medium text-[13px] truncate leading-tight">
                                  {pl.title}
                                </h4>
                                <p
                                  className={`font-mono text-[10px] truncate mt-0.5 ${
                                    isActive
                                      ? 'text-white/70 dark:text-black/70'
                                      : 'text-neutral-400'
                                  }`}
                                >
                                  {pl.tracks.length} tracks • {pl.category}
                                </p>
                              </div>
                            </div>

                            {isActive && (
                              <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/20 dark:bg-black/20 font-bold shrink-0 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Inline Create Form or Quick Actions */}
                  {isCreatingInline ? (
                    <form
                      onSubmit={handleCreateSubmit}
                      className="p-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 flex flex-col gap-1.5 mt-1"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={newPlaylistTitle}
                        onChange={(e) => setNewPlaylistTitle(e.target.value)}
                        placeholder="New playlist title…"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-black/40 border border-black/15 dark:border-white/15 text-[12px] focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingInline(false);
                            setNewPlaylistTitle('');
                          }}
                          className="px-2 py-0.5 text-[10px] font-mono text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!newPlaylistTitle.trim()}
                          className="px-2.5 py-1 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-mono text-[10px] font-medium disabled:opacity-40"
                        >
                          Create
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="pt-1 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsCreatingInline(true)}
                        className="flex-1 py-1.5 px-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white text-neutral-700 dark:text-neutral-200 text-[10.5px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>+ New Playlist</span>
                      </button>

                      {onOpenCharts && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setIsPlaylistDropdownOpen(false);
                            onOpenCharts();
                          }}
                          className="py-1.5 px-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[10.5px] font-mono uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                          title="Open YouTube Music Live Charts"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Charts</span>
                        </button>
                      )}

                      {onOpenCommunityLeaderboard && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setIsPlaylistDropdownOpen(false);
                            onOpenCommunityLeaderboard();
                          }}
                          className="py-1.5 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10.5px] font-mono uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                          title="Open Community Leaderboard (Most Saved Playlists)"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          <span>Leaderboard</span>
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 3. Community Playlists Leaderboard Trigger & Anchored Dropdown Below Rank Button */}
        {!isMenuOpen && (
          <div className="relative" ref={leaderboardRef}>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setIsPlaylistDropdownOpen(false);
                if (isCommunityLeaderboardOpen) {
                  onCloseCommunityLeaderboard?.();
                } else {
                  onOpenCommunityLeaderboard?.();
                }
              }}
              aria-label="Community Playlists Leaderboard"
              title="Community Leaderboard — Most Saved Playlists"
              className={`touch-target w-9 h-9 rounded-full flex items-center justify-center ${
                isCommunityLeaderboardOpen
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                  : `${iconColor} ${hoverBg}`
              } active:scale-90 transition-all cursor-pointer`}
            >
              <Trophy className="w-4 h-4" strokeWidth={1.75} />
            </button>

            {/* Anchored Community Leaderboard Dropdown */}
            <AnimatePresence>
              {isCommunityLeaderboardOpen && (
                <CommunityLeaderboardDropdown
                  isOpen={isCommunityLeaderboardOpen}
                  userPlaylists={playlists}
                  activePlaylistId={activePlaylistId}
                  initialPublishCrateId={initialPublishCrateId}
                  user={user}
                  onClose={() => onCloseCommunityLeaderboard?.()}
                  onImportCommunityPlaylist={(pl) => {
                    onImportCommunityPlaylist?.(pl);
                  }}
                  onPlayCommunityPlaylist={(pl) => {
                    onPlayCommunityPlaylist?.(pl);
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 4. User Google Account & Cloud Sync Trigger */}
        {!isMenuOpen && (
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setIsPlaylistDropdownOpen(false);
              onOpenAuthModal?.();
            }}
            aria-label={user ? `Account: ${user.name}` : 'Sign in with Google'}
            title={
              user
                ? `${user.name} (${user.email}) — Cloud Backup Active`
                : 'Sign in with Google — Keep Playlists Synced'
            }
            className={`touch-target relative w-9 h-9 rounded-full flex items-center justify-center ${hoverBg} active:scale-90 transition-all cursor-pointer`}
          >
            {user?.avatarUrl ? (
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-black/15 dark:border-white/20 shadow-sm">
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
              </div>
            ) : (
              <User className={`w-4 h-4 ${iconColor}`} strokeWidth={1.75} />
            )}
          </button>
        )}

        {/* 4. True Borderless Fullscreen Toggle */}
        {!isMenuOpen && !isIOS && (
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setIsPlaylistDropdownOpen(false);
              onToggleFullscreen();
            }}
            aria-label={isFullscreen ? 'Exit borderless fullscreen' : 'Enter borderless fullscreen'}
            title={isFullscreen ? 'Exit Fullscreen (F / Esc)' : 'Borderless Fullscreen (F)'}
            className={`touch-target w-9 h-9 rounded-full flex items-center justify-center ${iconColor} ${hoverBg} active:scale-90 transition-all cursor-pointer`}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>
        )}

        {/* 4. Minimal Hamburger Menu Trigger */}
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setIsPlaylistDropdownOpen(false);
            onToggleMenu();
          }}
          aria-label="Open menu"
          title="Menu — Player Views, Playlists & YouTube Sync"
          className={`touch-target relative w-9 h-9 rounded-full flex flex-col items-center justify-center gap-[4.5px] ${hoverBg} active:scale-90 transition-all cursor-pointer`}
        >
          <span
            className={`block w-[18px] h-[1.5px] ${lineColor} rounded-full transition-all duration-200 ${
              isMenuOpen ? 'translate-y-[3px] rotate-45' : ''
            }`}
          />
          <span
            className={`block w-[18px] h-[1.5px] ${lineColor} rounded-full transition-all duration-200 ${
              isMenuOpen ? '-translate-y-[3px] -rotate-45' : ''
            }`}
          />
          {isSyncedYouTube && !isMenuOpen && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
      </div>
    </header>
  );
};
