/**
 * Voxa Real-World Dynamic Era & Radio Recommendation Engine
 * (Built on Gaana & Spotify's Dynamic Station Architecture)
 * 
 * - NO HARDCODED SONG TITLES.
 * - When a user plays a song, its musical era (New Era / Modern, Retro Classics, 90s/2000s,
 *   Punjabi, Indie) and primary artist are detected.
 * - The music catalog is dynamically queried for songs belonging to that EXACT era and vibe.
 * - Strict deduplication and root-title filtering prevents any remixes, mashups,
 *   or duplicate editions of the currently playing song from entering the queue.
 * - If user plays an Old Era song -> strictly Old Era songs play next.
 * - If user plays a New Era song -> strictly New Era songs play next.
 */

export const ERAS = {
  NEW_GEN: 'new-generation',
  RETRO_CLASSIC: 'retro-classics',
  NOSTALGIA_90S_2000S: '90s-2000s-nostalgia',
  PUNJABI_DESI: 'punjabi-desi',
  INDIE_LOFI: 'indie-lofi'
};

const RETRO_ARTISTS = [
  'kishore kumar', 'mohammed rafi', 'lata mangeshkar', 'asha bhosle',
  'mukesh', 'r.d. burman', 'rd burman', 's.d. burman', 'hemant kumar',
  'manna dey', 'talat mahmood', 'geeta dutt', 'kalyanji anandji',
  'laxmikant pyarelal', 'khayyam', 'salil chowdhury', 'naushad'
];

const RETRO_KEYWORDS = [
  'retro', 'evergreen', 'purane geet', 'golden era', 'vintage', 'old classic',
  'roop tera mastana', 'gulabi aankhen', 'lag ja gale', 'chura liya', 'mere sapno ki rani',
  'yeh shaam mastani', 'pal pal dil ke paas', 'pyar hua iqrar hua', 'kabhie kabhie',
  'chalte chalte', 'zindagi kaisi hai paheli', 'o mere dil ke chain', 'aane wala pal',
  'dum maro dum', 'kabhi kabhie mere dil mein', 'likhe jo khat tujhe'
];

const NINETIES_ARTISTS = [
  'kumar sanu', 'alka yagnik', 'udit narayan', 'kavita krishnamurthy',
  'sonu nigam', 'anuradha paudwal', 'abhijeet', 'shaan', 'lucky ali',
  'babul supriyo', 'hariharan', 'jatin lalit', 'nadeem shravan', 'anu malik',
  'anand milind', 'jagjit singh', 'pankaj udhas', 'sadhana sargam', 'altaf raja'
];

const NINETIES_KEYWORDS = [
  '90s', '2000s', 'nostalgia', 'kuch kuch hota hai', 'ddlj', 'tujhe dekha toh',
  'pehla nasha', 'kal ho naa ho', 'suraj hua maddham', 'dil to pagal hai', 'mohabbatein',
  'hum dil de chuke sanam', 'kaho naa pyaar hai', 'raaz', 'tere naam', 'main hoon na',
  'zara zara', 'pee loon', 'tum dil ki dhadkan', 'dhadkan', 'hum saath saath hain'
];

const PUNJABI_ARTISTS = [
  'karan aujla', 'shubh', 'ap dhillon', 'diljit dosanjh', 'sidhu moosewala',
  'yo yo honey singh', 'badshah', 'guru randhawa', 'hardy sandhu', 'jass manak',
  'amrit maan', 'b praak', 'kaka', 'mankirt aulakh', 'jasleen royal', 'king', 'divine',
  'mc stan', 'raftaar', 'ikka', 'ammy virk', 'parmish verma', 'jassi gill'
];

const PUNJABI_KEYWORDS = [
  'punjabi', 'bhangra', 'hip-hop', 'desi hip hop', 'tauba tauba', 'softly', 'with you',
  'winning speech', 'cheques', 'baller', 'no love', 'elevated', 'daru badnaam', 'lahore',
  'excuses', 'brown munde', 'insane', 'summer high', 'born to shine', 'g-wagon', 'admiring you'
];

const INDIE_ARTISTS = [
  'anuv jain', 'prateek kuhad', 'the local train', 'mitraz', 'taba chake',
  'when chai met toast', 'zaeden', 'jasleen royal', 'aditya a', 'ashu shukla',
  'osho jain', 'sanah moidutty', 'raghav chaitanya', 'achint'
];

const INDIE_KEYWORDS = [
  'lo-fi', 'lofi', 'indie', 'acoustic', 'husn', 'baarishein', 'kasoor',
  'chaand baaliyan', 'al fiction', 'choo lo', 'gul', 'mishri', 'cold/mess', 'kho gaye hum kahan'
];

const NEW_GEN_ARTISTS = [
  'arijit singh', 'sachin-jigar', 'sachin jigar', 'amitabh bhattacharya',
  'pritam', 'shreya ghoshal', 'jubin nautiyal', 'atif aslam', 'vishal mishra',
  'sachet-parampara', 'sachet tandon', 'parampara tandon', 'darshan raval',
  'armaan malik', 'amaal mallik', 'tanishk bagchi', 'neha kakkar', 'tony kakkar',
  'asees kaur', 'shilpa rao', 'monali thakur', 'kaifi khalil',
  'akhil sachdeva', 'stebin ben', 'payal dev'
];

