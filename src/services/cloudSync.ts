import { Playlist } from '../types';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  token?: string;
}

const USER_STORAGE_KEY = 'retro_station_active_user_v1';
const LAST_SYNC_KEY = 'retro_station_last_sync_v1';

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(LAST_SYNC_KEY);
    }
  } catch {
    // ignore
  }
}

export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncTime(time: string): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, time);
  } catch {
    // ignore
  }
}

/**
 * Syncs user profile with the backend cloud database.
 */
export async function syncUserWithBackend(user: Partial<UserProfile>): Promise<{
  user: UserProfile;
  hasCloudPlaylists: boolean;
  cloudPlaylistsCount: number;
}> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user }),
  });

  if (!res.ok) {
    throw new Error('Failed to authenticate with cloud backend');
  }

  const data = await res.json();
  const profile: UserProfile = data.user;
  setStoredUser(profile);

  return {
    user: profile,
    hasCloudPlaylists: data.hasCloudPlaylists,
    cloudPlaylistsCount: data.cloudPlaylistsCount,
  };
}

/**
 * Fetches user's saved playlists from the backend cloud storage.
 */
export async function fetchUserCloudPlaylists(userId: string): Promise<Playlist[] | null> {
  try {
    const res = await fetch(`/api/user/playlists?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && Array.isArray(data.playlists) && data.playlists.length > 0) {
      if (data.updatedAt) setLastSyncTime(data.updatedAt);
      return data.playlists;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves/updates user's playlists in the backend cloud database.
 */
export async function saveUserCloudPlaylists(userId: string, playlists: Playlist[]): Promise<boolean> {
  try {
    const res = await fetch('/api/user/playlists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, playlists }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    if (data.success && data.updatedAt) {
      setLastSyncTime(data.updatedAt);
    }
    return Boolean(data.success);
  } catch {
    return false;
  }
}
