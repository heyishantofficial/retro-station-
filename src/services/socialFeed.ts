import { Track } from '../types';

export type ReactionType = 'hype' | 'love' | 'save';

export interface SocialPost {
  id: string;
  type: 'playlist' | 'song';
  note: string; // Enforced max 200 characters
  author: {
    id?: string;
    name: string;
    avatarUrl?: string;
    email?: string;
  };
  playlist?: {
    id: string;
    title: string;
    category?: string;
    trackCount: number;
    tracks: Track[];
  };
  song?: Track;
  reactions: {
    hype: number; // 🔥
    love: number; // ❤️
    save: number; // 💿
  };
  createdAt: string;
}

export interface CreatePostPayload {
  type: 'playlist' | 'song';
  note: string;
  author: {
    id?: string;
    name: string;
    avatarUrl?: string;
    email?: string;
  };
  playlist?: {
    id: string;
    title: string;
    category?: string;
    trackCount: number;
    tracks: Track[];
  };
  song?: Track;
}

const LOCAL_FEED_KEY = 'retro_social_feed_cache';
const LOCAL_REACTIONS_KEY = 'retro_social_user_reactions';

// Aesthetic starter posts to welcome listeners into the lounge
export const SEED_POSTS: SocialPost[] = [
  {
    id: 'seed_post_1',
    type: 'song',
    note: 'The synth lead at the drop gives me goosebumps every single time. Peak night drive energy.',
    author: {
      name: 'Elena Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
    },
    song: {
      id: 'seed_song_resonance',
      title: 'Resonance',
      artist: 'HOME',
      album: 'Odyssey',
      year: '2014',
      duration: 212,
      coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80',
      youtubeId: '8GW6sLrK40k',
      genre: 'Chillwave',
      label: 'Midwest Collective',
      matrixCode: 'RS-HOME-01',
      quotes: [],
    },
    reactions: {
      hype: 42,
      love: 68,
      save: 24,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45m ago
  },
  {
    id: 'seed_post_2',
    type: 'playlist',
    note: 'Handpicked lo-fi chillhop for deep coding and rain outside. Keeps your focus locked in all night.',
    author: {
      name: 'Kaito Tanaka',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    },
    playlist: {
      id: 'seed_pl_lofi',
      title: 'Lofi Beats • Late Night Study',
      category: 'Lofi & Chill',
      trackCount: 4,
      tracks: [
        {
          id: 'lofi-1',
          title: 'Snowman',
          artist: 'WYS',
          album: '1 AM Study Session',
          year: '2020',
          duration: 198,
          coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80',
          youtubeId: 'beBUgpflR40',
          genre: 'Lofi Hip Hop',
          label: 'Lofi Records',
          matrixCode: 'RS-LOFI-01',
          quotes: [],
        },
        {
          id: 'lofi-2',
          title: 'The Girl I Havent Met',
          artist: 'Kudasaibeats',
          album: 'Falling',
          year: '2017',
          duration: 184,
          coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&q=80',
          youtubeId: 'wAPCSnAhhC8',
          genre: 'Lofi',
          label: 'Independent',
          matrixCode: 'RS-LOFI-02',
          quotes: [],
        },
      ],
    },
    reactions: {
      hype: 57,
      love: 91,
      save: 38,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3h ago
  },
  {
    id: 'seed_post_3',
    type: 'song',
    note: 'Kavinsky and Lovefoxxx created the definitive modern synthwave anthem. That vocoder is immortal.',
    author: {
      name: 'Marcus Brody',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
    },
    song: {
      id: 'seed_song_nightcall',
      title: 'Nightcall',
      artist: 'Kavinsky',
      album: 'Drive Original Soundtrack',
      year: '2010',
      duration: 259,
      coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&q=80',
      youtubeId: 'MV_3Dpw-BRY',
      genre: 'Synthwave',
      label: 'Record Makers',
      matrixCode: 'RS-DRIVE-01',
      quotes: [],
    },
    reactions: {
      hype: 83,
      love: 44,
      save: 18,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6h ago
  },
];

/**
 * Fetch feed posts with server-first pattern and resilient localStorage fallback
 */
export async function fetchSocialFeed(filter: 'recent' | 'trending' = 'recent'): Promise<SocialPost[]> {
  try {
    const res = await fetch(`/api/feed/posts?filter=${filter}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.posts) && data.posts.length > 0) {
        // Cache for offline resilience
        try {
          localStorage.setItem(LOCAL_FEED_KEY, JSON.stringify(data.posts));
        } catch {
          // ignore storage quota errors
        }
        return data.posts;
      }
    }
  } catch {
    // Backend offline / serverless sleeping
  }

  // Fallback to local cache
  try {
    const localRaw = localStorage.getItem(LOCAL_FEED_KEY);
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortPosts(parsed, filter);
      }
    }
  } catch {
    // ignore
  }

  // First-time fallback: Seed posts
  return sortPosts(SEED_POSTS, filter);
}

/**
 * Post a new playlist drop or song story
 */
export async function createSocialPost(payload: CreatePostPayload): Promise<SocialPost> {
  const trimmedNote = payload.note.trim().slice(0, 200);

  // 1. Try server endpoint
  try {
    const res = await fetch('/api/feed/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, note: trimmedNote }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.post) {
        savePostToLocalFeed(data.post);
        return data.post;
      }
    }
  } catch {
    // Backend sleeping
  }

  // 2. Local fallback creation
  const localPost: SocialPost = {
    id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: payload.type,
    note: trimmedNote,
    author: {
      id: payload.author.id,
      name: payload.author.name || 'Anonymous Collector',
      avatarUrl:
        payload.author.avatarUrl ||
        `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
          payload.author.name || 'listener'
        )}`,
      email: payload.author.email,
    },
    playlist: payload.type === 'playlist' ? payload.playlist : undefined,
    song: payload.type === 'song' ? payload.song : undefined,
    reactions: {
      hype: 1,
      love: 1,
      save: 0,
    },
    createdAt: new Date().toISOString(),
  };

  savePostToLocalFeed(localPost);
  return localPost;
}

/**
 * 1-Tap toggle reaction (Hype, Love, Save)
 */
export async function togglePostReaction(
  postId: string,
  reactionType: ReactionType
): Promise<{ reactions: Record<ReactionType, number>; hasReacted: boolean }> {
  const reactionsMap = getLocalUserReactions();
  const currentPostReactions = reactionsMap[postId] || {};
  const isCurrentlyReacted = Boolean(currentPostReactions[reactionType]);
  const action = isCurrentlyReacted ? 'remove' : 'add';

  // Toggle in local storage
  currentPostReactions[reactionType] = !isCurrentlyReacted;
  reactionsMap[postId] = currentPostReactions;
  try {
    localStorage.setItem(LOCAL_REACTIONS_KEY, JSON.stringify(reactionsMap));
  } catch {
    // ignore
  }

  // Try server call
  try {
    const res = await fetch(`/api/feed/posts/${postId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reactionType, action }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.reactions) {
        return {
          reactions: data.reactions,
          hasReacted: !isCurrentlyReacted,
        };
      }
    }
  } catch {
    // offline
  }

  // Local fallback: update cached feed
  const feed = getCachedFeed();
  const target = feed.find((p) => p.id === postId);
  if (target) {
    if (!target.reactions) target.reactions = { hype: 0, love: 0, save: 0 };
    const delta = action === 'remove' ? -1 : 1;
    target.reactions[reactionType] = Math.max(0, (target.reactions[reactionType] || 0) + delta);
    try {
      localStorage.setItem(LOCAL_FEED_KEY, JSON.stringify(feed));
    } catch {
      // ignore
    }
    return {
      reactions: target.reactions,
      hasReacted: !isCurrentlyReacted,
    };
  }

  return {
    reactions: { hype: 0, love: 0, save: 0 },
    hasReacted: !isCurrentlyReacted,
  };
}