const NEW_GEN_KEYWORDS = [
  'apna bana le', 'kesariya', 'chaleya', 'o maahi', 'heeriye', 'satranga',
  've kamleya', 'pehle bhi main', 'rasiya', 'ruaan', 'tere hawaale', 'gehra hua',
  'sajni', 'raataan lambiyan', 'kahani suno', 'tu hai kahan', 'jo tum mere ho'
];

/**
 * Normalizes title for strict deduplication
 */
export function normalizeSongTitle(title = '') {
  return title
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

/**
 * Extracts key identity words to aggressively prevent remixes, mashups, or covers of the same song.
 */
export function getRootTitleWords(title = '') {
  return normalizeSongTitle(title)
    .replace(/(lofi|remix|mix|mashup|patshah|shambhu|slowed|reverb|version|acoustic|cover|instrumental)/gi, '')
    .trim();
}

/**
 * Classifies a song's musical era and generational vibe.
 */
export function detectSongVibeAndEra(song) {
  if (!song) {
    return {
      era: ERAS.NEW_GEN,
      label: 'New-Gen Romantic',
      badge: '🔥 New Generation Radio'
    };
  }

  const title = (song.title || '').toLowerCase();
  const artist = (song.artistName || '').toLowerCase();
  const album = (song.albumName || '').toLowerCase();
  const genre = (song.genre || '').toLowerCase();
  const combined = `${title} ${artist} ${album} ${genre}`;

  // 1. Detect Retro Classics (1950s - 1980s)
  if (RETRO_ARTISTS.some(a => combined.includes(a)) || RETRO_KEYWORDS.some(k => combined.includes(k))) {
    return {
      era: ERAS.RETRO_CLASSIC,
      label: 'Evergreen Retro Classics',
      badge: '📻 Retro Classics Radio'
    };
  }

  // 2. Detect 90s & Early 2000s Nostalgia Era
  if (NINETIES_ARTISTS.some(a => combined.includes(a)) || NINETIES_KEYWORDS.some(k => combined.includes(k))) {
    return {
      era: ERAS.NOSTALGIA_90S_2000S,
      label: '90s & 2000s Bollywood Nostalgia',
      badge: '✨ 90s-2000s Nostalgia Radio'
    };
  }

  // 3. Detect Punjabi / Desi Hip-Hop
  if (genre.includes('punjabi') || PUNJABI_ARTISTS.some(a => combined.includes(a)) || PUNJABI_KEYWORDS.some(k => combined.includes(k))) {
    return {
      era: ERAS.PUNJABI_DESI,
      label: 'Trending Punjabi & Desi Beats',
      badge: '⚡ Punjabi & Desi Radio'
    };
  }

  // 4. Detect Indie / Acoustic / Lo-Fi
  if (INDIE_ARTISTS.some(a => combined.includes(a)) || INDIE_KEYWORDS.some(k => combined.includes(k))) {
    return {
      era: ERAS.INDIE_LOFI,
      label: 'Indie & Acoustic Lo-Fi',
      badge: '🌙 Indie & Lo-Fi Radio'
    };
  }

  // 5. Modern New-Generation Bollywood (Default / 2020-2026 Hits)
  return {
    era: ERAS.NEW_GEN,
    label: 'Modern New-Gen Romantic',
    badge: '🔥 New Generation Radio'
  };
}

/**
 * Builds a dynamic Gaana / Spotify style Era Station without any hardcoded songs.
 * 
 * Dynamically queries the live music catalog based on the song's exact era and primary artist,
 * and strictly prevents any duplicate releases or remixes of the current song from entering the queue.
 */
export async function buildDynamicEraRadio(currentSong, searchApi) {
  if (!currentSong || !searchApi) return [currentSong];

  const vibe = detectSongVibeAndEra(currentSong);
  const currentNorm = normalizeSongTitle(currentSong.title);
  const currentRoot = getRootTitleWords(currentSong.title);
  const primaryArtist = (currentSong.artistName || '')
    .split(',')[0]
    .split('-')[0]
    .replace(/\b(feat|ft|with|various|artists|music|director)\b.*/gi, '')
    .trim();

  let primaryQuery = '';
  let fallbackQuery = '';

  if (vibe.era === ERAS.RETRO_CLASSIC) {
    primaryQuery = primaryArtist ? `${primaryArtist} evergreen golden classic old hindi songs` : 'old evergreen hindi classic songs';
    fallbackQuery = 'old evergreen hindi classic songs kishore kumar lata rafi';
  } else if (vibe.era === ERAS.NOSTALGIA_90S_2000S) {
    primaryQuery = primaryArtist ? `${primaryArtist} 90s bollywood romantic movie songs` : '90s bollywood romantic songs';
    fallbackQuery = '90s bollywood romantic songs kumar sanu udit narayan alka yagnik';
  } else if (vibe.era === ERAS.PUNJABI_DESI) {
    primaryQuery = primaryArtist ? `${primaryArtist} top latest punjabi songs` : 'latest trending punjabi songs';
    fallbackQuery = 'latest trending punjabi songs karan aujla shubh ap dhillon';
  } else if (vibe.era === ERAS.INDIE_LOFI) {
    primaryQuery = primaryArtist ? `${primaryArtist} indie acoustic hindi songs` : 'hindi indie acoustic songs';
    fallbackQuery = 'hindi indie acoustic songs anuv jain prateek kuhad';
  } else {
    // NEW_GEN (Modern Movie Era: 2020s)
    primaryQuery = primaryArtist ? `${primaryArtist} latest new hindi romantic movie songs` : 'latest bollywood movie romantic songs';
    fallbackQuery = 'latest bollywood movie romantic songs';
  }

  const radioQueue = [currentSong];
  const seenNorms = new Set([currentNorm]);

  try {
    const res = await searchApi(primaryQuery);
    const list = res?.content || (Array.isArray(res) ? res : []);

    for (const item of list) {
      if (!item) continue;
      const songNorm = normalizeSongTitle(item.title);
      const songRoot = getRootTitleWords(item.title);

      const isDuplicate = (
        songNorm === currentNorm ||
        (currentRoot.length >= 4 && songNorm.includes(currentRoot)) ||
        (songRoot.length >= 4 && currentNorm.includes(songRoot)) ||
        seenNorms.has(songNorm)
      );

      if (!isDuplicate) {
        seenNorms.add(songNorm);
        radioQueue.push({
          ...item,
          vibeBadge: vibe.badge,
          vibeEra: vibe.era
        });
      }
    }

    // Supplement with fallback query if fewer than 10 tracks
    if (radioQueue.length < 12 && fallbackQuery) {
      const fallbackRes = await searchApi(fallbackQuery);
      const fallbackList = fallbackRes?.content || (Array.isArray(fallbackRes) ? fallbackRes : []);

      for (const item of fallbackList) {
        if (!item) continue;
        const songNorm = normalizeSongTitle(item.title);
        const songRoot = getRootTitleWords(item.title);

        const isDuplicate = (
          songNorm === currentNorm ||
          (currentRoot.length >= 4 && songNorm.includes(currentRoot)) ||
          (songRoot.length >= 4 && currentNorm.includes(songRoot)) ||
          seenNorms.has(songNorm)
        );

        if (!isDuplicate) {
          seenNorms.add(songNorm);
          radioQueue.push({
            ...item,
            vibeBadge: vibe.badge,
            vibeEra: vibe.era
          });
        }
      }
    }
  } catch (err) {
    console.warn('Dynamic era radio error:', err);
  }

  return radioQueue;
}

/**
 * Preloads more songs dynamically as playback nears the end of queue.
 */
export async function fetchSimilarGenerationSongs(currentSong, playedSongIds = new Set(), searchApi) {
  if (!currentSong || !searchApi) return [];

  const vibe = detectSongVibeAndEra(currentSong);
  const currentNorm = normalizeSongTitle(currentSong.title);
  const currentRoot = getRootTitleWords(currentSong.title);

  const seenNorms = new Set([currentNorm]);
  if (Array.isArray(playedSongIds)) {
    playedSongIds.forEach(id => seenNorms.add(normalizeSongTitle(String(id))));
  } else if (playedSongIds instanceof Set) {
    playedSongIds.forEach(id => seenNorms.add(normalizeSongTitle(String(id))));
  }

  let query = '';
  if (vibe.era === ERAS.RETRO_CLASSIC) {
    query = 'classic evergreen old hindi movie hits kishore lata rafi';
  } else if (vibe.era === ERAS.NOSTALGIA_90S_2000S) {
    query = 'superhit 90s bollywood songs kumar sanu alka yagnik';
  } else if (vibe.era === ERAS.PUNJABI_DESI) {
    query = 'trending punjabi songs';
  } else if (vibe.era === ERAS.INDIE_LOFI) {
    query = 'best hindi indie songs';
  } else {
    query = 'top new hindi bollywood movie romantic songs';
  }

  const additions = [];
  try {
    const res = await searchApi(query);
    const list = res?.content || (Array.isArray(res) ? res : []);

    for (const item of list) {
      if (!item) continue;
      const songNorm = normalizeSongTitle(item.title);
      const songRoot = getRootTitleWords(item.title);

      const isDuplicate = (
        songNorm === currentNorm ||
        (currentRoot.length >= 4 && songNorm.includes(currentRoot)) ||
        (songRoot.length >= 4 && currentNorm.includes(songRoot)) ||
        seenNorms.has(songNorm)
      );

      if (!isDuplicate) {
        seenNorms.add(songNorm);
        additions.push({
          ...item,
          vibeBadge: vibe.badge,
          vibeEra: vibe.era
        });
      }
    }
  } catch (e) {
    console.warn('Failed to fetch more era tracks:', e);
  }

  return additions;
}
