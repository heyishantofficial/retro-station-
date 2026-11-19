import { parseYouTubeInput, fetchVideoMetadata } from './youtube';
import { Track } from '../types';

export interface SearchSongResult {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  album: string;
  year?: string;
  duration: number;
  coverUrl: string;
  genre?: string;
  source: 'curated' | 'youtube' | 'itunes';
}

// Built-in instant-match index of popular classics across all major genres
export const POPULAR_HITS_CATALOG: SearchSongResult[] = [
  // Pop / Global Hits
  {
    id: 'hit-blinding-lights',
    youtubeId: '4NRXx6U8ABQ',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    year: '2020',
    duration: 200,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    genre: 'Synthpop',
    source: 'curated',
  },
  {
    id: 'hit-starboy',
    youtubeId: '34Na4j8AVgA',
    title: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    album: 'Starboy',
    year: '2016',
    duration: 230,
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&q=80',
    genre: 'R&B / Electro',
    source: 'curated',
  },
  {
    id: 'hit-paint-the-town-red',
    youtubeId: 'm4_9TFeMfJE',
    title: 'Paint The Town Red',
    artist: 'Doja Cat',
    album: 'Scarlet',
    year: '2023',
    duration: 231,
    coverUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
    genre: 'Pop / Hip Hop',
    source: 'curated',
  },
  {
    id: 'hit-espresso',
    youtubeId: 'eVli-tstM5E',
    title: 'Espresso',
    artist: 'Sabrina Carpenter',
    album: 'Short n Sweet',
    year: '2024',
    duration: 175,
    coverUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
    genre: 'Pop',
    source: 'curated',
  },
  {
    id: 'hit-birds-feather',
    youtubeId: 'd5gf9dXbPi0',
    title: 'BIRDS OF A FEATHER',
    artist: 'Billie Eilish',
    album: 'HIT ME HARD AND SOFT',
    year: '2024',
    duration: 196,
    coverUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80',
    genre: 'Indie Pop',
    source: 'curated',
  },
  {
    id: 'hit-houdini',
    youtubeId: 'suAR1PYFNYA',
    title: 'Houdini',
    artist: 'Dua Lipa',
    album: 'Radical Optimism',
    year: '2024',
    duration: 185,
    coverUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80',
    genre: 'Nu-Disco',
    source: 'curated',
  },
  {
    id: 'hit-snooze',
    youtubeId: 'LDY_Xa76Hdg',
    title: 'Snooze',
    artist: 'SZA',
    album: 'SOS',
    year: '2023',
    duration: 201,
    coverUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80',
    genre: 'R&B',
    source: 'curated',
  },
  {
    id: 'hit-as-it-was',
    youtubeId: 'H5v3kku4y6Q',
    title: 'As It Was',
    artist: 'Harry Styles',
    album: "Harry's House",
    year: '2022',
    duration: 167,
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
    genre: 'Synthpop',
    source: 'curated',
  },
  {
    id: 'hit-cruel-summer',
    youtubeId: 'ic8j13piAhQ',
    title: 'Cruel Summer',
    artist: 'Taylor Swift',
    album: 'Lover',
    year: '2019',
    duration: 178,
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    genre: 'Pop',
    source: 'curated',
  },

  // Indian / Bollywood Hits
  {
    id: 'hit-kesariya',
    youtubeId: 'BddP6PYo2gs',
    title: 'Kesariya',
    artist: 'Arijit Singh, Pritam',
    album: 'Brahmastra',
    year: '2022',
    duration: 268,
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80',
    genre: 'Bollywood Romantic',
    source: 'curated',
  },
  {
    id: 'hit-chittiyaan-kalaiyaan',
    youtubeId: 'zpsVpnvFfZQ',
    title: 'Chittiyaan Kalaiyaan',
    artist: 'Meet Bros Anjjan, Kanika Kapoor',
    album: 'Roy',
    year: '2015',
    duration: 185,
    coverUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80',
    genre: 'Bollywood Pop / Dance',
    source: 'curated',
  },
  {
    id: 'hit-apna-bana-le',
    youtubeId: 'ElZfdU54Cp8',
    title: 'Apna Bana Le',
    artist: 'Arijit Singh, Sachin-Jigar',
    album: 'Bhediya',
    year: '2022',
    duration: 261,
    coverUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',
    genre: 'Bollywood Soul',
    source: 'curated',
  },
  {
    id: 'hit-lover-diljit',
    youtubeId: 'mH_LFkWxpI0',
    title: 'Lover',
    artist: 'Diljit Dosanjh',
    album: 'MoonChild Era',
    year: '2021',
    duration: 189,
    coverUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80',
    genre: 'Punjabi Pop',
    source: 'curated',
  },
  {
    id: 'hit-brown-munde',
    youtubeId: 'VNs_cCtdbPc',
    title: 'Brown Munde',
    artist: 'AP Dhillon, Gurinder Gill, Shinda Kahlon',
    album: 'Brown Munde',
    year: '2020',
    duration: 268,
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&q=80',
    genre: 'Punjabi Hip Hop',
    source: 'curated',
  },

  // Electronic / Daft Punk / Retrowave
  {
    id: 'hit-get-lucky',
    youtubeId: '5NV6Rdv1a3I',
    title: 'Get Lucky',
    artist: 'Daft Punk ft. Pharrell Williams',
    album: 'Random Access Memories',
    year: '2013',
    duration: 248,
    coverUrl: 'https://images.unsplash.com/photo-1498036882173-b41c28a8ba34?w=800&q=80',
    genre: 'Disco / Funk',
    source: 'curated',
  },
  {
    id: 'hit-one-more-time',
    youtubeId: 'FGBhQbmMxbw',
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    year: '2001',
    duration: 320,
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&q=80',
    genre: 'French House',
    source: 'curated',
  },
  {
    id: 'hit-sunset-midnight',
    youtubeId: 'rDBbaGCCIhk',
    title: 'Sunset',
    artist: 'The Midnight',
    album: 'Endless Summer',
    year: '2016',
    duration: 326,
    coverUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80',
    genre: 'Synthwave',
    source: 'curated',
  },
  {
    id: 'hit-nightcall',
    youtubeId: 'MV_3Dpw-BRY',
    title: 'Nightcall',
    artist: 'Kavinsky',
    album: 'OutRun',
    year: '2013',
    duration: 259,
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&q=80',
    genre: 'Synthwave',
    source: 'curated',
  },
  {
    id: 'hit-plastic-love',
    youtubeId: '9Gj47G2e1Jc',
    title: 'Plastic Love',
    artist: 'Mariya Takeuchi',
    album: 'Variety',
    year: '1984',
    duration: 295,
    coverUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80',
    genre: 'City Pop',
    source: 'curated',
  },
  {
    id: 'hit-stay-with-me',
    youtubeId: 'M0qMgoChzGI',
    title: 'Stay With Me',
    artist: 'Miki Matsubara',
    album: 'Pocket Park',
    year: '1979',
    duration: 312,
    coverUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
    genre: 'City Pop',
    source: 'curated',
  },
];

