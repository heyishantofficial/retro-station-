import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  Flame,
  Globe2,
  Share2,
  Check,
  Plus,
  Play,
  Disc3,
  BookmarkCheck,
  Sparkles,
  UploadCloud,
  Search,
} from 'lucide-react';
import { Playlist } from '../types';
import { sound } from '../utils/soundEffects';
import {
  CommunityPlaylist,
  fetchCommunityLeaderboard,
  publishCrateToCommunity,
  saveCommunityCrate,
  generateCrateShareUrl,
  getSavedCrateIds,
} from '../services/communityPlaylists';
import { UserProfile } from '../services/cloudSync';

interface CommunityLeaderboardModalProps {
  isOpen: boolean;
  userPlaylists: Playlist[];
  activePlaylistId?: string;
  user?: UserProfile | null;
  onClose: () => void;
  onImportCommunityPlaylist: (playlist: Playlist) => void;
  onPlayCommunityPlaylist?: (playlist: Playlist) => void;
}

export const CommunityLeaderboardModal: React.FC<CommunityLeaderboardModalProps> = ({
  isOpen,
  userPlaylists,
  activePlaylistId,
  user,
  onClose,
  onImportCommunityPlaylist,
  onPlayCommunityPlaylist,
}) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'trending' | 'publish'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('commTab');
      if (p === 'publish' || p === 'trending' || p === 'leaderboard') return p;
    }
    return 'leaderboard';
  });
  const [crates, setCrates] = useState<CommunityPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  // Publish Form State
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(
    activePlaylistId || userPlaylists[0]?.id || ''
  );
  const [creatorName, setCreatorName] = useState<string>(user?.name || '');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessMessage, setPublishSuccessMessage] = useState<string | null>(null);

  // Sync user name when user logs in
  useEffect(() => {
    if (user?.name && !creatorName) {
      setCreatorName(user.name);
    }
  }, [user]);

  // Load community leaderboard
  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
      setSavedIds(getSavedCrateIds());
    }
  }, [isOpen]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCommunityLeaderboard();
      setCrates(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyShareLink = (crateId: string) => {
    sound.playClick();
    const url = generateCrateShareUrl(crateId);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedId(crateId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSaveCrate = async (crate: CommunityPlaylist) => {
    sound.playClick(1350, 0.02);

    // 1. Create a local copy for the user
    const importedPlaylist: Playlist = {
      id: `saved_${crate.id}_${Date.now()}`,
      title: crate.title,
      subtitle: `By ${crate.creatorName}`,
      category: crate.category,
      tracks: crate.tracks,
    };

    // 2. Add to local user library
    onImportCommunityPlaylist(importedPlaylist);

    // 3. Mark as saved locally
    setSavedIds((prev) => [...prev, crate.id]);

    // 4. Optimistically increment save count on the leaderboard
    setCrates((prev) =>
      prev.map((c) => (c.id === crate.id ? { ...c, saveCount: (c.saveCount || 0) + 1 } : c))
    );

    // 5. Fire backend save event
    await saveCommunityCrate(crate.id);
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = userPlaylists.find((p) => p.id === selectedPlaylistId);
    if (!target) return;

    setIsPublishing(true);
    sound.playClick();

    try {
      const published = await publishCrateToCommunity(
        target,
        creatorName.trim() || 'Anonymous Collector',
        user?.avatarUrl,
        user?.id
      );

      setPublishSuccessMessage(`"${published.title}" is now published on the Community Leaderboard!`);
      await loadLeaderboard();
      setActiveTab('leaderboard');
    } finally {
      setIsPublishing(false);
    }
  };

  const filteredCrates = crates.filter((c) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.creatorName.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  const sortedCrates =
    activeTab === 'trending'
      ? [...filteredCrates].reverse() // Show latest additions as trending
      : [...filteredCrates].sort((a, b) => (b.saveCount || 0) - (a.saveCount || 0));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none">
          {/* Ambient Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-2xl max-h-[88dvh] rounded-3xl bg-[#0e0e12]/96 text-white backdrop-blur-2xl border border-white/[0.08] shadow-[0_32px_80px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden font-sans"
          >
            {/* Ambient Radial Glow */}
            <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-bl from-amber-500/10 via-purple-500/5 to-transparent pointer-events-none rounded-bl-full" />

            {/* Header */}
            <div className="px-6 pt-5 pb-3 border-b border-white/[0.08] relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white leading-tight">
                      Community Crates Leaderboard
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-[10px] font-semibold uppercase tracking-wider">
                      Most Saved
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Ranked by how many collectors have added each playlist to their library.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-neutral-400 hover:text-white flex items-center justify-center transition-all border border-white/[0.08] active:scale-95 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success Toast */}
            {publishSuccessMessage && (
              <div className="mx-6 mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{publishSuccessMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPublishSuccessMessage(null)}
                  className="text-emerald-400 hover:text-white text-xs font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Segmented Control & Search */}
            <div className="px-6 pt-3 pb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 relative z-10">
              {/* Tabs: Leaderboard · Trending · Publish */}
              <div className="grid grid-cols-3 p-1 rounded-xl bg-white/[0.05] border border-white/[0.06] text-xs font-medium max-w-sm">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('leaderboard');
                  }}
                  className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'leaderboard'
                      ? 'bg-white text-neutral-950 font-semibold shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Top Ranked</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('trending');
                  }}
                  className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'trending'
                      ? 'bg-white text-neutral-950 font-semibold shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>New & Hot</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('publish');
                  }}
                  className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'publish'
                      ? 'bg-white text-neutral-950 font-semibold shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Publish</span>
                </button>
              </div>

              {/* Search Filter (Visible on Leaderboard & Trending) */}
              {activeTab !== 'publish' && (
                <div className="relative flex items-center min-w-[200px]">
                  <Search className="absolute left-3 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter crates or curators…"
                    className="w-full h-8 pl-8 pr-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                  />
                </div>
              )}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2 relative z-10">
              {/* TAB 1 & 2: LEADERBOARD & TRENDING */}
              {activeTab !== 'publish' ? (
                <div className="space-y-2 pb-4">
                  {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-neutral-400 gap-2">
                      <Disc3 className="w-8 h-8 animate-spin text-amber-400" />
                      <span className="text-xs">Loading community leaderboard…</span>
                    </div>
                  ) : sortedCrates.length === 0 ? (
                    <div className="py-16 text-center text-neutral-400">
                      <p className="text-sm font-semibold text-white">No community crates matched</p>
                      <p className="text-xs text-neutral-500 mt-1">Try a different search query.</p>
                    </div>
                  ) : (
                    sortedCrates.map((crate, idx) => {
                      const rank = idx + 1;
                      const isSaved =
                        savedIds.includes(crate.id) ||
                        userPlaylists.some(
                          (pl) => pl.title.toLowerCase() === crate.title.toLowerCase()
                        );
                      const isTop3 = rank <= 3 && activeTab === 'leaderboard';

                      // Cover preview from first track or fallback
                      const cover =
                        crate.tracks[0]?.coverUrl ||
                        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80';

                      return (
                        <div
                          key={crate.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                            isTop3
                              ? 'bg-gradient-to-r from-amber-500/[0.07] via-white/[0.04] to-transparent border-amber-500/25 shadow-sm'
                              : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]'
                          }`}
                        >
                          {/* Left: Rank + Cover + Info */}
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            {/* Rank Badge */}
                            <div className="w-8 flex items-center justify-center shrink-0">
                              {rank === 1 && activeTab === 'leaderboard' ? (
                                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 text-neutral-950 font-bold text-xs flex items-center justify-center shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/50">
                                  #1
                                </span>
                              ) : rank === 2 && activeTab === 'leaderboard' ? (
                                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-400 text-neutral-950 font-bold text-xs flex items-center justify-center shadow ring-2 ring-neutral-300/40">
                                  #2
                                </span>
                              ) : rank === 3 && activeTab === 'leaderboard' ? (
                                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-700 to-amber-800 text-amber-100 font-bold text-xs flex items-center justify-center shadow ring-2 ring-amber-600/40">
                                  #3
                                </span>
                              ) : (
                                <span className="text-xs font-mono font-medium text-neutral-400">
                                  #{rank}
                                </span>
                              )}
                            </div>

                            {/* Cover Artwork */}
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-sm bg-neutral-900 group-hover:scale-105 transition-transform">
                              <img src={cover} alt={crate.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                            </div>

                            {/* Crate Title & Metadata */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-white truncate">
                                  {crate.title}
                                </h3>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-white/[0.06] text-neutral-300 border border-white/[0.08] shrink-0">
                                  {crate.category || 'Collection'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5 truncate">
                                <span>by {crate.creatorName}</span>
                                <span>•</span>
                                <span>{crate.tracks.length} tracks</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Save Count + Action Buttons */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.05]">
                            {/* Save Count Metric Badge */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-amber-300">
                              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span className="tabular-nums font-semibold">
                                {crate.saveCount.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-normal">saves</span>
                            </div>

                            {/* Direct Listen Trigger */}
                            {onPlayCommunityPlaylist && (
                              <button
                                type="button"
                                onClick={() => {
                                  sound.playDiscSpin();
                                  onPlayCommunityPlaylist({
                                    id: crate.id,
                                    title: crate.title,
                                    subtitle: `By ${crate.creatorName}`,
                                    category: crate.category,
                                    tracks: crate.tracks,
                                  });
                                  onClose();
                                }}
                                title="Play this community crate now"
                                className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white transition-all active:scale-95 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}

                            {/* Share Link Button */}
                            <button
                              type="button"
                              onClick={() => handleCopyShareLink(crate.id)}
                              title="Copy crate share link"
                              className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white transition-all active:scale-95 cursor-pointer"
                            >
                              {copiedId === crate.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Share2 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* 1-Click Save to Library */}
                            <button
                              type="button"
                              onClick={() => handleSaveCrate(crate)}
                              disabled={isSaved}
                              className={`py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm ${
                                isSaved
                                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 cursor-default'
                                  : 'bg-white hover:bg-neutral-100 text-neutral-950 font-semibold'
                              }`}
                            >
                              {isSaved ? (
                                <>
                                  <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>In Library</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add Crate</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* TAB 3: PUBLISH A PLAYLIST */
                <div className="max-w-lg mx-auto py-4 space-y-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto text-emerald-400 mb-2.5">
                      <Globe2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      Publish Your Crate to the World
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                      Share your curation on the community leaderboard. Other collectors can listen,
                      share, and save your crate to their libraries!
                    </p>
                  </div>

                  <form onSubmit={handlePublishSubmit} className="space-y-3.5">
                    {/* 1. Choose Playlist */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Select Crate to Publish:
                      </label>
                      <select
                        value={selectedPlaylistId}
                        onChange={(e) => setSelectedPlaylistId(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        {userPlaylists.map((pl) => (
                          <option key={pl.id} value={pl.id} className="bg-neutral-900 text-white">
                            {pl.title} ({pl.tracks.length} tracks • {pl.category || 'Collection'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Creator Moniker / Display Name */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Curator / Artist Moniker:
                      </label>
                      <input
                        type="text"
                        value={creatorName}
                        onChange={(e) => setCreatorName(e.target.value)}
                        placeholder="e.g. DJ Ishant, VinylArchive, SoundVoyager"
                        required
                        className="w-full h-10 px-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                      <span className="text-[10px] text-neutral-500 mt-0.5 block">
                        This name will be displayed next to your crate on the leaderboard.
                      </span>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isPublishing || !selectedPlaylistId}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      {isPublishing ? (
                        <>
                          <Disc3 className="w-4 h-4 animate-spin" />
                          <span>Publishing to Leaderboard…</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          <span>Publish to Community Leaderboard</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Footer Status Bar */}
            <div className="px-6 py-3 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-xs text-neutral-400 relative z-10">
              <span className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-neutral-400" />
                Retro Station Global Crate Registry
              </span>

              <button
                type="button"
                onClick={onClose}
                className="hover:text-white text-xs font-medium px-2 py-0.5 rounded transition-colors"
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
