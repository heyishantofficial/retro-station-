import fs from 'fs';
import path from 'path';

const DB_FILE_PATH = path.join('/tmp', 'cloud_db.json');

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

function getDatabase() {
  let db;
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      db = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'));
    } else {
      db = { users: {}, playlists: {}, community: {} };
    }
  } catch {
    db = { users: {}, playlists: {}, community: {} };
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
  } catch (e) {
    console.error('Save DB error:', e);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = req.url || '';
  const db = getDatabase();

  // Health
  if (url === '/api/health' || url === '/api' || url.startsWith('/api/health')) {
    return res.status(200).json({ status: 'ok', service: 'Retro Station Cloud API on Vercel' });
  }

  // Community playlists
  if (url.startsWith('/api/community/playlists') && req.method === 'GET') {
    const list = Object.values(db.community || {}).sort((a, b) => (b.saveCount || 0) - (a.saveCount || 0));
    return res.status(200).json({ success: true, playlists: list });
  }

  // Publish playlist
  if (url.startsWith('/api/community/publish') && req.method === 'POST') {
    const body = req.body || {};
    const { playlist, creatorName, creatorAvatar, creatorId } = body;
    if (!playlist || !playlist.title) {
      return res.status(400).json({ error: 'Playlist object with title is required' });
    }
    const playlistId = playlist.id || `pub_${Date.now()}`;
    const existing = db.community[playlistId];
    const item = {
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
      creatorId,
      tracks: playlist.tracks || [],
      saveCount: existing ? existing.saveCount : 1,
      isPublic: true,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.community[playlistId] = item;
    saveDatabase(db);
    return res.status(200).json({ success: true, playlist: item });
  }

  // Save community crate
  if (url.startsWith('/api/community/save') && req.method === 'POST') {
    const body = req.body || {};
    const { playlistId } = body;
    if (!playlistId) return res.status(400).json({ error: 'playlistId is required' });
    const item = db.community[playlistId];
    if (!item) return res.status(404).json({ error: 'Community playlist not found' });
    item.saveCount = (item.saveCount || 0) + 1;
    item.updatedAt = new Date().toISOString();
    saveDatabase(db);
    return res.status(200).json({ success: true, newSaveCount: item.saveCount });
  }

  // Google Auth
  if (url.startsWith('/api/auth/google') && req.method === 'POST') {
    const { user } = req.body || {};
    if (!user || !user.email) return res.status(400).json({ error: 'User email is required' });
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
    const existing = db.playlists[userId]?.playlists || null;
    return res.status(200).json({
      success: true,
      user: userData,
      hasCloudPlaylists: Boolean(existing && existing.length > 0),
      cloudPlaylistsCount: existing ? existing.length : 0,
    });
  }

  // Get user playlists
  if (url.startsWith('/api/user/playlists') && req.method === 'GET') {
    const parsed = new URL(url, 'http://localhost');
    const userId = parsed.searchParams.get('userId') || req.query?.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const record = db.playlists[userId];
    return res.status(200).json({
      success: true,
      playlists: record ? record.playlists : [],
      updatedAt: record ? record.updatedAt : null,
    });
  }

  // Put user playlists
  if (url.startsWith('/api/user/playlists') && req.method === 'PUT') {
    const { userId, playlists } = req.body || {};
    if (!userId || !Array.isArray(playlists)) {
      return res.status(400).json({ error: 'userId and playlists are required' });
    }
    db.playlists[userId] = { playlists, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    return res.status(200).json({ success: true, count: playlists.length });
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}
