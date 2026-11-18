export interface CriticQuote {
  text: string;
  source: string;
  stars?: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  duration: number; // in seconds
  coverUrl: string;
  youtubeId?: string; // YouTube video ID or stream query
  genre: string;
  label: string;
  matrixCode: string; // e.g. "A24-EEAAO-04" laser etched on inner hub
  quotes: CriticQuote[];
  themeColor?: string;
  discDesign?: 'artistic' | 'minimal' | 'typography' | 'dark';
}

export interface Playlist {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  tracks: Track[];
}

export type PlaybackStatus = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';
