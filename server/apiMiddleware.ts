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

interface UserDatabase {
  users: Record<string, StoredUserData>;
  playlists: Record<string, { playlists: any[]; updatedAt: string }>;
}

const DB_FILE_PATH = path.resolve(process.cwd(), 'server/data/cloud_db.json');

function ensureDatabase(): UserDatabase {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE_PATH)) {
    const initial: UserDatabase = { users: {}, playlists: {} };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const fallback: UserDatabase = { users: {}, playlists: {} };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
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

        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Endpoint not found' }));
      });
    },
  };
}
