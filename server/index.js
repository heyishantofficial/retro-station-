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

  if (!db.community) {
    db.community = {};
    saveDatabase(db);
  }

  if (!db.feed || !Array.isArray(db.feed)) {
    db.feed = [];
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

// ==========================================
// SHARING IS CARING: SOCIAL MUSIC FEED APIS
// ==========================================

// 1. Get Feed Posts (Recent or Trending)
app.get('/api/feed/posts', (req, res) => {
  const { filter } = req.query; // 'recent' or 'trending'
  const db = ensureDatabase();
  let posts = [...(db.feed || [])];

  if (filter === 'trending') {
    posts.sort((a, b) => {
      const scoreA =
        (a.reactions?.hype || 0) * 2 + (a.reactions?.love || 0) + (a.reactions?.save || 0) * 3;
      const scoreB =
        (b.reactions?.hype || 0) * 2 + (b.reactions?.love || 0) + (b.reactions?.save || 0) * 3;
      return scoreB - scoreA;
    });
  } else {
    // Default: Recent first
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return res.json({ success: true, posts });
});

// 2. Create a Post (Playlist Drop or Song Story)
app.post('/api/feed/posts', (req, res) => {
  const { type, note, playlist, song, author, timestampSeconds } = req.body;

  if (!type || (type !== 'playlist' && type !== 'song')) {
    return res.status(400).json({ error: 'Valid post type ("playlist" or "song") is required' });
  }

  if (!note || typeof note !== 'string') {
    return res.status(400).json({ error: 'A short note is required' });
  }

  // Enforce the 200 character micro-note limit (not an entire essay)
  const trimmedNote = note.trim().slice(0, 200);

  const db = ensureDatabase();
  if (!Array.isArray(db.feed)) db.feed = [];

  const newPost = {
    id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    note: trimmedNote,
    timestampSeconds: typeof timestampSeconds === 'number' ? timestampSeconds : undefined,
    author: {
      id: author?.id || undefined,
      name: author?.name || 'Anonymous Collector',
      avatarUrl:
        author?.avatarUrl ||
        `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
          author?.name || 'listener'
        )}`,
      email: author?.email || undefined,
    },
    playlist: type === 'playlist' ? playlist : undefined,
    song: type === 'song' ? song : undefined,
    reactions: {
      hype: 1,
      love: 1,
      save: 0,
    },
    createdAt: new Date().toISOString(),
  };

  db.feed.unshift(newPost);
  saveDatabase(db);

  return res.json({ success: true, post: newPost });
});

// 3. React to a Post (Hype, Love, Save)
app.post('/api/feed/posts/:id/react', (req, res) => {
  const { id } = req.params;
  const { reactionType, action } = req.body; // reactionType: 'hype' | 'love' | 'save', action: 'add' | 'remove'

  if (!['hype', 'love', 'save'].includes(reactionType)) {
    return res.status(400).json({ error: 'Invalid reaction type' });
  }

  const db = ensureDatabase();
  const post = (db.feed || []).find((p) => p.id === id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (!post.reactions) {
    post.reactions = { hype: 0, love: 0, save: 0 };
  }

  const delta = action === 'remove' ? -1 : 1;
  post.reactions[reactionType] = Math.max(0, (post.reactions[reactionType] || 0) + delta);
  saveDatabase(db);

  return res.json({ success: true, reactions: post.reactions });
});

// 4. Delete a Post (Author only)
app.delete('/api/feed/posts/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const db = ensureDatabase();
  const index = (db.feed || []).findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const post = db.feed[index];
  if (post.author?.id && userId && post.author.id !== userId) {
    return res.status(403).json({ error: 'Unauthorized to delete this post' });
  }

  db.feed.splice(index, 1);
  saveDatabase(db);

  return res.json({ success: true });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Retro Station Backend] Listening on http://localhost:${PORT}`);
  });
}

export default app;
