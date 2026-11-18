import { useEffect, useRef, useState, useCallback } from 'react';
import {
  loadYouTubeIFrameAPI,
  buildTrackFromYouTubeId,
  fetchVideoMetadata,
} from '../services/youtube';
import { Track } from '../types';

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  cuePlaylist: (opts: { listType: string; list: string; index?: number }) => void;
  getPlaylist: () => string[] | null;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (vol: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoData: () => { title?: string; author?: string; video_id?: string };
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
  }
}

interface UseYouTubePlayerArgs {
  activeTrack: Track | undefined;
  nextTrack?: Track | undefined;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  onTrackEnded: () => void;
  onSyncPlayState: (playing: boolean) => void;
  onDurationUpdate: (duration: number) => void;
  onCurrentTimeUpdate: (time: number) => void;
  onErrorNotice: (msg: string | null) => void;
}

export function useYouTubePlayer({
  activeTrack,
  nextTrack,
  isPlaying,
  volume,
  isMuted,
  onTrackEnded,
  onSyncPlayState,
  onDurationUpdate,
  onCurrentTimeUpdate,
  onErrorNotice,
}: UseYouTubePlayerArgs) {
  // Dual-Deck A/B Turntable Engine for TRUE 0ms gapless crossfade!
  const decksRef = useRef<[YTPlayerInstance | null, YTPlayerInstance | null]>([null, null]);
  const deckVideoIdsRef = useRef<[string | null, string | null]>([null, null]);
  const deckVolsRef = useRef<[number, number]>([volume, 0]);
  const activeDeckIdxRef = useRef<0 | 1>(0);
  const [activeDeckIdx, setActiveDeckIdx] = useState<0 | 1>(0);

  const syncPlayerRef = useRef<YTPlayerInstance | null>(null);
  const [isReady, setIsReady] = useState(false);

  const fadeRafRef = useRef<number | null>(null);
  const targetVolRef = useRef<number>(volume);
  const isMutedRef = useRef<boolean>(isMuted);
  const isPlayingRef = useRef<boolean>(isPlaying);

  // Pending crossfade metadata: incoming deck loads silently while outgoing deck keeps playing continuously!
  const pendingDeckRef = useRef<{
    incomingIdx: 0 | 1;
    videoId: string;
    seq: number;
  } | null>(null);
  const switchSeqRef = useRef(0);
  const isFadingOutPauseRef = useRef(false);
  const autoCrossfadeTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    targetVolRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const callbacksRef = useRef({
    onTrackEnded,
    onSyncPlayState,
    onDurationUpdate,
    onCurrentTimeUpdate,
    onErrorNotice,
  });

  useEffect(() => {
    callbacksRef.current = {
      onTrackEnded,
      onSyncPlayState,
      onDurationUpdate,
      onCurrentTimeUpdate,
      onErrorNotice,
    };
  }, [onTrackEnded, onSyncPlayState, onDurationUpdate, onCurrentTimeUpdate, onErrorNotice]);

  const cancelFade = useCallback(() => {
    if (fadeRafRef.current !== null) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
  }, []);

  // Pre-cue the upcoming track silently on the idle standby deck so Next starts near-instantly!
  const precueStandby = useCallback((videoId: string | undefined) => {
    if (!videoId) return;
    if (pendingDeckRef.current) return;
    const standbyIdx: 0 | 1 = activeDeckIdxRef.current === 0 ? 1 : 0;
    const standby = decksRef.current[standbyIdx];
    if (!standby || deckVideoIdsRef.current[standbyIdx] === videoId) return;
    try {
      deckVideoIdsRef.current[standbyIdx] = videoId;
      deckVolsRef.current[standbyIdx] = 0;
      standby.setVolume(0);
      standby.cueVideoById(videoId);
    } catch {
      // ignore
    }
  }, []);

  // Execute true equal-power DJ crossfade between outgoing deck -> incoming deck (0ms silence!)
  const startEqualPowerCrossfade = useCallback(
    (incomingIdx: 0 | 1, outgoingIdx: 0 | 1) => {
      cancelFade();
      const incoming = decksRef.current[incomingIdx];
      const outgoing = decksRef.current[outgoingIdx];
      if (!incoming) return;

      const startOutVol = deckVolsRef.current[outgoingIdx];
      const startTime = performance.now();
      const crossfadeMs = 680; // Lush DJ crossfade duration

      // Promote incoming deck to active immediately as audio blends in
      activeDeckIdxRef.current = incomingIdx;
      setActiveDeckIdx(incomingIdx);

      const step = (now: number) => {
        const u = Math.min(1, (now - startTime) / crossfadeMs);
        // Smooth equal-power cosine/sine curve so perceived loudness NEVER dips!
        const smoothU = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const gainIn = Math.sin(smoothU * (Math.PI / 2));
        const gainOut = Math.cos(smoothU * (Math.PI / 2));

        const targetV = isMutedRef.current ? 0 : targetVolRef.current;
        const vIn = targetV * gainIn;
        const vOut = startOutVol * gainOut;

        deckVolsRef.current[incomingIdx] = vIn;
        deckVolsRef.current[outgoingIdx] = vOut;

        try {
          incoming.setVolume(Math.round(vIn));
          outgoing?.setVolume(Math.round(vOut));
        } catch {
          // ignore
        }

        if (u < 1) {
          fadeRafRef.current = requestAnimationFrame(step);
        } else {
          fadeRafRef.current = null;
          try {
            outgoing?.pauseVideo();
            outgoing?.setVolume(0);
            deckVolsRef.current[outgoingIdx] = 0;
          } catch {
            // ignore
          }
          // Warm up the newly freed standby deck with the next track!
          if (nextTrack?.youtubeId) {
            precueStandby(nextTrack.youtubeId);
          }
        }
      };

      fadeRafRef.current = requestAnimationFrame(step);
    },
    [cancelFade, nextTrack?.youtubeId, precueStandby]
  );

  // Single-deck cubic ease-in-out volume fade for Play / Pause
  const runSingleDeckFade = useCallback(
    (deckIdx: 0 | 1, fromVol: number, toVol: number, durMs: number, onComplete?: () => void) => {
      cancelFade();
      const deck = decksRef.current[deckIdx];
      if (!deck) {
        onComplete?.();
        return;
      }

      const easeInOutCubic = (u: number) =>
        u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

      const startTime = performance.now();
      const step = (now: number) => {
        const u = Math.min(1, (now - startTime) / durMs);
        const v = fromVol + (toVol - fromVol) * easeInOutCubic(u);
        deckVolsRef.current[deckIdx] = v;
        try {
          deck.setVolume(Math.round(v));
        } catch {
          // ignore
        }
        if (u < 1) {
          fadeRafRef.current = requestAnimationFrame(step);
        } else {
          fadeRafRef.current = null;
          onComplete?.();
        }
      };
      fadeRafRef.current = requestAnimationFrame(step);
    },
    [cancelFade]
  );

  // Initialize Dual-Deck A & B YouTube IFrame Players
  useEffect(() => {
    let mounted = true;
    let readyCount = 0;

    loadYouTubeIFrameAPI().then(() => {
      if (!mounted || !window.YT?.Player) return;

      const createDeck = (idx: 0 | 1, elementId: string, initialVideoId?: string) => {
        const container = document.getElementById(elementId);
        if (!container) return;

        decksRef.current[idx] = new window.YT!.Player(elementId, {
          height: '180',
          width: '320',
          videoId: initialVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (!mounted) return;
              const initVol = idx === 0 ? targetVolRef.current : 0;
              e.target.setVolume(initVol);
              deckVolsRef.current[idx] = initVol;
              if (isMutedRef.current) e.target.mute();
              if (initialVideoId) {
                deckVideoIdsRef.current[idx] = initialVideoId;
              }
              readyCount += 1;
              if (readyCount >= 2) {
                setIsReady(true);
              }
            },
            onStateChange: (e) => {
              if (!mounted) return;
              const state = e.data;
              const pending = pendingDeckRef.current;

              // Case 1: The standby incoming deck just began streaming real audio -> trigger 0ms crossfade!
              if (pending && pending.incomingIdx === idx && state === 1) {
                const outgoingIdx: 0 | 1 = idx === 0 ? 1 : 0;
                pendingDeckRef.current = null;
                callbacksRef.current.onErrorNotice(null);
                const dur = e.target.getDuration();
                if (dur && dur > 0) callbacksRef.current.onDurationUpdate(dur);
                startEqualPowerCrossfade(idx, outgoingIdx);
                return;
              }

              // Ignore events from the non-active standby deck
              if (idx !== activeDeckIdxRef.current) return;

              if (state === 1) {
                callbacksRef.current.onErrorNotice(null);
                if (!isFadingOutPauseRef.current) {
                  callbacksRef.current.onSyncPlayState(true);
                }
                const dur = e.target.getDuration();
                if (dur && dur > 0) callbacksRef.current.onDurationUpdate(dur);
              } else if (state === 2) {
                if (!isFadingOutPauseRef.current && !pendingDeckRef.current) {
                  callbacksRef.current.onSyncPlayState(false);
                }
              } else if (state === 0) {
                if (!pendingDeckRef.current) {
                  callbacksRef.current.onTrackEnded();
                }
              }
            },
            onError: (e) => {
              if (!mounted) return;
              const pending = pendingDeckRef.current;
              if (pending && pending.incomingIdx === idx) {
                pendingDeckRef.current = null;
              }
              if (idx === activeDeckIdxRef.current || pending?.incomingIdx === idx) {
                if (e.data === 101 || e.data === 150) {
                  callbacksRef.current.onErrorNotice(
                    'Owner restricted embedding for this video — click Next or sync another track.'
                  );
                } else {
                  callbacksRef.current.onErrorNotice('Stream unavailable on YouTube.');
                }
              }
            },
          },
        });
      };

      createDeck(0, 'yt-deck-a', activeTrack?.youtubeId || 'Wwce1L37q00');
      createDeck(1, 'yt-deck-b', nextTrack?.youtubeId);
    });

    return () => {
      mounted = false;
      cancelFade();
      decksRef.current.forEach((d) => {
        try {
          d?.destroy();
        } catch {
          // ignore
        }
      });
      decksRef.current = [null, null];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep standby deck pre-cued with the upcoming track whenever idle
  useEffect(() => {
    if (!isReady || !nextTrack?.youtubeId) return;
    const timer = window.setTimeout(() => {
      precueStandby(nextTrack.youtubeId);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [isReady, nextTrack?.youtubeId, activeDeckIdx, precueStandby]);

  // ZERO-GAP DUAL-DECK TRACK SWITCHING!
  // While the current deck keeps playing continuously, the standby deck silently loads & starts the new song.
  // The exact millisecond the new song's audio starts flowing, both decks equal-power crossfade!
  useEffect(() => {
    if (!isReady || !activeTrack?.youtubeId) return;

    const currentIdx = activeDeckIdxRef.current;
    const currentDeck = decksRef.current[currentIdx];
    const standbyIdx: 0 | 1 = currentIdx === 0 ? 1 : 0;
    const standbyDeck = decksRef.current[standbyIdx];
    const targetVideoId = activeTrack.youtubeId;

    // Already playing or already loading this exact video?
    if (
      deckVideoIdsRef.current[currentIdx] === targetVideoId &&
      !pendingDeckRef.current
    ) {
      return;
    }
    if (pendingDeckRef.current?.videoId === targetVideoId) {
      return;
    }

    autoCrossfadeTriggeredRef.current = null;
    callbacksRef.current.onErrorNotice(null);
    callbacksRef.current.onCurrentTimeUpdate(0);
    callbacksRef.current.onDurationUpdate(activeTrack.duration);

    const isOutgoingAudible =
      isPlaying && currentDeck && currentDeck.getPlayerState?.() === 1;

    if (isPlaying && standbyDeck && isOutgoingAudible) {
      // TRUE ZERO-MILLISECOND GAP: leave currentDeck playing continuously while standbyDeck loads silently!
      const seq = ++switchSeqRef.current;
      pendingDeckRef.current = {
        incomingIdx: standbyIdx,
        videoId: targetVideoId,
        seq,
      };

      try {
        standbyDeck.setPlaybackRate?.(1);
        deckVolsRef.current[standbyIdx] = 0;
        standbyDeck.setVolume(0);
        if (isMutedRef.current) standbyDeck.mute();
        else standbyDeck.unMute();

        if (deckVideoIdsRef.current[standbyIdx] === targetVideoId) {
          // Already pre-cued on standby deck! Play immediately for near-instant crossfade!
          standbyDeck.seekTo(0, true);
          standbyDeck.playVideo();
        } else {
          deckVideoIdsRef.current[standbyIdx] = targetVideoId;
          standbyDeck.loadVideoById(targetVideoId);
        }
      } catch {
        pendingDeckRef.current = null;
      }
    } else if (currentDeck) {
      // Starting from paused/standby state -> load directly onto active deck
      pendingDeckRef.current = null;
      deckVideoIdsRef.current[currentIdx] = targetVideoId;
      try {
        currentDeck.setPlaybackRate?.(1);
        if (isPlaying) {
          deckVolsRef.current[currentIdx] = 0;
          currentDeck.setVolume(0);
          currentDeck.loadVideoById(targetVideoId);
          runSingleDeckFade(currentIdx, 0, targetVolRef.current, 380);
        } else {
          currentDeck.cueVideoById(targetVideoId);
        }
      } catch {
        // ignore
      }
    }
  }, [activeTrack, isReady, isPlaying, runSingleDeckFade]);

  // Smooth Cubic Ease-In-Out Audio Fade on Play & Pause
  useEffect(() => {
    if (!isReady) return;
    if (pendingDeckRef.current) return;

    const idx = activeDeckIdxRef.current;
    const deck = decksRef.current[idx];
    if (!deck) return;

    try {
      const state = deck.getPlayerState?.();
      if (isPlaying) {
        isFadingOutPauseRef.current = false;
        const startVol = state === 1 ? deckVolsRef.current[idx] : 0;
        if (state !== 1 && state !== 3) {
          deck.setVolume(startVol);
          deck.playVideo();
        }
        runSingleDeckFade(idx, startVol, targetVolRef.current, 380);
      } else if (state === 1) {
        isFadingOutPauseRef.current = true;
        // Also pause standby deck cleanly if anything was pre-loading
        const standby = decksRef.current[idx === 0 ? 1 : 0];
        try {
          standby?.pauseVideo();
        } catch {
          // ignore
        }
        runSingleDeckFade(idx, deckVolsRef.current[idx], 0, 340, () => {
          try {
            deck.pauseVideo();
          } catch {
            // ignore
          }
          isFadingOutPauseRef.current = false;
        });
      }
    } catch {
      // ignore
    }
  }, [isPlaying, isReady, runSingleDeckFade]);

  // Volume & Mute control
  useEffect(() => {
    if (!isReady) return;
    const idx = activeDeckIdxRef.current;
    const deck = decksRef.current[idx];
    const standby = decksRef.current[idx === 0 ? 1 : 0];
    try {
      deckVolsRef.current[idx] = volume;
      deck?.setVolume(volume);
      if (isMuted) {
        deck?.mute();
        standby?.mute();
      } else {
        deck?.unMute();
        standby?.unMute();
      }
    } catch {
      // ignore
    }
  }, [volume, isMuted, isReady]);

  // Progress Polling + Automatic End-of-Track Zero-Gap Crossfade Trigger (1.6s before end!)
  useEffect(() => {
    if (!isReady || !isPlaying) return;
    const timer = window.setInterval(() => {
      const idx = activeDeckIdxRef.current;
      const deck = decksRef.current[idx];
      if (!deck || pendingDeckRef.current) return;
      try {
        const t = deck.getCurrentTime();
        const d = deck.getDuration();
        if (typeof t === 'number' && !isNaN(t)) {
          callbacksRef.current.onCurrentTimeUpdate(t);
        }
        if (typeof d === 'number' && d > 0) {
          callbacksRef.current.onDurationUpdate(d);
          // Trigger seamless auto-crossfade 1.6s before song finishes!
          const curVid = deckVideoIdsRef.current[idx];
          if (
            d > 10 &&
            d - t <= 1.6 &&
            curVid &&
            autoCrossfadeTriggeredRef.current !== curVid
          ) {
            autoCrossfadeTriggeredRef.current = curVid;
            callbacksRef.current.onTrackEnded();
          }
        }
      } catch {
        // ignore
      }
    }, 220);

    return () => window.clearInterval(timer);
  }, [isReady, isPlaying]);

  const seekTo = useCallback((seconds: number) => {
    const deck = decksRef.current[activeDeckIdxRef.current];
    if (!deck) return;
    try {
      deck.seekTo(seconds, true);
      callbacksRef.current.onCurrentTimeUpdate(seconds);
    } catch {
      // ignore
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const deck = decksRef.current[activeDeckIdxRef.current];
    if (!deck) return;
    try {
      deck.setPlaybackRate?.(rate);
    } catch {
      // ignore
    }
  }, []);

  /**
   * Syncs any public/unlisted YouTube or YouTube Music playlist ID into Track[]
   * using a dedicated hidden YouTube IFrame API loader (zero API key required!).
   */
  const fetchPlaylistTracks = useCallback(
    async (
      playlistId: string,
      playlistName: string,
      onProgress?: (status: string) => void,
      onTrackHydrated?: (updatedTrack: Track) => void
    ): Promise<Track[]> => {
      await loadYouTubeIFrameAPI();
      if (!window.YT?.Player) {
        throw new Error('YouTube API failed to load. Please check your internet connection.');
      }

      onProgress?.('Connecting to YouTube Music playlist…');

      const videoIds = await new Promise<string[]>((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(
              new Error(
                'Could not read this playlist. Make sure it is Public or Unlisted (not Private).'
              )
            );
          }
        }, 12000);

        const cleanup = () => {
          window.clearTimeout(timeout);
          try {
            syncPlayerRef.current?.destroy();
          } catch {
            // ignore
          }
          syncPlayerRef.current = null;
          const el = document.getElementById('yt-sync-loader');
          if (el) el.innerHTML = '';
        };

        const host = document.getElementById('yt-sync-loader');
        if (!host) {
          cleanup();
          reject(new Error('Sync container missing.'));
          return;
        }
        host.innerHTML = '<div id="yt-sync-inner"></div>';

        syncPlayerRef.current = new window.YT!.Player('yt-sync-inner', {
          height: '1',
          width: '1',
          playerVars: {
            listType: 'playlist',
            list: playlistId,
            autoplay: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              e.target.cuePlaylist({ listType: 'playlist', list: playlistId, index: 0 });
              const poll = window.setInterval(() => {
                if (settled) {
                  window.clearInterval(poll);
                  return;
                }
                const list = e.target.getPlaylist?.();
                if (Array.isArray(list) && list.length > 0) {
                  settled = true;
                  window.clearInterval(poll);
                  cleanup();
                  resolve(list.slice(0, 40));
                }
              }, 300);
            },
            onStateChange: (e) => {
              if (settled) return;
              const list = e.target.getPlaylist?.();
              if (Array.isArray(list) && list.length > 0) {
                settled = true;
                cleanup();
                resolve(list.slice(0, 40));
              }
            },
            onError: () => {
              if (!settled) {
                settled = true;
                cleanup();
                reject(
                  new Error(
                    'Playlist unavailable or Private. Set your YouTube Music playlist to Unlisted or Public.'
                  )
                );
              }
            },
          },
        });
      });

      onProgress?.(`Found ${videoIds.length} tracks — pressing digital CDs…`);

      const initialTracks = videoIds.map((vid, idx) =>
        buildTrackFromYouTubeId(vid, idx, undefined, playlistName)
      );

      const firstBatch = await Promise.all(
        initialTracks.slice(0, 5).map(async (_, idx) => {
          const meta = await fetchVideoMetadata(videoIds[idx]);
          return buildTrackFromYouTubeId(videoIds[idx], idx, meta, playlistName);
        })
      );

      const finalInitial = [...firstBatch, ...initialTracks.slice(5)];

      if (videoIds.length > 5 && onTrackHydrated) {
        (async () => {
          for (let i = 5; i < videoIds.length; i++) {
            const meta = await fetchVideoMetadata(videoIds[i]);
            onTrackHydrated(buildTrackFromYouTubeId(videoIds[i], i, meta, playlistName));
          }
        })();
      }

      return finalInitial;
    },
    []
  );

  return {
    isReady,
    activeDeckIdx,
    seekTo,
    setPlaybackRate,
    fetchPlaylistTracks,
  };
}
