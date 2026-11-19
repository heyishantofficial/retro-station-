const GOOGLE_CLIENT_ID_STORAGE = 'retro_google_client_id_v1';
const GOOGLE_TOKEN_STORAGE = 'retro_google_access_token_v1';

// Default / fallback public web client ID
const DEFAULT_GOOGLE_CLIENT_ID = '937291048201-publicretrostation.apps.googleusercontent.com';

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

/**
 * Initiates Google / YouTube OAuth 2.0 flow for read-only library access.
 */
export async function loginWithGoogleYouTube(
  onSuccess: (accessToken: string) => void,
  onError?: (err: string) => void,
  customClientId?: string
): Promise<void> {
  await loadGoogleGISScript();
  if (!window.google?.accounts?.oauth2) {
    onError?.('Google Identity Services not ready');
    return;
  }

  const clientId = (customClientId || localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE) || DEFAULT_GOOGLE_CLIENT_ID).trim();
  if (customClientId) {
    try {
      localStorage.setItem(GOOGLE_CLIENT_ID_STORAGE, customClientId);
    } catch {
      // ignore
    }
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
