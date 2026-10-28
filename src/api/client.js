const BASE_URL = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '') + '/api';

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

    // If unique list is fewer than 35 items, fetch diverse top hits from live cloud catalog
    if (uniqueTrending.length < 35) {
      try {
        const queries = ['top bollywood hits', 'trending hindi songs'];
        for (const q of queries) {
          if (uniqueTrending.length >= 45) break;
          const res = await fetch(`https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=30&p=1&q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (data && data.results) {
            for (const item of data.results) {
              const rawTitle = item.title || 'Unknown Title';
              const cleanTitle = rawTitle.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
              const norm = normalizeTitle(cleanTitle);
              if (!norm || seenTitles.has(norm)) continue;
              seenTitles.add(norm);

              const cleanArtist = (item.subtitle || 'Bollywood Artist').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
              const vlink = item.more_info?.vlink || '';
              const preview = item.more_info?.media_preview_url || '';
              const rawImg = (item.image || '').replace(/^http:/, 'https:');
              const imageUrl = rawImg.replace('150x150', '500x500').replace('50x50', '500x500')
                || rawImg
                || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500';

              uniqueTrending.push({
                id: Number(item.id) || Math.floor(Math.random() * 100000),
                sourceId: 'saavn_' + item.id,
                title: cleanTitle,
                artistName: cleanArtist,
                albumName: item.more_info?.album || 'Single',
                genre: item.language || 'Hindi',
                durationSec: Number(item.more_info?.duration || 210),
                audioUrl: vlink || preview || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                imageUrl: imageUrl,
                playCount: Number(item.play_count || 500000),
                active: true,
                isLiked: false
              });
            }
          }
        }
      } catch (e) {
        console.warn('Catalog supplement notice:', e);
      }
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

    // 1. Kick off backend search and cloud searches in PARALLEL
    const fetchPromises = [
      // Backend catalog query
      request(`/search?q=${encodeURIComponent(searchTarget)}`)
        .then(res => ({ type: 'backend', data: res }))
        .catch(err => ({ type: 'backend', err })),
      
      // Cloud catalog queries (executed concurrently!)
      ...searchQueries.map(sq => {
        const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=35&p=1&q=${encodeURIComponent(sq)}`;
        return fetch(url, { signal: AbortSignal.timeout(3500) })
          .then(r => r.json())
          .then(data => ({ type: 'cloud', data }))
          .catch(err => ({ type: 'cloud', err }));
      })
    ];

    const settled = await Promise.allSettled(fetchPromises);

    // Process all results from backend and cloud
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      const val = outcome.value;
      if (!val) continue;

      if (val.type === 'backend' && val.data?.content && Array.isArray(val.data.content)) {
        for (const item of val.data.content) {
          const norm = normalizeTitle(item.title);
          if (!norm) continue;
          if (!bestByNorm.has(norm)) {
            bestByNorm.set(norm, {
              item: {
                id: item.id,
                title: item.title,
                subtitle: item.artistName,
                image: item.imageUrl,
                more_info: {
                  album: item.albumName,
                  duration: item.durationSec,
                  vlink: item.audioUrl
                },
                language: item.genre,
                play_count: item.playCount
              },
              cleanTitle: item.title,
              score: 80,
              playCount: Number(item.playCount || 100000)
            });
          }
        }
      } else if (val.type === 'cloud' && val.data?.results && Array.isArray(val.data.results)) {
        for (const item of val.data.results) {
          const rawTitle = item.title || 'Unknown Title';
          const cleanTitle = rawTitle
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#039;/g, "'");

          const norm = normalizeTitle(cleanTitle);
          if (!norm) continue;

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
