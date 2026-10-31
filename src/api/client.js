const RAW_API_URL = import.meta.env.VITE_API_URL || '';
const BASE_URL = (RAW_API_URL ? RAW_API_URL.replace(/\/+$/, '') : '') + '/api';

if (typeof window !== 'undefined' && !RAW_API_URL && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.warn(
    '[Voxa Cloud Warning] VITE_API_URL environment variable is not configured. ' +
    'To connect your Vercel frontend to your Render backend, set VITE_API_URL=https://<your-render-backend-url>.onrender.com in Vercel Project Settings -> Environment Variables, and redeploy.'
  );
}

// Built-in verified seed tracks (guarantees the home feed never renders empty or gets stuck on loading)
const INITIAL_FALLBACK_SONGS = [
  {
    id: 1001,
    sourceId: 'jam_1001',
    title: 'Midnight City Lights',
    artistName: 'Neon Echoes',
    albumName: 'Cybernetic Sunset',
    genre: 'Synthwave',
    durationSec: 215,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500',
    playCount: 142050,
    active: true,
    isLiked: false
  },
  {
    id: 1002,
    sourceId: 'jam_1002',
    title: 'Retro Highway 84',
    artistName: 'Neon Echoes',
    albumName: 'Cybernetic Sunset',
    genre: 'Synthwave',
    durationSec: 188,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500',
    playCount: 98120,
    active: true,
    isLiked: false
  },
  {
    id: 1004,
    sourceId: 'jam_1004',
    title: 'Sunday Morning Brew',
    artistName: 'Luna Mirage',
    albumName: 'Coffee & Raindrops',
    genre: 'Lo-Fi',
    durationSec: 160,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500',
    playCount: 215300,
    active: true,
    isLiked: false
  },
  {
    id: 1005,
    sourceId: 'jam_1005',
    title: 'Tokyo Street Drizzle',
    artistName: 'Luna Mirage',
    albumName: 'Coffee & Raindrops',
    genre: 'Lo-Fi',
    durationSec: 175,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500',
    playCount: 189400,
    active: true,
    isLiked: false
  },
  {
    id: 1007,
    sourceId: 'jam_1007',
    title: 'Wildflowers & Gold',
    artistName: 'The Velvet Bloom',
    albumName: 'Golden Horizons',
    genre: 'Pop',
    durationSec: 205,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500',
    playCount: 312800,
    active: true,
    isLiked: false
  },
  {
    id: 1009,
    sourceId: 'jam_1009',
    title: 'Electric Euphoria',
    artistName: 'Apex Pulse',
    albumName: 'Overdrive Velocity',
    genre: 'Pop',
    durationSec: 220,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500',
    playCount: 178900,
    active: true,
    isLiked: false
  },
  {
    id: 1011,
    sourceId: 'jam_1011',
    title: 'Mountain Pine Whispers',
    artistName: 'Quiet Reverie',
    albumName: 'Whispering Woods',
    genre: 'Retro',
    durationSec: 168,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=500',
    playCount: 152300,
    active: true,
    isLiked: false
  },
  {
    id: 1012,
    sourceId: 'jam_1012',
    title: 'Canyon Echoes',
    artistName: 'Quiet Reverie',
    albumName: 'Whispering Woods',
    genre: 'Retro',
    durationSec: 198,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500',
    playCount: 89400,
    active: true,
    isLiked: false
  }
];

// High-speed in-memory LRU search and autocomplete caches
const searchCache = new Map();
const suggestionCache = new Map();

function getAuthHeaders(endpoint = '') {
  const headers = { 'Content-Type': 'application/json' };
  // Never send Authorization header on public registration/login/otp endpoints
  if (
    endpoint.startsWith('/auth/login') ||
    endpoint.startsWith('/auth/register') ||
    endpoint.startsWith('/auth/send-otp') ||
    endpoint.startsWith('/auth/verify-otp')
  ) {
    return headers;
  }
  const token = localStorage.getItem('aurastream_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    ...getAuthHeaders(endpoint),
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      if (!endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register')) {
        console.warn('Session expired or unauthorized');
      }
    }

    if (!response.ok) {
      let errMessage = 'Request failed';
      try {
        const errData = await response.json();
        errMessage = errData.message || errData.error || `Error ${response.status}`;
      } catch {
        errMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errMessage);
    }

    // Check if response has content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    if (contentType && contentType.includes('text/html')) {
      console.warn(`[Voxa API] Endpoint '${endpoint}' returned HTML instead of JSON. Ensure VITE_API_URL is set in Vercel to your deployed Render URL.`);
      return null;
    }
    return null;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

