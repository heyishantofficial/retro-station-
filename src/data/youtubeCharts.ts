export interface YouTubeChartItem {
  id: string;
  title: string;
  subtitle: string;
  playlistId: string;
  badge: string;
  country: string;
  cadence: 'daily' | 'weekly';
  accentColor: string;
  imageUrl?: string;
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export const CHART_COUNTRIES: CountryOption[] = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'GLOBAL', name: 'Global', flag: '🌐' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
];

export const YOUTUBE_CHARTS: Record<string, YouTubeChartItem[]> = {
  IN: [
    {
      id: 'in-trending-20',
      title: 'Trending 20 India',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn7tP2-t13_YdYv3V2Zc3fE3',
      badge: 'TRENDING 20',
      cadence: 'daily',
      country: 'India',
      accentColor: 'from-[#b388ff] to-[#7c4dff]',
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'in-top-music-videos-daily',
      title: 'Daily Top Music Videos - India',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PLDIoUOhQQPlXr63I_vwF9GD8sAKh77dWU',
      badge: 'TOP 100 VIDEOS',
      cadence: 'daily',
      country: 'India',
      accentColor: 'from-[#c084fc] to-[#9333ea]',
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'in-shorts-top-50-daily',
      title: 'Daily Top Songs on Shorts - India',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn5kI81J1fYWK5eZRl1zJ5kK',
      badge: 'SHORTS 50',
      cadence: 'daily',
      country: 'India',
      accentColor: 'from-[#e9d5ff] to-[#c084fc]',
      imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'in-top-100-songs-weekly',
      title: 'Top 100 Songs India',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn5kI81J1fYWK5eZRl1zJ5kK',
      badge: 'TOP 100 SONGS',
      cadence: 'weekly',
      country: 'India',
      accentColor: 'from-[#c084fc] to-[#9333ea]',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'in-top-music-videos-weekly',
      title: 'Top 100 Music Videos India',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PLDIoUOhQQPlXr63I_vwF9GD8sAKh77dWU',
      badge: 'TOP 100 VIDEOS',
      cadence: 'weekly',
      country: 'India',
      accentColor: 'from-[#d8b4fe] to-[#a855f7]',
      imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'in-shorts-weekly',
      title: 'Weekly Top Songs on Shorts - India',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn7tP2-t13_YdYv3V2Zc3fE3',
      badge: 'SHORTS 50',
      cadence: 'weekly',
      country: 'India',
      accentColor: 'from-[#e9d5ff] to-[#a855f7]',
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    },
  ],
  GLOBAL: [
    {
      id: 'global-trending-20',
      title: 'Trending 20 Global',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn5hT9vQ2a3qfQ_4d1v3_E6b',
      badge: 'TRENDING 20',
      cadence: 'daily',
      country: 'Global',
      accentColor: 'from-[#a5b4fc] to-[#6366f1]',
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'global-top-music-videos',
      title: 'Top 100 Music Videos Global',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn6puJdseH2Rt9sMvt9E2M4i',
      badge: 'TOP 100 VIDEOS',
      cadence: 'daily',
      country: 'Global',
      accentColor: 'from-[#c7d2fe] to-[#4338ca]',
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'global-top-100-songs',
      title: 'Top 100 Songs Global',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn69On1f-8NAvX_CYlx7QyZc',
      badge: 'TOP 100 SONGS',
      cadence: 'weekly',
      country: 'Global',
      accentColor: 'from-[#818cf8] to-[#4f46e5]',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
    },
  ],
  US: [
    {
      id: 'us-trending-20',
      title: 'Trending 20 United States',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PLrEnWoR732-Bh2i4S3f6C51w2sQ6WfL3p',
      badge: 'TRENDING 20',
      cadence: 'daily',
      country: 'United States',
      accentColor: 'from-[#7dd3fc] to-[#0369a1]',
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'us-top-100-songs',
      title: 'Top 100 Songs United States',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn6puJdseH2Rt9sMvt9E2M4i',
      badge: 'TOP 100 US',
      cadence: 'weekly',
      country: 'United States',
      accentColor: 'from-[#38bdf8] to-[#0284c7]',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
    },
  ],
  GB: [
    {
      id: 'uk-top-100-songs',
      title: 'Top 100 Songs United Kingdom',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn7lWvDk8v3vV2-c13fE_7kK',
      badge: 'TOP 100 UK',
      cadence: 'weekly',
      country: 'United Kingdom',
      accentColor: 'from-[#f472b6] to-[#db2777]',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
    },
  ],
  KR: [
    {
      id: 'kr-top-100-kpop',
      title: 'Top 100 K-Pop South Korea',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn7_5rC8U26N8mY8q689qFm1',
      badge: 'TOP 100 K-POP',
      cadence: 'weekly',
      country: 'South Korea',
      accentColor: 'from-[#fb7185] to-[#e11d48]',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
    },
  ],
  JP: [
    {
      id: 'jp-top-100-japan',
      title: 'Top 100 Songs Japan',
      subtitle: 'Chart • YouTube Charts',
      playlistId: 'PL4fGSI1pDJn43_3r21pW31q7U8S9qW2r4',
      badge: 'TOP 100 JAPAN',
      cadence: 'weekly',
      country: 'Japan',
      accentColor: 'from-[#f87171] to-[#dc2626]',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
    },
  ],
};
