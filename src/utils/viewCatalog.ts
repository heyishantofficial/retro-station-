import { Track } from '../types';

export type PlayerViewMode =
  | 'arc'
  | 'vinyl'
  | 'chrome'
  | 'crt'
  | 'sleeve'
  | 'braun'
  | 'cassette'
  | 'pixel'
  | 'atlas'
  | 'ember'
  | 'chroma'
  | 'binder'
  | 'glam';

export interface ViewCatalogItem {
  id: PlayerViewMode;
  name: string;
  subtitle: string;
  badge?: string;
  isDark: boolean;
  bgClass: string;
}

export const VIEW_CATALOG: ViewCatalogItem[] = [
  {
    id: 'arc',
    name: 'Orbit Gallery',
    subtitle: 'Floating Parabolic CD Arc',
    badge: '3D',
    isDark: false,
    bgClass: 'bg-[#ececeb] studio-grain',
  },
  {
    id: 'vinyl',
    name: 'Swiss Monolith',
    subtitle: 'Minimalist Studio Turntable',
    badge: 'SWISS',
    isDark: false,
    bgClass: 'bg-[#f8f8f7]',
  },
  {
    id: 'chrome',
    name: 'Liquid Chrome',
    subtitle: 'Cybernetic Molten Mirror',
    badge: 'CYBER',
    isDark: true,
    bgClass: 'bg-black',
  },
  {
    id: 'crt',
    name: 'Cathode Ray',
    subtitle: 'Curved Phosphor CRT Glow',
    badge: '90S',
    isDark: true,
    bgClass: 'bg-black',
  },
  {
    id: 'sleeve',
    name: 'Kraft & Vinyl',
    subtitle: 'Raw Cardboard Record Sleeve',
    badge: 'PRINT',
    isDark: true,
    bgClass: 'bg-[#362c20]',
  },
  {
    id: 'braun',
    name: 'Atelier 1956',
    subtitle: 'Mid-Century German Hi-Fi',
    badge: 'RAMS',
    isDark: false,
    bgClass: 'bg-[#e6e6e4]',
  },
  {
    id: 'cassette',
    name: 'Crimson Spool',
    subtitle: 'Analog Dual-Reel Cassette',
    badge: 'TAPE',
    isDark: true,
    bgClass: 'bg-[#c80d3a]',
  },
  {
    id: 'pixel',
    name: 'Pixel Genesis',
    subtitle: '16-Bit Creation of Adam',
    badge: 'PIXEL',
    isDark: true,
    bgClass: 'bg-[#1c2a38]',
  },
  {
    id: 'atlas',
    name: "Titan's Orbit",
    subtitle: '16-Bit Celestial Atlas',
    badge: 'MYTH',
    isDark: true,
    bgClass: 'bg-[#3a332a]',
  },
  {
    id: 'ember',
    name: 'Magma Forge',
    subtitle: 'Fluid Molten Fire & Titanium',
    badge: 'FLUID',
    isDark: true,
    bgClass: 'bg-[#0b0a0a]',
  },
  {
    id: 'chroma',
    name: 'Prism Aura',
    subtitle: 'Artwork-Reactive Ambient Light',
    badge: 'PRISM',
    isDark: true,
    bgClass: 'bg-[#b81b17]',
  },
  {
    id: 'binder',
    name: 'Case Logic',
    subtitle: '90s Frosted PVC Disc Wallet',
    badge: 'Y2K',
    isDark: true,
    bgClass: 'bg-[#0d0d10]',
  },
  {
    id: 'glam',
    name: 'Cherry Gloss',
    subtitle: 'Y2K Strawberry Mirror Compact',
    badge: 'GLAM',
    isDark: false,
    bgClass: 'bg-[#f9c8e1]',
  },
];

export function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDelta(deltaSecs: number): string {
  const sign = deltaSecs >= 0 ? '+' : '−';
  const abs = Math.abs(Math.round(deltaSecs));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

export function cleanDisplayTitle(rawTitle: string): string {
  const primary = rawTitle.split(/\s*\|\s*/)[0].trim();
  return (primary || rawTitle).toUpperCase();
}

export function getBestCoverUrl(track?: Track): string {
  if (!track) return '';
  if (track.youtubeId) {
    return `https://i.ytimg.com/vi/${track.youtubeId}/maxresdefault.jpg`;
  }
  return track.coverUrl;
}

export interface SharedViewProps {
  playlistTitle: string;
  tracks: Track[];
  activeIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  onSelectTrack: (index: number) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}
