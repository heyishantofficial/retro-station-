import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Playlist, Track } from './types';
import { HeaderNav } from './components/HeaderNav';
import { TrackMetadata } from './components/TrackMetadata';
import { CDCarousel } from './components/CDCarousel';
import { PlayerControls } from './components/PlayerControls';
import { VinylDeckView } from './components/VinylDeckView';
import { ChromeVinylView } from './components/views/ChromeVinylView';
import { RetroLCDView } from './components/views/RetroLCDView';
import { VinylSleeveView } from './components/views/VinylSleeveView';
import { BraunTurntableView } from './components/views/BraunTurntableView';
import { CassetteDeckView } from './components/views/CassetteDeckView';
import { PixelHeavenView } from './components/views/PixelHeavenView';
import { PixelAtlasView } from './components/views/PixelAtlasView';
import { EmberVinylView } from './components/views/EmberVinylView';
import { ChromaVinylView } from './components/views/ChromaVinylView';
import { BinderView } from './components/views/BinderView';
import { GlamPaletteView } from './components/views/GlamPaletteView';
import { YouTubeSyncModal } from './components/YouTubeSyncModal';
import { MenuDrawer } from './components/MenuDrawer';
import { SongSearchModal } from './components/SongSearchModal';
import { YouTubeChartsModal } from './components/YouTubeChartsModal';
import { YouTubeIcon } from './components/YouTubeIcon';
import { useYouTubePlayer } from './hooks/useYouTubePlayer';
import { buildTrackFromYouTubeId, fetchVideoMetadata } from './services/youtube';
import { convertSearchResultToTrack } from './services/musicSearch';
import { STARTER_CRATES } from './data/starterCrates';
import { VIEW_CATALOG, PlayerViewMode, SharedViewProps } from './utils/viewCatalog';
import { sound } from './utils/soundEffects';
import { AlertCircle, X } from 'lucide-react';

const STORAGE_KEY = 'a24_synced_yt_playlists_v1';
const VIEW_STORAGE_KEY = 'a24_player_view_mode_v1';