/**
 * Searches songs using a 3-tier strategy:
 * 1. Checks if input is a direct YouTube link / video ID.
 * 2. Matches against built-in curated popular hits index (instant 0ms).
 * 3. Queries iTunes open Search API for global song metadata.
 */
export async function searchSongs(rawQuery: string): Promise<SearchSongResult[]> {
  const query = rawQuery.trim();
  if (!query) return POPULAR_HITS_CATALOG.slice(0, 10);

  // 1. Direct YouTube link or 11-char ID
  const parsed = parseYouTubeInput(query);
  if (parsed.type === 'video') {
    try {
      const meta = await fetchVideoMetadata(parsed.id);
      return [
        {
          id: `yt-${parsed.id}`,
          youtubeId: parsed.id,
          title: meta.title,
          artist: meta.author,
          album: 'YouTube Stream',
          year: String(new Date().getFullYear()),
          duration: 210,
          coverUrl: meta.thumbnail,
          genre: 'Direct Stream',
          source: 'youtube',
        },
      ];
    } catch {
      return [
        {
          id: `yt-${parsed.id}`,
          youtubeId: parsed.id,
          title: `YouTube Video (${parsed.id})`,
          artist: 'YouTube Audio',
          album: 'Single Stream',
          year: String(new Date().getFullYear()),
          duration: 210,
          coverUrl: `https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg`,
          genre: 'Direct Stream',
          source: 'youtube',
        },
      ];
    }
  }

  // 2. Search local curated hits
  const qLower = query.toLowerCase();
  const localMatches = POPULAR_HITS_CATALOG.filter(
    (item) =>
      item.title.toLowerCase().includes(qLower) ||
      item.artist.toLowerCase().includes(qLower) ||
      item.album.toLowerCase().includes(qLower) ||
      (item.genre && item.genre.toLowerCase().includes(qLower))
  );

  // 3. Query iTunes API in parallel for universal discovery
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      query
    )}&entity=song&limit=12`;
    const res = await fetch(itunesUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        interface ITunesItem {
          trackId: number;
          trackName: string;
          artistName: string;
          collectionName?: string;
          releaseDate?: string;
          trackTimeMillis?: number;
          artworkUrl100?: string;
          primaryGenreName?: string;
        }

        const externalResults: SearchSongResult[] = (data.results as ITunesItem[])
          .filter((it) => it.trackName && it.artistName)
          .map((it) => {
            // Find if we already have a curated YouTube ID for this title & artist
            const curMatch = POPULAR_HITS_CATALOG.find(
              (c) =>
                c.title.toLowerCase() === it.trackName.toLowerCase() &&
                c.artist.toLowerCase().includes(it.artistName.toLowerCase().slice(0, 5))
            );

            // Upscale artwork from 100x100 to 600x600 for crisp visualizer presentation
            const hiResArt = (it.artworkUrl100 || '').replace('100x100bb', '600x600bb');

            return {
              id: `itunes-${it.trackId}`,
              // If we have a verified YT match, use it; otherwise use song query for YouTube player
              youtubeId: curMatch ? curMatch.youtubeId : `${it.trackName} ${it.artistName}`,
              title: it.trackName,
              artist: it.artistName,
              album: it.collectionName || it.trackName,
              year: it.releaseDate ? it.releaseDate.slice(0, 4) : undefined,
              duration: it.trackTimeMillis ? Math.round(it.trackTimeMillis / 1000) : 210,
              coverUrl: hiResArt || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
              genre: it.primaryGenreName || 'Music',
              source: 'itunes',
            };
          });

        // Deduplicate against local matches
        const existingIds = new Set(localMatches.map((m) => `${m.title.toLowerCase()}-${m.artist.toLowerCase()}`));
        const filteredExternals = externalResults.filter(
          (ex) => !existingIds.has(`${ex.title.toLowerCase()}-${ex.artist.toLowerCase()}`)
        );

        return [...localMatches, ...filteredExternals];
      }
    }
  } catch {
    // If external fetch fails, return local matches
  }

  return localMatches;
}

/**
 * Converts a SearchSongResult into a fully-formed Retro Station Track with disc designs & quotes.
 */
export function convertSearchResultToTrack(result: SearchSongResult, trackIndex: number, playlistName: string): Track {
  const designs: Track['discDesign'][] = ['artistic', 'minimal', 'typography', 'dark'];
  const cleanTitle = result.title.toUpperCase();

  return {
    id: `track-${result.youtubeId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}-${trackIndex}`,
    youtubeId: result.youtubeId,
    title: cleanTitle,
    artist: result.artist,
    album: result.album || playlistName,
    year: result.year || String(new Date().getFullYear()),
    duration: result.duration || 210,
    coverUrl: result.coverUrl,
    genre: result.genre || 'Soundtrack',
    label: playlistName,
    matrixCode: `RT-${cleanTitle.slice(0, 4)}-${String(trackIndex + 1).padStart(2, '0')}`,
    discDesign: designs[trackIndex % designs.length],
    quotes: [
      { text: 'AN ESSENTIAL PIECE FROM YOUR PERSONAL ROTATION', source: 'RETRO STATION ARCHIVE', stars: 5 },
      { text: 'TIMELESS COMPOSITION PRESSED TO DIGITAL VINYL', source: 'A24 AUDIO LAB', stars: 5 },
    ],
  };
}
