import { Track, Playlist } from '../types';

const SPOTIFY_CLIENT_ID_STORAGE = 'retro_spotify_client_id_v1';
const SPOTIFY_VERIFIER_STORAGE = 'retro_spotify_code_verifier_v1';
const SPOTIFY_TOKEN_STORAGE = 'retro_spotify_access_token_v1';

// Default public client ID or fallback
const DEFAULT_CLIENT_ID = 'e6130ebcfc0746e59aa7a6e138a0f9b6';

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function getStoredSpotifyToken(): string | null {
  try {
    return sessionStorage.getItem(SPOTIFY_TOKEN_STORAGE);
  } catch {
    return null;
  }
}

export function clearSpotifyToken(): void {
  try {
    sessionStorage.removeItem(SPOTIFY_TOKEN_STORAGE);
    sessionStorage.removeItem(SPOTIFY_VERIFIER_STORAGE);
  } catch {
    // ignore
  }
}

export async function initiateSpotifyLogin(customClientId?: string): Promise<void> {
  const clientId = (customClientId || localStorage.getItem(SPOTIFY_CLIENT_ID_STORAGE) || DEFAULT_CLIENT_ID).trim();
  if (customClientId) {
    try {
      localStorage.setItem(SPOTIFY_CLIENT_ID_STORAGE, customClientId);
    } catch {
      // ignore
    }
  }

  const verifier = generateRandomString(64);
  const hashed = await sha256(verifier);
  const challenge = base64encode(hashed);

  try {
    sessionStorage.setItem(SPOTIFY_VERIFIER_STORAGE, verifier);
  } catch {
    // ignore
  }

  const redirectUri = window.location.origin + window.location.pathname;
  const scope = 'playlist-read-private playlist-read-collaborative user-library-read';

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function checkAndHandleSpotifyCallback(): Promise<string | null> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (!code) return getStoredSpotifyToken();

  const verifier = sessionStorage.getItem(SPOTIFY_VERIFIER_STORAGE);
  const clientId = localStorage.getItem(SPOTIFY_CLIENT_ID_STORAGE) || DEFAULT_CLIENT_ID;
  const redirectUri = window.location.origin + window.location.pathname;

  if (!verifier) return null;

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.access_token) {
      sessionStorage.setItem(SPOTIFY_TOKEN_STORAGE, data.access_token);
      // Clean query params from URL
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      return data.access_token;
    }
  } catch {
    // ignore
  }

  return null;
}

export interface SpotifyPlaylistItem {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  imageUrl: string;
}

export async function fetchUserSpotifyPlaylists(accessToken: string): Promise<SpotifyPlaylistItem[]> {
  try {
    const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.items)) return [];

    interface RawSpotifyPl {
      id: string;
      name: string;
      description?: string;
      tracks?: { total: number };
      images?: { url: string }[];
    }

    return (data.items as RawSpotifyPl[]).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      trackCount: p.tracks?.total || 0,
      imageUrl: p.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    }));
  } catch {
    return [];
  }
}

export async function convertSpotifyPlaylistToCrate(
  accessToken: string,
  playlistId: string,
  playlistName: string
): Promise<Playlist> {
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Could not fetch Spotify tracks');
  const data = await res.json();

  interface SpotifyTrackWrapper {
    track: {
      id: string;
      name: string;
      artists: { name: string }[];
      album: {
        name: string;
        release_date?: string;
        images?: { url: string }[];
      };
      duration_ms: number;
    } | null;
  }

  const designs: Track['discDesign'][] = ['artistic', 'minimal', 'typography', 'dark'];
  const items = (data.items as SpotifyTrackWrapper[]).filter((i) => Boolean(i?.track));

  const tracks: Track[] = items.map((item, idx) => {
    const t = item.track!;
    const artistName = t.artists.map((a) => a.name).join(', ') || 'Spotify Artist';
    const cleanTitle = t.name.toUpperCase();
    const coverUrl = t.album.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80';

    return {
      id: `sp-${t.id}-${idx}`,
      youtubeId: `${t.name} ${artistName}`, // Hybrid matcher plays this query seamlessly!
      title: cleanTitle,
      artist: artistName,
      album: t.album.name || playlistName,
      year: t.album.release_date?.slice(0, 4) || String(new Date().getFullYear()),
      duration: Math.round(t.duration_ms / 1000) || 210,
      coverUrl,
      genre: 'Spotify Hybrid Stream',
      label: 'Synced from Spotify',
      matrixCode: `SP-${t.id.slice(0, 4).toUpperCase()}-${String(idx + 1).padStart(2, '0')}`,
      discDesign: designs[idx % designs.length],
      quotes: [
        { text: 'IMPORTED DIRECTLY FROM SPOTIFY ROTATION', source: 'SPOTIFY SYNC', stars: 5 },
        { text: '100% FREE UNIVERSAL RETRO HYBRID PLAYBACK', source: 'A24 AUDIO LAB', stars: 5 },
      ],
    };
  });

  return {
    id: `spotify-pl-${playlistId}-${Date.now()}`,
    title: playlistName,
    subtitle: `Synced from Spotify • ${tracks.length} discs`,
    category: 'Spotify Sync',
    tracks,
  };
}
