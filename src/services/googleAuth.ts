const GOOGLE_CLIENT_ID_STORAGE = 'retro_google_client_id_v1';
const GOOGLE_TOKEN_STORAGE = 'retro_google_access_token_v1';

// Placeholder identifier that causes Google 401 invalid_client
const DUMMY_PLACEHOLDER_SUBSTRING = 'publicretrostation';

export function getStoredGoogleClientId(): string {
  try {
    const custom = localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE);
    if (custom && custom.trim()) return custom.trim();
    const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (envId && typeof envId === 'string' && envId.trim()) return envId.trim();
  } catch {
    // ignore
  }
  return '';
}

export function setStoredGoogleClientId(clientId: string): void {
  try {
    const clean = clientId.trim();
    if (clean) {
      localStorage.setItem(GOOGLE_CLIENT_ID_STORAGE, clean);
    } else {
      localStorage.removeItem(GOOGLE_CLIENT_ID_STORAGE);
    }
  } catch {
    // ignore
  }
}

export function isValidGoogleClientId(clientId?: string): boolean {
  if (!clientId) return false;
  const clean = clientId.trim();
  if (!clean || clean.includes(DUMMY_PLACEHOLDER_SUBSTRING)) return false;
  return clean.endsWith('.apps.googleusercontent.com') && clean.length > 30;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

export function getStoredGoogleToken(): string | null {
  try {
    return sessionStorage.getItem(GOOGLE_TOKEN_STORAGE);
  } catch {
    return null;
  }
}

export function clearGoogleToken(): void {
  try {
    sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE);
  } catch {
    // ignore
  }
}

/**
 * Loads the official Google Identity Services (GIS) script.
 */
export function loadGoogleGISScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (document.getElementById('google-gis-script')) {
      const check = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export interface GoogleUserInfo {
  sub: string;
  name: string;
  email: string;
  picture: string;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Initiates Google OAuth 2.0 flow to sign the user in with their Google account.
 */
export async function loginWithGoogleAccount(
  onSuccess: (user: { id: string; name: string; email: string; avatarUrl: string; token?: string }) => void,
  onError?: (err: string) => void,
  customClientId?: string
): Promise<void> {
  const clientId = (customClientId || getStoredGoogleClientId()).trim();

  if (!clientId || clientId.includes(DUMMY_PLACEHOLDER_SUBSTRING)) {
    onError?.(
      'No valid Google Cloud Client ID configured. Please enter your Google OAuth Client ID in settings, or use Instant Profile Sign-In.'
    );
    return;
  }

  if (customClientId) {
    setStoredGoogleClientId(customClientId);
  }

  await loadGoogleGISScript();
  if (!window.google?.accounts?.oauth2) {
    onError?.('Google Identity Services not ready');
    return;
  }

  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'email profile openid https://www.googleapis.com/auth/youtube.readonly',
    callback: async (resp) => {
      if (resp.error || !resp.access_token) {
        onError?.(resp.error || 'Google authentication failed');
        return;
      }
      try {
        sessionStorage.setItem(GOOGLE_TOKEN_STORAGE, resp.access_token);
      } catch {
        // ignore
      }

      const info = await fetchGoogleUserInfo(resp.access_token);
      if (info) {
        onSuccess({
          id: info.sub,
          name: info.name,
          email: info.email,
          avatarUrl: info.picture,
          token: resp.access_token,
        });
      } else {
        onSuccess({
          id: `google_${Date.now()}`,
          name: 'Google User',
          email: 'google.listener@gmail.com',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
          token: resp.access_token,
        });
      }
    },
  });

  client.requestAccessToken();
}

/**
 * Initiates Google / YouTube OAuth 2.0 flow for read-only library access.
 */
export async function loginWithGoogleYouTube(
  onSuccess: (accessToken: string) => void,
  onError?: (err: string) => void,
  customClientId?: string
): Promise<void> {
  const clientId = (customClientId || getStoredGoogleClientId()).trim();

  if (!clientId || clientId.includes(DUMMY_PLACEHOLDER_SUBSTRING)) {
    onError?.(
      'No valid Google Cloud Client ID configured. Please configure your Google Client ID to import from your personal YouTube Library.'
    );
    return;
  }

  if (customClientId) {
    setStoredGoogleClientId(customClientId);
  }

  await loadGoogleGISScript();
  if (!window.google?.accounts?.oauth2) {
    onError?.('Google Identity Services not ready');
    return;
  }

  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    callback: (resp) => {
      if (resp.error || !resp.access_token) {
        onError?.(resp.error || 'Google authentication failed');
        return;
      }
      try {
        sessionStorage.setItem(GOOGLE_TOKEN_STORAGE, resp.access_token);
      } catch {
        // ignore
      }
      onSuccess(resp.access_token);
    },
  });

  client.requestAccessToken();
}

export interface GooglePlaylistItem {
  id: string;
  title: string;
  itemCount: number;
  thumbnailUrl: string;
}

export async function fetchUserGoogleYouTubePlaylists(accessToken: string): Promise<GooglePlaylistItem[]> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.items)) return [];

    interface RawYTPl {
      id: string;
      snippet?: {
        title: string;
        thumbnails?: {
          medium?: { url: string };
          default?: { url: string };
        };
      };
      contentDetails?: {
        itemCount: number;
      };
    }

    const customPlaylists = (data.items as RawYTPl[]).map((p) => ({
      id: p.id,
      title: p.snippet?.title || 'YouTube Playlist',
      itemCount: p.contentDetails?.itemCount || 0,
      thumbnailUrl:
        p.snippet?.thumbnails?.medium?.url ||
        p.snippet?.thumbnails?.default?.url ||
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    }));

    // Prepend special "Liked Videos" library playlist ('LL')
    return [
      {
        id: 'LL',
        title: 'Liked Videos (YouTube Library)',
        itemCount: 50,
        thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&q=80',
      },
      ...customPlaylists,
    ];
  } catch {
    return [];
  }
}
