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

// Known legacy demo IDs to exclude from leaderboards
export const DEMO_COMMUNITY_IDS = [
  'community_tokyo_citypop',
  'community_lofi_study',
  'community_punjabi_drill',
  'community_french_touch',
  'community_synthwave_drive',
  'community_80s_synthwave',
];

export const SEED_COMMUNITY_FALLBACK: CommunityPlaylist[] = [];

/**
 * Fetch public community playlists sorted by saveCount descending
 */
export async function fetchCommunityLeaderboard(): Promise<CommunityPlaylist[]> {
  try {
    const res = await fetch('/api/community/playlists');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.playlists)) {
        return data.playlists.filter(
          (p: CommunityPlaylist) => !DEMO_COMMUNITY_IDS.includes(p.id)
        );
      }
    }
  } catch {
    // Graceful fallback to client storage
  }

  // Fallback: Return only genuinely published local crates
  const localPublished = getLocallyPublishedCrates().filter(
    (p) => !DEMO_COMMUNITY_IDS.includes(p.id)
  );

  return localPublished.sort((a, b) => (b.saveCount || 0) - (a.saveCount || 0));
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
      category: playlist.category || 'Curated Playlist',
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
    category: playlist.category || 'Curated Playlist',
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
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list.filter((id) => !DEMO_COMMUNITY_IDS.includes(id));
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
    const list: CommunityPlaylist[] = raw ? JSON.parse(raw) : [];
    return list.filter((crate) => !DEMO_COMMUNITY_IDS.includes(crate.id));
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

// Clean Playlist Aliases
export const publishPlaylistToCommunity = publishCrateToCommunity;
export const saveCommunityPlaylist = saveCommunityCrate;
export const fetchCommunityPlaylistById = fetchCommunityCrateById;
export const isPlaylistSavedInLibrary = isCrateSavedInLibrary;
export const generatePlaylistShareUrl = generateCrateShareUrl;
