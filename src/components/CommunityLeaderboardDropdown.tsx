import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Flame,
  Share2,
  Check,
  Plus,
  Play,
  Disc3,
  UploadCloud,
  X,
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
  isCrateSavedInLibrary,
} from '../services/communityPlaylists';
import { UserProfile } from '../services/cloudSync';

interface CommunityLeaderboardDropdownProps {
  isOpen: boolean;
  userPlaylists: Playlist[];
  activePlaylistId?: string;
  initialPublishCrateId?: string;
  user?: UserProfile | null;
  onClose: () => void;
  onImportCommunityPlaylist: (playlist: Playlist) => void;
  onPlayCommunityPlaylist?: (playlist: Playlist) => void;
}

export const CommunityLeaderboardDropdown: React.FC<CommunityLeaderboardDropdownProps> = ({
  isOpen,
  userPlaylists,
  activePlaylistId,
  initialPublishCrateId,
  user,
  onClose,
  onImportCommunityPlaylist,
  onPlayCommunityPlaylist,
}) => {
  const [activeTab, setActiveTab] = useState<'ranked' | 'publish'>('ranked');
  const [crates, setCrates] = useState<CommunityPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  // Publish Form State
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(
    initialPublishCrateId || activePlaylistId || userPlaylists[0]?.id || ''
  );
  const [creatorName, setCreatorName] = useState<string>(user?.name || '');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessMessage, setPublishSuccessMessage] = useState<string | null>(null);

  // Sync selected playlist and creator name if props change
  useEffect(() => {
    if (initialPublishCrateId) {
      setSelectedPlaylistId(initialPublishCrateId);
      setActiveTab('publish');
    } else if (activePlaylistId && !selectedPlaylistId) {
      setSelectedPlaylistId(activePlaylistId);
    }
  }, [initialPublishCrateId, activePlaylistId, selectedPlaylistId]);

  useEffect(() => {
    if (user?.name && !creatorName) {
      setCreatorName(user.name);
    }
  }, [user, creatorName]);

  // Load community leaderboard when opened
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

  const handleCopyShareLink = (crateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    const url = generateCrateShareUrl(crateId);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedId(crateId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleSaveCrate = async (crate: CommunityPlaylist, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick(1200, 0.02);

    // Save to local storage & convert to Playlist
    const importedPlaylist: Playlist = {
      id: `community_${crate.id}`,
      title: crate.title,
      subtitle: `${crate.tracks.length} tracks • Curated by ${crate.creatorName}`,
      category: crate.category,
      tracks: crate.tracks,
    };

    onImportCommunityPlaylist(importedPlaylist);
    setSavedIds((prev) => [...prev, crate.id]);

    // Optimistically increment save count in local state
    setCrates((prev) =>
      prev.map((c) => (c.id === crate.id ? { ...c, saveCount: (c.saveCount || 0) + 1 } : c))
    );

    // Ping server
    await saveCommunityCrate(crate.id);
  };

  const handlePlayCrate = (crate: CommunityPlaylist, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick(1400, 0.02);
    if (onPlayCommunityPlaylist) {
      const importedPlaylist: Playlist = {
        id: `community_${crate.id}`,
        title: crate.title,
        subtitle: `${crate.tracks.length} tracks • Curated by ${crate.creatorName}`,
        category: crate.category,
        tracks: crate.tracks,
      };
      onPlayCommunityPlaylist(importedPlaylist);
    }
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPl = userPlaylists.find((p) => p.id === selectedPlaylistId);
    if (!targetPl) return;

    if (targetPl.tracks.length === 0) {
      alert('This playlist has 0 songs. Add some tracks before publishing!');
      return;
    }

    const finalCreatorName = creatorName.trim() || user?.name || 'Anonymous Collector';

    setIsPublishing(true);
    sound.playClick(1100, 0.03);

    try {
      const published = await publishCrateToCommunity(
        targetPl,
        finalCreatorName,
        user?.avatarUrl,
        user?.id
      );

      setPublishSuccessMessage(`Published "${published.title}"!`);
      sound.playClick(1500, 0.04);

      // Refresh crates and switch to Ranked tab after short celebration
      await loadLeaderboard();
      setTimeout(() => {
        setPublishSuccessMessage(null);
        setActiveTab('ranked');
      }, 1400);
    } catch (err) {
      console.error('Publish error:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      style={{ backgroundColor: '#121216' }}
      className="fixed left-3 right-3 top-[54px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-[390px] max-h-[82vh] sm:max-h-[520px] rounded-2xl border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.85)] p-3.5 z-50 text-white font-sans flex flex-col gap-2.5 overflow-hidden pointer-events-auto"
    >
      {/* Dropdown Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
            <Trophy className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-white tracking-tight">
                Community Playlists
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/35 font-medium">
                Ranked
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          aria-label="Close"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Control Tabs */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-black/60 border border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveTab('ranked');
          }}
          className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'ranked'
              ? 'bg-zinc-800 text-white shadow-sm border border-white/15'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Most Saved</span>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveTab('publish');
          }}
          className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'publish'
              ? 'bg-zinc-800 text-white shadow-sm border border-white/15'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
          <span>Publish Playlist</span>
        </button>
      </div>

      {/* Tab Content: Ranked Playlists */}
      {activeTab === 'ranked' && (
        <div className="flex-1 overflow-y-auto pr-0.5 space-y-2 min-h-0">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <Disc3 className="w-6 h-6 text-amber-400 animate-spin" />
              <span className="text-xs font-mono">Syncing leaderboard…</span>
            </div>
          ) : crates.length === 0 ? (
            /* Elegant Empty State with High-Contrast Obsidian Card */
            <div className="py-7 px-4 flex flex-col items-center text-center rounded-xl bg-black/40 border border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-yellow-600/15 border border-amber-500/35 flex items-center justify-center text-amber-300 shadow-inner mb-3">
                <Trophy className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white">No Playlists Published Yet</h4>
              <p className="text-xs text-zinc-300 mt-1 max-w-[260px] leading-relaxed">
                Be the first to publish your playlist and claim the #1 spot on the community leaderboard!
              </p>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setActiveTab('publish');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-semibold text-xs transition-all shadow-md shadow-amber-500/25 flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Publish Your Playlist</span>
              </button>
            </div>
          ) : (
            crates.map((crate, idx) => {
              const rank = idx + 1;
              const isSaved =
                savedIds.includes(crate.id) || isCrateSavedInLibrary(crate.id, userPlaylists);
              const firstCover = crate.tracks[0]?.coverUrl;

              // Metallic badges for top 3
              const rankBadge =
                rank === 1
                  ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-black font-extrabold shadow-sm shadow-amber-500/30'
                  : rank === 2
                  ? 'bg-gradient-to-br from-slate-200 to-zinc-400 text-black font-bold'
                  : rank === 3
                  ? 'bg-gradient-to-br from-amber-700 to-orange-900 text-white font-bold'
                  : 'bg-zinc-800 text-zinc-400 font-semibold';

              return (
                <div
                  key={crate.id}
                  className="p-2.5 rounded-xl bg-zinc-900/95 hover:bg-zinc-800/95 border border-white/10 transition-all flex flex-col gap-2 group"
                >
                  <div className="flex items-center justify-between gap-2.5 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Rank Number Badge */}
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono shrink-0 ${rankBadge}`}
                      >
                        #{rank}
                      </span>

                      {/* Cover Thumbnail */}
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/60 border border-white/10 shrink-0 flex items-center justify-center">
                        {firstCover ? (
                          <img
                            src={firstCover}
                            alt={crate.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Disc3 className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>

                      {/* Title & Curator */}
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium text-white truncate leading-tight">
                          {crate.title}
                        </div>
                        <div className="text-[10.5px] text-zinc-400 truncate mt-0.5">
                          by {crate.creatorName} • {crate.tracks.length} tracks
                        </div>
                      </div>
                    </div>

                    {/* Saves Count Pill */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-[10.5px] font-mono shrink-0 font-medium">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>{crate.saveCount || 0}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.08] text-xs">
                    <div className="flex items-center gap-1.5">
                      {/* Instant Play */}
                      <button
                        type="button"
                        onClick={(e) => handlePlayCrate(crate, e)}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Play Playlist"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Play</span>
                      </button>

                      {/* Copy Share Link */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyShareLink(crate.id, e)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copy Share Link"
                      >
                        {copiedId === crate.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3 h-3" />
                            <span>Share</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Add to Library Button */}
                    <button
                      type="button"
                      disabled={isSaved}
                      onClick={(e) => handleSaveCrate(crate, e)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                        isSaved
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white hover:bg-zinc-200 text-black font-semibold active:scale-95'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>In Library</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                          <span>Add Playlist</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab Content: Publish Playlist */}
      {activeTab === 'publish' && (
        <form onSubmit={handlePublishSubmit} className="flex-1 flex flex-col gap-2.5 min-h-0">
          {publishSuccessMessage ? (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h4 className="text-sm font-semibold text-white">{publishSuccessMessage}</h4>
              <p className="text-xs text-zinc-400">Your playlist is now live on the leaderboard!</p>
            </div>
          ) : (
            <>
              <p className="text-[11.5px] text-zinc-300 leading-snug">
                Publishing shares your playlist with the community. Every time someone adds your playlist, your rank rises!
              </p>

              {/* Select Playlist to Publish */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Select Playlist to Share
                </label>
                <select
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {userPlaylists.length === 0 ? (
                    <option value="" disabled>
                      No playlists found in library
                    </option>
                  ) : (
                    userPlaylists.map((pl) => (
                      <option key={pl.id} value={pl.id} className="bg-zinc-900 text-white">
                        {pl.title} ({pl.tracks.length} tracks)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Curator Moniker */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Curator Moniker / Alias
                </label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="e.g. Ishant C, MusicLover, TokyoGroove"
                  maxLength={36}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Submit Button */}
              <div className="mt-auto pt-2">
                <button
                  type="submit"
                  disabled={isPublishing || userPlaylists.length === 0}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-semibold text-xs shadow-md shadow-amber-500/25 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer"
                >
                  {isPublishing ? (
                    <>
                      <Disc3 className="w-3.5 h-3.5 animate-spin" />
                      <span>Publishing to Leaderboard…</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Publish Playlist to Leaderboard</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </motion.div>
  );
};