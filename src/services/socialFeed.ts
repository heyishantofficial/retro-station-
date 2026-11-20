import { Track } from '../types';

export type ReactionType = 'hype' | 'love' | 'save';

export interface SocialPost {
  id: string;
  type: 'playlist' | 'song';
  note: string; // Enforced max 200 characters
  timestampSeconds?: number; // Optional deep-link into song (e.g. 145 for 2:25)
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
  timestampSeconds?: number;
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

// Clean slate: no demo / seed posts
export const SEED_POSTS: SocialPost[] = [];

/**
 * Fetch feed posts with server-first pattern and resilient localStorage fallback
 */
export async function fetchSocialFeed(filter: 'recent' | 'trending' = 'recent'): Promise<SocialPost[]> {
  try {
    const res = await fetch(`/api/feed/posts?filter=${filter}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.posts)) {
        // Filter out any lingering seed / demo posts
        const realPosts = data.posts.filter((p: SocialPost) => !p.id.startsWith('seed_post_'));
        // Cache for offline resilience
        try {
          localStorage.setItem(LOCAL_FEED_KEY, JSON.stringify(realPosts));
        } catch {
          // ignore storage quota errors
        }
        return realPosts;
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
      if (Array.isArray(parsed)) {
        const realPosts = parsed.filter((p: SocialPost) => !p.id.startsWith('seed_post_'));
        return sortPosts(realPosts, filter);
      }
    }
  } catch {
    // ignore
  }

  return [];
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
    timestampSeconds: payload.timestampSeconds,
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

/**
 * Delete a post (only allowed for post author)
 */
export async function deleteSocialPost(postId: string, userId?: string): Promise<boolean> {
  // 1. Delete from local cache
  try {
    const feed = getCachedFeed().filter((p) => p.id !== postId);
    localStorage.setItem(LOCAL_FEED_KEY, JSON.stringify(feed));
  } catch {
    // ignore
  }

  // 2. Delete from backend if reachable
  try {
    const res = await fetch(`/api/feed/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return res.ok;
  } catch {
    return true;
  }
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
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p: SocialPost) => !p.id.startsWith('seed_post_'))
      : [];
  } catch {
    return [];
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
