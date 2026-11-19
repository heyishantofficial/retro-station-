import { Playlist, Track } from '../types';

export interface CommunityPlaylist {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  creatorName: string;
  creatorAvatar?: string;
  creatorId?: string;
  tracks: Track[];
  saveCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_STORAGE_SAVED_KEY = 'retro_saved_community_crates_ids';
const LOCAL_STORAGE_PUBLISHED_KEY = 'retro_my_published_crates';

export const SEED_COMMUNITY_FALLBACK: CommunityPlaylist[] = [
  {
    id: 'community_tokyo_citypop',
    title: 'Midnight Tokyo City Pop',
    subtitle: 'Classic 80s Japanese Funk & Grooves',
    category: 'City Pop',
    creatorName: 'Taeko_Collector',
    creatorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=Taeko',
    saveCount: 1842,
    isPublic: true,
    createdAt: '2026-10-15T12:00:00.000Z',
    updatedAt: '2026-11-18T18:00:00.000Z',
    tracks: [
      {
        id: 'cp-1',
        title: 'Plastic Love',
        artist: 'Mariya Takeuchi',
        album: 'Variety',
        year: '1984',
        duration: 295,
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
        youtubeId: '9Gj47G2e1Jc',
        genre: 'City Pop',
        label: 'Moon Records',
        matrixCode: 'RS-CP-01',
        quotes: [{ text: 'The definitive anthem of 80s Tokyo nightlife.', source: 'Pitchfork', stars: 5 }],
      },
      {
        id: 'cp-2',
        title: 'Stay With Me',
        artist: 'Miki Matsubara',
        album: 'Pocket Park',
        year: '1979',
        duration: 300,
        coverUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80',
        youtubeId: 'M0qMgoChzGI',
        genre: 'City Pop',
        label: 'See-Saw',
        matrixCode: 'RS-CP-02',
        quotes: [{ text: 'Timeless disco-funk energy that never fades.', source: 'Rolling Stone', stars: 5 }],
      },
      {
        id: 'cp-3',
        title: 'Midnight Pretenders',
        artist: 'Tomoko Aran',
        album: 'Fuyü-Kankë',
        year: '1983',
        duration: 345,
        coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
        youtubeId: 'q8hFm3z1WwE',
        genre: 'City Pop',
        label: 'Warner Pioneer',
        matrixCode: 'RS-CP-03',
        quotes: [{ text: 'Smooth late-night synth elegance.', source: 'Resident Advisor', stars: 4.8 }],
      },
    ],
  },
  {
    id: 'community_lofi_study',
    title: 'Lofi Beats • Late Night Study',
    subtitle: 'Nostalgic Tape Saturation & Rhodes Chords',
    category: 'Lofi & Chill',
    creatorName: 'ChillHopStation',
    creatorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=ChillHop',
    saveCount: 1420,
    isPublic: true,
    createdAt: '2026-10-20T14:30:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z',
    tracks: [
      {
        id: 'lofi-1',
        title: 'Lofi Hip Hop Radio',
        artist: 'Lofi Girl',
        album: 'Beats to Relax/Study to',
        year: '2024',
        duration: 215,
        coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
        youtubeId: 'jfKfPfyJRdk',
        genre: 'Lofi Hip Hop',
        label: 'Lofi Records',
        matrixCode: 'RS-LF-01',
        quotes: [{ text: 'The heartbeat of quiet focus.', source: 'Study Vibes', stars: 5 }],
      },
      {
        id: 'lofi-2',
        title: 'Snowman',
        artist: 'WYS',
        album: '1 Am. Study Session',
        year: '2020',
        duration: 198,
        coverUrl: 'https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=400&q=80',
        youtubeId: 'koxZ_nU6m48',
        genre: 'Chillhop',
        label: 'ChilledCow',
        matrixCode: 'RS-LF-02',
        quotes: [{ text: 'Warm fireplace nostalgia in audio form.', source: 'Ambient Magazine', stars: 4.9 }],
      },
    ],
  },
  {
    id: 'community_punjabi_drill',
    title: 'Punjabi Heavy Bass & Drill',
    subtitle: 'Sub-bass 808s, Folk Harmonies & Hard Bars',
    category: 'Desi Hip Hop',
    creatorName: 'Aujla_Vibes',
    creatorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=Aujla',
    saveCount: 980,
    isPublic: true,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-19T14:00:00.000Z',
    tracks: [
      {
        id: 'pj-1',
        title: 'Shady AF',
        artist: 'Release',
        album: 'Street Legend',
        year: '2024',
        duration: 185,
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
        youtubeId: 'N9y9M9c_9c4',
        genre: 'Punjabi Drill',
        label: 'Rehaan Records',
        matrixCode: 'RS-PJ-01',
        quotes: [{ text: 'Heavy underground drill pressure.', source: 'Rolling Stone India', stars: 4.8 }],
      },
      {
        id: 'pj-2',
        title: 'Straight Up',
        artist: 'Karan Aujla',
        album: 'Four Me',
        year: '2023',
        duration: 204,
        coverUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80',
        youtubeId: '7xX3hK7yH_k',
        genre: 'Desi Hip Hop',
        label: 'Sandhu Bros',
        matrixCode: 'RS-PJ-02',
        quotes: [{ text: 'Relentless flow and trademark swagger.', source: 'BBC Asian Network', stars: 5 }],
      },
    ],
  },
  {
    id: 'community_french_touch',
    title: 'French Touch & Nu-Disco',
    subtitle: 'Filter Sweeps, Slap Bass & 90s Club Euphoria',
    category: 'Electronic',
    creatorName: 'Daft_Archive',
    creatorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=DaftArchive',
    saveCount: 760,
    isPublic: true,
    createdAt: '2026-11-05T19:00:00.000Z',
    updatedAt: '2026-11-17T21:00:00.000Z',
    tracks: [
      {
        id: 'ft-1',
        title: 'One More Time',
        artist: 'Daft Punk',
        album: 'Discovery',
        year: '2001',
        duration: 320,
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
        youtubeId: 'FGBhQbmPwH8',
        genre: 'French House',
        label: 'Virgin Records',
        matrixCode: 'RS-FT-01',
        quotes: [{ text: 'The crowning jewel of 2000s electronic music.', source: 'Pitchfork', stars: 5 }],
      },
    ],
  },
  {
    id: 'community_synthwave_drive',
    title: '80s Synthwave Drive',
    subtitle: 'Neon Horizons, Analog Arps & Cinematic Suspense',
    category: 'Synthwave',
    creatorName: 'Kavinsky_Drive',
    creatorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=Kavinsky',
    saveCount: 610,
    isPublic: true,
    createdAt: '2026-11-10T11:00:00.000Z',
    updatedAt: '2026-11-19T09:00:00.000Z',
    tracks: [
      {
        id: 'sw-1',
        title: 'Nightcall',
        artist: 'Kavinsky',
        album: 'OutRun',
        year: '2010',
        duration: 259,
        coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80',
        youtubeId: 'MV_3Dpw-BRY',
        genre: 'Synthwave',
        label: 'Record Makers',
        matrixCode: 'RS-SW-01',
        quotes: [{ text: 'Pure night drive cinematic glory.', source: 'NME', stars: 5 }],
      },
    ],
  },
];

/**
 * Fetch public community playlists sorted by saveCount descending
 */
export async function fetchCommunityLeaderboard(): Promise<CommunityPlaylist[]> {
  try {
    const res = await fetch('/api/community/playlists');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.playlists) && data.playlists.length > 0) {
        return data.playlists;
      }
    }
  } catch {
    // Graceful fallback to client storage & seed
  }

  // Fallback: Combine seeds with locally published crates
  const localPublished = getLocallyPublishedCrates();
  const map: Record<string, CommunityPlaylist> = {};

  for (const item of SEED_COMMUNITY_FALLBACK) {
    map[item.id] = item;
  }
  for (const item of localPublished) {
    map[item.id] = item;
  }

  return Object.values(map).sort((a, b) => (b.saveCount || 0) - (a.saveCount || 0));
}

