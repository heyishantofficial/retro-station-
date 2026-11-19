import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Plus,
  Check,
  Disc3,
  Music2,
  ChevronDown,
  FolderPlus,
  ListMusic,
} from 'lucide-react';
import { searchSongs, SearchSongResult, POPULAR_HITS_CATALOG } from '../services/musicSearch';
import { Playlist } from '../types';
import { sound } from '../utils/soundEffects';

interface SongSearchModalProps {
  isOpen: boolean;
  playlists: Playlist[];
  activePlaylistId: string;
  onClose: () => void;
  onSelectPlaylist?: (id: string) => void;
  onAddSongToPlaylist: (result: SearchSongResult, playlistId: string) => void;
  onCreatePlaylist?: (title: string) => string;
}

const QUICK_TAGS = [
  'The Weeknd',
  'Arijit Singh',
  'Doja Cat',
  'Daft Punk',
  'Lofi Girl',
  'Dua Lipa',
  'Synthwave',
  'Mariya Takeuchi',
  'Diljit Dosanjh',
  'Billie Eilish',
];

export const SongSearchModal: React.FC<SongSearchModalProps> = ({
  isOpen,
  playlists,
  activePlaylistId,
  onClose,
  onSelectPlaylist,
  onAddSongToPlaylist,
  onCreatePlaylist,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchSongResult[]>(POPULAR_HITS_CATALOG.slice(0, 8));
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Record<string, string>>({});

  // Target Crate State
  const [targetId, setTargetId] = useState<string>(activePlaylistId);
  const [isHoverDropdownOpen, setIsHoverDropdownOpen] = useState(false);
  const [isCreatingNewCrate, setIsCreatingNewCrate] = useState(false);
  const [newCrateName, setNewCrateName] = useState('');

  // Per-song Add Button Hover Dropdown State
  const [hoveredSongDropdownId, setHoveredSongDropdownId] = useState<string | null>(null);
  const [inlineCreateName, setInlineCreateName] = useState('');
  const [inlineCreatingForSongId, setInlineCreatingForSongId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const songHoverTimeoutRef = useRef<number | null>(null);

  // Sync target ID when active playlist changes
  useEffect(() => {
    if (activePlaylistId) {
      setTargetId(activePlaylistId);
    }
  }, [activePlaylistId]);

  const activeCrate = playlists.find((p) => p.id === targetId) || playlists[0];

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      setQuery('');
      setResults(POPULAR_HITS_CATALOG.slice(0, 8));
      setIsHoverDropdownOpen(false);
      setIsCreatingNewCrate(false);
      setNewCrateName('');
      setHoveredSongDropdownId(null);
      setInlineCreatingForSongId(null);
      setInlineCreateName('');
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(POPULAR_HITS_CATALOG.slice(0, 8));
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchSongs(trimmed);
        setResults(res);
      } catch {
        // fallback
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, isOpen]);

  const handleMouseEnterCrateBadge = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHoverDropdownOpen(true);
  };

  const handleMouseLeaveCrateBadge = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHoverDropdownOpen(false);
      setIsCreatingNewCrate(false);
    }, 240);
  };

  const handleMouseEnterSongBtn = (songId: string) => {
    if (songHoverTimeoutRef.current) {
      window.clearTimeout(songHoverTimeoutRef.current);
      songHoverTimeoutRef.current = null;
    }
    setHoveredSongDropdownId(songId);
  };

  const handleMouseLeaveSongBtn = () => {
    songHoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredSongDropdownId(null);
      setInlineCreatingForSongId(null);
      setInlineCreateName('');
    }, 260);
  };

  const handleSelectCrate = (pl: Playlist) => {
    sound.playClick(1080, 0.015);
    setTargetId(pl.id);
    onSelectPlaylist?.(pl.id);
    setIsHoverDropdownOpen(false);
  };

  const handleCreateNewCrateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrateName.trim() || !onCreatePlaylist) return;
    sound.playClick(1280, 0.02);
    const createdId = onCreatePlaylist(newCrateName.trim());
    setTargetId(createdId);
    setIsCreatingNewCrate(false);
    setNewCrateName('');
    setIsHoverDropdownOpen(false);
  };

  const isSongInPlaylist = (song: SearchSongResult, pl: Playlist | undefined): boolean => {
    if (!pl) return false;
    return pl.tracks.some((t) => {
      const sameYt = Boolean(
        t.youtubeId &&
        song.youtubeId &&
        song.youtubeId.length === 11 &&
        t.youtubeId === song.youtubeId
      );
      const sameTitleArtist =
        t.title.trim().toLowerCase() === song.title.trim().toLowerCase() &&
        t.artist.trim().toLowerCase() === song.artist.trim().toLowerCase();
      return sameYt || sameTitleArtist;
    });
  };

  const handleAddSong = (song: SearchSongResult) => {
    sound.playClick(1160, 0.02);
    const destinationPl = activeCrate || playlists[0];
    if (!destinationPl) return;

    if (isSongInPlaylist(song, destinationPl)) {
      setAddedIds((prev) => ({ ...prev, [song.id]: `Already in ${destinationPl.title}` }));
      window.setTimeout(() => {
        setAddedIds((prev) => {
          const next = { ...prev };
          delete next[song.id];
          return next;
        });
      }, 2400);
      return;
    }

    onAddSongToPlaylist(song, destinationPl.id);
    setAddedIds((prev) => ({ ...prev, [song.id]: destinationPl.title }));
    window.setTimeout(() => {
      setAddedIds((prev) => {
        const next = { ...prev };
        delete next[song.id];
        return next;
      });
    }, 2400);
  };

  const handleAddSongToSpecificPlaylist = (song: SearchSongResult, playlist: Playlist) => {
    sound.playClick(1160, 0.02);

    if (isSongInPlaylist(song, playlist)) {
      setHoveredSongDropdownId(null);
      setAddedIds((prev) => ({ ...prev, [song.id]: `Already in ${playlist.title}` }));
      window.setTimeout(() => {
        setAddedIds((prev) => {
          const next = { ...prev };
          delete next[song.id];
          return next;
        });
      }, 2400);
      return;
    }

    onAddSongToPlaylist(song, playlist.id);
    setTargetId(playlist.id);
    onSelectPlaylist?.(playlist.id);
    setHoveredSongDropdownId(null);
    setAddedIds((prev) => ({ ...prev, [song.id]: playlist.title }));
    window.setTimeout(() => {
      setAddedIds((prev) => {
        const next = { ...prev };
        delete next[song.id];
        return next;
      });
    }, 2400);
  };

  const handleInlineCreateAndAdd = (e: React.FormEvent, song: SearchSongResult) => {
    e.preventDefault();
    if (!inlineCreateName.trim() || !onCreatePlaylist) return;
    sound.playClick(1280, 0.02);
    const createdId = onCreatePlaylist(inlineCreateName.trim());
    setTargetId(createdId);
    onAddSongToPlaylist(song, createdId);
    onSelectPlaylist?.(createdId);
    setAddedIds((prev) => ({ ...prev, [song.id]: inlineCreateName.trim() }));
    setHoveredSongDropdownId(null);
    setInlineCreatingForSongId(null);
    setInlineCreateName('');
    window.setTimeout(() => {
      setAddedIds((prev) => {
        const next = { ...prev };
        delete next[song.id];
        return next;
      });
    }, 2400);
  };

  const handleTagClick = (tag: string) => {
    sound.playClick();
    setQuery(tag);
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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
            className="absolute inset-0 bg-black/55 backdrop-blur-[6px]"
          />

          {/* Modal Sheet */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-xl max-h-[88dvh] rounded-3xl bg-[#f6f6f4]/95 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.35)] flex flex-col overflow-visible text-neutral-900 dark:text-neutral-100"
          >
            {/* Header with Search Input */}
            <div className="px-5 pt-5 pb-3 border-b border-black/[0.08] dark:border-white/[0.08] relative z-20">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center shadow">
                    <Music2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-serif text-base sm:text-lg font-semibold uppercase tracking-wide leading-none truncate">
                      Search & Press to Disc
                    </h2>

                    {/* HOVER DROPDOWN FOR TARGET CRATE / PLAYLIST */}
                    <div
                      className="relative inline-block mt-0.5"
                      onMouseEnter={handleMouseEnterCrateBadge}
                      onMouseLeave={handleMouseLeaveCrateBadge}
                    >
                      <button
                        type="button"
                        onClick={() => setIsHoverDropdownOpen((o) => !o)}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] text-[10.5px] font-mono text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                        title="Hover or click to switch target playlist"
                      >
                        <span className="text-neutral-400">Target Crate:</span>
                        <span className="font-semibold text-neutral-900 dark:text-white truncate max-w-[190px]">
                          {activeCrate?.title || 'Create a playlist'}
                        </span>
                        <ChevronDown
                          className={`w-3 h-3 text-neutral-400 transition-transform ${
                            isHoverDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {/* Dropdown Menu that opens on Hover */}
                      <AnimatePresence>
                        {isHoverDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.97 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 rounded-2xl bg-white/95 dark:bg-[#202020]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.25)] p-2.5 flex flex-col gap-1.5"
                          >
                            <div className="px-2 py-1 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                              <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                                Select Target Crate
                              </span>
                              <span className="font-mono text-[9px] text-neutral-400">
                                {playlists.length} available
                              </span>
                            </div>

                            {/* Create New Playlist option inside hover menu */}
                            {isCreatingNewCrate ? (
                              <form
                                onSubmit={handleCreateNewCrateSubmit}
                                className="p-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 flex flex-col gap-1.5"
                              >
                                <input
                                  type="text"
                                  autoFocus
                                  value={newCrateName}
                                  onChange={(e) => setNewCrateName(e.target.value)}
                                  placeholder="New playlist name…"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-black/40 border border-black/15 dark:border-white/15 text-[12px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
                                />
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setIsCreatingNewCrate(false)}
                                    className="px-2 py-0.5 text-[10px] font-mono text-neutral-500 hover:text-neutral-800"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={!newCrateName.trim()}
                                    className="px-2.5 py-1 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-mono text-[10px] font-medium disabled:opacity-40"
                                  >
                                    Create
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsCreatingNewCrate(true)}
                                className="w-full py-1.5 px-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white text-neutral-700 dark:text-neutral-200 text-[11px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                              >
                                <FolderPlus className="w-3.5 h-3.5" />
                                <span>+ Create New Playlist</span>
                              </button>
                            )}

                            {/* Playlists List */}
                            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                              {playlists.map((pl) => {
                                const isSelected = pl.id === targetId;
                                return (
                                  <button
                                    key={pl.id}
                                    type="button"
                                    onClick={() => handleSelectCrate(pl)}
                                    className={`w-full px-2.5 py-2 rounded-xl text-left transition-colors flex items-center justify-between ${
                                      isSelected
                                        ? 'bg-neutral-900 text-white font-medium'
                                        : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-neutral-800 dark:text-neutral-200'
                                    }`}
                                  >
                                    <div className="min-w-0 pr-2">
                                      <div className="text-[12px] truncate">{pl.title}</div>
                                      <div
                                        className={`font-mono text-[8.5px] truncate mt-0.5 ${
                                          isSelected ? 'text-neutral-300' : 'text-neutral-400'
                                        }`}
                                      >
                                        {pl.tracks.length} tracks • {pl.category}
                                      </div>
                                    </div>
                                    {isSelected ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                      <ListMusic className="w-3.5 h-3.5 text-neutral-400 shrink-0 opacity-40" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar Input */}
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search song title, artist, or paste any YouTube link…"
                  className="w-full h-11 pl-10 pr-9 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.08] text-[15px] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white/40 transition-all"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    className="absolute right-3 w-5 h-5 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Suggestion Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-0.5 select-none">
                <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 shrink-0">
                  Quick:
                </span>
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="shrink-0 px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] active:scale-95 text-[11px] font-sans text-neutral-600 dark:text-neutral-300 transition-all border border-black/[0.04] dark:border-white/[0.06]"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[260px] max-h-[52dvh] relative z-10">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-14 text-neutral-400">
                  <Disc3 className="w-7 h-7 animate-spin text-neutral-600 dark:text-neutral-300 mb-2" />
                  <span className="font-mono text-xs tracking-wider">Searching catalogue…</span>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
                  <Music2 className="w-8 h-8 stroke-1 mb-2 text-neutral-300 dark:text-neutral-600" />
                  <p className="font-serif text-base text-neutral-700 dark:text-neutral-300">No tracks found</p>
                  <p className="font-mono text-[11px] text-neutral-400 mt-1 max-w-xs">
                    Try searching an artist, song title, or paste a direct YouTube video link.
                  </p>
                </div>
              ) : (
                results.map((item) => {
                  return (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 p-2 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors border border-transparent hover:border-black/[0.04] dark:hover:border-white/[0.06]"
                    >
                      {/* Album Art Thumbnail */}
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-neutral-200 dark:bg-neutral-800 shadow-sm border border-black/5 dark:border-white/5">
                        <img
                          src={item.coverUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                      </div>

                      {/* Song Metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="font-sans font-medium text-[14px] text-neutral-900 dark:text-white truncate leading-snug">
                            {item.title}
                          </h4>
                          {item.isVerified ? (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-[4px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-[8.5px] uppercase tracking-wider leading-none flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              Ready to Play
                            </span>
                          ) : (
                            <span
                              className="shrink-0 px-1.5 py-0.5 rounded-[4px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono text-[8.5px] uppercase tracking-wider leading-none flex items-center gap-0.5 cursor-help"
                              title="External track metadata — owner may restrict YouTube embedding unless direct link provided"
                            >
                              <span>⚠️</span>
                              <span>Unverified Stream</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                          <span className="truncate">{item.artist}</span>
                          <span className="text-neutral-300 dark:text-neutral-600">•</span>
                          <span className="font-mono text-[10.5px] shrink-0 tabular-nums">
                            {formatSecs(item.duration)}
                          </span>
                          {item.genre && (
                            <>
                              <span className="text-neutral-300 dark:text-neutral-600">•</span>
                              <span className="font-mono text-[9.5px] uppercase tracking-wider truncate text-neutral-400">
                                {item.genre}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Add Button with Hover Playlist Menu & Duplicate Guard */}
                      {(() => {
                        const isAlreadyInActive = isSongInPlaylist(item, activeCrate);
                        const addedFeedback = addedIds[item.id];

                        return (
                          <div
                            className="relative shrink-0"
                            onMouseEnter={() => handleMouseEnterSongBtn(item.id)}
                            onMouseLeave={handleMouseLeaveSongBtn}
                          >
                            <button
                              type="button"
                              onClick={() => handleAddSong(item)}
                              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider font-medium transition-all active:scale-95 cursor-pointer ${
                                addedFeedback
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : isAlreadyInActive
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-sm'
                                  : 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 shadow-sm'
                              }`}
                              title={
                                isAlreadyInActive
                                  ? 'Already in this playlist. Hover to add to a different playlist.'
                                  : 'Click to add to target playlist, or hover to choose/create playlist'
                              }
                            >
                              {addedFeedback ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[130px]">
                                    {addedFeedback}
                                  </span>
                                </>
                              ) : isAlreadyInActive ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>In Playlist</span>
                                  <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add</span>
                                  <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                                </>
                              )}
                            </button>

                            {/* Hover Dropdown Menu listing user playlists */}
                            <AnimatePresence>
                              {hoveredSongDropdownId === item.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute right-0 top-full mt-1.5 z-50 w-72 sm:w-80 rounded-2xl bg-white/95 dark:bg-[#1e1e22]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.35)] p-2.5 flex flex-col gap-1.5 text-neutral-900 dark:text-white"
                                >
                                  <div className="px-2 py-1 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                                      Add to Playlist
                                    </span>
                                    <span className="font-mono text-[9px] text-neutral-400">
                                      {playlists.length} playlists
                                    </span>
                                  </div>

                                  {!item.isVerified && (
                                    <div className="px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-700 dark:text-amber-400 flex items-start gap-1.5 leading-tight">
                                      <span>⚠️</span>
                                      <span>
                                        Unverified stream: YouTube owner may restrict embedding if video isn't licensed for third-party players.
                                      </span>
                                    </div>
                                  )}

                                  {/* Playlists List with Duplicate Status */}
                                  <div className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5">
                                    {playlists.length === 0 ? (
                                      <div className="py-2 px-2 text-center text-[11px] font-mono text-neutral-400">
                                        No playlists created yet
                                      </div>
                                    ) : (
                                      playlists.map((pl) => {
                                        const isTarget = pl.id === targetId;
                                        const isAlreadyInThisPl = isSongInPlaylist(item, pl);

                                        return (
                                          <button
                                            key={pl.id}
                                            type="button"
                                            onClick={() =>
                                              handleAddSongToSpecificPlaylist(item, pl)
                                            }
                                            className={`w-full px-2.5 py-1.5 rounded-xl text-left transition-colors flex items-center justify-between group/pl ${
                                              isAlreadyInThisPl
                                                ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-medium'
                                                : isTarget
                                                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium'
                                                : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-neutral-800 dark:text-neutral-200'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <ListMusic
                                                className={`w-3.5 h-3.5 shrink-0 ${
                                                  isAlreadyInThisPl
                                                    ? 'text-emerald-500'
                                                    : isTarget
                                                    ? 'text-white dark:text-neutral-900'
                                                    : 'text-neutral-400'
                                                }`}
                                              />
                                              <span className="text-[12px] truncate">
                                                {pl.title}
                                              </span>
                                            </div>

                                            {isAlreadyInThisPl ? (
                                              <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                                                <Check className="w-3 h-3" />
                                                In Playlist
                                              </span>
                                            ) : (
                                              <span
                                                className={`font-mono text-[9.5px] shrink-0 ${
                                                  isTarget
                                                    ? 'opacity-80'
                                                    : 'text-neutral-400 group-hover/pl:text-neutral-600 dark:group-hover/pl:text-neutral-300'
                                                }`}
                                              >
                                                + Add
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>

                                  {/* Inline Create New Playlist Section */}
                                  {inlineCreatingForSongId === item.id ? (
                                    <form
                                      onSubmit={(e) => handleInlineCreateAndAdd(e, item)}
                                      className="p-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 flex flex-col gap-1.5"
                                    >
                                      <input
                                        type="text"
                                        autoFocus
                                        value={inlineCreateName}
                                        onChange={(e) => setInlineCreateName(e.target.value)}
                                        placeholder="New playlist name…"
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-black/40 border border-black/15 dark:border-white/15 text-[12px] focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                                      />
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setInlineCreatingForSongId(null);
                                            setInlineCreateName('');
                                          }}
                                          className="px-2 py-0.5 text-[10px] font-mono text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="submit"
                                          disabled={!inlineCreateName.trim()}
                                          className="px-2.5 py-1 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-mono text-[10px] font-medium disabled:opacity-40"
                                        >
                                          Create & Add
                                        </button>
                                      </div>
                                    </form>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setInlineCreatingForSongId(item.id)}
                                      className="w-full py-1.5 px-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white text-neutral-700 dark:text-neutral-200 text-[11px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                                    >
                                      <FolderPlus className="w-3.5 h-3.5" />
                                      <span>+ Create New Playlist</span>
                                    </button>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Notice */}
            <div className="px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 font-sans relative z-20">
              <span>Press Esc to close</span>
              <button
                type="button"
                onClick={onClose}
                className="hover:text-neutral-900 dark:hover:text-white font-medium px-2.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