/**
 * Check if the user has already reacted to this post
 */
export function hasUserReacted(postId: string, reactionType: ReactionType): boolean {
  const map = getLocalUserReactions();
  return Boolean(map[postId]?.[reactionType]);
}

// Helpers
function getLocalUserReactions(): Record<string, Record<string, boolean>> {
  try {
    const raw = localStorage.getItem(LOCAL_REACTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getCachedFeed(): SocialPost[] {
  try {
    const raw = localStorage.getItem(LOCAL_FEED_KEY);
    return raw ? JSON.parse(raw) : [...SEED_POSTS];
  } catch {
    return [...SEED_POSTS];
  }
}

function savePostToLocalFeed(post: SocialPost) {
  const feed = getCachedFeed();
  feed.unshift(post);
  try {
    localStorage.setItem(LOCAL_FEED_KEY, JSON.stringify(feed));
  } catch {
    // ignore
  }
}

function sortPosts(posts: SocialPost[], filter: 'recent' | 'trending'): SocialPost[] {
  const cloned = [...posts];
  if (filter === 'trending') {
    return cloned.sort((a, b) => {
      const scoreA = (a.reactions?.hype || 0) * 2 + (a.reactions?.love || 0) + (a.reactions?.save || 0) * 3;
      const scoreB = (b.reactions?.hype || 0) * 2 + (b.reactions?.love || 0) + (b.reactions?.save || 0) * 3;
      return scoreB - scoreA;
    });
  }
  return cloned.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
