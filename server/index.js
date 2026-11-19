import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DB_FILE_PATH = process.env.VERCEL
  ? path.join('/tmp', 'cloud_db.json')
  : path.resolve(__dirname, 'data/cloud_db.json');

const SEED_COMMUNITY_PLAYLISTS = [
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
];

function ensureDatabase() {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db;
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

function saveDatabase(db) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Retro Cloud DB] Save error:', err);
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Retro Station Cloud API', timestamp: new Date().toISOString() });
});

// Google Authentication & User Profile
app.post('/api/auth/google', (req, res) => {
  const { user } = req.body;
  if (!user || !user.email) {
    return res.status(400).json({ error: 'User profile with email is required' });
  }

  const db = ensureDatabase();
  const userId = user.id || `google_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const userData = {
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

  return res.json({
    success: true,
    user: userData,
    hasCloudPlaylists: Boolean(existingPlaylists && existingPlaylists.length > 0),
    cloudPlaylistsCount: existingPlaylists ? existingPlaylists.length : 0,
  });
});

// Get User Playlists from Cloud
app.get('/api/user/playlists', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const db = ensureDatabase();
  const record = db.playlists[userId];
  return res.json({
    success: true,
    playlists: record ? record.playlists : [],
    updatedAt: record ? record.updatedAt : null,
  });
});

// Save User Playlists to Cloud
app.put('/api/user/playlists', (req, res) => {
  const { userId, playlists } = req.body;
  if (!userId || !Array.isArray(playlists)) {
    return res.status(400).json({ error: 'userId and playlists array are required' });
  }

  const db = ensureDatabase();
  const updatedAt = new Date().toISOString();
  db.playlists[userId] = {
    playlists,
    updatedAt,
  };
  saveDatabase(db);

  return res.json({
    success: true,
    count: playlists.length,
    updatedAt,
  });
});

// Get Public Ranked Community Playlists
app.get('/api/community/playlists', (req, res) => {
  const db = ensureDatabase();
  const list = Object.values(db.community || {}).sort(
    (a, b) => (b.saveCount || 0) - (a.saveCount || 0)
  );
  return res.json({ success: true, playlists: list });
});

// Publish a Playlist to Community
app.post('/api/community/publish', (req, res) => {
  const { playlist, creatorName, creatorAvatar, creatorId } = req.body;
  if (!playlist || !playlist.title) {
    return res.status(400).json({ error: 'Playlist object with title is required' });
  }

  const db = ensureDatabase();
  if (!db.community) db.community = {};

  const playlistId = playlist.id || `pub_${Date.now()}`;
  const existing = db.community[playlistId];

  const publishedItem = {
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
    saveCount: existing ? existing.saveCount : 1,
    isPublic: true,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.community[playlistId] = publishedItem;
  saveDatabase(db);

  return res.json({ success: true, playlist: publishedItem });
});

// Save Community Playlist (increments saves)
app.post('/api/community/save', (req, res) => {
  const { playlistId } = req.body;
  if (!playlistId) {
    return res.status(400).json({ error: 'playlistId is required' });
  }

  const db = ensureDatabase();
  if (!db.community) db.community = {};

  const item = db.community[playlistId];
  if (!item) {
    return res.status(404).json({ error: 'Community playlist not found' });
  }

  item.saveCount = (item.saveCount || 0) + 1;
  item.updatedAt = new Date().toISOString();
  saveDatabase(db);

  return res.json({ success: true, newSaveCount: item.saveCount });
});

// Get Single Community Playlist by ID
app.get('/api/community/playlist/:id', (req, res) => {
  const db = ensureDatabase();
  const item = db.community?.[req.params.id];
  if (!item) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  return res.json({ success: true, playlist: item });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Retro Station Backend] Listening on http://localhost:${PORT}`);
  });
}

export default app;
