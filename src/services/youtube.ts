import { Track } from '../types';

export interface ParsedYouTubeInput {
  type: 'playlist' | 'video' | 'invalid';
  id: string;
}

/**
 * Parses a YouTube / YouTube Music URL or raw ID into either a playlist ID or video ID.
 */
export function parseYouTubeInput(input: string): ParsedYouTubeInput {
  const trimmed = input.trim();
  if (!trimmed) return { type: 'invalid', id: '' };

  // Try URL parsing first
  try {
    const urlStr = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(urlStr);
    const listParam = url.searchParams.get('list');
    const vParam = url.searchParams.get('v');

    if (listParam && listParam.length >= 10) {
      return { type: 'playlist', id: listParam };
    }
    if (vParam && vParam.length === 11) {
      return { type: 'video', id: vParam };
    }
    // youtu.be/<id>
    if (url.hostname.includes('youtu.be')) {
      const seg = url.pathname.replace(/^\//, '').split('/')[0];
      if (seg && seg.length === 11) {
        return { type: 'video', id: seg };
      }
    }
  } catch {
    // Not a full URL — inspect raw IDs
  }

  // Raw playlist ID (PL..., OLAK5uy_..., RDCLAK5uy_..., UU..., FL...)
  if (/^(PL|OLAK5uy_|RDCLAK5uy_|UU|LL|FL)[a-zA-Z0-9_-]{8,}$/.test(trimmed)) {
    return { type: 'playlist', id: trimmed };
  }

  // Raw 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', id: trimmed };
  }

  return { type: 'invalid', id: '' };
}

export interface VideoMeta {
  title: string;
  author: string;
  thumbnail: string;
}

/**
 * Fetches title & artist metadata for a YouTube video ID using CORS-friendly oEmbed.
 */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMeta> {
  const cleanThumb = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
    );
    if (!res.ok) throw new Error('oEmbed failed');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    let title: string = data.title || `Track ${videoId}`;
    let author: string = (data.author_name || 'YouTube Music').replace(/ - Topic$/i, '');

    // Clean common "Artist - Song (Official Audio)" patterns
    const dashMatch = title.match(/^(.+?)\s[-–—]\s(.+)$/);
    if ((dashMatch && author.toLowerCase().includes('vevo')) || (dashMatch && !title.toLowerCase().includes(author.toLowerCase()))) {
      author = dashMatch[1].trim();
      title = dashMatch[2].trim();
    }

    // Strip noisy suffixes for clean A24 editorial typography
    title = title
      .replace(/\s*\((Official\s*(Music\s*)?Video|Official\s*Audio|Lyric\s*Video|Visualizer|Audio|HD|4K)\)/gi, '')
      .replace(/\s*\[(Official\s*(Music\s*)?Video|Official\s*Audio|Lyric\s*Video|Audio)\]/gi, '')
      .trim();

    return {
      title,
      author,
      thumbnail: cleanThumb,
    };
  } catch {
    return {
      title: `Track ${videoId.slice(0, 6)}`,
      author: 'YouTube Music',
      thumbnail: cleanThumb,
    };
  }
}

const EDITORIAL_QUOTES = [
  { text: 'PURE SONIC CLARITY IN MOTION', source: 'YOUTUBE MUSIC ARCHIVE', stars: 5 },
  { text: 'AN ESSENTIAL SELECTION FROM YOUR PERSONAL ROTATION', source: 'A24 AUDIO LAB', stars: 5 },
  { text: 'TIMELESS ATMOSPHERE, PRESSED TO DIGITAL SILVER', source: 'PITCHFORK', stars: 5 },
  { text: 'EFFORTLESSLY MINIMAL, DEEPLY RESONANT', source: 'THE WIRE', stars: 5 },
  { text: 'A HYPNOTIC LATE-NIGHT LISTENING EXPERIENCE', source: 'RESIDENT ADVISOR', stars: 5 },
  { text: 'SHARP PRODUCTION WITH UNMISTAKABLE EMOTIONAL WEIGHT', source: 'ROLLING STONE', stars: 5 },
];

export function buildTrackFromYouTubeId(
  videoId: string,
  index: number,
  meta?: Partial<VideoMeta>,
  playlistName = 'YouTube Music Sync'
): Track {
  const q1 = EDITORIAL_QUOTES[(index * 2) % EDITORIAL_QUOTES.length];
  const q2 = EDITORIAL_QUOTES[(index * 2 + 1) % EDITORIAL_QUOTES.length];
  const designs: Track['discDesign'][] = ['artistic', 'dark', 'typography', 'minimal'];

  return {
    id: `yt-${videoId}-${index}`,
    youtubeId: videoId,
    title: (meta?.title || `TRACK ${String(index + 1).padStart(2, '0')}`).toUpperCase(),
    artist: meta?.author || 'YouTube Music',
    album: playlistName,
    year: String(new Date().getFullYear()),
    duration: 210,
    coverUrl: meta?.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    genre: 'YouTube Music Stream',
    label: 'Synced Library',
    matrixCode: `YT-${videoId.toUpperCase().slice(0, 6)}-${String(index + 1).padStart(2, '0')}`,
    discDesign: designs[index % designs.length],
    quotes: [q1, q2],
  };
}

/**
 * Loads the official YouTube IFrame API script once and resolves when YT.Player is ready.
 */
let ytApiPromise: Promise<void> | null = null;

export function loadYouTubeIFrameAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as unknown as { YT?: { Player?: unknown } }).YT?.Player) {
    return Promise.resolve();
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const prevCallback = (window as unknown as { onYouTubeIframeAPIReady?: () => void })
      .onYouTubeIframeAPIReady;

    (window as unknown as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      resolve();
    };

    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  });

  return ytApiPromise;
}
