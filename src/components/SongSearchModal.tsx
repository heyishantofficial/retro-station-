import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, Check, Disc3, Sparkles, Music2 } from 'lucide-react';
import { searchSongs, SearchSongResult, POPULAR_HITS_CATALOG } from '../services/musicSearch';
import { sound } from '../utils/soundEffects';

interface SongSearchModalProps {
  isOpen: boolean;
  activePlaylistTitle: string;
  onClose: () => void;
  onAddSong: (result: SearchSongResult) => void;
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
  activePlaylistTitle,
  onClose,
  onAddSong,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchSongResult[]>(POPULAR_HITS_CATALOG.slice(0, 8));
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      setQuery('');
      setResults(POPULAR_HITS_CATALOG.slice(0, 8));
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
        // fallback to curated
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, isOpen]);

  const handleAdd = (song: SearchSongResult) => {
    sound.playClick(1120, 0.02);
    onAddSong(song);
    setAddedIds((prev) => ({ ...prev, [song.id]: true }));
    window.setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [song.id]: false }));
    }, 2200);
  };

  const handleTagClick = (tag: string) => {
    sound.playClick();
    setQuery(tag);
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 64);
    const s = Math.floor(sec % 64);
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
            className="absolute inset-0 bg-black/45 backdrop-blur-[6px]"
          />

          {/* Modal Sheet */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-xl max-h-[88dvh] rounded-3xl bg-[#f6f6f4]/95 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100"
          >
            {/* Header with Search Input */}
            <div className="px-5 pt-5 pb-3 border-b border-black/[0.08] dark:border-white/[0.08]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center shadow">
                    <Music2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-serif text-base sm:text-lg font-semibold uppercase tracking-wide leading-none truncate">
                      Search & Press to Disc
                    </h2>
                    <p className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      Target Crate: <span className="font-medium text-neutral-800 dark:text-neutral-200">{activePlaylistTitle}</span>
                    </p>
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
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[260px] max-h-[52dvh]">
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
                  const isAdded = Boolean(addedIds[item.id]);
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
                          {item.source === 'curated' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-[4px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono text-[8.5px] uppercase tracking-wider leading-none">
                              Verified
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

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={() => handleAdd(item)}
                        disabled={isAdded}
                        className={`shrink-0 px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider font-medium transition-all active:scale-95 ${
                          isAdded
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 shadow-sm'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Notice */}
            <div className="px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Stamps song directly onto spinning vinyl / CD
              </span>
              <button
                type="button"
                onClick={onClose}
                className="hover:text-neutral-900 dark:hover:text-white uppercase tracking-wider font-medium"
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
