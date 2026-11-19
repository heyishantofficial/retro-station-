import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';

interface StoredUserData {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  lastLogin: string;
}

interface CommunityPlaylist {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  creatorName: string;
  creatorAvatar?: string;
  creatorId?: string;
  tracks: any[];
  saveCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserDatabase {
  users: Record<string, StoredUserData>;
  playlists: Record<string, { playlists: any[]; updatedAt: string }>;
  community?: Record<string, CommunityPlaylist>;
}

const SEED_COMMUNITY_PLAYLISTS: CommunityPlaylist[] = [
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

const DB_FILE_PATH = path.resolve(process.cwd(), 'server/data/cloud_db.json');

function ensureDatabase(): UserDatabase {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db: UserDatabase;
  if (!fs.existsSync(DB_FILE_PATH)) {
    db = { users: {}, playlists: {}, community: {} };
  } else {
    try {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      db = JSON.parse(raw);
    } catch {
      db = { users: {}, playlists: {}, community: {} };
    }
  }

  if (!db.community || Object.keys(db.community).length === 0) {
    db.community = {};
    for (const seed of SEED_COMMUNITY_PLAYLISTS) {
      db.community[seed.id] = seed;
    }
    saveDatabase(db);
  }

  return db;
}

function saveDatabase(db: UserDatabase): void {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Retro Cloud DB] Save error:', err);
  }
}

export function retroCloudBackendPlugin(): Plugin {
  return {
    name: 'retro-cloud-backend',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        if (!url.startsWith('/api/')) {
          return next();
        }

        // Set CORS and JSON headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const parseBody = (): Promise<any> => {
          return new Promise((resolve) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch {
                resolve({});
              }
            });
          });
        };

        const db = ensureDatabase();

        // 1. Healthcheck
        if (url === '/api/health') {
          res.statusCode = 200;
          return res.end(JSON.stringify({ status: 'ok', service: 'Retro Station Cloud Sync' }));
        }

        // 2. Google Authentication & Profile Sync
        if (url === '/api/auth/google' && req.method === 'POST') {
          const body = await parseBody();
          const { user } = body;

          if (!user || !user.email) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'User profile with email is required' }));
          }

          const userId = user.id || `google_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
          const userData: StoredUserData = {
            id: userId,
            name: user.name || user.email.split('@')[0],
            email: user.email,
            avatarUrl:
              user.avatarUrl ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.email)}`,
            lastLogin: new Date().toISOString(),
          };

          db.users[userId] = userData;
          saveDatabase(db);

          const existingPlaylists = db.playlists[userId]?.playlists || null;

          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              user: userData,
              hasCloudPlaylists: Boolean(existingPlaylists && existingPlaylists.length > 0),
              cloudPlaylistsCount: existingPlaylists ? existingPlaylists.length : 0,
            })
          );
        }

        // 3. Get User Playlists from Cloud
        if (url.startsWith('/api/user/playlists') && req.method === 'GET') {
          const parsedUrl = new URL(url, 'http://localhost');
          const userId = parsedUrl.searchParams.get('userId');

          if (!userId) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'userId is required' }));
          }

          const record = db.playlists[userId];
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              playlists: record ? record.playlists : [],
              updatedAt: record ? record.updatedAt : null,
            })
          );
        }

        // 4. Save User Playlists to Cloud
        if (url.startsWith('/api/user/playlists') && req.method === 'PUT') {
          const body = await parseBody();
          const { userId, playlists } = body;

          if (!userId || !Array.isArray(playlists)) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'userId and playlists array are required' }));
          }

          const updatedAt = new Date().toISOString();
          db.playlists[userId] = {
            playlists,
            updatedAt,
          };
          saveDatabase(db);

          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              count: playlists.length,
              updatedAt,
            })
          );
        }

        // 5. Get Public Ranked Community Playlists (Sorted by saves descending)
        if (url.startsWith('/api/community/playlists') && req.method === 'GET') {
          const list = Object.values(db.community || {}).sort(
            (a, b) => (b.saveCount || 0) - (a.saveCount || 0)
          );
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, playlists: list }));
        }

        // 6. Publish / Update a Playlist to Community Leaderboard
        if (url === '/api/community/publish' && req.method === 'POST') {
          const body = await parseBody();
          const { playlist, creatorName, creatorAvatar, creatorId } = body;

          if (!playlist || !playlist.title) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Playlist object with title is required' }));
          }

          if (!db.community) db.community = {};

          const playlistId = playlist.id || `pub_${Date.now()}`;
          const existing = db.community[playlistId];

          const publishedItem: CommunityPlaylist = {
            id: playlistId,
            title: playlist.title,
            subtitle: playlist.subtitle || `${playlist.tracks?.length || 0} tracks`,
            category: playlist.category || 'Community Crate',
            creatorName: creatorName || 'Anonymous Collector',
            creatorAvatar:
              creatorAvatar ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
                creatorName || playlistId
              )}`,
            creatorId: creatorId || undefined,
            tracks: playlist.tracks || [],
            saveCount: existing ? existing.saveCount : 1, // author counts as 1st save
            isPublic: true,
            createdAt: existing ? existing.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          db.community[playlistId] = publishedItem;
          saveDatabase(db);

          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, playlist: publishedItem }));
        }

        // 7. Save / Add Community Playlist to User Library (Increments save count)
        if (url === '/api/community/save' && req.method === 'POST') {
          const body = await parseBody();
          const { playlistId } = body;

          if (!playlistId) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'playlistId is required' }));
          }

          if (!db.community) db.community = {};

          const item = db.community[playlistId];
          if (!item) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Community playlist not found' }));
          }

          item.saveCount = (item.saveCount || 0) + 1;
          item.updatedAt = new Date().toISOString();
          saveDatabase(db);

          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, newSaveCount: item.saveCount }));
        }

        // 8. Get Single Community Playlist by ID
        if (url.startsWith('/api/community/playlist/') && req.method === 'GET') {
          const id = url.replace('/api/community/playlist/', '').split('?')[0];
          const item = db.community?.[id];
          if (!item) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Playlist not found' }));
          }
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, playlist: item }));
        }

        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Endpoint not found' }));
      });
    },
  };
}
