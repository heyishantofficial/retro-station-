import React, { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartHandshake,
  X,
  Flame,
  Heart,
  Disc3,
  Play,
  Plus,
  Share2,
  Sparkles,
  Music,
  Layers,
  Send,
  Search,
  Check,
  Clock,
  LogIn,
  Trash2,
} from 'lucide-react';
import {
  SocialPost,
  fetchSocialFeed,
  createSocialPost,
  togglePostReaction,
  hasUserReacted,
  deleteSocialPost,
  ReactionType,
} from '../services/socialFeed';
import { searchSongs, SearchSongResult } from '../services/musicSearch';
import { Playlist, Track } from '../types';
import { sound } from '../utils/soundEffects';
import { ShareCardModal } from './ShareCardModal';

interface SharingIsCaringModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string; email: string; avatarUrl?: string } | null;
  userPlaylists: Playlist[];
  activePlaylistId: string;
  currentTrack?: Track;
  onPlaySong: (track: Track) => void;
  onPlaySongAtTimestamp?: (track: Track, timestampSeconds: number) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onImportPlaylist: (playlist: Playlist) => void;
  onAddSongToPlaylist: (track: Track, playlistId: string) => void;
  onOpenAuthModal?: () => void;
}

const MAX_NOTE_LENGTH = 200;

const DAILY_PROMPTS = [
  { day: 0, theme: 'Sunday Chill & Nostalgia', prompt: 'A song that feels like slow Sunday coffee ☕' },
  { day: 1, theme: 'Monday Focus & Drive', prompt: 'Your ultimate deep-work hyperfocus anthem ⚡' },
  { day: 2, theme: 'Hidden Gems', prompt: 'A masterpiece that nobody in your circle knows about 💎' },
  { day: 3, theme: 'Late Night Reverie', prompt: 'A track best played at 2 AM with headphones on 🌧' },
  { day: 4, theme: 'Analog Heat', prompt: 'Best bassline or guitar riff in existence 🔥' },
  { day: 5, theme: 'Friday Night Drive', prompt: 'Top song for an empty highway with windows down 🌃' },
  { day: 6, theme: 'Weekend Groove', prompt: 'Instant mood booster to kick off the weekend 🪩' },
];

function parseTimestampToSeconds(str: string): number | undefined {
  if (!str.trim()) return undefined;
  const parts = str.trim().split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  const direct = parseInt(str, 10);
  return !isNaN(direct) && direct > 0 ? direct : undefined;
}

function formatSecondsToTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const SharingIsCaringModal: React.FC<SharingIsCaringModalProps> = ({
  isOpen,
  onClose,
  user,
  userPlaylists,
  activePlaylistId,
  currentTrack,
  onPlaySong,
  onPlaySongAtTimestamp,
  onPlayPlaylist,
  onImportPlaylist,
  onAddSongToPlaylist,
  onOpenAuthModal,
}) => {
  const [feed, setFeed] = useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recent' | 'trending'>('recent');

  // Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [postType, setPostType] = useState<'song' | 'playlist'>('song');
  const [note, setNote] = useState('');
  const [timestampInput, setTimestampInput] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(activePlaylistId);
  const [selectedSong, setSelectedSong] = useState<Track | null>(currentTrack || null);

  // Story Card Modal state
  const [selectedPostForCard, setSelectedPostForCard] = useState<SocialPost | null>(null);

  // Daily Prompt logic
  const dayOfWeek = new Date().getDay();
  const todayPrompt = DAILY_PROMPTS.find((p) => p.day === dayOfWeek) || DAILY_PROMPTS[0];

  // Song search inside composer
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [songSearchResults, setSongSearchResults] = useState<SearchSongResult[]>([]);
  const [isSearchingSongs, setIsSearchingSongs] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Quick feedback states
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [addedSongPostId, setAddedSongPostId] = useState<string | null>(null);
  const [savedPlaylistPostId, setSavedPlaylistPostId] = useState<string | null>(null);

  // Generate unique IDs for form inputs (accessibility best practice)
  const playlistSelectId = useId();
  const searchInputId = useId();

  useEffect(() => {
    if (isOpen) {
      loadFeed(activeTab);
      if (currentTrack && !selectedSong) {
        setSelectedSong(currentTrack);
      }
    }
  }, [isOpen, activeTab]);

  const loadFeed = async (filter: 'recent' | 'trending') => {
    setIsLoading(true);
    try {
      const posts = await fetchSocialFeed(filter);
      setFeed(posts);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced song search
  useEffect(() => {
    if (!songSearchQuery.trim()) {
      setSongSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingSongs(true);
      try {
        const results = await searchSongs(songSearchQuery);
        setSongSearchResults(results.slice(0, 5));
      } finally {
        setIsSearchingSongs(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [songSearchQuery]);

  const handleToggleReaction = async (post: SocialPost, reactionType: ReactionType) => {
    sound.playClick(1100, 0.015);
    const result = await togglePostReaction(post.id, reactionType);
    setFeed((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, reactions: result.reactions as any } : p))
    );
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || isPosting) return;

    if (postType === 'song' && !selectedSong) {
      return;
    }
    if (postType === 'playlist' && !selectedPlaylistId) {
      return;
    }

    setIsPosting(true);
    sound.playClick(1300, 0.02);

    try {
      const chosenPlaylist = userPlaylists.find((p) => p.id === selectedPlaylistId);
      const parsedTimestamp =
        postType === 'song' ? parseTimestampToSeconds(timestampInput) : undefined;

      const newPost = await createSocialPost({
        type: postType,
        note: note.trim().slice(0, MAX_NOTE_LENGTH),
        timestampSeconds: parsedTimestamp,
        author: {
          id: user?.id,
          name: user ? user.name : 'Anonymous Collector',
          avatarUrl: user?.avatarUrl,
          email: user?.email,
        },
        song: postType === 'song' ? (selectedSong as Track) : undefined,
        playlist:
          postType === 'playlist' && chosenPlaylist
            ? {
                id: chosenPlaylist.id,
                title: chosenPlaylist.title,
                category: chosenPlaylist.category,
                trackCount: chosenPlaylist.tracks.length,
                tracks: chosenPlaylist.tracks,
              }
            : undefined,
      });

      setFeed((prev) => [newPost, ...prev]);
      setNote('');
      setTimestampInput('');
      setIsComposerOpen(false);
      setSongSearchQuery('');
      setSongSearchResults([]);
    } finally {
      setIsPosting(false);
    }
  };

  const handleShareLink = (post: SocialPost, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    const url = `${window.location.origin}/?post=${post.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedPostId(post.id);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  const handleAddSongToActivePlaylist = (song: Track, postId: string) => {
    sound.playClick(1200, 0.02);
    onAddSongToPlaylist(song, activePlaylistId);
    setAddedSongPostId(postId);
    setTimeout(() => setAddedSongPostId(null), 2000);
  };

  const handleSaveCommunityPlaylist = (playlistData: any, postId: string) => {
    sound.playClick(1250, 0.02);
    const imported: Playlist = {
      id: `community_${Date.now()}`,
      title: playlistData.title,
      subtitle: `${playlistData.trackCount} tracks • via Sharing is Caring`,
      category: playlistData.category || 'Shared Collection',
      tracks: playlistData.tracks,
    };
    onImportPlaylist(imported);
    setSavedPlaylistPostId(postId);
    setTimeout(() => setSavedPlaylistPostId(null), 2000);
  };

  const handleDeletePost = async (postId: string) => {
    sound.playClick();
    setFeed((prev) => prev.filter((p) => p.id !== postId));
    await deleteSocialPost(postId, user?.id);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        {/* Ambient Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
        />

        {/* Liquid Glass Modal Shell */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl liquid-glass-drawer border border-white/25 flex flex-col overflow-hidden text-white font-sans shadow-[0_32px_80px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.4)] z-10"
        >
          {/* Ambient Refraction Orbs */}
          <div className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 -right-20 w-64 h-64 rounded-full bg-indigo-500/12 blur-3xl" />

          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-white/[0.14] flex items-center justify-between relative z-10 bg-white/[0.03] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500/25 to-pink-600/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)]">
                <HeartHandshake className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Sharing is Caring
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/35">
                    Lounge
                  </span>
                </div>
                <p className="text-xs text-white/60 font-medium">
                  Community music feed • Playlists & song stories
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>16 listening now</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-white/[0.10] hover:bg-white/[0.22] border border-white/25 text-white/80 hover:text-white flex items-center justify-center transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] active:scale-95 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub-Header: Filter Tabs & Quick Compose Button */}
          <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 relative z-10 bg-black/20">
            {/* Filter Tabs */}
            <div className="flex p-0.5 rounded-full bg-black/40 border border-white/15">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setActiveTab('recent');
                }}
                className={`py-1 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'recent'
                    ? 'liquid-glass-pill text-neutral-950 font-bold'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Recent</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setActiveTab('trending');
                }}
                className={`py-1 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'trending'
                    ? 'liquid-glass-pill text-neutral-950 font-bold'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Trending</span>
              </button>
            </div>

            {/* Compose Toggle */}
            <button
              type="button"
              data-testid="compose-btn"
              onClick={() => {
                sound.playClick();
                setIsComposerOpen((prev) => !prev);
              }}
              className={`py-1.5 px-3.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isComposerOpen
                  ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.4)]'
                  : 'liquid-glass-interactive text-white border-white/20'
              }`}
            >
              {isComposerOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{isComposerOpen ? 'Close Composer' : 'Share Something'}</span>
            </button>
          </div>

          {/* Daily Community Prompt Banner */}
          <div className="px-5 py-2.5 bg-gradient-to-r from-rose-500/15 via-pink-500/10 to-transparent border-b border-white/[0.10] flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300 shrink-0 text-xs">
                ✦
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-bold">
                  TODAY'S PROMPT • {todayPrompt.theme}
                </div>
                <div className="text-xs text-white/90 font-medium truncate mt-0.5">
                  {todayPrompt.prompt}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setIsComposerOpen(true);
                setPostType('song');
                if (!note) setNote(`[#DailyDisc] `);
              }}
              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[10.5px] font-semibold shrink-0 cursor-pointer transition-colors"
            >
              Drop Answer
            </button>
          </div>

          {/* Interactive Composer Deck (Collapsible) */}
          <AnimatePresence>
            {isComposerOpen && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCreatePost}
                className="px-5 py-3.5 border-b border-white/[0.14] bg-white/[0.04] backdrop-blur-2xl space-y-3 relative z-20 overflow-hidden"
              >
                {/* Type Switcher Capsule */}
                <div className="flex items-center justify-between">
                  <div className="flex p-0.5 rounded-full bg-black/40 border border-white/15">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setPostType('song');
                      }}
                      className={`py-1 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        postType === 'song'
                          ? 'liquid-glass-pill text-neutral-950 font-bold'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <Music className="w-3.5 h-3.5" />
                      <span>Song Story</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setPostType('playlist');
                      }}
                      className={`py-1 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        postType === 'playlist'
                          ? 'liquid-glass-pill text-neutral-950 font-bold'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Playlist Drop</span>
                    </button>
                  </div>

                  {/* Character Counter (Constraint: Max 200 characters) */}
                  <span
                    className={`text-[11px] font-mono tabular-nums font-semibold px-2 py-0.5 rounded-full ${
                      note.length >= MAX_NOTE_LENGTH
                        ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                        : note.length >= 170
                        ? 'bg-amber-500/25 text-amber-300'
                        : 'text-white/60'
                    }`}
                  >
                    {note.length}/{MAX_NOTE_LENGTH}
                  </span>
                </div>

                {/* Micro-Note Textarea */}
                <div>
                  <textarea
                    rows={2}
                    maxLength={MAX_NOTE_LENGTH}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      postType === 'song'
                        ? 'What makes this song special? A memory, lyrics, or late-night vibe... (max 200 chars)'
                        : 'Describe the vibe of this playlist... (max 200 chars)'
                    }
                    className="w-full p-2.5 rounded-2xl bg-black/40 border border-white/20 text-white placeholder-white/40 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-rose-400 focus:border-rose-400 transition-all resize-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                  />
                </div>

                {/* Target Media Picker */}
                {postType === 'playlist' ? (
                  <div>
                    <label htmlFor={playlistSelectId} className="text-[11px] font-medium text-white/70 block mb-1">
                      Choose one of your playlists to drop:
                    </label>
                    <select
                      id={playlistSelectId}
                      value={selectedPlaylistId}
                      onChange={(e) => setSelectedPlaylistId(e.target.value)}
                      className="w-full p-2 rounded-xl bg-black/50 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
                    >
                      {userPlaylists.map((pl) => (
                        <option key={pl.id} value={pl.id} className="bg-neutral-900 text-white">
                          {pl.title} ({pl.tracks.length} tracks)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Selected Song Preview Banner */}
                    {selectedSong && (
                      <div className="p-2 rounded-xl bg-white/[0.08] border border-white/15 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={selectedSong.coverUrl}
                            alt={selectedSong.title}
                            className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/20"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {selectedSong.title}
                            </div>
                            <div className="text-[11px] text-white/60 truncate">
                              {selectedSong.artist}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                          Attached
                        </span>
                      </div>
                    )}

                    {/* Quick Search to change song */}
                    <div className="relative">
                      <label htmlFor={searchInputId} className="sr-only">Search song to attach</label>
                      {isSearchingSongs ? (
                        <Disc3 className="w-3.5 h-3.5 text-rose-400 animate-spin absolute left-2.5 top-1/2 -translate-y-1/2" />
                      ) : (
                        <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      )}
                      <input
                        id={searchInputId}
                        type="text"
                        value={songSearchQuery}
                        onChange={(e) => setSongSearchQuery(e.target.value)}
                        placeholder="Search song to attach (or leave current)..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-rose-400"
                      />
                    </div>

                    {/* Instant Search Results Dropdown */}
                    {songSearchResults.length > 0 && (
                      <div className="max-h-36 overflow-y-auto rounded-xl bg-neutral-950/95 border border-white/20 p-1 space-y-1">
                        {songSearchResults.map((res) => (
                          <button
                            key={res.id}
                            type="button"
                            onClick={() => {
                              sound.playClick();
                              setSelectedSong({
                                id: `track_${res.youtubeId}`,
                                youtubeId: res.youtubeId,
                                title: res.title,
                                artist: res.artist,
                                album: res.album,
                                year: res.year || '2024',
                                duration: res.duration,
                                coverUrl: res.coverUrl,
                                genre: res.genre || 'Music',
                                label: 'YouTube Music',
                                matrixCode: `YT-${res.youtubeId.substring(0, 8)}`,
                                quotes: [],
                              });
                              setSongSearchQuery('');
                              setSongSearchResults([]);
                            }}
                            className="w-full p-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={res.coverUrl}
                                alt={res.title}
                                className="w-6 h-6 rounded object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-white truncate">
                                  {res.title}
                                </div>
                                <div className="text-[10px] text-white/60 truncate">
                                  {res.artist}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-rose-300 font-semibold shrink-0 ml-1">
                              Select
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {postType === 'song' && (
                  <div className="flex items-center gap-2 pt-1">
                    <Clock className="w-3.5 h-3.5 text-white/50 shrink-0" />
                    <span className="text-[11px] text-white/70 font-medium">Highlight timestamp (optional):</span>
                    <input
                      type="text"
                      value={timestampInput}
                      onChange={(e) => setTimestampInput(e.target.value)}
                      placeholder="e.g. 1:45"
                      className="w-20 px-2 py-0.5 rounded-lg bg-black/40 border border-white/15 text-white text-xs font-mono placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-rose-400 text-center"
                    />
                  </div>
                )}

                {/* Submit Row */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-6 h-6 rounded-full border border-white/20 object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                        👤
                      </div>
                    )}
                    <span className="text-xs text-white/70">
                      Posting as <strong className="text-white">{user ? user.name : 'Guest Collector'}</strong>
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={!note.trim() || isPosting || (postType === 'song' && !selectedSong)}
                    className="py-1.5 px-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-[0_0_16px_rgba(244,63,94,0.4)] disabled:opacity-40 transition-all cursor-pointer active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isPosting ? 'Dropping…' : 'Drop to Lounge'}</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Feed Stream */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 relative z-10">
            {isLoading ? (
              <div className="py-16 text-center text-white/60">
                <Disc3 className="w-8 h-8 text-rose-400 animate-spin mx-auto mb-2" />
                <p className="text-xs font-mono">Syncing lounge frequency…</p>
              </div>
            ) : feed.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl liquid-glass-card flex items-center justify-center mx-auto text-rose-300 mb-3 shadow-[0_0_16px_rgba(244,63,94,0.25)]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-white">Lounge is Quiet</h4>
                <p className="text-xs text-white/60 mt-1 max-w-[260px] mx-auto">
                  Be the first to drop a playlist or share a song story!
                </p>
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(true)}
                  className="mt-3.5 py-1.5 px-4 rounded-full liquid-glass-pill text-neutral-950 font-bold text-xs cursor-pointer"
                >
                  Share Something
                </button>
              </div>
            ) : (
              feed.map((post) => {
                const isHype = hasUserReacted(post.id, 'hype');
                const isLove = hasUserReacted(post.id, 'love');
                const isSave = hasUserReacted(post.id, 'save');

                return (
                  <div
                    key={post.id}
                    className="p-4 rounded-2xl liquid-glass-card space-y-3 transition-all hover:border-white/30"
                  >
                    {/* Post Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {post.author.avatarUrl ? (
                          <img
                            src={post.author.avatarUrl}
                            alt={post.author.name}
                            className="w-8 h-8 rounded-full border border-white/25 object-cover shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs shrink-0">
                            👤
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white tracking-tight truncate">
                            {post.author.name}
                          </div>
                          <div className="text-[10px] text-white/50 truncate font-mono">
                            {new Date(post.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            •{' '}
                            {new Date(post.createdAt).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            post.type === 'song'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-400/35'
                          }`}
                        >
                          {post.type === 'song' ? '♫ Song Story' : '🗂 Playlist Drop'}
                        </span>

                        {/* Story Card Trigger */}
                        <button
                          type="button"
                          onClick={() => setSelectedPostForCard(post)}
                          title="Generate aesthetic Story Card"
                          className="h-7 px-2 rounded-lg liquid-glass-interactive flex items-center gap-1 text-[11px] font-medium text-white/70 hover:text-white cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-rose-300" />
                          <span className="hidden sm:inline">Story Card</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleShareLink(post, e)}
                          title="Copy share link"
                          className="w-7 h-7 rounded-lg liquid-glass-interactive flex items-center justify-center text-white/60 hover:text-white cursor-pointer"
                        >
                          {copiedPostId === post.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Author Delete Action */}
                        {user &&
                          (post.author.id === user.id ||
                            (post.author.email && post.author.email === user.email) ||
                            post.author.name === user.name) && (
                            <button
                              type="button"
                              onClick={() => handleDeletePost(post.id)}
                              title="Delete your post"
                              className="w-7 h-7 rounded-lg liquid-glass-interactive flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                      </div>
                    </div>

                    {/* Micro-Note (Crisp quote, strictly limited words) */}
                    <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-normal italic">
                      “{post.note}”
                    </p>

                    {/* Attached Media Card */}
                    {post.type === 'song' && post.song && (
                      <div className="p-2.5 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/20 shadow-sm bg-neutral-950">
                            <img
                              src={post.song.coverUrl}
                              alt={post.song.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                              {post.song.title}
                            </div>
                            <div className="text-xs text-white/60 truncate mt-0.5 font-medium">
                              {post.song.artist}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {typeof post.timestampSeconds === 'number' && (
                            <button
                              type="button"
                              onClick={() => {
                                sound.playDiscSpin();
                                if (onPlaySongAtTimestamp) {
                                  onPlaySongAtTimestamp(post.song as Track, post.timestampSeconds!);
                                } else {
                                  onPlaySong(post.song as Track);
                                }
                              }}
                              className="px-2 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-[10.5px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                              title={`Jump to ${formatSecondsToTimestamp(post.timestampSeconds)}`}
                            >
                              <Clock className="w-3 h-3 text-emerald-400" />
                              <span>{formatSecondsToTimestamp(post.timestampSeconds)}</span>
                            </button>
                          )}

                          {/* Play on turntable */}
                          <button
                            type="button"
                            onClick={() => {
                              sound.playDiscSpin();
                              onPlaySong(post.song as Track);
                            }}
                            className="py-1.5 px-3 rounded-full bg-white text-neutral-950 font-bold text-xs flex items-center gap-1 shadow-sm hover:bg-white/90 transition-all active:scale-95 cursor-pointer"
                            title="Play this track on the retro turntable"
                          >
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                            <span>Play</span>
                          </button>

                          {/* Add to Playlist */}
                          <button
                            type="button"
                            onClick={() => handleAddSongToActivePlaylist(post.song as Track, post.id)}
                            className="p-1.5 rounded-full liquid-glass-interactive text-white/80 hover:text-white cursor-pointer"
                            title="Add song to your active playlist"
                          >
                            {addedSongPostId === post.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {post.type === 'playlist' && post.playlist && (
                      <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0 shadow-[0_0_14px_rgba(168,85,247,0.25)]">
                            <Disc3 className="w-6 h-6" />
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                              {post.playlist.title}
                            </div>
                            <div className="text-xs text-white/60 truncate mt-0.5 font-medium">
                              {post.playlist.trackCount} tracks • {post.playlist.category || 'Collection'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Spin Playlist */}
                          <button
                            type="button"
                            onClick={() => {
                              sound.playDiscSpin();
                              const fullPl: Playlist = {
                                id: post.playlist!.id,
                                title: post.playlist!.title,
                                subtitle: `${post.playlist!.trackCount} tracks`,
                                category: post.playlist!.category || 'Curated',
                                tracks: post.playlist!.tracks,
                              };
                              onPlayPlaylist(fullPl);
                            }}
                            className="py-1.5 px-3 rounded-full bg-white text-neutral-950 font-bold text-xs flex items-center gap-1 shadow-sm hover:bg-white/90 transition-all active:scale-95 cursor-pointer"
                            title="Spin entire playlist on the turntable"
                          >
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                            <span>Spin</span>
                          </button>

                          {/* Save to library */}
                          <button
                            type="button"
                            onClick={() => handleSaveCommunityPlaylist(post.playlist, post.id)}
                            className="p-1.5 rounded-full liquid-glass-interactive text-white/80 hover:text-white cursor-pointer"
                            title="Save playlist to your library"
                          >
                            {savedPlaylistPostId === post.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 1-Tap Lightweight Reactions Bar */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.08]">
                      <div className="flex items-center gap-2">
                        {/* Hype */}
                        <button
                          type="button"
                          onClick={() => handleToggleReaction(post, 'hype')}
                          className={`py-1 px-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            isHype
                              ? 'bg-amber-500/25 border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                              : 'bg-white/[0.05] hover:bg-white/[0.12] border-white/10 text-white/70'
                          }`}
                        >
                          <Flame className={`w-3.5 h-3.5 ${isHype ? 'text-amber-400 fill-amber-400' : ''}`} />
                          <span className="font-mono text-[11px]">{post.reactions?.hype || 0}</span>
                        </button>

                        {/* Love */}
                        <button
                          type="button"
                          onClick={() => handleToggleReaction(post, 'love')}
                          className={`py-1 px-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            isLove
                              ? 'bg-rose-500/25 border-rose-400/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                              : 'bg-white/[0.05] hover:bg-white/[0.12] border-white/10 text-white/70'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isLove ? 'text-rose-400 fill-rose-400' : ''}`} />
                          <span className="font-mono text-[11px]">{post.reactions?.love || 0}</span>
                        </button>

                        {/* Save */}
                        <button
                          type="button"
                          onClick={() => handleToggleReaction(post, 'save')}
                          className={`py-1 px-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            isSave
                              ? 'bg-purple-500/25 border-purple-400/50 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                              : 'bg-white/[0.05] hover:bg-white/[0.12] border-white/10 text-white/70'
                          }`}
                        >
                          <Disc3 className={`w-3.5 h-3.5 ${isSave ? 'text-purple-400' : ''}`} />
                          <span className="font-mono text-[11px]">{post.reactions?.save || 0}</span>
                        </button>
                      </div>

                      {!user && onOpenAuthModal && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            onClose();
                            onOpenAuthModal();
                          }}
                          className="text-[11px] text-white/60 hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          <LogIn className="w-3 h-3" />
                          <span>Sign in to post</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Story Card Modal */}
        <ShareCardModal
          isOpen={!!selectedPostForCard}
          post={selectedPostForCard}
          onClose={() => setSelectedPostForCard(null)}
        />
      </div>
    </AnimatePresence>
  );
};