function normalizeTitle(t = '') {
  return t
    .toLowerCase()
    .replace(/\(from ".*?"\)/gi, '')
    .replace(/\(from '.*?'\)/gi, '')
    .replace(/\(.*?\)/gi, '')
    .replace(/\[.*?\]/gi, '')
    .replace(/- .*$/g, '')
    .replace(/ft\..*$/g, '')
    .replace(/feat\..*$/g, '')
    .replace(/piya$/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  sendOtp: (email, name = '') => request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email, name })
  }),
  verifyOtp: (email, otp, name, password) => request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp, name, password })
  }),
  register: (name, email, password) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password })
  }),
  getCurrentUser: () => request('/auth/me'),

  // Home & Catalog
  getHomeFeed: async () => {
    let rawList = [];
    let initialFeed = null;
    try {
      initialFeed = await request('/home');
      if (initialFeed && Array.isArray(initialFeed.trending)) {
        rawList = [...initialFeed.trending];
      }
    } catch (err) {
      console.warn('Backend /home fetch notice:', err);
    }

    // Strictly deduplicate by normalized title
    const seenTitles = new Set();
    const uniqueTrending = [];
    for (const song of rawList) {
      if (!song || !song.title) continue;
      const norm = normalizeTitle(song.title);
      if (!norm || seenTitles.has(norm)) continue;
      seenTitles.add(norm);
      uniqueTrending.push(song);
    }

    // Fallback: If unique list is empty (e.g. backend is waking up on Render free tier or offline), load built-in verified tracks
    if (uniqueTrending.length === 0) {
      uniqueTrending.push(...INITIAL_FALLBACK_SONGS);
    }

    return {
      trending: uniqueTrending,
      newReleases: initialFeed?.newReleases?.length ? initialFeed.newReleases : uniqueTrending.slice(0, 20),
      genres: ['All', 'Bollywood', 'Romantic', 'Punjabi', 'Lo-Fi', 'Pop', 'Retro', 'Devotional'],
      recommended: uniqueTrending.slice(10, 25)
    };
  },
  getSongs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/songs${query ? `?${query}` : ''}`);
  },
  getSongById: (id) => request(`/songs/${id}`),
  getArtists: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/artists${query ? `?${query}` : ''}`);
  },
  getArtistById: (id) => request(`/artists/${id}`),
  getAlbums: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/albums${query ? `?${query}` : ''}`);
  },
  getAlbumById: (id) => request(`/albums/${id}`),

  // Search with unified fallback and live catalog merging
  // Search with backend proxy + authentic original movie soundtrack artwork matching
  // Search with ultra-fast parallel queries + in-memory cache
  search: async (q, type = 'all') => {
    const rawQ = (q || '').trim();
    if (!rawQ) return { content: [], totalElements: 0 };

    const cacheKey = rawQ.toLowerCase();
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }

    // Extract core song title (e.g., "Qaafirana" from "Qaafirana - Arijit Singh Vocals Only")
    const cleanQ = rawQ
      .replace(/\(from ".*?"\)/gi, '')
      .replace(/\(from '.*?'\)/gi, '')
      .replace(/\(.*?\)/gi, '')
      .replace(/\[.*?\]/gi, '')
      .replace(/vocals?\s*only/gi, '')
      .replace(/instrumental/gi, '')
      .replace(/slowed\s*\+?\s*reverb/gi, '')
      .replace(/lo-?fi\s*(remix|mix|version)?/gi, '')
      .replace(/- .*$/g, '')
      .trim();

    const searchTarget = cleanQ || rawQ;
    const searchQueries = Array.from(new Set([searchTarget, rawQ].filter(Boolean)));

    const getOriginalScore = (item) => {
      let score = 0;
      const album = (item.more_info?.album || '').toLowerCase();
      const subtitle = (item.subtitle || '').toLowerCase();
      const text = `${album} ${subtitle}`;

      if (/vol|volume/i.test(text)) score -= 50;
      if (/lounge/i.test(text)) score -= 50;
      if (/special/i.test(text)) score -= 30;
      if (/hits/i.test(text)) score -= 40;
      if (/\bmix\b|\bremix\b/i.test(text)) score -= 30;
      if (/spotlight/i.test(text)) score -= 40;
      if (/chill/i.test(text)) score -= 30;
      if (/best of/i.test(text)) score -= 50;
      if (/sunset\s*(&|and)\s*strings/i.test(text)) score -= 70;
      if (/collection|compilation/i.test(text)) score -= 50;
      if (/party|dance mix/i.test(text)) score -= 30;
      if (/mashup/i.test(text)) score -= 40;

      if (album && album !== 'single') score += 25;
      return score;
    };

    const bestByNorm = new Map();

    // 1. FAST-PATH: Query backend first (backend already searches local DB + cloud proxy with 320kbps links)
    try {
      const backendRes = await request(`/search?q=${encodeURIComponent(searchTarget)}`);
      if (backendRes && Array.isArray(backendRes.content) && backendRes.content.length > 0) {
        const finalResult = {
          content: backendRes.content,
          totalElements: backendRes.totalElements || backendRes.content.length
        };
        if (searchCache.size > 120) searchCache.clear();
        searchCache.set(cacheKey, finalResult);
        return finalResult;
      }
    } catch (backendErr) {
      console.warn('Backend search note, falling back to direct cloud search:', backendErr);
    }

    // 2. FALLBACK: Direct Cloud Search only if backend returned 0 items or threw an error
    try {
      const cloudUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=35&p=1&q=${encodeURIComponent(searchTarget)}`;
      const cloudRes = await fetch(cloudUrl, { signal: AbortSignal.timeout(1800) });
      const cloudData = await cloudRes.json();

      if (cloudData?.results && Array.isArray(cloudData.results)) {
        for (const item of cloudData.results) {
          const rawTitle = item.title || 'Unknown Title';
          const cleanTitle = rawTitle
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#039;/g, "'");

          const normTitle = normalizeTitle(cleanTitle);
          if (!normTitle) continue;
          const artistKey = (item.subtitle || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
          const norm = `${normTitle}_${artistKey}`;

          const score = getOriginalScore(item);
          const playCount = Number(item.play_count || 0);

          if (!bestByNorm.has(norm)) {
            bestByNorm.set(norm, { item, cleanTitle, score, playCount });
          } else {
            const existing = bestByNorm.get(norm);
            if (score > existing.score || (score === existing.score && playCount > existing.playCount)) {
              bestByNorm.set(norm, { item, cleanTitle, score, playCount });
            }
          }
        }
      }
    } catch (cloudErr) {
      console.warn('Cloud search fallback notice:', cloudErr);
    }

    const combined = [];
    for (const { item, cleanTitle, playCount } of bestByNorm.values()) {
      const cleanArtist = (item.subtitle || 'Bollywood Artist')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'");

      const vlink = item.more_info?.vlink || '';
      const preview = item.more_info?.media_preview_url || '';
      const audioUrl = vlink || preview || 'https://jiotunepreview.jio.com/content/Converted/010910393154234.mp3';

      const rawImg = (item.image || '').replace(/^http:/, 'https:');
      const imageUrl = rawImg
        .replace('150x150', '500x500')
        .replace('50x50', '500x500')
        || rawImg
        || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500';

      combined.push({
        id: item.id,
        sourceId: 'saavn_' + item.id,
        title: cleanTitle,
        artistName: cleanArtist,
        albumName: item.more_info?.album || 'Original Soundtrack',
        genre: item.language || 'Hindi',
        durationSec: Number(item.more_info?.duration || 210),
        audioUrl: audioUrl,
        imageUrl: imageUrl,
        playCount: playCount || 50000,
        active: true,
        isLiked: false
      });
    }

    combined.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));

    const finalResult = { content: combined, totalElements: combined.length };
    if (searchCache.size > 120) searchCache.clear();
    searchCache.set(cacheKey, finalResult);

    return finalResult;
  },
  getSuggestions: async (q) => {
    if (!q || q.trim().length < 2) return { suggestions: [], songs: [], artists: [] };
    const clean = q.trim();
    const cacheKey = clean.toLowerCase();
    if (suggestionCache.has(cacheKey)) {
      return suggestionCache.get(cacheKey);
    }
    try {
      const res = await request(`/search/suggest?q=${encodeURIComponent(clean)}`);
      if (res && (res.suggestions?.length || res.songs?.length || res.artists?.length)) {
        if (suggestionCache.size > 150) suggestionCache.clear();
        suggestionCache.set(cacheKey, res);
        return res;
      }
    } catch (e) {
      console.warn('Backend suggestions notice:', e);
    }

    try {
      const url = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&api_version=4&ctx=web6dot0&query=${encodeURIComponent(clean)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const data = await response.json();
      const suggestions = [];
      const songs = [];
      const artists = [];

      if (data?.topquery?.data?.length) {
        const top = data.topquery.data[0];
        const title = (top.title || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
        if (title) suggestions.push(title);
      }
      if (data?.songs?.data?.length) {
        data.songs.data.slice(0, 5).forEach((s) => {
          const title = (s.title || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
          if (title && !suggestions.includes(title)) suggestions.push(title);
          songs.push({
            id: s.id,
            title: title,
            artistName: (s.subtitle || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
            imageUrl: (s.image || '').replace('50x50', '150x150'),
            audioUrl: s.more_info?.vlink || ''
          });
        });
      }
      if (data?.artists?.data?.length) {
        data.artists.data.slice(0, 3).forEach((a) => {
          const name = (a.title || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
          if (name && !suggestions.includes(name)) suggestions.push(name);
          artists.push({
            name: name,
            imageUrl: (a.image || '').replace('50x50', '150x150')
          });
        });
      }
      const res = { query: clean, suggestions, songs, artists };
      if (suggestionCache.size > 150) suggestionCache.clear();
      suggestionCache.set(cacheKey, res);
      return res;
    } catch (err) {
      return { suggestions: [], songs: [], artists: [] };
    }
  },

  // Likes (Mapped directly to Spring Boot UserController & SongController)
  getLikedSongs: async () => {
    try {
      const res = await request('/me/liked');
      if (res && res.content) return res.content;
      if (Array.isArray(res)) return res;
    } catch (e) {
      console.warn('Backend /me/liked error:', e);
    }
    return null;
  },
  likeSong: (songId) => request(`/songs/${songId}/like`, { method: 'POST' }),
  unlikeSong: (songId) => request(`/songs/${songId}/like`, { method: 'POST' }),

  // Playlists
  getMyPlaylists: () => request('/playlists/my'),
  getPlaylistById: (id) => request(`/playlists/${id}`),
  createPlaylist: (title, description = '', isPublic = true) => request('/playlists', {
    method: 'POST',
    body: JSON.stringify({ name: title, title, description, isPublic })
  }),
  addSongToPlaylist: (playlistId, songId) => request(`/playlists/${playlistId}/songs/${songId}`, {
    method: 'POST'
  }),
  removeSongFromPlaylist: (playlistId, songId) => request(`/playlists/${playlistId}/songs/${songId}`, {
    method: 'DELETE'
  }),
  deletePlaylist: (playlistId) => request(`/playlists/${playlistId}`, {
    method: 'DELETE'
  }),

  // Play History (FRD 30s threshold)
  recordPlay: (songId, durationSeconds) => request('/history/played', {
    method: 'POST',
    body: JSON.stringify({ songId, durationSeconds })
  }),
  getPlayHistory: () => request('/history'),

  // Admin
  getAdminStats: () => request('/admin/stats'),
  getImportJobs: () => request('/admin/import'),
  triggerJamendoImport: (tag = 'rock', limit = 10) => request('/admin/import', {
    method: 'POST',
    body: JSON.stringify({ tag, max: limit, limit })
  })
};
