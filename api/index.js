import fs from 'fs';
import path from 'path';

const DB_FILE_PATH = path.join('/tmp', 'cloud_db.json');

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

  if (!db.community) {
    db.community = {};
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

function sendResponse(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = req.url || '';
  const db = getDatabase();

  try {
    // Health
    if (url === '/api/health' || url === '/api' || url.startsWith('/api/health')) {
      return sendResponse(res, 200, {
        status: 'ok',
        service: 'Retro Station Cloud API on Vercel',
        timestamp: new Date().toISOString(),
      });
    }

    // Community playlists
    if (url.startsWith('/api/community/playlists') && req.method === 'GET') {
      const list = Object.values(db.community || {}).sort(
        (a, b) => (b.saveCount || 0) - (a.saveCount || 0)
      );
      return sendResponse(res, 200, { success: true, playlists: list });
    }

    // Publish playlist
    if (url.startsWith('/api/community/publish') && req.method === 'POST') {
      const body = await parseBody(req);
      const { playlist, creatorName, creatorAvatar, creatorId } = body;
      if (!playlist || !playlist.title) {
        return sendResponse(res, 400, { error: 'Playlist object with title is required' });
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
      return sendResponse(res, 200, { success: true, playlist: item });
    }

    // Save community crate
    if (url.startsWith('/api/community/save') && req.method === 'POST') {
      const body = await parseBody(req);
      const { playlistId } = body;
      if (!playlistId) return sendResponse(res, 400, { error: 'playlistId is required' });
      const item = db.community[playlistId];
      if (!item) return sendResponse(res, 404, { error: 'Community playlist not found' });
      item.saveCount = (item.saveCount || 0) + 1;
      item.updatedAt = new Date().toISOString();
      saveDatabase(db);
      return sendResponse(res, 200, { success: true, newSaveCount: item.saveCount });
    }

    // Google Auth
    if (url.startsWith('/api/auth/google') && req.method === 'POST') {
      const body = await parseBody(req);
      const { user } = body;
      if (!user || !user.email) return sendResponse(res, 400, { error: 'User email is required' });
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
      return sendResponse(res, 200, {
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
      if (!userId) return sendResponse(res, 400, { error: 'userId is required' });
      const record = db.playlists[userId];
      return sendResponse(res, 200, {
        success: true,
        playlists: record ? record.playlists : [],
        updatedAt: record ? record.updatedAt : null,
      });
    }

    // Put user playlists
    if (url.startsWith('/api/user/playlists') && req.method === 'PUT') {
      const body = await parseBody(req);
      const { userId, playlists } = body;
      if (!userId || !Array.isArray(playlists)) {
        return sendResponse(res, 400, { error: 'userId and playlists are required' });
      }
      db.playlists[userId] = { playlists, updatedAt: new Date().toISOString() };
      saveDatabase(db);
      return sendResponse(res, 200, { success: true, count: playlists.length });
    }

    return sendResponse(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    console.error('API Error:', err);
    return sendResponse(res, 500, { error: 'Internal server error', message: String(err) });
  }
}