export function App() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Playlist[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return STARTER_CRATES;
  });

  const [viewMode, setViewMode] = useState<PlayerViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY) as PlayerViewMode | null;
      if (saved && VIEW_CATALOG.some((v) => v.id === saved)) return saved;
    } catch {
      // ignore
    }
    return 'arc';
  });

  const [viewToast, setViewToast] = useState<string | null>(null);

  const [activePlaylistId, setActivePlaylistId] = useState<string>(() => {
    const first = playlists[0];
    return first ? first.id : (STARTER_CRATES[0]?.id || '');
  });
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(210);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');

  // UI overlays
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isChartsModalOpen, setIsChartsModalOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [chromeHudVisible, setChromeHudVisible] = useState<boolean>(true);
  const [showMiniVideo, setShowMiniVideo] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [playerNotice, setPlayerNotice] = useState<string | null>(null);
  const [arcScrubPreview, setArcScrubPreview] = useState<number | null>(null);

  const activePlaylist =
    playlists.find((p) => p.id === activePlaylistId) || playlists[0] || null;
  const tracks = activePlaylist?.tracks ?? [];
  const activeTrack = tracks[activeTrackIndex] || tracks[0];
  const nextTrack =
    tracks.length > 1
      ? tracks[(activeTrackIndex + 1) % tracks.length]
      : undefined;
  const activeViewMeta =
    VIEW_CATALOG.find((v) => v.id === viewMode) || VIEW_CATALOG[0];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    } catch {
      // ignore
    }
  }, [playlists]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const switchViewWithToast = useCallback((nextMode: PlayerViewMode) => {
    setViewMode(nextMode);
    const meta = VIEW_CATALOG.find((v) => v.id === nextMode);
    if (meta) {
      setViewToast(`${meta.name} · ${meta.subtitle}`);
    }
  }, []);

  useEffect(() => {
    if (!viewToast) return;
    const t = window.setTimeout(() => setViewToast(null), 1300);
    return () => window.clearTimeout(t);
  }, [viewToast]);

  // Read shared mixtape links on load: e.g. #mixtape=Title:ytId1,ytId2,...
  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#mixtape=')) {
        const payload = decodeURIComponent(hash.slice(9));
        const [rawTitle, idsStr] = payload.split(':');
        if (idsStr) {
          const ids = idsStr.split(',').filter((id) => /^[a-zA-Z0-9_-]{11}$/.test(id.trim()));
          if (ids.length > 0) {
            const title = (rawTitle || 'Shared Mixtape').trim();
            const mixtapeId = `mixtape-${Date.now()}`;
            const newTracks = ids.map((id, idx) =>
              buildTrackFromYouTubeId(id, idx, undefined, title)
            );
            const sharedPl: Playlist = {
              id: mixtapeId,
              title,
              subtitle: `Shared Mixtape • ${newTracks.length} discs`,
              category: 'Shared Mixtape',
              tracks: newTracks,
            };
            setPlaylists((prev) => [sharedPl, ...prev.filter((p) => p.id !== mixtapeId)]);
            setActivePlaylistId(mixtapeId);
            setActiveTrackIndex(0);
            setIsPlaying(true);
            setViewToast(`Loaded "${title}" ✦`);
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Prevent macOS Chrome two-finger horizontal swipe from triggering browser Back/Forward navigation
  // (runs in bubble phase with passive:false so React onWheel track-switchers still fire first!)
  useEffect(() => {
    const preventSwipeNav = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || Math.abs(e.deltaX) >= 4) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', preventSwipeNav, { passive: false });
    return () => window.removeEventListener('wheel', preventSwipeNav);
  }, []);

  useEffect(() => {
    const syncFs = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    syncFs();
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
    };
  }, []);

  // Netflix-style auto-hide of the top-right icons after 2.4s idle while in borderless fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setChromeHudVisible(true);
      return;
    }
    let timer = window.setTimeout(() => setChromeHudVisible(false), 2400);
    const wake = () => {
      setChromeHudVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setChromeHudVisible(false), 2400);
    };
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    try {
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        if (rootEl.requestFullscreen) {
          try {
            await rootEl.requestFullscreen({ navigationUI: 'hide' });
          } catch {
            await rootEl.requestFullscreen();
          }
        } else if (rootEl.webkitRequestFullscreen) {
          await rootEl.webkitRequestFullscreen();
        }
        setViewToast('Borderless Fullscreen · Press F or Esc to exit');
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        setViewToast('Exited Fullscreen');
      }
    } catch {
      setViewToast('Click the Fullscreen icon (↗↙) or press F');
    }
  }, []);

  // Global Shortcuts: 'F' borderless fullscreen, 'V' cycles views, '1'-'9' & '0' jump directly to views
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        sound.playClick();
        setIsSearchModalOpen((o) => !o);
        return;
      }

      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        sound.playClick();
        toggleFullscreen();
        return;
      }

      if (e.key.toLowerCase() === 'v') {
        sound.playSwitch();
        const idx = VIEW_CATALOG.findIndex((v) => v.id === viewMode);
        const nextIdx = e.shiftKey
          ? (idx - 1 + VIEW_CATALOG.length) % VIEW_CATALOG.length
          : (idx + 1) % VIEW_CATALOG.length;
        switchViewWithToast(VIEW_CATALOG[nextIdx].id);
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        const slot = e.key === '0' ? 9 : Number(e.key) - 1;
        if (VIEW_CATALOG[slot]) {
          sound.playSwitch();
          switchViewWithToast(VIEW_CATALOG[slot].id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, switchViewWithToast, toggleFullscreen]);

  const handleSelectTrack = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(tracks.length - 1, idx));
      setActiveTrackIndex(clamped);
      setCurrentTime(0);
      setDuration(tracks[clamped]?.duration || 210);
    },
    [tracks]
  );

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    if (isShuffle && tracks.length > 1) {
      let randomIdx = activeTrackIndex;
      while (randomIdx === activeTrackIndex) {
        randomIdx = Math.floor(Math.random() * tracks.length);
      }
      handleSelectTrack(randomIdx);
    } else if (activeTrackIndex < tracks.length - 1) {
      handleSelectTrack(activeTrackIndex + 1);
    } else if (repeatMode === 'all') {
      handleSelectTrack(0);
    }
  }, [tracks.length, isShuffle, activeTrackIndex, repeatMode, handleSelectTrack]);

  const handlePrev = useCallback(() => {
    if (currentTime > 4) {
      seekTo(0);
      return;
    }
    if (activeTrackIndex > 0) {
      handleSelectTrack(activeTrackIndex - 1);
    } else if (repeatMode === 'all') {
      handleSelectTrack(tracks.length - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, activeTrackIndex, repeatMode, tracks.length, handleSelectTrack]);

  const handleTrackEnded = useCallback(() => {
    if (repeatMode === 'one') {
      seekTo(0);
      setIsPlaying(true);
    } else {
      handleNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatMode, handleNext]);

  const { activeDeckIdx, seekTo, setPlaybackRate, fetchPlaylistTracks } = useYouTubePlayer({
    activeTrack,
    nextTrack,
    isPlaying,
    volume,
    isMuted,
    onTrackEnded: handleTrackEnded,
    onSyncPlayState: setIsPlaying,
    onDurationUpdate: setDuration,
    onCurrentTimeUpdate: setCurrentTime,
    onErrorNotice: setPlayerNotice,
  });

  const handleSelectPlaylist = (id: string) => {
    setActivePlaylistId(id);
    setActiveTrackIndex(0);
    setCurrentTime(0);
    const pl = playlists.find((p) => p.id === id);
    if (pl && pl.tracks[0]) {
      setDuration(pl.tracks[0].duration);
    }
  };

  const handleDeletePlaylist = (id: string) => {
    setPlaylists((prev) => {
      const next = prev.filter((pl) => pl.id !== id);
      if (activePlaylistId === id) {
        if (next.length > 0) {
          setActivePlaylistId(next[0].id);
          setActiveTrackIndex(0);
          setCurrentTime(0);
        } else {
          setActivePlaylistId('');
          setActiveTrackIndex(0);
          setCurrentTime(0);
          setIsPlaying(false);
        }
      }
      return next;
    });
  };

  const handleSyncPlaylist = async (playlistId: string, customTitle?: string) => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncStatus('Connecting to YouTube Music…');

    const newPlaylistId = `yt-pl-${playlistId}-${Date.now()}`;
    const title = customTitle || `YouTube Music (${playlistId.slice(0, 8)}…)`;

    try {
      const syncedTracks = await fetchPlaylistTracks(
        playlistId,
        title,
        (status) => setSyncStatus(status),
        (hydratedTrack: Track) => {
          setPlaylists((prev) =>
            prev.map((pl) => {
              if (pl.id !== newPlaylistId) return pl;
              return {
                ...pl,
                tracks: pl.tracks.map((t) =>
                  t.id === hydratedTrack.id ? hydratedTrack : t
                ),
              };
            })
          );
        }
      );

      const newPlaylist: Playlist = {
        id: newPlaylistId,
        title,
        subtitle: `Synced from YouTube Music • ${syncedTracks.length} discs`,
        category: 'YouTube Sync',
        tracks: syncedTracks,
      };

      setPlaylists((prev) => [...prev, newPlaylist]);
      setActivePlaylistId(newPlaylistId);
      setActiveTrackIndex(0);
      setCurrentTime(0);
      setIsPlaying(true);
      setSyncStatus(`Synced ${syncedTracks.length} tracks successfully!`);

      window.setTimeout(() => {
        setIsSyncModalOpen(false);
        setSyncStatus(null);
      }, 850);
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'Unable to sync playlist. Please verify URL.'
      );
      setSyncStatus(null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddSingleVideo = async (videoId: string) => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncStatus('Fetching track artwork & metadata…');

    try {
      const meta = await fetchVideoMetadata(videoId);
      if (!activePlaylist) {
        const newPlId = `yt-singles-${Date.now()}`;
        const newTrack = buildTrackFromYouTubeId(videoId, 0, meta, 'My YouTube Tracks');
        const newPl: Playlist = {
          id: newPlId,
          title: 'My YouTube Tracks',
          subtitle: 'Synced from YouTube Music',
          category: 'YouTube Sync',
          tracks: [newTrack],
        };
        setPlaylists([newPl]);
        setActivePlaylistId(newPlId);
        setActiveTrackIndex(0);
      } else {
        const newTrack = buildTrackFromYouTubeId(
          videoId,
          activePlaylist.tracks.length,
          meta,
          activePlaylist.title
        );
        setPlaylists((prev) =>
          prev.map((pl) =>
            pl.id === activePlaylist.id
              ? { ...pl, tracks: [...pl.tracks, newTrack] }
              : pl
          )
        );
        setActiveTrackIndex(activePlaylist.tracks.length);
      }
      setCurrentTime(0);
      setIsPlaying(true);
      setSyncStatus(`Pressed “${meta.title}” onto disc!`);

      window.setTimeout(() => {
        setIsSyncModalOpen(false);
        setSyncStatus(null);
      }, 750);
    } catch {
      setSyncError('Could not fetch track details from YouTube.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateNewCrate = useCallback(() => {
    const customCount = playlists.filter((p) => p.category === 'Custom Crate').length;
    const defaultName = `Mixtape #${customCount + 1}`;
    const name = window.prompt('Name your new custom crate:', defaultName);
    if (!name || !name.trim()) return;

    const newId = `custom-crate-${Date.now()}`;
    const newPl: Playlist = {
      id: newId,
      title: name.trim(),
      subtitle: '0 discs • Custom Crate',
      category: 'Custom Crate',
      tracks: [],
    };

    setPlaylists((prev) => [newPl, ...prev]);
    setActivePlaylistId(newId);
    setActiveTrackIndex(0);
    setIsPlaying(false);
    setViewToast(`Created "${name.trim()}"`);
    setIsSearchModalOpen(true);
  }, [playlists]);

  const handleDeleteTrack = useCallback(
    (trackIdx: number) => {
      if (!activePlaylist) return;
      const trackToRemove = activePlaylist.tracks[trackIdx];
      const nextTracks = activePlaylist.tracks.filter((_, i) => i !== trackIdx);

      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id !== activePlaylist.id) return pl;
          return {
            ...pl,
            subtitle: `${nextTracks.length} discs • ${pl.category}`,
            tracks: nextTracks,
          };
        })
      );

      if (activeTrackIndex >= nextTracks.length) {
        setActiveTrackIndex(Math.max(0, nextTracks.length - 1));
      }
      if (trackToRemove) {
        setViewToast(`Removed "${trackToRemove.title}"`);
      }
    },
    [activePlaylist, activeTrackIndex]
  );

  const handleShareCrate = useCallback(() => {
    if (!activePlaylist || activePlaylist.tracks.length === 0) {
      setViewToast('No tracks in crate to share');
      return;
    }
    const ytIds = activePlaylist.tracks
      .map((t) => t.youtubeId)
      .filter((id): id is string => Boolean(id && id.length === 11));

    if (ytIds.length === 0) {
      setViewToast('No YouTube tracks in crate');
      return;
    }

    const payload = `${encodeURIComponent(activePlaylist.title)}:${ytIds.join(',')}`;
    const shareUrl = `${window.location.origin}${window.location.pathname}#mixtape=${payload}`;

    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
        setViewToast('Mixtape link copied to clipboard 🔗');
      } else {
        window.prompt('Copy your mixtape link:', shareUrl);
      }
    } catch {
      window.prompt('Copy your mixtape link:', shareUrl);
    }
  }, [activePlaylist]);

  const isSyncedYouTube = playlists.length > 0;

  const sharedViewProps: SharedViewProps = {
    playlistTitle: activePlaylist?.title || 'YouTube Music',
    tracks,
    activeIndex: activeTrackIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    onSelectTrack: (idx) => {
      handleSelectTrack(idx);
      setIsPlaying(true);
    },
    onTogglePlay: () => setIsPlaying((p) => !p),
    onNext: handleNext,
    onPrev: handlePrev,
    onSeek: seekTo,
    onSetPlaybackRate: setPlaybackRate,
    onVolumeChange: (v) => {
      setVolume(v);
      if (v > 0 && isMuted) setIsMuted(false);
    },
    onToggleMute: () => setIsMuted((m) => !m),
    onToggleShuffle: () => setIsShuffle((s) => !s),
    onToggleRepeat: () =>
      setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off')),
  };

  return (
    <div
      className={`relative h-[100dvh] w-[100dvw] flex flex-col justify-between overflow-hidden select-none transition-colors duration-300 ${activeViewMeta.bgClass}`}
    >
      {/* Ultra-Minimal Floating Top Bar (adapts automatically to Dark / Light views) */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <HeaderNav
          isMenuOpen={isMenuOpen}
          isSyncedYouTube={isSyncedYouTube}
          isDark={activeViewMeta.isDark}
          isFullscreen={isFullscreen}
          isHudHidden={!chromeHudVisible && isFullscreen && !isMenuOpen}
          onToggleFullscreen={toggleFullscreen}
          onToggleMenu={() => setIsMenuOpen((o) => !o)}
          onOpenSearch={() => setIsSearchModalOpen(true)}
        />
      </div>

      {/* Subtle Floating View Switch Pill Toast */}
      <AnimatePresence>
        {viewToast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-neutral-950/80 text-white backdrop-blur-xl border border-white/10 font-mono text-[9.5px] uppercase tracking-[0.2em] shadow-lg"
          >
            {viewToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty Library State when user has no synced playlists yet */}
      {tracks.length === 0 ? (
        <main className="relative flex-1 w-full h-full flex flex-col items-center justify-center px-6 text-center">
          <h1
            className={`font-serif text-3xl sm:text-4xl font-medium uppercase tracking-tight mb-3 ${activeViewMeta.isDark ? 'text-white' : 'text-neutral-900'
              }`}
          >
            Your Library is Empty
          </h1>
          <p
            className={`font-mono text-[10.5px] uppercase tracking-[0.18em] mb-7 ${activeViewMeta.isDark ? 'text-white/50' : 'text-neutral-500'
              }`}
          >
            Paste any YouTube Music playlist to press your collection
          </p>
          <button
            onClick={() => {
              sound.playClick();
              setSyncError(null);
              setSyncStatus(null);
              setIsSyncModalOpen(true);
            }}
            className={`px-6 py-3 rounded-full text-[11.5px] font-medium tracking-wide flex items-center gap-2.5 shadow-lg transition-all active:scale-95 ${activeViewMeta.isDark
              ? 'bg-white text-black hover:bg-neutral-200'
              : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }`}
          >
            <YouTubeIcon className="w-4 h-4 text-red-500" />
            <span>Sync YouTube Music Playlist</span>
          </button>
        </main>
      ) : (
        /* Active Player View (7 Curated Interactive Views with Smooth Cross-Fade) */
        <AnimatePresence mode="wait">
          {viewMode === 'arc' && (
            <motion.main
              key="view-arc"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex-1 w-full h-full pt-12 flex flex-col justify-between overflow-hidden text-[#111111]"
            >
              {/* Single seamless studio cyclorama depth backdrop spanning the entire viewport */}
              <div
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                  background:
                    'radial-gradient(ellipse 78% 64% at 44% 32%, rgba(255,255,255,0.60) 0%, rgba(236,236,235,0) 66%), radial-gradient(ellipse 95% 58% at 50% 94%, rgba(16,16,20,0.085) 0%, rgba(16,16,20,0.03) 48%, rgba(0,0,0,0) 82%)',
                }}
              />

              <div className="absolute top-12 sm:top-16 left-4 right-16 sm:right-auto sm:left-9 z-30 pointer-events-none pt-safe sm:pt-0">
                {activeTrack && <TrackMetadata track={activeTrack} />}
              </div>

              <div className="flex-1 w-full flex items-center justify-center relative z-10">
                <CDCarousel
                  tracks={tracks}
                  activeIndex={activeTrackIndex}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  onSelectTrack={sharedViewProps.onSelectTrack}
                  onTogglePlay={sharedViewProps.onTogglePlay}
                  onSeek={seekTo}
                  onSetPlaybackRate={setPlaybackRate}
                  onScrubPreview={setArcScrubPreview}
                />
              </div>

              <footer
                className="relative z-30 w-full sm:pb-7 pt-2 sm:pt-4"
                style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
              >
                <PlayerControls
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  previewTime={arcScrubPreview}
                  duration={duration}
                  volume={volume}
                  isMuted={isMuted}
                  isShuffle={isShuffle}
                  repeatMode={repeatMode}
                  onTogglePlay={sharedViewProps.onTogglePlay}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  onSeek={seekTo}
                  onSetPlaybackRate={setPlaybackRate}
                  onVolumeChange={sharedViewProps.onVolumeChange}
                  onToggleMute={sharedViewProps.onToggleMute}
                  onToggleShuffle={sharedViewProps.onToggleShuffle}
                  onToggleRepeat={sharedViewProps.onToggleRepeat}
                />
              </footer>
            </motion.main>
          )}

          {viewMode === 'vinyl' && (
            <motion.main
              key="view-vinyl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <VinylDeckView
                playlistTitle={sharedViewProps.playlistTitle}
                tracks={tracks}
                activeIndex={activeTrackIndex}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                isMuted={isMuted}
                onSelectTrack={sharedViewProps.onSelectTrack}
                onTogglePlay={sharedViewProps.onTogglePlay}
                onNext={handleNext}
                onPrev={handlePrev}
                onSeek={seekTo}
                onSetPlaybackRate={setPlaybackRate}
                onToggleMute={sharedViewProps.onToggleMute}
              />
            </motion.main>
          )}

          {viewMode === 'chrome' && (
            <motion.main
              key="view-chrome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <ChromeVinylView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'crt' && (
            <motion.main
              key="view-crt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <RetroLCDView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'sleeve' && (
            <motion.main
              key="view-sleeve"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <VinylSleeveView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'braun' && (
            <motion.main
              key="view-braun"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <BraunTurntableView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'cassette' && (
            <motion.main
              key="view-cassette"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <CassetteDeckView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'pixel' && (
            <motion.main
              key="view-pixel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <PixelHeavenView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'atlas' && (
            <motion.main
              key="view-atlas"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <PixelAtlasView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'ember' && (
            <motion.main
              key="view-ember"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <EmberVinylView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'chroma' && (
            <motion.main
              key="view-chroma"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <ChromaVinylView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'binder' && (
            <motion.main
              key="view-binder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <BinderView {...sharedViewProps} />
            </motion.main>
          )}

          {viewMode === 'glam' && (
            <motion.main
              key="view-glam"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="relative flex-1 w-full h-full overflow-hidden"
            >
              <GlamPaletteView {...sharedViewProps} />
            </motion.main>
          )}
        </AnimatePresence>
      )}

      {/* Subtle Non-Blocking Notice Toast */}
      <AnimatePresence>
        {playerNotice && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-neutral-900/90 text-white backdrop-blur-xl text-[11px] font-sans flex items-center gap-2 shadow-lg"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{playerNotice}</span>
            <button
              onClick={() => setPlayerNotice(null)}
              className="ml-1 text-neutral-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Dual-Deck A/B YouTube IFrame Audio Engine (0ms Gapless Crossfade across all 10 views!) */}
      <div
        className={`fixed bottom-24 right-6 z-40 rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.3)] border border-black/15 bg-black transition-all duration-300 ${showMiniVideo
          ? 'w-72 h-40 opacity-100 scale-100 pointer-events-auto'
          : 'w-1 h-1 opacity-0 scale-95 pointer-events-none'
          }`}
      >
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${activeDeckIdx === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
        >
          <div id="yt-deck-a" className="w-full h-full" />
        </div>
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${activeDeckIdx === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
        >
          <div id="yt-deck-b" className="w-full h-full" />
        </div>
      </div>

      {/* Dedicated Hidden Loader for YouTube Playlist Sync */}
      <div
        id="yt-sync-loader"
        className="fixed -left-[9999px] -top-[9999px] w-1 h-1 opacity-0 pointer-events-none"
      />

      {/* YouTube Music Sync & Account Connect Modal */}
      <YouTubeSyncModal
        isOpen={isSyncModalOpen}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        syncError={syncError}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncPlaylist={handleSyncPlaylist}
        onAddSingleVideo={handleAddSingleVideo}
        onOpenCharts={() => {
          setIsSyncModalOpen(false);
          setIsChartsModalOpen(true);
        }}
        onImportCustomPlaylist={(newPl) => {
          setPlaylists((prev) => [newPl, ...prev]);
          setActivePlaylistId(newPl.id);
          setActiveTrackIndex(0);
          setIsPlaying(true);
          setViewToast(`Imported "${newPl.title}" ✦`);
        }}
      />

      {/* Song Search & Press to Disc Modal */}
      <SongSearchModal
        isOpen={isSearchModalOpen}
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectPlaylist={(id) => {
          setActivePlaylistId(id);
          setActiveTrackIndex(0);
        }}
        onAddSongToPlaylist={(result, playlistId) => {
          const targetPl = playlists.find((p) => p.id === playlistId) || activePlaylist;
          if (!targetPl) return;

          const newTrack = convertSearchResultToTrack(
            result,
            targetPl.tracks.length,
            targetPl.title
          );

          setPlaylists((prev) =>
            prev.map((pl) => {
              if (pl.id !== targetPl.id) return pl;
              const nextTracks = [...pl.tracks, newTrack];
              return {
                ...pl,
                subtitle: `${nextTracks.length} discs • ${pl.category}`,
                tracks: nextTracks,
              };
            })
          );

          setViewToast(`Pressed "${result.title}" onto "${targetPl.title}"! ✦`);
        }}
        onCreatePlaylist={(title) => {
          const newId = `custom-crate-${Date.now()}`;
          const newPl: Playlist = {
            id: newId,
            title,
            subtitle: '0 discs • Custom Crate',
            category: 'Custom Crate',
            tracks: [],
          };
          setPlaylists((prev) => [newPl, ...prev]);
          setActivePlaylistId(newId);
          setActiveTrackIndex(0);
          setViewToast(`Created "${title}" ✦`);
          return newId;
        }}
      />

      {/* Live YouTube Music Charts Modal */}
      <YouTubeChartsModal
        isOpen={isChartsModalOpen}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onClose={() => setIsChartsModalOpen(false)}
        onSelectChart={(playlistId, chartTitle) => {
          handleSyncPlaylist(playlistId, chartTitle);
        }}
      />

      {/* Right-Side Minimal Hamburger Menu Drawer */}
      <MenuDrawer
        isOpen={isMenuOpen}
        viewMode={viewMode}
        playlists={playlists}
        activePlaylist={activePlaylist}
        activeTrackIndex={activeTrackIndex}
        isPlaying={isPlaying}
        showMiniVideo={showMiniVideo}
        onClose={() => setIsMenuOpen(false)}
        onChangeViewMode={switchViewWithToast}
        onSelectPlaylist={handleSelectPlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onSelectTrack={sharedViewProps.onSelectTrack}
        onDeleteTrack={handleDeleteTrack}
        onOpenSyncModal={() => {
          setSyncError(null);
          setSyncStatus(null);
          setIsSyncModalOpen(true);
        }}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenCharts={() => setIsChartsModalOpen(true)}
        onCreateNewCrate={handleCreateNewCrate}
        onShareCrate={handleShareCrate}
        onToggleMiniVideo={() => setShowMiniVideo((v) => !v)}
      />
    </div>
  );
}

export default App;