/**
 * Publish a user's playlist to the public community leaderboard
 */
export async function publishCrateToCommunity(
  playlist: Playlist,
  creatorName: string,
  creatorAvatar?: string,
  creatorId?: string
): Promise<CommunityPlaylist> {
  const payload = {
    playlist: {
      id: playlist.id,
      title: playlist.title,
      subtitle: playlist.subtitle || `${playlist.tracks.length} tracks`,
      category: playlist.category || 'Curated Crate',
      tracks: playlist.tracks,
    },
    creatorName,
    creatorAvatar,
    creatorId,
  };

  try {
    const res = await fetch('/api/community/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.playlist) {
        saveLocallyPublishedCrate(data.playlist);
        return data.playlist;
      }
    }
  } catch {
    // Offline fallback
  }

  // Create locally
  const fallbackItem: CommunityPlaylist = {
    id: playlist.id,
    title: playlist.title,
    subtitle: playlist.subtitle || `${playlist.tracks.length} tracks`,
    category: playlist.category || 'Curated Crate',
    creatorName,
    creatorAvatar:
      creatorAvatar ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(creatorName || playlist.id)}`,
    creatorId,
    tracks: playlist.tracks,
    saveCount: 1,
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveLocallyPublishedCrate(fallbackItem);
  return fallbackItem;
}

/**
 * Increment save count when a user adds a community crate to their library
 */
export async function saveCommunityCrate(playlistId: string): Promise<number | null> {
  markCrateSavedLocally(playlistId);

  try {
    const res = await fetch('/api/community/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.newSaveCount ?? null;
    }
  } catch {
    // Offline fallback
  }

  return null;
}

/**
 * Get single community crate by ID (for share links)
 */
export async function fetchCommunityCrateById(id: string): Promise<CommunityPlaylist | null> {
  try {
    const res = await fetch(`/api/community/playlist/${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      return data.playlist || null;
    }
  } catch {
    // Fallback
  }

  const all = await fetchCommunityLeaderboard();
  return all.find((p) => p.id === id) || null;
}

/**
 * Check if the user already has saved this crate
 */
export function isCrateSavedInLibrary(
  communityId: string,
  userPlaylists: Playlist[]
): boolean {
  // Check by ID match or exact title match
  return userPlaylists.some(
    (pl) => pl.id === communityId || pl.id === `imported_${communityId}`
  );
}

/**
 * LocalStorage Helpers
 */
export function getSavedCrateIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markCrateSavedLocally(id: string): void {
  try {
    const current = getSavedCrateIds();
    if (!current.includes(id)) {
      current.push(id);
      localStorage.setItem(LOCAL_STORAGE_SAVED_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore
  }
}

export function getLocallyPublishedCrates(): CommunityPlaylist[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PUBLISHED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocallyPublishedCrate(crate: CommunityPlaylist): void {
  try {
    const current = getLocallyPublishedCrates();
    const idx = current.findIndex((c) => c.id === crate.id);
    if (idx >= 0) {
      current[idx] = crate;
    } else {
      current.unshift(crate);
    }
    localStorage.setItem(LOCAL_STORAGE_PUBLISHED_KEY, JSON.stringify(current));
  } catch {
    // Ignore
  }
}

export function generateCrateShareUrl(playlistId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?crate=${encodeURIComponent(playlistId)}`;
}
