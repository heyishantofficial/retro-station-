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

const DB_FILE_PATH = path.resolve(__dirname, 'data/cloud_db.json');

function ensureDatabase() {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE_PATH)) {
    const initial = { users: {}, playlists: {} };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const fallback = { users: {}, playlists: {} };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
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
  res.json({ status: 'ok', service: 'Retro Station Standalone Cloud Server' });
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

app.listen(PORT, () => {
  console.log(`[Retro Station Backend] Listening on http://localhost:${PORT}`);
});
