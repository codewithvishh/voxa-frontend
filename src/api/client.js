export function getBaseApiUrl() {
  // 1. User manual override stored on device
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('voxa_api_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '') + '/api';
    }
  }

  // 2. Vite environment variable baked during build
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '') + '/api';
  }

  // 3. Android Capacitor native runtime check (where window.location is localhost / capacitor)
  if (typeof window !== 'undefined') {
    const isCapacitor = Boolean(
      window.Capacitor !== undefined ||
      window.location.protocol === 'capacitor:' ||
      (window.location.hostname === 'localhost' && !window.location.port)
    );
    if (isCapacitor) {
      return 'https://voxa-backend.onrender.com/api';
    }
  }

  // 4. Fallback for local web development proxy
  return '/api';
}

export function setCustomApiUrl(rawUrl) {
  if (typeof window === 'undefined') return;
  if (!rawUrl || !rawUrl.trim()) {
    localStorage.removeItem('voxa_api_url');
  } else {
    let clean = rawUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    localStorage.setItem('voxa_api_url', clean.replace(/\/+$/, '').replace(/\/api\/?$/, ''));
  }
}

export function getCurrentServerUrl() {
  return getBaseApiUrl().replace(/\/api\/?$/, '');
}

const BASE_URL = getBaseApiUrl();

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

// -----------------------------------------------------------------------------
// Pure JavaScript DES-ECB Decryptor for 320kbps Cloud Audio Streaming
// -----------------------------------------------------------------------------
const DES_IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7
];
const DES_FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25
];
const DES_PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4
];
const DES_PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
];
const DES_SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const DES_E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
];
const DES_P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25
];
const DES_S = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
  ]
];

function desPermute(src, table) {
  const out = new Array(table.length);
  for (let i = 0; i < table.length; i++) {
    out[i] = src[table[i] - 1];
  }
  return out;
}

function desLeftRotate(arr, n) {
  return arr.slice(n).concat(arr.slice(0, n));
}

function desGenerateSubkeys(keyBits) {
  const pc1 = desPermute(keyBits, DES_PC1);
  let c = pc1.slice(0, 28);
  let d = pc1.slice(28, 56);
  const subkeys = [];
  for (let i = 0; i < 16; i++) {
    c = desLeftRotate(c, DES_SHIFTS[i]);
    d = desLeftRotate(d, DES_SHIFTS[i]);
    subkeys.push(desPermute(c.concat(d), DES_PC2));
  }
  return subkeys;
}

function desFeistel(r, k) {
  const er = desPermute(r, DES_E);
  const xor = er.map((b, i) => b ^ k[i]);
  const sOut = [];
  for (let i = 0; i < 8; i++) {
    const chunk = xor.slice(i * 6, (i + 1) * 6);
    const row = (chunk[0] << 1) | chunk[5];
    const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4];
    const val = DES_S[i][row][col];
    sOut.push((val >> 3) & 1, (val >> 2) & 1, (val >> 1) & 1, val & 1);
  }
  return desPermute(sOut, DES_P);
}

function desDecryptBlock(blockBits, subkeys) {
  const ip = desPermute(blockBits, DES_IP);
  let l = ip.slice(0, 32);
  let r = ip.slice(32, 64);
  for (let i = 15; i >= 0; i--) {
    const nextL = r;
    const f = desFeistel(r, subkeys[i]);
    r = l.map((b, idx) => b ^ f[idx]);
    l = nextL;
  }
  return desPermute(r.concat(l), DES_FP);
}

function desBytesToBits(bytes) {
  const bits = [];
  for (let b of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((b >> i) & 1);
    }
  }
  return bits;
}

function desBitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | (bits[i + j] || 0);
    }
    bytes.push(b);
  }
  return bytes;
}

export function decryptSaavnMediaUrl(encryptedUrl, keyStr = '38346591') {
  if (!encryptedUrl || typeof encryptedUrl !== 'string') return null;
  try {
    const b64 = encryptedUrl.trim();
    if (!b64) return null;
    const binStr = atob(b64);
    const ciphertextBytes = new Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      ciphertextBytes[i] = binStr.charCodeAt(i);
    }
    const keyBytes = Array.from(keyStr).map(c => c.charCodeAt(0));
    const subkeys = desGenerateSubkeys(desBytesToBits(keyBytes));
    const decryptedBytes = [];

    for (let i = 0; i < ciphertextBytes.length; i += 8) {
      const block = ciphertextBytes.slice(i, i + 8);
      while (block.length < 8) block.push(0);
      const decBits = desDecryptBlock(desBytesToBits(block), subkeys);
      decryptedBytes.push(...desBitsToBytes(decBits));
    }

    const padLen = decryptedBytes[decryptedBytes.length - 1];
    if (padLen > 0 && padLen <= 8) {
      decryptedBytes.splice(decryptedBytes.length - padLen, padLen);
    }

    const rawUrl = new TextDecoder('utf-8').decode(new Uint8Array(decryptedBytes)).trim();
    if (rawUrl && rawUrl.startsWith('http')) {
      return rawUrl.replace('_96.mp4', '_320.mp4').replace('_160.mp4', '_320.mp4');
    }
    return null;
  } catch (err) {
    return null;
  }
}

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
  const currentBase = getBaseApiUrl();
  const url = `${currentBase}${endpoint}`;
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

      const encrypted = item.more_info?.encrypted_media_url || '';
      const decryptedUrl = decryptSaavnMediaUrl(encrypted);
      const vlink = item.more_info?.vlink || '';
      const preview = item.more_info?.media_preview_url || '';
      const audioUrl = decryptedUrl || vlink || preview || 'https://jiotunepreview.jio.com/content/Converted/010910393154234.mp3';

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
            audioUrl: decryptSaavnMediaUrl(s.more_info?.encrypted_media_url) || s.more_info?.vlink || ''
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
  }),

  // Server configuration helpers for mobile native apps
  getBaseApiUrl,
  setCustomApiUrl,
  getCurrentServerUrl
};
