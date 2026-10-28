import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from './api/client';
import {
  Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Volume2, VolumeX,
  Heart, Search, Home, Compass, Library, Plus, Shield, History,
  LogOut, User as UserIcon, Music, Disc, Sparkles, CheckCircle, AlertCircle,
  Clock, Flame, RefreshCw, Radio, ListMusic, ChevronDown, Share2, FileText, Maximize2, Minimize2,
  Trash2, ListPlus, FolderPlus
} from 'lucide-react';
import {
  detectSongVibeAndEra,
  fetchSimilarGenerationSongs,
  normalizeSongTitle,
  buildDynamicEraRadio,
  getRootTitleWords
} from './services/recommendationAlgorithm';
import { getSynchronizedLyrics, fetchOnlineLyrics } from './services/lyricsService';
import './App.css';

// Fallback artworks if remote image fails
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80';
const FALLBACK_ARTIST = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80';

// Curated Genre Categories with live search fallback
const GENRE_TABS = [
  { id: 'All', label: 'All Hits' },
  { id: 'Bollywood', label: 'Bollywood', query: 'superhit bollywood hindi songs' },
  { id: 'Romantic', label: 'Romantic', query: 'romantic hindi songs' },
  { id: 'Punjabi', label: 'Punjabi', query: 'trending punjabi songs' },
  { id: 'Lo-Fi', label: 'Lo-Fi Chill', query: 'hindi lofi chill songs' },
  { id: 'Pop', label: 'Pop & Dance', query: 'party dance bollywood songs' },
  { id: 'Retro', label: 'Retro Classics', query: 'classic evergreen old hindi hits' },
  { id: 'Devotional', label: 'Devotional', query: 'bhakti bhajan' }
];

export default function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState('discover');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [genreCache, setGenreCache] = useState({});
  const [genreLoading, setGenreLoading] = useState(false);
  
  // Data States
  const [homeFeed, setHomeFeed] = useState({
    trending: [],
    newReleases: [],
    genres: [],
    recommended: []
  });
  const [featuredAlbums, setFeaturedAlbums] = useState([]);
  const [popularArtists, setPopularArtists] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState(null);
  const [quickPlaylistTitle, setQuickPlaylistTitle] = useState('');
  const [likedSongIds, setLikedSongIds] = useState(new Set());
  const [likedSongsList, setLikedSongsList] = useState([]);
  const [playHistoryList, setPlayHistoryList] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [importJobs, setImportJobs] = useState([]);
  
  // Search & Autocomplete State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState({ suggestions: [], songs: [], artists: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);
  const debounceRef = useRef(null);

  const POPULAR_SEARCHES = [
    'Arijit Singh', 'Atif Aslam', 'Shreya Ghoshal', 'Kesariya',
    'Tum Hi Ho', 'Apna Bana Le', 'Yo Yo Honey Singh', 'Channa Ve'
  ];

  // Curated Gaana / Spotify Style Musical Era Stations (Zero Hardcoded Tracks)
  const BROWSE_ERAS = [
    {
      id: 'new-gen',
      title: 'New Generation Hits',
      subtitle: '2020-2026 Bollywood & Pop',
      query: 'latest new hindi bollywood songs',
      badge: '2020s NEW ERA',
      gradient: 'linear-gradient(135deg, #fa243c 0%, #ff6b81 100%)',
      desc: 'Arijit Singh, Sachin-Jigar, Pritam, Vishal Mishra, Stebin Ben'
    },
    {
      id: 'retro-golden',
      title: 'Evergreen Golden Retro',
      subtitle: '60s & 70s Pure Vintage Classics',
      query: 'evergreen classic old hindi songs kishore rafi lata',
      badge: 'GOLDEN RETRO',
      gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
      desc: 'Kishore Kumar, Mohammed Rafi, Lata Mangeshkar, R.D. Burman, Mukesh'
    },
    {
      id: '90s-nostalgia',
      title: '90s & 2000s Nostalgia',
      subtitle: 'The Golden Romance Decades',
      query: 'superhit 90s hindi songs kumar sanu alka yagnik udit narayan',
      badge: '90s & 2000s',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      desc: 'Kumar Sanu, Alka Yagnik, Udit Narayan, Sonu Nigam, Shaan'
    },
    {
      id: 'punjabi-desi',
      title: 'Punjabi & Desi Wave',
      subtitle: 'High Voltage Chartbusters',
      query: 'trending punjabi songs karan aujla diljit',
      badge: 'PUNJABI DESI',
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
      desc: 'Karan Aujla, Diljit Dosanjh, AP Dhillon, Shubh, Sidhu Moosewala'
    },
    {
      id: 'indie-lofi',
      title: 'Indie & Midnight Lo-Fi',
      subtitle: 'Chill Acoustic & Late Night Vibes',
      query: 'best hindi indie lofi acoustic songs anuv jain',
      badge: 'INDIE & LO-FI',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      desc: 'Anuv Jain, Prateek Kuhad, Mitraz, Jasleen Royal, The Local Train'
    },
    {
      id: 'sufi-devotional',
      title: 'Sufi & Soulful Serenade',
      subtitle: 'Heart-touching Spiritual Melodies',
      query: 'sufi hindi songs nusrat rahat kailash kher',
      badge: 'SUFI & SOUL',
      gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      desc: 'Rahat Fateh Ali Khan, Nusrat, Kailash Kher, Mohit Chauhan'
    }
  ];

  // Browse Hub Moods & Themes
  const BROWSE_MOODS = [
    { title: 'Bollywood Romance', query: 'romantic bollywood movie songs', emoji: '❤️', color: '#e11d48' },
    { title: 'Party & Dance Club', query: 'bollywood party dance songs', emoji: '🎉', color: '#7c3aed' },
    { title: 'Sad & Broken Heart', query: 'sad emotional hindi songs', emoji: '💔', color: '#2563eb' },
    { title: 'Monsoon Rain Vibes', query: 'monsoon romantic hindi songs', emoji: '🌧️', color: '#0284c7' },
    { title: 'Gym & High Energy', query: 'workout gym motivational songs hindi', emoji: '⚡', color: '#ea580c' },
    { title: 'Acoustic & Unplugged', query: 'unplugged acoustic hindi songs', emoji: '🎸', color: '#059669' },
    { title: 'Late Night Chill', query: 'late night drive hindi lofi', emoji: '🌙', color: '#4338ca' },
    { title: 'Devotional & Bhakti', query: 'morning peaceful devotional bhajans', emoji: '🪔', color: '#d97706' }
  ];

  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'verify-otp'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Playlist Create Modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [playlistModalError, setPlaylistModalError] = useState('');
  const [dspMode, setDspMode] = useState('STUDIO');

  // Admin Import Form State
  const [importTag, setImportTag] = useState('synthwave');
  const [importLimit, setImportLimit] = useState(10);
  const [importLoading, setImportLoading] = useState(false);
  const [importFeedback, setImportFeedback] = useState(null);

  // Audio Playback Engine States
  const audioRef = useRef(new Audio());
  const preloadAudioRef = useRef(new Audio());
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const hasTriggeredHistory = useRef(false);

  // Voxa Intelligent Era & Smart Radio Playback Queue States
  const [playbackQueue, setPlaybackQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playedHistoryIds, setPlayedHistoryIds] = useState(new Set());
  const [activeVibe, setActiveVibe] = useState(null);
  const [isAutoplayOn, setIsAutoplayOn] = useState(true);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const isFetchingMoreRadio = useRef(false);

  // Fullscreen Player & Synchronized Lyrics States
  const [showFullscreenPlayer, setShowFullscreenPlayer] = useState(false);
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [currentLyrics, setCurrentLyrics] = useState([]);
  const [shareToast, setShareToast] = useState(null);
  const lyricsContainerRef = useRef(null);
  const activeLyricRef = useRef(null);
  const contentScrollRef = useRef(null);

  // Auto-scroll main viewport to top when switching views/tabs
  useEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  // Synchronized Lyrics Loader (Fast Cached + Live Online Sync)
  useEffect(() => {
    let isCancelled = false;
    if (currentSong) {
      // 1. Immediately display instant built-in / cached lyrics
      const instant = getSynchronizedLyrics(currentSong);
      if (instant && instant.length > 0) {
        setCurrentLyrics(instant);
      }
      // 2. Fetch live real LRC lyrics asynchronously for full accuracy on any track
      fetchOnlineLyrics(currentSong).then(onlineLyrics => {
        if (!isCancelled && onlineLyrics && onlineLyrics.length > 0) {
          setCurrentLyrics(onlineLyrics);
        }
      });
    } else {
      setCurrentLyrics([]);
    }
    return () => { isCancelled = true; };
  }, [currentSong?.id, currentSong?.title]);

  // Compute Active Lyric Line Index based on playback currentTime
  const activeLyricIndex = useMemo(() => {
    if (!currentLyrics || currentLyrics.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
      if (currentTime >= currentLyrics[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [currentTime, currentLyrics]);

  // Auto-scroll active lyric smoothly to center of viewport
  useEffect(() => {
    if (showLyricsModal) {
      const scrollTimer = setTimeout(() => {
        if (activeLyricRef.current && lyricsContainerRef.current) {
          const container = lyricsContainerRef.current;
          const element = activeLyricRef.current;
          const containerRect = container.getBoundingClientRect();
          const elemRect = element.getBoundingClientRect();
          const offset = elemRect.top - containerRect.top - (container.clientHeight / 2) + (element.clientHeight / 2);
          container.scrollBy({
            top: offset,
            behavior: 'smooth'
          });
        }
      }, 50);
      return () => clearTimeout(scrollTimer);
    }
  }, [activeLyricIndex, showLyricsModal]);

  // Track Share Handler (Web Share API + Clipboard Fallback)
  const handleShareTrack = (song = currentSong) => {
    if (!song) return;
    const shareUrl = `${window.location.origin}/?track=${encodeURIComponent(song.title)}`;
    if (navigator.share) {
      navigator.share({
        title: `${song.title} — Voxa Music`,
        text: `Listen to "${song.title}" by ${song.artistName} in 320 kbps Lossless Audio on Voxa!`,
        url: shareUrl
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareToast(`Copied link for "${song.title}"!`);
        setTimeout(() => setShareToast(null), 3000);
      });
    }
  };

  useEffect(() => {
    queueRef.current = playbackQueue;
  }, [playbackQueue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  // Initialize Auth from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('aurastream_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('aurastream_user');
      }
    }
  }, []);

  // Strict title deduplication helper to eliminate repetitive song copies (e.g. 10x Apna Bana Le)
  const deduplicateSongList = (songs = []) => {
    const seen = new Set();
    const result = [];
    for (const song of songs) {
      if (!song || !song.title) continue;
      const norm = normalizeSongTitle(song.title);
      const root = getRootTitleWords(song.title);
      const key = norm || song.title.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      if (root.length >= 6 && seen.has(root)) continue;
      seen.add(key);
      if (root.length >= 6) seen.add(root);
      result.push(song);
    }
    return result;
  };

  // Fetch Home Feed, Albums & Artists
  const loadHomeData = async () => {
    try {
      const feed = await api.getHomeFeed();
      if (feed) {
        setHomeFeed({
          trending: deduplicateSongList(feed.trending || []),
          newReleases: deduplicateSongList(feed.newReleases || []),
          genres: feed.genres || [],
          recommended: deduplicateSongList(feed.recommended || [])
        });
      }

      // Load Albums
      api.getAlbums({ size: 8 }).then(res => {
        if (res && res.content) setFeaturedAlbums(res.content);
      }).catch(() => {});

      // Load Artists
      api.getArtists({ size: 8 }).then(res => {
        if (res && res.content) setPopularArtists(res.content);
      }).catch(() => {});

    } catch (err) {
      console.warn('Backend connection pending or offline:', err);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, []);

  // Fetch User specific data when logged in
  useEffect(() => {
    if (currentUser) {
      const userKey = currentUser.id || currentUser.email || 'user';
      let localLiked = [];
      try {
        const saved = localStorage.getItem(`voxa_liked_${userKey}`);
        if (saved) localLiked = JSON.parse(saved);
      } catch (e) {}

      if (Array.isArray(localLiked) && localLiked.length > 0) {
        setLikedSongsList(localLiked);
        setLikedSongIds(new Set(localLiked.map(s => s.id)));
      }

      api.getMyPlaylists()
        .then(data => {
          let list = Array.isArray(data) ? [...data] : [];
          try {
            const local = JSON.parse(localStorage.getItem(`voxa_playlists_${userKey}`) || '[]');
            const ids = new Set(list.map(p => p.id));
            local.forEach(lp => {
              if (!ids.has(lp.id)) list.push(lp);
            });
          } catch (e) {}
          setPlaylists(list);
        })
        .catch(err => {
          console.warn('API getMyPlaylists notice, loading local vault:', err);
          try {
            const local = JSON.parse(localStorage.getItem(`voxa_playlists_${userKey}`) || '[]');
            setPlaylists(local);
          } catch (e) {}
        });

      api.getLikedSongs()
        .then(data => {
          const remoteList = data?.content || (Array.isArray(data) ? data : []);
          if (remoteList.length > 0) {
            setLikedSongsList(prev => {
              const combined = [...remoteList];
              const seen = new Set(combined.map(s => s.id));
              for (const loc of prev) {
                if (!seen.has(loc.id)) {
                  seen.add(loc.id);
                  combined.push(loc);
                }
              }
              try {
                localStorage.setItem(`voxa_liked_${userKey}`, JSON.stringify(combined));
              } catch (e) {}
              return combined;
            });
            setLikedSongIds(prev => {
              const next = new Set(prev);
              remoteList.forEach(s => next.add(s.id));
              return next;
            });
          }
        })
        .catch(console.error);

      api.getPlayHistory()
        .then(data => setPlayHistoryList(data || []))
        .catch(console.error);

      if (currentUser.role === 'ROLE_ADMIN') {
        loadAdminData();
      }
    } else {
      try {
        const guestPlaylists = JSON.parse(localStorage.getItem('voxa_playlists_guest') || '[]');
        setPlaylists(guestPlaylists);
      } catch (e) {
        setPlaylists([]);
      }
      setLikedSongIds(new Set());
      setLikedSongsList([]);
    }
  }, [currentUser]);

  const loadAdminData = async () => {
    try {
      const stats = await api.getAdminStats();
      const jobs = await api.getImportJobs();
      setAdminStats(stats);
      setImportJobs(jobs || []);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  };

  // --------------------------------------------------------------------------
  // Audio Player Engine Handlers
  // --------------------------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    audio.loop = false;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // FRD Requirement: If played >= 30 seconds, record play history
      if (audio.currentTime >= 30 && !hasTriggeredHistory.current && currentSong) {
        hasTriggeredHistory.current = true;
        api.recordPlay(currentSong.id, Math.floor(audio.currentTime)).catch(() => {});
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        handleNextSong();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentSong, isRepeat, playbackQueue, queueIndex]);

  // Volume & Mute Sync
  useEffect(() => {
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const allVisibleSongs = (homeFeed.trending || []);

  /**
   * Preloads similar generation songs in the background so the playback queue never runs dry
   */
  const preloadSimilarEraSongs = async (baseSong, currentQ = []) => {
    if (isFetchingMoreRadio.current || !baseSong) return;
    isFetchingMoreRadio.current = true;
    try {
      const playedSet = new Set(playedHistoryIds);
      currentQ.forEach(s => {
        if (s) {
          playedSet.add(String(s.id || s.sourceId));
          playedSet.add(normalizeSongTitle(s.title));
        }
      });

      const similarSongs = await fetchSimilarGenerationSongs(baseSong, playedSet, api.search);
      if (similarSongs && similarSongs.length > 0) {
        setPlaybackQueue(prev => {
          const existingIds = new Set(prev.map(s => String(s.id || s.sourceId)));
          const existingTitles = new Set(prev.map(s => normalizeSongTitle(s.title)));
          const additions = [];
          for (const s of similarSongs) {
            const sid = String(s.id || s.sourceId);
            const snorm = normalizeSongTitle(s.title);
            if (!existingIds.has(sid) && !existingTitles.has(snorm)) {
              existingIds.add(sid);
              existingTitles.add(snorm);
              additions.push(s);
            }
          }
          return [...prev, ...additions];
        });
      }
    } catch (e) {
      console.warn('Preload era radio failed:', e);
    } finally {
      isFetchingMoreRadio.current = false;
    }
  };

  /**
   * Directly sets up audio playback without resetting the existing queue
   * (Features Zero-Lag Preloaded Swap & Soft Volume Fade-In)
   */
  const playTrackDirect = (track) => {
    if (!track) return;
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    const audio = audioRef.current;
    hasTriggeredHistory.current = false;
    setCurrentSong(track);

    // Instant swap if already preloaded in memory
    audio.src = track.audioUrl;

    const targetVolume = isMuted ? 0 : volume;
    audio.volume = 0; // Start at 0 for soft crossfade ramp

    audio.play()
      .then(() => {
        setIsPlaying(true);
        // Soft volume ramp (smooth 200ms audio fade-in like Spotify)
        let step = 0;
        const rampTimer = setInterval(() => {
          step++;
          audio.volume = Math.min(targetVolume, (step / 4) * targetVolume);
          if (step >= 4) clearInterval(rampTimer);
        }, 50);
      })
      .catch(err => {
        console.warn('Playback notice, retrying with direct volume:', err);
        setTimeout(() => {
          audio.volume = targetVolume;
          audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }, 120);
      });

    // Detect era & vibe for the new song
    const vibe = detectSongVibeAndEra(track);
    setActiveVibe(vibe);
    setPlayedHistoryIds(prev => new Set(prev).add(String(track.id || track.sourceId)));
  };

  /**
   * Main entry point to play any song with Amazon Music / Spotify style Dynamic Era Autoplay
   * - ZERO hardcoded songs
   * - If a modern song plays -> strictly modern songs play next
   * - If a retro song plays -> strictly retro songs play next
   */
  const playSong = async (song, contextList = null, options = {}) => {
    if (!song) return;
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    const audio = audioRef.current;

    if (currentSong?.id === song.id) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().then(() => setIsPlaying(true)).catch(console.error);
      }
      return;
    }

    // New song selected: Play immediately
    playTrackDirect(song);

    const songVibe = detectSongVibeAndEra(song);

    // If played from an explicit user-created playlist in Library, preserve playlist sequence
    if (options.isExplicitPlaylist && contextList && Array.isArray(contextList) && contextList.length > 0) {
      const selectedNorm = normalizeSongTitle(song.title);
      const selectedRoot = getRootTitleWords(song.title);
      const seenTitles = new Set([selectedNorm]);

      const uniqueList = [song];

      for (const item of contextList) {
        if (!item || item.id === song.id) continue;
        const norm = normalizeSongTitle(item.title);
        if (norm === selectedNorm || (selectedRoot.length >= 4 && norm.includes(selectedRoot))) continue;
        if (!seenTitles.has(norm)) {
          seenTitles.add(norm);
          uniqueList.push(item);
        }
      }

      setPlaybackQueue(uniqueList);
      setQueueIndex(0);
      preloadSimilarEraSongs(song, uniqueList);
    } else {
      // AMAZON MUSIC / SPOTIFY AUTOPLAY:
      // 1. Filter any contextList to STRICTLY include songs of the EXACT same era
      const initialSameEraQueue = [song];
      const seenTitles = new Set([normalizeSongTitle(song.title)]);

      if (contextList && Array.isArray(contextList)) {
        for (const item of contextList) {
          if (!item || item.id === song.id) continue;
          const itemVibe = detectSongVibeAndEra(item);
          // STRICT ERA GUARANTEE: Only include if same musical era
          if (itemVibe.era === songVibe.era) {
            const norm = normalizeSongTitle(item.title);
            const songRoot = getRootTitleWords(song.title);
            if (norm !== normalizeSongTitle(song.title) && !(songRoot.length >= 4 && norm.includes(songRoot)) && !seenTitles.has(norm)) {
              seenTitles.add(norm);
              initialSameEraQueue.push(item);
            }
          }
        }
      }

      setPlaybackQueue(initialSameEraQueue);
      setQueueIndex(0);

      // 2. Concurrently query live cloud catalog for infinite era autoplay matching this song's exact era and artist
      buildDynamicEraRadio(song, api.search).then(eraRadio => {
        if (eraRadio && eraRadio.length > 1) {
          setPlaybackQueue(prev => {
            const existingIds = new Set(prev.map(s => String(s.id || s.sourceId)));
            const existingTitles = new Set(prev.map(s => normalizeSongTitle(s.title)));
            const additions = [];
            for (const item of eraRadio) {
              const sid = String(item.id || item.sourceId);
              const snorm = normalizeSongTitle(item.title);
              const itemVibe = detectSongVibeAndEra(item);
              if (itemVibe.era === songVibe.era && !existingIds.has(sid) && !existingTitles.has(snorm)) {
                existingIds.add(sid);
                existingTitles.add(snorm);
                additions.push(item);
              }
            }
            return [...prev, ...additions];
          });
        }
      }).catch(err => {
        console.warn('Dynamic era radio notice:', err);
      });
    }
  };

  const handleTogglePlay = () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    const audio = audioRef.current;
    if (!currentSong) {
      if (playbackQueue.length > 0) {
        playTrackDirect(playbackQueue[0]);
      } else if (allVisibleSongs.length > 0) {
        playSong(allVisibleSongs[0], allVisibleSongs);
      }
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  /**
   * Automatically advances to the next song in the exact same generation line
   */
  const handleNextSong = async () => {
    const currentQ = queueRef.current;
    const curIdx = queueIndexRef.current;
    const currentTrack = currentSong;
    const currentNorm = currentTrack ? normalizeSongTitle(currentTrack.title) : '';
    const currentRoot = currentTrack ? getRootTitleWords(currentTrack.title) : '';
    const currentVibe = currentTrack ? detectSongVibeAndEra(currentTrack) : null;

    if (isRepeat && currentTrack) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
      return;
    }

    if (isShuffle && currentQ.length > 1) {
      const differentTracks = currentQ.filter((t, i) => {
        if (i === curIdx) return false;
        const norm = normalizeSongTitle(t.title);
        const matchesEra = !currentVibe || detectSongVibeAndEra(t).era === currentVibe.era;
        return matchesEra && norm !== currentNorm && !(currentRoot.length >= 4 && norm.includes(currentRoot));
      });
      if (differentTracks.length > 0) {
        const picked = differentTracks[Math.floor(Math.random() * differentTracks.length)];
        const newIndex = currentQ.findIndex(t => t.id === picked.id);
        setQueueIndex(newIndex !== -1 ? newIndex : 0);
        playTrackDirect(picked);
        return;
      }
    }

    // Advance to next song, skipping any consecutive duplicates of the same song title or remix!
    let nextIndex = curIdx + 1;
    while (nextIndex < currentQ.length) {
      const candidate = currentQ[nextIndex];
      if (candidate) {
        const candidateNorm = normalizeSongTitle(candidate.title);
        const candidateRoot = getRootTitleWords(candidate.title);
        const isDuplicate = (
          candidateNorm === currentNorm ||
          (currentRoot.length >= 4 && candidateNorm.includes(currentRoot)) ||
          (candidateRoot.length >= 4 && currentNorm.includes(candidateRoot))
        );
        const candidateVibe = detectSongVibeAndEra(candidate);
        const matchesEra = !currentVibe || candidateVibe.era === currentVibe.era;

        if (!isDuplicate && matchesEra) {
          break;
        }
      }
      nextIndex++;
    }

    if (nextIndex < currentQ.length) {
      setQueueIndex(nextIndex);
      const nextTrack = currentQ[nextIndex];
      playTrackDirect(nextTrack);

      // Preload more if nearing end of queue
      if (currentQ.length - nextIndex <= 4 && nextTrack) {
        preloadSimilarEraSongs(nextTrack, currentQ);
      }
    } else {
      // Reached the end of queue: Fetch more songs matching this song's era
      if (currentTrack) {
        try {
          const playedSet = new Set(playedHistoryIds);
          currentQ.forEach(s => {
            if (s) {
              playedSet.add(String(s.id || s.sourceId));
              playedSet.add(normalizeSongTitle(s.title));
            }
          });
          const moreSongs = await fetchSimilarGenerationSongs(currentTrack, playedSet, api.search);
          const distinctMore = moreSongs.filter(s => {
            const norm = normalizeSongTitle(s.title);
            return norm !== currentNorm && !(currentRoot.length >= 4 && norm.includes(currentRoot));
          });

          if (distinctMore.length > 0) {
            const nextTrack = distinctMore[0];
            setPlaybackQueue(prev => {
              const existingIds = new Set(prev.map(s => String(s.id || s.sourceId)));
              const existingTitles = new Set(prev.map(s => normalizeSongTitle(s.title)));
              const additions = [];
              for (const s of distinctMore) {
                const sid = String(s.id || s.sourceId);
                const snorm = normalizeSongTitle(s.title);
                if (!existingIds.has(sid) && !existingTitles.has(snorm)) {
                  existingIds.add(sid);
                  existingTitles.add(snorm);
                  additions.push(s);
                }
              }
              return [...prev, ...additions];
            });
            setQueueIndex(currentQ.length);
            playTrackDirect(nextTrack);
            return;
          }
        } catch (e) {
          console.warn('Error fetching more era songs:', e);
        }
      }

      // If all else fails, loop back to the first track in currentQ that is not the same title
      const alternativeTrackIndex = currentQ.findIndex(t => {
        const norm = normalizeSongTitle(t.title);
        return norm !== currentNorm && !(currentRoot.length >= 4 && norm.includes(currentRoot));
      });
      if (alternativeTrackIndex !== -1) {
        setQueueIndex(alternativeTrackIndex);
        playTrackDirect(currentQ[alternativeTrackIndex]);
      } else {
        if (currentQ.length > 0) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(console.error);
        }
      }
    }
  };

  const handlePrevSong = () => {
    if (currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const currentQ = queueRef.current;
    const curIdx = queueIndexRef.current;
    if (curIdx > 0 && currentQ.length > 0) {
      const prevIdx = curIdx - 1;
      setQueueIndex(prevIdx);
      playTrackDirect(currentQ[prevIdx]);
    } else if (currentQ.length > 0) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleSeek = (e) => {
    const seekTime = Number(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleLikeToggle = async (songOrId, maybeSong = null) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    const songId = typeof songOrId === 'object' && songOrId !== null ? songOrId.id : songOrId;
    if (!songId) return;

    const targetSong = (typeof songOrId === 'object' && songOrId !== null)
      ? songOrId
      : (maybeSong ||
         (currentSong?.id === songId ? currentSong : null) ||
         (searchResults?.content || (Array.isArray(searchResults) ? searchResults : [])).find?.(s => s.id === songId) ||
         playbackQueue.find?.(s => s.id === songId) ||
         allVisibleSongs.find?.(s => s.id === songId) ||
         likedSongsList.find?.(s => s.id === songId));

    const isLiked = likedSongIds.has(songId);
    const userKey = currentUser.id || currentUser.email || 'user';

    if (isLiked) {
      setLikedSongIds(prev => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
      setLikedSongsList(prev => {
        const nextList = prev.filter(s => s.id !== songId);
        try {
          localStorage.setItem(`voxa_liked_${userKey}`, JSON.stringify(nextList));
        } catch (e) {}
        return nextList;
      });

      try {
        if (typeof songId === 'number' || !isNaN(Number(songId))) {
          await api.unlikeSong(songId);
        }
      } catch (err) {
        console.warn('Sync unlike notice:', err.message);
      }
    } else {
      setLikedSongIds(prev => new Set(prev).add(songId));
      if (targetSong) {
        setLikedSongsList(prev => {
          const filtered = prev.filter(s => s.id !== songId);
          const nextList = [targetSong, ...filtered];
          try {
            localStorage.setItem(`voxa_liked_${userKey}`, JSON.stringify(nextList));
          } catch (e) {}
          return nextList;
        });
      }

      try {
        if (typeof songId === 'number' || !isNaN(Number(songId))) {
          await api.likeSong(songId);
        }
      } catch (err) {
        console.warn('Sync like notice:', err.message);
      }
    }
  };

  // --------------------------------------------------------------------------
  // Zero-Latency Next Track Preloader (Spotify Buffer Architecture)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const nextIdx = queueIndex + 1;
    if (nextIdx < playbackQueue.length) {
      const nextSong = playbackQueue[nextIdx];
      if (nextSong && nextSong.audioUrl) {
        try {
          const pre = preloadAudioRef.current;
          if (pre.src !== nextSong.audioUrl) {
            pre.src = nextSong.audioUrl;
            pre.preload = 'auto';
            pre.load();
          }
          setIsPreloaded(true);
        } catch (e) {
          console.warn('Preload audio error:', e);
        }
      }
    } else {
      setIsPreloaded(false);
    }
  }, [queueIndex, playbackQueue]);

  // --------------------------------------------------------------------------
  // HTML5 MediaSession API (Lock Screen, Bluetooth & Media Keys Integration)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: currentSong.title || 'Voxa Music',
          artist: currentSong.artistName || 'Various Artists',
          album: currentSong.albumName || 'Single',
          artwork: [
            { src: currentSong.imageUrl || FALLBACK_COVER, sizes: '96x96', type: 'image/jpeg' },
            { src: currentSong.imageUrl || FALLBACK_COVER, sizes: '192x192', type: 'image/jpeg' },
            { src: currentSong.imageUrl || FALLBACK_COVER, sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => handleTogglePlay());
        navigator.mediaSession.setActionHandler('pause', () => handleTogglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevSong());
        navigator.mediaSession.setActionHandler('nexttrack', () => handleNextSong());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            setCurrentTime(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skip = details.seekOffset || 10;
          if (audioRef.current) {
            const nextT = Math.max(0, audioRef.current.currentTime - skip);
            audioRef.current.currentTime = nextT;
            setCurrentTime(nextT);
          }
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skip = details.seekOffset || 10;
          if (audioRef.current) {
            const nextT = Math.min(duration || 300, audioRef.current.currentTime + skip);
            audioRef.current.currentTime = nextT;
            setCurrentTime(nextT);
          }
        });
      } catch (err) {
        console.warn('MediaSession handler error:', err);
      }
    }
  }, [currentSong, isPlaying, duration]);

  // Sync MediaSession playback progress bar
  useEffect(() => {
    if ('mediaSession' in navigator && duration > 0 && navigator.mediaSession.setPositionState) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, 1),
          playbackRate: 1,
          position: Math.min(currentTime, duration)
        });
      } catch (e) {}
    }
  }, [currentTime, duration]);

  // --------------------------------------------------------------------------
  // Global Hardware & Keyboard Shortcuts (Spotify-Style Controls)
  // Space: Play/Pause | M: Mute | L: Like | ArrowLeft/Right: Seek 5s
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setIsMuted(prev => !prev);
      } else if (e.code === 'KeyL') {
        if (currentSong) {
          e.preventDefault();
          handleLikeToggle(currentSong);
        }
      } else if (e.code === 'ArrowRight') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleNextSong();
        } else {
          e.preventDefault();
          if (audioRef.current) {
            const nextTime = Math.min(duration || 300, audioRef.current.currentTime + 5);
            audioRef.current.currentTime = nextTime;
            setCurrentTime(nextTime);
          }
        }
      } else if (e.code === 'ArrowLeft') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handlePrevSong();
        } else {
          e.preventDefault();
          if (audioRef.current) {
            const prevTime = Math.max(0, audioRef.current.currentTime - 5);
            audioRef.current.currentTime = prevTime;
            setCurrentTime(prevTime);
          }
        }
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        handleNextSong();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        handlePrevSong();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong, isPlaying, duration, isMuted, likedSongIds, playbackQueue, queueIndex]);

  // --------------------------------------------------------------------------
  // Search & Autocomplete Handlers
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await api.getSuggestions(val.trim());
          if (res) {
            setSuggestions(res);
          }
        } catch (err) {
          console.warn('Autocomplete fetch error:', err);
        }
      }, 180);
    } else {
      setSuggestions({ suggestions: [], songs: [], artists: [] });
    }
  };

  const executeSearch = async (term) => {
    const queryToSearch = (term || searchQuery).trim();
    if (!queryToSearch) return;
    setSearchQuery(queryToSearch);
    setShowSuggestions(false);
    setIsSearching(true);
    setActiveTab('search');
    try {
      const res = await api.search(queryToSearch);
      if (res && Array.isArray(res.content)) {
        setSearchResults({ ...res, content: deduplicateSongList(res.content) });
      } else if (Array.isArray(res)) {
        setSearchResults(deduplicateSongList(res));
      } else {
        setSearchResults(res);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    executeSearch(searchQuery);
  };

  // --------------------------------------------------------------------------
  // Auth Handlers
  // --------------------------------------------------------------------------
  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      let res;
      try {
        res = await api.login('user@musicapp.com', 'user123');
      } catch {
        res = await api.register('Vishal (Google)', 'vishal@gmail.com', 'vishal123');
      }
      const token = res?.accessToken || res?.token;
      if (token) {
        localStorage.setItem('aurastream_token', token);
        const userObj = res.user ? {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: typeof res.user.role === 'object' ? res.user.role.name : res.user.role
        } : {
          id: 1,
          name: 'Vishal (Google)',
          email: 'vishal@gmail.com',
          role: 'ROLE_USER'
        };
        localStorage.setItem('aurastream_user', JSON.stringify(userObj));
        setCurrentUser(userObj);
        setShowAuthModal(false);
      }
    } catch (err) {
      setAuthError('Google Sign-in: ' + (err.message || 'Ensure backend is running in Eclipse'));
    }
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    if (!authForm.name || authForm.name.trim().length < 2) {
      setAuthError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!authForm.email || !authForm.email.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (!authForm.password || authForm.password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setIsAuthLoading(true);
    try {
      await api.sendOtp(authForm.email.trim(), authForm.name.trim());
      setAuthMode('verify-otp');
      setResendCooldown(30);
      setAuthSuccessMsg(`We've sent a 6-digit One Time Password (OTP) to ${authForm.email}`);
    } catch (err) {
      setAuthError(err.message || 'Failed to send verification email. Please check your email address.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    const cleanOtp = otpCode.trim();
    if (cleanOtp.length !== 6) {
      setAuthError('Please enter the full 6-digit OTP code sent to your email.');
      return;
    }

    setIsAuthLoading(true);
    try {
      const res = await api.verifyOtp(authForm.email.trim(), cleanOtp, authForm.name.trim(), authForm.password);
      const token = res?.accessToken || res?.token;
      if (res && token) {
        localStorage.setItem('aurastream_token', token);
        const userObj = res.user ? {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: typeof res.user.role === 'object' ? res.user.role.name : res.user.role
        } : {
          id: res.id,
          name: res.name,
          email: res.email,
          role: res.role
        };
        localStorage.setItem('aurastream_user', JSON.stringify(userObj));
        setCurrentUser(userObj);
        setShowAuthModal(false);
        setAuthForm({ name: '', email: '', password: '' });
        setOtpCode('');
        setAuthMode('login');
      } else {
        throw new Error('Registration failed');
      }
    } catch (err) {
      setAuthError(err.message || 'Invalid or expired OTP code. Please check your email.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');

    if (authMode === 'register') {
      return handleSendOtp(e);
    }

    if (authMode === 'verify-otp') {
      return handleVerifyOtp(e);
    }

    // Login mode
    setIsAuthLoading(true);
    try {
      const res = await api.login(authForm.email, authForm.password);
      const token = res?.accessToken || res?.token;
      if (res && token) {
        localStorage.setItem('aurastream_token', token);
        const userObj = res.user ? {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: typeof res.user.role === 'object' ? res.user.role.name : res.user.role
        } : {
          id: res.id,
          name: res.name,
          email: res.email,
          role: res.role
        };
        localStorage.setItem('aurastream_user', JSON.stringify(userObj));
        setCurrentUser(userObj);
        setShowAuthModal(false);
        setAuthForm({ name: '', email: '', password: '' });
      } else {
        throw new Error('Invalid credentials or response from server');
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('403')) {
        setAuthError('Access refused (403). Make sure Backend is running or click "User Demo" below.');
      } else {
        setAuthError(msg || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleDemoLogin = async (email, password) => {
    setAuthError('');
    try {
      const res = await api.login(email, password);
      const token = res?.accessToken || res?.token;
      if (res && token) {
        localStorage.setItem('aurastream_token', token);
        const userObj = res.user ? {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: typeof res.user.role === 'object' ? res.user.role.name : res.user.role
        } : {
          id: res.id,
          name: res.name,
          email: res.email,
          role: res.role
        };
        localStorage.setItem('aurastream_user', JSON.stringify(userObj));
        setCurrentUser(userObj);
        setShowAuthModal(false);
      }
    } catch (err) {
      setAuthError(`Demo login failed: ${err.message}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aurastream_token');
    localStorage.removeItem('aurastream_user');
    setCurrentUser(null);
    setActiveTab('discover');
  };

  // --------------------------------------------------------------------------
  // DSP Soundstage Profile Selector
  // --------------------------------------------------------------------------
  const handleSelectDsp = (mode) => {
    setDspMode(mode);
    const descriptions = {
      'STUDIO': 'Studio Direct: Flat 0dB reference monitor response (Original Master)',
      'BASS 3D': 'Bass 3D: Sub-Bass boost at 80Hz with deep dynamic low-end punch',
      'SPATIAL': 'Spatial: 3D Surround soundstage widening & airy presence',
      'TUBE': 'Tube: Warm vintage analog vacuum tube harmonics & smooth treble'
    };
    if (descriptions[mode]) {
      setShareToast(descriptions[mode]);
      setTimeout(() => setShareToast(''), 3200);
    }
  };

  // --------------------------------------------------------------------------
  // Image Error Graceful Fallback
  // --------------------------------------------------------------------------
  const handleImageError = (e) => {
    const currentSrc = e.currentTarget.src || '';
    if (currentSrc.includes('500x500')) {
      e.currentTarget.src = currentSrc.replace('500x500', '150x150');
    } else if (!currentSrc.includes('unsplash')) {
      e.currentTarget.src = FALLBACK_COVER;
    }
  };

  // --------------------------------------------------------------------------
  // Playlist Handlers
  // --------------------------------------------------------------------------
  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    setPlaylistModalError('');
    const cleanTitle = newPlaylistTitle.trim();
    if (!cleanTitle) {
      setPlaylistModalError('Please enter a playlist name.');
      return;
    }

    const userKey = currentUser ? (currentUser.id || currentUser.email || 'user') : 'guest';
    const localPlaylist = {
      id: Date.now(),
      title: cleanTitle,
      name: cleanTitle,
      description: newPlaylistDesc.trim(),
      isPublic: true,
      songs: [],
      songCount: 0,
      createdAt: new Date().toISOString()
    };

    try {
      if (currentUser) {
        const created = await api.createPlaylist(cleanTitle, newPlaylistDesc.trim());
        const safe = created ? {
          ...created,
          title: created.title || created.name || cleanTitle,
          name: created.name || created.title || cleanTitle,
          songs: created.songs || []
        } : localPlaylist;

        setPlaylists(prev => [safe, ...prev.filter(p => p.id !== safe.id)]);
        try {
          const key = `voxa_playlists_${userKey}`;
          const current = JSON.parse(localStorage.getItem(key) || '[]');
          localStorage.setItem(key, JSON.stringify([safe, ...current.filter(p => p.id !== safe.id)]));
        } catch (_) {}
      } else {
        // Guest mode creation
        setPlaylists(prev => [localPlaylist, ...prev]);
        try {
          const current = JSON.parse(localStorage.getItem('voxa_playlists_guest') || '[]');
          localStorage.setItem('voxa_playlists_guest', JSON.stringify([localPlaylist, ...current]));
        } catch (_) {}
      }
      setShowPlaylistModal(false);
      setNewPlaylistTitle('');
      setNewPlaylistDesc('');
    } catch (err) {
      console.warn('Backend playlist notice, saved to local studio vault:', err);
      setPlaylists(prev => [localPlaylist, ...prev]);
      try {
        const key = `voxa_playlists_${userKey}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([localPlaylist, ...current]));
      } catch (_) {}
      setShowPlaylistModal(false);
      setNewPlaylistTitle('');
      setNewPlaylistDesc('');
    }
  };

  // --------------------------------------------------------------------------
  // Delete Playlist Handler
  // --------------------------------------------------------------------------
  const handleDeletePlaylist = async (playlistId, playlistTitle = 'Playlist') => {
    if (!window.confirm(`Are you sure you want to delete playlist "${playlistTitle}"?`)) {
      return;
    }
    const userKey = currentUser?.id || currentUser?.email || 'guest';
    const storageKey = currentUser ? `voxa_playlists_${userKey}` : 'voxa_playlists_guest';

    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    if (selectedPlaylist && selectedPlaylist.id === playlistId) {
      setSelectedPlaylist(null);
    }

    try {
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      localStorage.setItem(storageKey, JSON.stringify(current.filter(p => p.id !== playlistId)));
    } catch (_) {}

    if (currentUser) {
      try {
        await api.deletePlaylist(playlistId);
      } catch (err) {
        console.warn('Backend delete playlist notice:', err);
      }
    }

    setShareToast(`Deleted playlist "${playlistTitle}"`);
    setTimeout(() => setShareToast(null), 3000);
  };

  // --------------------------------------------------------------------------
  // Add Song to Playlist Handler
  // --------------------------------------------------------------------------
  const handleAddSongToPlaylist = async (playlistId, song) => {
    if (!playlistId || !song) return;
    const targetPlaylist = playlists.find(p => p.id === playlistId);
    const plTitle = targetPlaylist?.title || targetPlaylist?.name || 'Playlist';
    const userKey = currentUser?.id || currentUser?.email || 'guest';
    const storageKey = currentUser ? `voxa_playlists_${userKey}` : 'voxa_playlists_guest';

    const existingSongs = targetPlaylist?.songs || [];
    if (existingSongs.some(s => s.id === song.id || (s.title && song.title && s.title.toLowerCase() === song.title.toLowerCase()))) {
      setShareToast(`"${song.title}" is already in "${plTitle}"`);
      setTimeout(() => setShareToast(null), 3000);
      setAddToPlaylistSong(null);
      return;
    }

    const updatedSongs = [...existingSongs, song];

    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, songs: updatedSongs, songCount: updatedSongs.length };
      }
      return p;
    }));

    if (selectedPlaylist && selectedPlaylist.id === playlistId) {
      setSelectedPlaylist(prev => ({ ...prev, songs: updatedSongs, songCount: updatedSongs.length }));
    }

    try {
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updatedList = current.map(p => {
        if (p.id === playlistId) {
          return { ...p, songs: updatedSongs, songCount: updatedSongs.length };
        }
        return p;
      });
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } catch (_) {}

    if (currentUser) {
      try {
        await api.addSongToPlaylist(playlistId, song.id);
      } catch (err) {
        console.warn('Backend add song notice:', err);
      }
    }

    setShareToast(`Added "${song.title}" to "${plTitle}"!`);
    setTimeout(() => setShareToast(null), 3000);
    setAddToPlaylistSong(null);
  };

  // --------------------------------------------------------------------------
  // Remove Song from Playlist Handler
  // --------------------------------------------------------------------------
  const handleRemoveSongFromPlaylist = async (playlistId, songId, songTitle = 'Track') => {
    const userKey = currentUser?.id || currentUser?.email || 'guest';
    const storageKey = currentUser ? `voxa_playlists_${userKey}` : 'voxa_playlists_guest';

    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        const filtered = (p.songs || []).filter(s => s.id !== songId);
        return { ...p, songs: filtered, songCount: filtered.length };
      }
      return p;
    }));

    if (selectedPlaylist && selectedPlaylist.id === playlistId) {
      setSelectedPlaylist(prev => {
        const filtered = (prev.songs || []).filter(s => s.id !== songId);
        return { ...prev, songs: filtered, songCount: filtered.length };
      });
    }

    try {
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updatedList = current.map(p => {
        if (p.id === playlistId) {
          const filtered = (p.songs || []).filter(s => s.id !== songId);
          return { ...p, songs: filtered, songCount: filtered.length };
        }
        return p;
      });
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } catch (_) {}

    if (currentUser) {
      try {
        await api.removeSongFromPlaylist(playlistId, songId);
      } catch (_) {}
    }

    setShareToast(`Removed "${songTitle}" from playlist`);
    setTimeout(() => setShareToast(null), 3000);
  };

  // --------------------------------------------------------------------------
  // Quick Create Playlist & Add Song
  // --------------------------------------------------------------------------
  const handleQuickCreateAndAdd = async (song) => {
    if (!quickPlaylistTitle.trim() || !song) return;
    const cleanTitle = quickPlaylistTitle.trim();
    const userKey = currentUser?.id || currentUser?.email || 'guest';
    const storageKey = currentUser ? `voxa_playlists_${userKey}` : 'voxa_playlists_guest';

    const newPlaylist = {
      id: Date.now(),
      title: cleanTitle,
      name: cleanTitle,
      description: 'Created from song menu',
      isPublic: true,
      songs: [song],
      songCount: 1,
      createdAt: new Date().toISOString()
    };

    setPlaylists(prev => [newPlaylist, ...prev]);

    try {
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      localStorage.setItem(storageKey, JSON.stringify([newPlaylist, ...current]));
    } catch (_) {}

    if (currentUser) {
      try {
        const created = await api.createPlaylist(cleanTitle, 'Created from song menu');
        if (created?.id) {
          await api.addSongToPlaylist(created.id, song.id);
        }
      } catch (_) {}
    }

    setShareToast(`Created "${cleanTitle}" & added "${song.title}"!`);
    setTimeout(() => setShareToast(null), 3000);
    setQuickPlaylistTitle('');
    setAddToPlaylistSong(null);
  };

  // --------------------------------------------------------------------------
  // Admin Jamendo Remote Importer
  // --------------------------------------------------------------------------
  const handleTriggerImport = async (e) => {
    e.preventDefault();
    setImportLoading(true);
    setImportFeedback(null);
    try {
      await api.triggerJamendoImport(importTag, Number(importLimit));
      setImportFeedback({
        type: 'success',
        message: `Successfully imported tracks for tag '${importTag}'!`
      });
      loadHomeData();
      loadAdminData();
    } catch (err) {
      setImportFeedback({
        type: 'error',
        message: `Import failed: ${err.message}`
      });
    } finally {
      setImportLoading(false);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Filter songs based on genre pill with dynamic live catalog fetching & title deduplication
  const trendingList = useMemo(() => deduplicateSongList(homeFeed.trending || []), [homeFeed.trending]);

  const matchesGenre = (s, genreId) => {
    if (!s) return false;
    const g = (s.genre || '').toLowerCase();
    const t = (s.title || '').toLowerCase();
    const a = (s.artistName || '').toLowerCase();
    const alb = (s.albumName || '').toLowerCase();
    const combined = `${g} ${t} ${a} ${alb}`;
    const gid = genreId.toLowerCase();

    if (g.includes(gid)) return true;
    if (gid === 'bollywood') return true; // Hindi movie soundtracks
    if (gid === 'romantic') return combined.includes('romantic') || combined.includes('love') || combined.includes('dil') || combined.includes('tum') || combined.includes('ishq') || combined.includes('humsafar');
    if (gid === 'punjabi') return combined.includes('punjabi') || combined.includes('bhangra') || combined.includes('karan') || combined.includes('diljit') || combined.includes('sidhu') || combined.includes('shubh');
    if (gid === 'lo-fi') return combined.includes('lofi') || combined.includes('lo-fi') || combined.includes('chill') || combined.includes('acoustic') || combined.includes('slowed');
    if (gid === 'pop') return combined.includes('pop') || combined.includes('party') || combined.includes('dance') || combined.includes('club') || combined.includes('dhamaka');
    if (gid === 'retro') return combined.includes('retro') || combined.includes('classic') || combined.includes('kishore') || combined.includes('rafi') || combined.includes('lata') || combined.includes('purane') || combined.includes('vintage');
    if (gid === 'devotional') return combined.includes('bhajan') || combined.includes('shiva') || combined.includes('ram') || combined.includes('krishna') || combined.includes('aarti') || combined.includes('bhakti');
    return false;
  };

  const handleSelectGenre = async (tab) => {
    setSelectedGenre(tab.id);
    if (tab.id === 'All') return;

    if (genreCache[tab.id] && genreCache[tab.id].length > 0) return;

    const localMatches = trendingList.filter(s => matchesGenre(s, tab.id));
    if (localMatches.length >= 12) {
      setGenreCache(prev => ({ ...prev, [tab.id]: localMatches }));
      return;
    }

    if (tab.query) {
      setGenreLoading(true);
      try {
        const res = await api.search(tab.query);
        const list = res?.content || (Array.isArray(res) ? res : []);
        const merged = deduplicateSongList([...localMatches, ...list]);
        setGenreCache(prev => ({ ...prev, [tab.id]: merged }));
      } catch (err) {
        console.warn('Genre live fetch error:', err);
      } finally {
        setGenreLoading(false);
      }
    }
  };

  const filteredSongs = useMemo(() => {
    if (selectedGenre === 'All') return trendingList;
    const cached = genreCache[selectedGenre];
    if (cached && cached.length > 0) return cached;
    const matched = trendingList.filter(s => matchesGenre(s, selectedGenre));
    return matched.length > 0 ? matched : trendingList;
  }, [selectedGenre, trendingList, genreCache]);

  // Dynamic Rotating Hero Song: Changes every time user navigates to Home / Discover!
  const [heroSongIndex, setHeroSongIndex] = useState(0);

  useEffect(() => {
    if (trendingList && trendingList.length > 0) {
      // Pick a random exciting superhit from top trending list
      const randomIdx = Math.floor(Math.random() * Math.min(trendingList.length, 15));
      setHeroSongIndex(randomIdx);
    }
  }, [activeTab, trendingList.length]);

  const heroSong = (trendingList && trendingList.length > 0) ? (trendingList[heroSongIndex] || trendingList[0]) : null;

  const handleShuffleHero = () => {
    if (trendingList && trendingList.length > 1) {
      let nextIdx;
      do {
        nextIdx = Math.floor(Math.random() * Math.min(trendingList.length, 15));
      } while (nextIdx === heroSongIndex && trendingList.length > 1);
      setHeroSongIndex(nextIdx);
    }
  };

  return (
    <div className="app-container">
      {/* Dynamic Ambient Background Glows */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* ====================================================================
          SIDEBAR NAVIGATION
          ==================================================================== */}
      {/* ====================================================================
          VOXA BESPOKE STUDIO ACOUSTIC CONSOLE
          ==================================================================== */}
      <aside className="sidebar voxa-studio-console">
        {/* Top Deck: Studio Master Status */}
        <div className="studio-master-header">
          <div className="studio-brand-crest" onClick={() => setActiveTab('discover')}>
            <div className="crest-glyph-box">
              <span className="crest-letter">V</span>
              <div className="crest-power-glow"></div>
            </div>
            <div className="crest-titles">
              <div className="brand-wordmark">
                Voxa<span className="brand-dot-pulse">.</span>
              </div>
              <div className="brand-byline">
                by Vishal
              </div>
            </div>
          </div>

          {/* Dual Analog VU Meters */}
          <div className="analog-vu-rack">
            <div className="vu-meter-row">
              <span className="vu-ch-label">CH-L</span>
              <div className="vu-meter-bar">
                <div className={`vu-meter-fill vu-left ${isPlaying ? 'active' : ''}`}></div>
              </div>
              <span className="vu-val">{isPlaying ? '-6dB' : '-∞'}</span>
            </div>
            <div className="vu-meter-row">
              <span className="vu-ch-label">CH-R</span>
              <div className="vu-meter-bar">
                <div className={`vu-meter-fill vu-right ${isPlaying ? 'active' : ''}`}></div>
              </div>
              <span className="vu-val">{isPlaying ? '-4dB' : '-∞'}</span>
            </div>
          </div>

          {/* OLED Master Telemetry Readout */}
          <div className="oled-telemetry-screen">
            <div className="oled-signal-line">
              <span className="oled-status">● {dspMode === 'STUDIO' ? 'DIRECT OUT' : dspMode}</span>
              <span className="oled-rate">48.0 kHz / 24-Bit</span>
            </div>
            <div className="oled-codec-line">
              <span className="oled-badge">
                {dspMode === 'BASS 3D' ? '+6dB SUB-BASS' : dspMode === 'SPATIAL' ? '3D SURROUND' : dspMode === 'TUBE' ? 'ANALOG WARMTH' : 'FLAC BIT-PERFECT'}
              </span>
              <span className="oled-latency">1.8ms DSD</span>
            </div>
          </div>
        </div>

        {/* Scrollable Console Body */}
        <div className="studio-console-body">
          {/* Bento Navigation Matrix (Tactile Studio Pads) */}
          <div className="studio-section-label">
            <span className="section-bracket">[</span>
            <span>SYSTEM MATRIX</span>
            <span className="section-bracket">]</span>
          </div>

          <div className="bento-control-matrix">
            {/* Pad 1: Discover */}
            <button
              className={`bento-pad ${activeTab === 'discover' ? 'active pad-discover' : ''}`}
              onClick={() => setActiveTab('discover')}
              title="Acoustic Discover Radar"
            >
              <div className="bento-pad-top">
                <div className="bento-icon-pod"><Flame size={18} /></div>
                <div className="bento-led"></div>
              </div>
              <div className="bento-pad-bottom">
                <span className="bento-pad-title">Radar</span>
                <span className="bento-pad-sub">Discover</span>
              </div>
              {activeTab === 'discover' && isPlaying && (
                <div className="bento-active-wave">
                  <span></span><span></span><span></span><span></span>
                </div>
              )}
            </button>

            {/* Pad 2: Search */}
            <button
              className={`bento-pad ${activeTab === 'search' ? 'active pad-search' : ''}`}
              onClick={() => {
                setActiveTab('search');
                setSearchQuery('');
                setSearchResults(null);
              }}
              title="Sonar Search Engine"
            >
              <div className="bento-pad-top">
                <div className="bento-icon-pod"><Compass size={18} /></div>
                <div className="bento-led"></div>
              </div>
              <div className="bento-pad-bottom">
                <span className="bento-pad-title">Sonar</span>
                <span className="bento-pad-sub">Search</span>
              </div>
            </button>

            {/* Pad 3: Sound Vault (Liked) */}
            <button
              className={`bento-pad ${activeTab === 'liked' ? 'active pad-vault' : ''}`}
              onClick={() => {
                if (!currentUser) setShowAuthModal(true);
                else setActiveTab('liked');
              }}
              title="Personal Sound Vault"
            >
              <div className="bento-pad-top">
                <div className="bento-icon-pod heart-accent"><Heart size={18} /></div>
                <div className="bento-counter-chip">{likedSongsList.length}</div>
              </div>
              <div className="bento-pad-bottom">
                <span className="bento-pad-title">Vault</span>
                <span className="bento-pad-sub">Liked Tracks</span>
              </div>
            </button>

            {/* Pad 4: Library / Collection */}
            <button
              className={`bento-pad ${activeTab === 'library' ? 'active pad-library' : ''}`}
              onClick={() => {
                if (!currentUser) setShowAuthModal(true);
                else setActiveTab('library');
              }}
              title="Acoustic Collection"
            >
              <div className="bento-pad-top">
                <div className="bento-icon-pod"><Library size={18} /></div>
                <div className="bento-led"></div>
              </div>
              <div className="bento-pad-bottom">
                <span className="bento-pad-title">Archive</span>
                <span className="bento-pad-sub">Collection</span>
              </div>
            </button>

            {/* Pad 5: Queue / Up Next */}
            <button
              className={`bento-pad ${activeTab === 'queue' ? 'active pad-queue' : ''}`}
              onClick={() => setActiveTab('queue')}
              title="Continuous Playback Queue"
            >
              <div className="bento-pad-top">
                <div className="bento-icon-pod"><ListMusic size={18} /></div>
                {playbackQueue.length > 0 && (
                  <div className="bento-counter-chip queue-chip">{playbackQueue.length}</div>
                )}
              </div>
              <div className="bento-pad-bottom">
                <span className="bento-pad-title">Up Next</span>
                <span className="bento-pad-sub">Queue</span>
              </div>
            </button>

            {/* Pad 6: History */}
            <button
              className={`bento-pad ${activeTab === 'history' ? 'active pad-history' : ''}`}
              onClick={() => {
                if (!currentUser) setShowAuthModal(true);
                else setActiveTab('history');
              }}
              title="Playback History"
            >
              <div className="bento-pad-top">
                <div className="bento-icon-pod"><History size={18} /></div>
                <div className="bento-led"></div>
              </div>
              <div className="bento-pad-bottom">
                <span className="bento-pad-title">Log</span>
                <span className="bento-pad-sub">History</span>
              </div>
            </button>

            {/* Pad 7 (Admin only) */}
            {currentUser?.role === 'ROLE_ADMIN' && (
              <button
                className={`bento-pad pad-admin ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
                title="Master Admin Console"
              >
                <div className="bento-pad-top">
                  <div className="bento-icon-pod admin-accent"><Shield size={18} /></div>
                  <div className="bento-admin-tag">SYS</div>
                </div>
                <div className="bento-pad-bottom">
                  <span className="bento-pad-title">Admin</span>
                  <span className="bento-pad-sub">Console</span>
                </div>
              </button>
            )}
          </div>

          {/* Interactive Mini-Turntable Vinyl Deck (Visible when song is loaded) */}
          {currentSong && (
            <div className="studio-turntable-deck" onClick={handleTogglePlay} title="Click to Play/Pause Vinyl Deck">
              <div className="turntable-chassis">
                <div className={`spinning-vinyl-record ${isPlaying ? 'spinning' : 'paused'}`}>
                  <div className="vinyl-groove g1"></div>
                  <div className="vinyl-groove g2"></div>
                  <div className="vinyl-center-label">
                    <img
                      src={currentSong.imageUrl || FALLBACK_COVER}
                      alt={currentSong.title}
                      className="vinyl-album-art"
                      onError={handleImageError}
                    />
                    <div className="vinyl-spindle-hole"></div>
                  </div>
                </div>
                <div className={`tonearm-assembly ${isPlaying ? 'on-record' : 'parked'}`}>
                  <div className="tonearm-pivot"></div>
                  <div className="tonearm-arm"></div>
                  <div className="tonearm-cartridge"></div>
                </div>
              </div>

              <div className="turntable-meta">
                <div className="turntable-marquee">
                  <span className="turntable-title">{currentSong.title}</span>
                  <span className="turntable-artist"> • {currentSong.artistName}</span>
                </div>
                <div className="turntable-status-chip">
                  <span className={`status-indicator-dot ${isPlaying ? 'live' : ''}`}></span>
                  <span>{isPlaying ? 'ROTATING 33⅓ RPM' : 'DECK PAUSED'}</span>
                </div>
              </div>
            </div>
          )}

          {/* DSP Acoustic Presets (Soundstage Matrix) */}
          <div className="studio-section-label">
            <span className="section-bracket">[</span>
            <span>DSP SOUNDSTAGE</span>
            <span className="section-bracket">]</span>
          </div>

          <div className="dsp-preset-rack">
            {['STUDIO', 'BASS 3D', 'SPATIAL', 'TUBE'].map((mode) => (
              <button
                key={mode}
                className={`dsp-preset-chip ${dspMode === mode ? 'active' : ''}`}
                onClick={() => handleSelectDsp(mode)}
              >
                <span className="dsp-dot"></span>
                <span>{mode}</span>
              </button>
            ))}
          </div>

          {/* Studio Cassette Mix Shelf (Playlists) */}
          <div className="studio-shelf-header">
            <div className="studio-section-label no-pad">
              <span className="section-bracket">[</span>
              <span>STUDIO MIXES ({playlists.length})</span>
              <span className="section-bracket">]</span>
            </div>
            <button
              className="studio-new-mix-btn"
              onClick={() => {
                setShowPlaylistModal(true);
              }}
              title="Create New Studio Mix"
            >
              <Plus size={13} />
              <span>New Mix</span>
            </button>
          </div>

          <div className="studio-tapes-rack">
            {playlists.map((pl, idx) => {
              const name = pl.title || pl.name || 'Untitled Mix';
              const hues = ['#ff2a51', '#8b5cf6', '#00f0ff', '#f59e0b', '#10b981'];
              const accentColor = hues[idx % hues.length];
              return (
                <div
                  key={pl.id}
                  className="cassette-tape-card"
                  onClick={() => setActiveTab('library')}
                  style={{ '--tape-accent': accentColor }}
                >
                  <div className="tape-spine-color"></div>
                  <div className="tape-reel-icons">
                    <Disc size={13} className="tape-spool left" />
                    <Disc size={13} className="tape-spool right" />
                  </div>
                  <div className="tape-info">
                    <span className="tape-title" title={name}>{name}</span>
                    <span className="tape-count">{pl.songCount || pl.songs?.length || 0} TRACKS</span>
                  </div>
                </div>
              );
            })}
            {playlists.length === 0 && (
              <div className="empty-tape-rack" onClick={() => setShowPlaylistModal(true)}>
                <span>+ Create Your First Studio Mix</span>
              </div>
            )}
          </div>
        </div>

        {/* Studio Console User Station at Bottom */}
        <div className="studio-user-station">
          {currentUser ? (
            <div className="studio-user-card">
              <div className="studio-user-avatar">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="studio-user-meta">
                <span className="studio-user-name">{currentUser.name}</span>
                <span className="studio-user-rank">
                  {currentUser.role === 'ROLE_ADMIN' ? 'STUDIO MASTER' : 'AUDIOPHILE PRO'}
                </span>
              </div>
              <button className="studio-power-btn" onClick={handleLogout} title="Power Off / Logout">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              className="studio-login-btn"
              onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
            >
              <span>CONNECT STUDIO ID</span>
            </button>
          )}
        </div>
      </aside>

      {/* ====================================================================
          MAIN VIEWPORT (Header + Content Views)
          ==================================================================== */}
      <main className="main-viewport">
        {/* Top Header */}
        <header className="top-header">
          {/* Live Search Bar with Real-time Autocomplete Dropdown */}
          <div className="search-wrapper-relative" ref={searchContainerRef}>
            <form className="search-box-wrapper" onSubmit={handleSearchSubmit}>
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="search-input"
                placeholder="Search songs, artists, albums, or genres..."
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={handleSearchInputChange}
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', paddingRight: '10px', fontSize: '1rem' }}
                  onClick={() => { setSearchQuery(''); setSuggestions({ suggestions: [], songs: [], artists: [] }); }}
                >
                  ✕
                </button>
              )}
            </form>

            {/* Recommended Autocomplete Dropdown */}
            {showSuggestions && (
              <div className="search-autocomplete-dropdown">
                {(!searchQuery || searchQuery.trim().length < 2) ? (
                  <div>
                    <div className="autocomplete-section-title">Trending & Recommended Searches</div>
                    <div className="popular-chips">
                      {POPULAR_SEARCHES.map(item => (
                        <div
                          key={item}
                          className="popular-chip"
                          onMouseDown={() => executeSearch(item)}
                        >
                          🔍 {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Query Suggestions */}
                    {suggestions.suggestions && suggestions.suggestions.length > 0 && (
                      <div>
                        <div className="autocomplete-section-title">Recommended Searches</div>
                        {suggestions.suggestions.slice(0, 5).map((term, i) => (
                          <div
                            key={i}
                            className="autocomplete-item"
                            onMouseDown={() => executeSearch(term)}
                          >
                            <div className="autocomplete-icon">
                              <Search size={16} />
                            </div>
                            <div className="autocomplete-details">
                              <span className="autocomplete-title">{term}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Artists Preview */}
                    {suggestions.artists && suggestions.artists.length > 0 && (
                      <div>
                        <div className="autocomplete-section-title">Artists</div>
                        {suggestions.artists.slice(0, 3).map((art, i) => (
                          <div
                            key={i}
                            className="autocomplete-item"
                            onMouseDown={() => executeSearch(art.name)}
                          >
                            <img
                              src={art.imageUrl || FALLBACK_ARTIST}
                              alt={art.name}
                              className="autocomplete-thumb artist"
                            />
                            <div className="autocomplete-details">
                              <span className="autocomplete-title">{art.name}</span>
                              <span className="autocomplete-subtitle">Artist</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Songs Preview */}
                    {suggestions.songs && suggestions.songs.length > 0 && (
                      <div>
                        <div className="autocomplete-section-title">Songs</div>
                        {suggestions.songs.slice(0, 4).map((s, i) => (
                          <div
                            key={i}
                            className="autocomplete-item"
                            onMouseDown={() => executeSearch(s.title)}
                          >
                            <img
                              src={s.imageUrl || FALLBACK_COVER}
                              alt={s.title}
                              className="autocomplete-thumb"
                            />
                            <div className="autocomplete-details">
                              <span className="autocomplete-title">{s.title}</span>
                              <span className="autocomplete-subtitle">{s.artistName || 'Song'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(!suggestions.suggestions?.length && !suggestions.songs?.length && !suggestions.artists?.length) && (
                      <div
                        className="autocomplete-item"
                        onMouseDown={() => executeSearch(searchQuery)}
                      >
                        <div className="autocomplete-icon">
                          <Search size={16} />
                        </div>
                        <div className="autocomplete-details">
                          <span className="autocomplete-title">Search for "{searchQuery}"</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Demo Logins & Actions */}
          <div className="header-actions">
            {!currentUser && (
              <>
                <button
                  className="demo-account-pill"
                  onClick={() => handleDemoLogin('user@musicapp.com', 'user123')}
                  title="Login instantly as Demo User"
                >
                  <UserIcon size={14} />
                  <span>1-Click Demo User</span>
                </button>
                <button
                  className="demo-account-pill"
                  style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)' }}
                  onClick={() => handleDemoLogin('admin@musicapp.com', 'admin123')}
                  title="Login instantly as Admin"
                >
                  <Shield size={14} />
                  <span>1-Click Admin</span>
                </button>
                <button className="btn-secondary" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
                  Log In
                </button>
                <button className="btn-primary" onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}>
                  Sign Up
                </button>
              </>
            )}

            {currentUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Welcome back, <strong style={{ color: '#fff' }}>{currentUser.name}</strong>
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Content View */}
        <div className="content-scrollable" ref={contentScrollRef}>
          {/* ================================================================
              VIEW: DISCOVER / HOME
              ================================================================ */}
          {activeTab === 'discover' && (
            <>
              {/* Hero Banner */}
              <div className="hero-banner">
                <div style={{ zIndex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div className="hero-badge">
                      <Flame size={14} /> FEATURED TRACK
                    </div>
                    <button
                      className="hero-shuffle-btn"
                      onClick={handleShuffleHero}
                      title="Shuffle to another featured superhit"
                    >
                      <Shuffle size={12} />
                      <span>Discover Next</span>
                    </button>
                  </div>
                  <h1 className="hero-title">
                    {heroSong?.title || 'Cosmic Journey'}
                  </h1>
                  <p className="hero-desc">
                    By {heroSong?.artistName || 'Voxa Artist'} • 320 kbps Studio Master Stream
                  </p>
                  <div className="hero-actions">
                    <button
                      className="btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px' }}
                      onClick={() => heroSong && playSong(heroSong, allVisibleSongs)}
                    >
                      <Play size={18} fill="white" />
                      <span>Play Now</span>
                    </button>
                    {heroSong && (
                      <button
                        className="btn-secondary"
                        onClick={() => handleLikeToggle(heroSong)}
                      >
                        <Heart
                          size={18}
                          color={likedSongIds.has(heroSong.id) ? '#f43f5e' : '#fff'}
                          fill={likedSongIds.has(heroSong.id) ? '#f43f5e' : 'none'}
                        />
                      </button>
                    )}
                  </div>
                </div>

                <img
                  src={heroSong?.imageUrl || FALLBACK_COVER}
                  alt="Hero Artwork"
                  className="hero-artwork"
                  onError={handleImageError}
                />
              </div>

              {/* Genre Pills */}
              <div className="genre-chips-container">
                {GENRE_TABS.map(tab => (
                  <button
                    key={tab.id}
                    className={`genre-chip ${selectedGenre === tab.id ? 'active' : ''}`}
                    onClick={() => handleSelectGenre(tab)}
                  >
                    {tab.label}
                  </button>
                ))}
                {genreLoading && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-cyan)', fontSize: '0.8rem', paddingLeft: 8 }}>
                    <RefreshCw className="eq-bar-2" size={13} />
                    <span>Loading tracks...</span>
                  </div>
                )}
              </div>

              {/* Trending Songs Section */}
              <div className="section-header">
                <div className="section-title">
                  <Flame size={20} color="#f43f5e" />
                  <span>Trending Songs</span>
                </div>
                <div className="section-more-link">{filteredSongs.length} Tracks</div>
              </div>

              <table className="track-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Title & Artist</th>
                    <th>Album</th>
                    <th>Genre</th>
                    <th>Plays</th>
                    <th style={{ width: 60 }}><Clock size={14} /></th>
                    <th style={{ width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSongs.map((song, idx) => {
                    const isCur = currentSong?.id === song.id;
                    const isLiked = likedSongIds.has(song.id);
                    return (
                      <tr
                        key={song.id}
                        className={`track-row ${isCur ? 'active' : ''}`}
                        onClick={() => playSong(song, filteredSongs)}
                      >
                        <td className="track-num-cell">
                          {isCur && isPlaying ? (
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: 16 }}>
                              <div className="eq-bar-1" style={{ width: 3, background: 'var(--accent-cyan)', borderRadius: 2 }}></div>
                              <div className="eq-bar-2" style={{ width: 3, background: 'var(--accent-purple)', borderRadius: 2 }}></div>
                              <div className="eq-bar-3" style={{ width: 3, background: 'var(--accent-cyan)', borderRadius: 2 }}></div>
                            </div>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td>
                          <div className="track-title-cell">
                            <img src={song.imageUrl || FALLBACK_COVER} alt={song.title} className="track-thumb" onError={handleImageError} />
                            <div>
                              <div className="track-title">{song.title}</div>
                              <div className="track-artist">{song.artistName || 'Unknown Artist'}</div>
                            </div>
                          </div>
                        </td>
                        <td>{song.albumName || 'Single'}</td>
                        <td>
                          <span className="track-genre-badge">{song.genre || 'Electronic'}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          {song.playCount?.toLocaleString() || 0}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          {formatTime(song.durationSec || 180)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              className="btn-icon-subtle"
                              title="Add to Playlist"
                              onClick={(e) => { e.stopPropagation(); setAddToPlaylistSong(song); }}
                            >
                              <ListPlus size={16} />
                            </button>
                            <button
                              className={`btn-icon-subtle ${isLiked ? 'liked' : ''}`}
                              title={isLiked ? 'Unlike' : 'Like'}
                              onClick={(e) => { e.stopPropagation(); handleLikeToggle(song); }}
                            >
                              <Heart size={16} fill={isLiked ? '#f43f5e' : 'none'} color={isLiked ? '#f43f5e' : 'currentColor'} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSongs.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No tracks found in this category. Use the Admin Portal to import more from Jamendo!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Featured Albums Grid */}
              <div className="section-header">
                <div className="section-title">
                  <Disc size={20} color="#06b6d4" />
                  <span>Featured Albums</span>
                </div>
              </div>

              <div className="cards-grid">
                {featuredAlbums.map(album => (
                  <div key={album.id} className="music-card">
                    <div className="card-img-wrapper">
                      <img src={album.imageUrl || FALLBACK_COVER} alt={album.name} className="card-img" />
                      <button className="card-play-btn" onClick={() => {
                        const albumSong = trendingList.find(s => s.albumId === album.id);
                        if (albumSong) playSong(albumSong);
                      }}>
                        <Play size={20} fill="white" />
                      </button>
                    </div>
                    <div className="card-title">{album.name}</div>
                    <div className="card-subtitle">{album.artistName || 'Various Artists'}</div>
                  </div>
                ))}
              </div>

              {/* Popular Artists Grid */}
              <div className="section-header">
                <div className="section-title">
                  <UserIcon size={20} color="#a78bfa" />
                  <span>Popular Artists</span>
                </div>
              </div>

              <div className="cards-grid">
                {popularArtists.map(artist => (
                  <div key={artist.id} className="music-card" style={{ textAlign: 'center' }}>
                    <div className="card-img-wrapper" style={{ borderRadius: '50%' }}>
                      <img src={artist.imageUrl || FALLBACK_ARTIST} alt={artist.name} className="card-img" />
                    </div>
                    <div className="card-title">{artist.name}</div>
                    <div className="card-subtitle">Artist</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ================================================================
              VIEW: EXPLORE / SEARCH / BROWSE HUB
              ================================================================ */}
          {activeTab === 'search' && (
            <div>
              {isSearching ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                  <RefreshCw className="eq-bar-2" size={32} color="var(--accent-red)" />
                  <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Searching live music catalog...</p>
                </div>
              ) : (searchResults && searchQuery) ? (
                <div>
                  <button
                    className="browse-back-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                    }}
                  >
                    ← Back to Browse Hub
                  </button>

                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '24px' }}>
                    Search Results for "{searchQuery}"
                  </h2>

                  {(() => {
                    const matchingList = searchResults?.content || searchResults?.songs || (Array.isArray(searchResults) ? searchResults : []);
                    const topResult = matchingList.length > 0 ? matchingList[0] : null;
                    const topFour = matchingList.slice(0, 4);

                    return (
                      <>
                        {/* Spotify-Style Two-Column Top Hero Section */}
                        {topResult && (
                          <div className="search-hero-grid">
                            {/* Top Result Card */}
                            <div>
                              <div className="section-title" style={{ marginBottom: 12, fontSize: '1.2rem' }}>
                                Top Result
                              </div>
                              <div className="top-result-card" onClick={() => playSong(topResult, null, { isSpotifyRadio: true })}>
                                <img
                                  src={topResult.imageUrl || FALLBACK_COVER}
                                  alt={topResult.title}
                                  className="top-art"
                                />
                                <div className="top-title">{topResult.title}</div>
                                <div className="top-subtitle">
                                  <span className="badge-type">Song</span>
                                  <span>{topResult.artistName}</span>
                                </div>
                                <button
                                  className="floating-play-btn"
                                  onClick={(e) => { e.stopPropagation(); playSong(topResult, null, { isSpotifyRadio: true }); }}
                                >
                                  {currentSong?.id === topResult.id && isPlaying ? (
                                    <Pause size={24} fill="#ffffff" color="#ffffff" />
                                  ) : (
                                    <Play size={24} fill="#ffffff" color="#ffffff" style={{ marginLeft: 3 }} />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Top 4 Songs Compact List */}
                            <div>
                              <div className="section-title" style={{ marginBottom: 12, fontSize: '1.2rem' }}>
                                Songs
                              </div>
                              <div className="top-songs-list">
                                {topFour.map((song) => {
                                  const isCur = currentSong?.id === song.id;
                                  const isLiked = likedSongIds.has(song.id);
                                  return (
                                    <div
                                      key={song.id}
                                      className={`top-song-row ${isCur ? 'active' : ''}`}
                                      onClick={() => playSong(song, null, { isSpotifyRadio: true })}
                                    >
                                      <div className="top-song-left">
                                        <img
                                          src={song.imageUrl || FALLBACK_COVER}
                                          alt={song.title}
                                          className="top-song-thumb"
                                          onError={handleImageError}
                                        />
                                        <div className="top-song-info">
                                          <span className="top-song-title" style={{ color: isCur ? 'var(--accent-red)' : '#fff' }}>
                                            {song.title}
                                          </span>
                                          <span className="top-song-artist">{song.artistName}</span>
                                        </div>
                                      </div>
                                      <div className="top-song-right">
                                        <button
                                          className="btn-icon-subtle"
                                          title="Add to Playlist"
                                          onClick={(e) => { e.stopPropagation(); setAddToPlaylistSong(song); }}
                                        >
                                          <ListPlus size={16} />
                                        </button>
                                        <button
                                          className={`btn-icon-subtle ${isLiked ? 'liked' : ''}`}
                                          onClick={(e) => { e.stopPropagation(); handleLikeToggle(song); }}
                                        >
                                          <Heart size={16} fill={isLiked ? '#fa243c' : 'none'} color={isLiked ? '#fa243c' : 'currentColor'} />
                                        </button>
                                        <span>{formatTime(song.durationSec || 210)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* All Matching Tracks Table (30+ items) */}
                        <div className="section-header" style={{ marginTop: 28 }}>
                          <div className="section-title">All Results ({matchingList.length} Tracks)</div>
                        </div>
                        <table className="track-table">
                          <thead>
                            <tr>
                              <th style={{ width: 44 }}>#</th>
                              <th>Title & Artist</th>
                              <th>Album</th>
                              <th>Genre</th>
                              <th style={{ width: 60 }}><Clock size={14} /></th>
                              <th style={{ width: 44 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchingList.map((song, idx) => {
                              const isCur = currentSong?.id === song.id;
                              const isLiked = likedSongIds.has(song.id);
                              return (
                                <tr
                                  key={song.id || idx}
                                  className={`track-row ${isCur ? 'active' : ''}`}
                                  onClick={() => playSong(song, null, { isSpotifyRadio: true })}
                                >
                                  <td className="track-num-cell">
                                    {isCur && isPlaying ? (
                                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: 16 }}>
                                        <div className="eq-bar-1" style={{ width: 3, background: 'var(--accent-red)', borderRadius: 2 }}></div>
                                        <div className="eq-bar-2" style={{ width: 3, background: 'var(--accent-coral)', borderRadius: 2 }}></div>
                                        <div className="eq-bar-3" style={{ width: 3, background: 'var(--accent-red)', borderRadius: 2 }}></div>
                                      </div>
                                    ) : (
                                      idx + 1
                                    )}
                                  </td>
                                  <td>
                                    <div className="track-title-cell">
                                      <img src={song.imageUrl || FALLBACK_COVER} alt={song.title} className="track-thumb" onError={handleImageError} />
                                      <div>
                                        <div className="track-title">{song.title}</div>
                                        <div className="track-artist">{song.artistName}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>{song.albumName || 'Single'}</td>
                                  <td>
                                    <span className="track-genre-badge">{song.genre || 'Hindi'}</span>
                                  </td>
                                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                    {formatTime(song.durationSec || 210)}
                                  </td>
                                  <td onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <button
                                        className="btn-icon-subtle"
                                        title="Add to Playlist"
                                        onClick={(e) => { e.stopPropagation(); setAddToPlaylistSong(song); }}
                                      >
                                        <ListPlus size={16} />
                                      </button>
                                      <button
                                        className={`btn-icon-subtle ${isLiked ? 'liked' : ''}`}
                                        title={isLiked ? 'Unlike' : 'Like'}
                                        onClick={(e) => { e.stopPropagation(); handleLikeToggle(song); }}
                                      >
                                        <Heart size={16} fill={isLiked ? '#fa243c' : 'none'} color={isLiked ? '#fa243c' : 'currentColor'} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {matchingList.length === 0 && (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                  No tracks found for "{searchQuery}". Try another song or artist name.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </>
                    );
                  })()}
                </div>
              ) : (
                /* ==========================================================
                   GAANA & SPOTIFY STYLE BROWSE HUB
                   ========================================================== */
                <div className="browse-hub-container">
                  <div style={{ marginBottom: 28 }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 12px',
                      borderRadius: 20,
                      background: 'rgba(250, 36, 60, 0.12)',
                      border: '1px solid rgba(250, 36, 60, 0.3)',
                      color: 'var(--accent-red)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      marginBottom: 10,
                      textTransform: 'uppercase'
                    }}>
                      <Compass size={14} />
                      <span>Gaana & Spotify Browse Hub</span>
                    </div>
                    <h1 style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff', marginBottom: 8 }}>
                      Browse Catalog & Era Stations
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 720 }}>
                      Tune into musical eras, legendary decades, and mood stations. Voxa streams authentic high-fidelity songs and dynamically queues similar-era tracks continuously without hardcoding.
                    </p>
                  </div>

                  {/* Section 1: Musical Eras & Decades */}
                  <div className="section-header" style={{ marginTop: 10, marginBottom: 18 }}>
                    <div className="section-title">
                      <Flame size={20} color="var(--accent-red)" />
                      <span>Explore By Musical Era & Generation</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Strict Era Matching • Dynamic Catalog</span>
                  </div>

                  <div className="browse-era-grid">
                    {BROWSE_ERAS.map(era => (
                      <div
                        key={era.id}
                        className={`browse-era-card ${era.id}`}
                        onClick={() => executeSearch(era.query)}
                      >
                        <div className="browse-era-badge">{era.badge}</div>
                        <div className="browse-era-title">{era.title}</div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 4 }}>
                          {era.subtitle}
                        </div>
                        <div className="browse-era-desc">{era.desc}</div>
                        <div className="browse-era-cta">
                          <Play size={13} fill="#ffffff" />
                          <span>Tune into Station</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Section 2: Moods & Situations */}
                  <div className="section-header" style={{ marginTop: 36, marginBottom: 18 }}>
                    <div className="section-title">
                      <Sparkles size={20} color="var(--accent-purple)" />
                      <span>Moods & Situations</span>
                    </div>
                  </div>

                  <div className="browse-mood-grid">
                    {BROWSE_MOODS.map(mood => (
                      <div
                        key={mood.title}
                        className="browse-mood-card"
                        style={{
                          background: `linear-gradient(135deg, ${mood.color}dd 0%, rgba(20, 20, 25, 0.95) 100%)`
                        }}
                        onClick={() => executeSearch(mood.query)}
                      >
                        <div style={{ fontSize: '1.6rem' }}>{mood.emoji}</div>
                        <div>
                          <div className="browse-mood-title">{mood.title}</div>
                          <div className="browse-mood-sub">Continuous Radio • Tap to Play</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              VIEW: LIKED SONGS
              ================================================================ */}
          {activeTab === 'liked' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
                <div style={{
                  width: 140,
                  height: 140,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--gradient-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 12px 36px rgba(255, 42, 81, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <Heart size={64} color="#fff" fill="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-neon)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
                    Curated Collection
                  </div>
                  <h1 style={{ fontSize: '2.8rem', fontWeight: 900, margin: '6px 0', letterSpacing: '-0.025em' }}>Liked Songs</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {currentUser?.name} • {likedSongsList.length} tracks
                  </p>
                </div>
              </div>

              <table className="track-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Title & Artist</th>
                    <th>Album</th>
                    <th style={{ width: 60 }}><Clock size={14} /></th>
                    <th style={{ width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {likedSongsList.map((song, idx) => (
                    <tr key={song.id || idx} className="track-row" onClick={() => playSong(song, likedSongsList)}>
                      <td className="track-num-cell">{idx + 1}</td>
                      <td>
                        <div className="track-title-cell">
                          <img src={song.imageUrl || FALLBACK_COVER} alt={song.title} className="track-thumb" />
                          <div>
                            <div className="track-title">{song.title}</div>
                            <div className="track-artist">{song.artistName}</div>
                          </div>
                        </div>
                      </td>
                      <td>{song.albumName || 'Single'}</td>
                      <td>{formatTime(song.durationSec || 180)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            className="btn-icon-subtle"
                            title="Add to Playlist"
                            onClick={(e) => { e.stopPropagation(); setAddToPlaylistSong(song); }}
                          >
                            <ListPlus size={16} />
                          </button>
                          <button
                            className="btn-icon-subtle liked"
                            title="Unlike"
                            onClick={(e) => { e.stopPropagation(); handleLikeToggle(song); }}
                          >
                            <Heart size={16} fill="#f43f5e" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {likedSongsList.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No liked songs yet. Click the heart icon on any track to add it here!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================================================
              VIEW: YOUR LIBRARY & PLAYLISTS
              ================================================================ */}
          {activeTab === 'library' && (
            <div>
              {selectedPlaylist ? (
                /* Detail View for Selected Playlist (Clean & Compact without oversized picture) */
                <div className="playlist-detail-view">
                  <div className="playlist-clean-header">
                    <div className="playlist-header-left">
                      <button
                        className="btn-back-link"
                        onClick={() => setSelectedPlaylist(null)}
                      >
                        ← Back to All Playlists
                      </button>
                      <div className="playlist-header-title-row">
                        <div className="playlist-icon-badge">
                          <Library size={24} color="#f43f5e" />
                        </div>
                        <div>
                          <h1 className="playlist-clean-title">{selectedPlaylist.title || selectedPlaylist.name}</h1>
                          <div className="playlist-clean-meta">
                            <span>{currentUser?.name || 'You'}</span>
                            <span>•</span>
                            <span>{selectedPlaylist.songs?.length || 0} tracks</span>
                            <span>•</span>
                            <span className="playlist-privacy-pill">{selectedPlaylist.isPublic ? 'Public' : 'Private Vault'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="playlist-header-actions">
                      {selectedPlaylist.songs && selectedPlaylist.songs.length > 0 && (
                        <button
                          className="btn-primary"
                          onClick={() => playSong(selectedPlaylist.songs[0], selectedPlaylist.songs, { isExplicitPlaylist: true })}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}
                        >
                          <Play size={17} fill="white" />
                          <span>Play All</span>
                        </button>
                      )}
                      <button
                        className="btn-danger-outline"
                        onClick={() => handleDeletePlaylist(selectedPlaylist.id, selectedPlaylist.title || selectedPlaylist.name)}
                        title="Delete this playlist"
                      >
                        <Trash2 size={16} />
                        <span>Delete Playlist</span>
                      </button>
                    </div>
                  </div>

                  {/* Playlist Songs Table - Identical to Trending Songs Table (Screenshot 2) */}
                  <div className="section-header" style={{ marginTop: 24 }}>
                    <div className="section-title">Tracks ({selectedPlaylist.songs?.length || 0})</div>
                  </div>

                  {selectedPlaylist.songs && selectedPlaylist.songs.length > 0 ? (
                    <table className="track-table">
                      <thead>
                        <tr>
                          <th style={{ width: 44 }}>#</th>
                          <th>Title & Artist</th>
                          <th>Album</th>
                          <th>Genre</th>
                          <th>Plays</th>
                          <th style={{ width: 60 }}><Clock size={14} /></th>
                          <th style={{ width: 64 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPlaylist.songs.map((song, idx) => {
                          const isCur = currentSong?.id === song.id;
                          const isLiked = likedSongIds.has(song.id);
                          return (
                            <tr
                              key={song.id || idx}
                              className={`track-row ${isCur ? 'active' : ''}`}
                              onClick={() => playSong(song, selectedPlaylist.songs, { isExplicitPlaylist: true })}
                              style={{ cursor: 'pointer' }}
                              title="Click to play"
                            >
                              <td className="track-num-cell">
                                {isCur && isPlaying ? (
                                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: 16 }}>
                                    <div className="eq-bar-1" style={{ width: 3, background: 'var(--accent-cyan)', borderRadius: 2 }}></div>
                                    <div className="eq-bar-2" style={{ width: 3, background: 'var(--accent-purple)', borderRadius: 2 }}></div>
                                    <div className="eq-bar-3" style={{ width: 3, background: 'var(--accent-cyan)', borderRadius: 2 }}></div>
                                  </div>
                                ) : (
                                  idx + 1
                                )}
                              </td>
                              <td>
                                <div className="track-title-cell">
                                  <img
                                    src={song.imageUrl || FALLBACK_COVER}
                                    alt={song.title}
                                    className="track-thumb"
                                    onError={handleImageError}
                                  />
                                  <div>
                                    <div className="track-title">{song.title}</div>
                                    <div className="track-artist">{song.artistName || 'Unknown Artist'}</div>
                                  </div>
                                </div>
                              </td>
                              <td>{song.albumName || 'Single'}</td>
                              <td>
                                <span className="track-genre-badge">{song.genre || 'Hindi'}</span>
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                {(song.playCount || 100000).toLocaleString()}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                {formatTime(song.durationSec || 210)}
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    className={`btn-icon-subtle ${isLiked ? 'liked' : ''}`}
                                    title={isLiked ? 'Unlike' : 'Like'}
                                    onClick={(e) => { e.stopPropagation(); handleLikeToggle(song); }}
                                  >
                                    <Heart size={16} fill={isLiked ? '#f43f5e' : 'none'} color={isLiked ? '#f43f5e' : 'currentColor'} />
                                  </button>
                                  <button
                                    className="btn-icon-subtle btn-remove-track"
                                    title="Remove track from playlist"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveSongFromPlaylist(selectedPlaylist.id, song.id, song.title);
                                    }}
                                  >
                                    <Trash2 size={16} color="#f43f5e" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="playlist-empty-state">
                      <Music size={48} color="rgba(255,255,255,0.2)" />
                      <h3>No songs in this playlist yet</h3>
                      <p>Search for songs or browse trending hits, then click the "+" button to add them here!</p>
                      <button className="btn-primary" onClick={() => setActiveTab('search')}>
                        Search Songs
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* All Playlists Grid */
                <div>
                  <div className="section-header">
                    <div>
                      <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Your Playlists</h1>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
                        {playlists.length} custom playlists in your music vault
                      </p>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => setShowPlaylistModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Plus size={16} />
                      <span>Create Playlist</span>
                    </button>
                  </div>

                  <div className="cards-grid">
                    {playlists.map(pl => (
                      <div
                        key={pl.id}
                        className="music-card playlist-card-interactive"
                        onClick={() => setSelectedPlaylist(pl)}
                        title="Click to open playlist"
                      >
                        <div className="card-img-wrapper" style={{
                          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}>
                          {pl.songs && pl.songs[0]?.imageUrl ? (
                            <img
                              src={pl.songs[0].imageUrl}
                              alt={pl.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={handleImageError}
                            />
                          ) : (
                            <Music size={44} color="#a78bfa" />
                          )}

                          {/* Instant Card Delete Button */}
                          <button
                            className="card-quick-delete-btn"
                            title="Delete Playlist"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(pl.id, pl.title || pl.name);
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="card-title">{pl.title || pl.name}</div>
                        <div className="card-subtitle">
                          {pl.songs?.length || pl.songCount || 0} songs • {pl.isPublic ? 'Public' : 'Private'}
                        </div>
                      </div>
                    ))}
                    {playlists.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <FolderPlus size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                        <h3 style={{ color: '#fff', marginBottom: 8 }}>No playlists created yet</h3>
                        <p style={{ marginBottom: 20 }}>Create your first custom playlist to save your favorite songs!</p>
                        <button className="btn-primary" onClick={() => setShowPlaylistModal(true)}>
                          Create Playlist
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              VIEW: PLAY HISTORY
              ================================================================ */}
          {activeTab === 'history' && (
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px' }}>Listening History</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Tracks automatically recorded after listening for 30 seconds or more.
              </p>

              <table className="track-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Track</th>
                    <th>Artist</th>
                    <th>Listened At</th>
                  </tr>
                </thead>
                <tbody>
                  {playHistoryList.map((item, idx) => (
                    <tr key={item.id} className="track-row" onClick={() => item.song && playSong(item.song)}>
                      <td className="track-num-cell">{idx + 1}</td>
                      <td>
                        <div className="track-title-cell">
                          <img src={item.song?.imageUrl || FALLBACK_COVER} alt={item.song?.title} className="track-thumb" />
                          <div className="track-title">{item.song?.title}</div>
                        </div>
                      </td>
                      <td>{item.song?.artistName}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {item.playedAt ? new Date(item.playedAt).toLocaleString() : 'Recently'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================================================
              VIEW: ADMIN PORTAL & JAMENDO IMPORTER
              ================================================================ */}
          {activeTab === 'admin' && currentUser?.role === 'ROLE_ADMIN' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Shield size={28} color="#f43f5e" />
                <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Admin Master Portal</h1>
              </div>

              {/* Stats Overview */}
              <div className="admin-stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Songs</div>
                  <div className="stat-value">{adminStats?.totalSongs || trendingList.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Artists</div>
                  <div className="stat-value">{adminStats?.totalArtists || popularArtists.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Albums</div>
                  <div className="stat-value">{adminStats?.totalAlbums || featuredAlbums.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Plays</div>
                  <div className="stat-value">{adminStats?.totalPlays || 1500}</div>
                </div>
              </div>

              {/* Jamendo Remote Importer Form */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-focus)',
                borderRadius: 'var(--radius-xl)',
                padding: '28px',
                marginBottom: '32px'
              }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
                  Jamendo Legal API Track Importer
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Sync high-fidelity tracks directly into your PostgreSQL database with full artist, album, and stream URLs.
                </p>

                <form onSubmit={handleTriggerImport} style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label className="form-label">Music Tag / Genre</label>
                    <input
                      type="text"
                      className="form-input"
                      value={importTag}
                      onChange={(e) => setImportTag(e.target.value)}
                      placeholder="e.g. synthwave, rock, ambient, jazz"
                      style={{ width: '220px' }}
                    />
                  </div>

                  <div>
                    <label className="form-label">Number of Tracks</label>
                    <select
                      className="form-input"
                      value={importLimit}
                      onChange={(e) => setImportLimit(Number(e.target.value))}
                      style={{ width: '120px' }}
                    >
                      <option value={5}>5 tracks</option>
                      <option value={10}>10 tracks</option>
                      <option value={20}>20 tracks</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={importLoading}
                    style={{ height: '44px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {importLoading ? <RefreshCw className="eq-bar-2" size={16} /> : <Sparkles size={16} />}
                    <span>{importLoading ? 'Importing from Jamendo...' : 'Import to Catalog'}</span>
                  </button>
                </form>

                {importFeedback && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: importFeedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${importFeedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
                    color: '#fff',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    {importFeedback.type === 'success' ? <CheckCircle size={18} color="#22c55e" /> : <AlertCircle size={18} color="#ef4444" />}
                    <span>{importFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* Import History Table */}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Recent Import Jobs</h3>
              <table className="track-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Tag</th>
                    <th>Imported</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {importJobs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                        No import jobs recorded yet. Use the form above to trigger a Jamendo sync!
                      </td>
                    </tr>
                  ) : (
                    importJobs.map(job => (
                      <tr key={job.jobId || job.id} className="track-row">
                        <td style={{ fontFamily: 'var(--font-mono)' }}>#{job.jobId || job.id}</td>
                        <td><strong>{job.tag || (job.requested ? `${job.requested} tracks` : 'Jamendo Sync')}</strong></td>
                        <td>{job.imported ?? job.importedCount ?? 0} songs</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: job.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                            color: job.status === 'COMPLETED' ? '#22c55e' : '#eab308'
                          }}>
                            {job.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {job.startedAt || job.createdAt ? new Date(job.startedAt || job.createdAt).toLocaleString() : 'Just now'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================================================
              VIEW: UP NEXT QUEUE (DEDICATED FULL VIEW)
              ================================================================ */}
          {activeTab === 'queue' && (
            <div className="queue-view-container">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
                    Up Next Queue
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Continuous Intelligent Era Autoplay • {playbackQueue.length} songs queued
                  </p>
                </div>
                {activeVibe && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(250, 36, 60, 0.2) 0%, rgba(255, 55, 95, 0.1) 100%)',
                    border: '1px solid rgba(250, 36, 60, 0.35)',
                    color: '#ff375f',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    <Sparkles size={16} />
                    <span>Era Mode: {activeVibe.label}</span>
                  </div>
                )}
              </div>

              {/* Currently Playing Card */}
              {currentSong ? (
                <div className="queue-hero-card">
                  <img
                    src={currentSong.imageUrl || FALLBACK_COVER}
                    alt={currentSong.title}
                    className="queue-hero-art"
                  />
                  <div className="queue-hero-meta">
                    <div className="queue-hero-now-playing">
                      <div className="eq-bar-1" style={{ width: 3, height: 12, background: 'var(--accent-red)' }}></div>
                      <div className="eq-bar-2" style={{ width: 3, height: 16, background: 'var(--accent-coral)' }}></div>
                      <div className="eq-bar-3" style={{ width: 3, height: 10, background: 'var(--accent-red)' }}></div>
                      <span>NOW PLAYING</span>
                    </div>
                    <div className="queue-hero-title">{currentSong.title}</div>
                    <div className="queue-hero-artist">{currentSong.artistName} • {currentSong.albumName || 'Single'}</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <button
                        className="btn-primary"
                        style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={handleTogglePlay}
                      >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        <span>{isPlaying ? 'Pause' : 'Resume'}</span>
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={handleNextSong}
                      >
                        <SkipForward size={16} />
                        <span>Skip to Next</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '40px',
                  borderRadius: '16px',
                  background: 'var(--bg-surface)',
                  textAlign: 'center',
                  marginBottom: '28px'
                }}>
                  <Music size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>No Track Currently Playing</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Play any song from Discover, Search, or Library to start the continuous era queue.
                  </p>
                </div>
              )}

              {/* Up Next List */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff' }}>
                  Up Next ({Math.max(0, playbackQueue.length - queueIndex - 1)})
                </h2>
                {currentSong && (
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => preloadSimilarEraSongs(currentSong, playbackQueue)}
                  >
                    <RefreshCw size={14} />
                    <span>Load More Era Tracks</span>
                  </button>
                )}
              </div>

              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: '16px',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden'
              }}>
                <table className="track-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th>Title</th>
                      <th>Artist</th>
                      <th>Album</th>
                      <th>Era / Vibe</th>
                      <th style={{ textAlign: 'right' }}><Clock size={14} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {playbackQueue.map((song, idx) => {
                      const isCurrent = idx === queueIndex;
                      return (
                        <tr
                          key={song.id || idx}
                          className={`track-row ${isCurrent ? 'active' : ''}`}
                          onClick={() => {
                            setQueueIndex(idx);
                            playTrackDirect(song);
                          }}
                          style={{
                            opacity: idx < queueIndex ? 0.45 : 1,
                            cursor: 'pointer'
                          }}
                        >
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                            {isCurrent && isPlaying ? (
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
                                <div className="eq-bar-1" style={{ width: 2, background: 'var(--accent-red)', borderRadius: 1 }}></div>
                                <div className="eq-bar-2" style={{ width: 2, background: 'var(--accent-coral)', borderRadius: 1 }}></div>
                                <div className="eq-bar-3" style={{ width: 2, background: 'var(--accent-red)', borderRadius: 1 }}></div>
                              </div>
                            ) : (
                              idx + 1
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <img
                                src={song.imageUrl || FALLBACK_COVER}
                                alt={song.title}
                                style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }}
                              />
                              <div>
                                <div style={{
                                  fontWeight: 600,
                                  color: isCurrent ? 'var(--accent-red)' : '#ffffff',
                                  fontSize: '0.9rem'
                                }}>
                                  {song.title}
                                </div>
                                {isCurrent && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-red)', fontWeight: 700 }}>
                                    NOW PLAYING
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{song.artistName}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{song.albumName || 'Single'}</td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              fontSize: '0.72rem',
                              color: 'var(--text-secondary)'
                            }}>
                              {song.vibeBadge || '🎵 Smart Match'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {formatTime(song.durationSec || 215)}
                          </td>
                        </tr>
                      );
                    })}
                    {playbackQueue.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          Your playback queue is empty. Click any song to start playing!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ====================================================================
          PERSISTENT BOTTOM AUDIO PLAYER
          ==================================================================== */}
      <footer className="bottom-player">
        {/* Live Synchronized Karaoke Lyric Line Ribbon (Plays live with the song) */}
        {isPlaying && currentLyrics && currentLyrics[activeLyricIndex] && (
          <div
            className="player-live-karaoke-ribbon"
            onClick={() => setShowLyricsModal(true)}
            title="Click to view full synchronized lyrics"
          >
            <div className="karaoke-mini-bars">
              <span className="eq-bar bar1"></span>
              <span className="eq-bar bar2"></span>
              <span className="eq-bar bar3"></span>
            </div>
            <span className="live-karaoke-text">
              {currentLyrics[activeLyricIndex].text}
            </span>
            <span className="live-karaoke-tag">LYRICS ↗</span>
          </div>
        )}

        {/* Track Metadata (Left) */}
        <div className="player-left">
          {currentSong ? (
            <>
              <img
                src={currentSong.imageUrl || FALLBACK_COVER}
                alt={currentSong.title}
                className="player-thumb"
                onError={handleImageError}
                onClick={() => setShowFullscreenPlayer(true)}
                title="Tap to view fullscreen player"
                style={{ cursor: 'pointer' }}
              />
              <div
                className="player-meta"
                onClick={() => setShowFullscreenPlayer(true)}
                title="Tap to view fullscreen player"
                style={{ cursor: 'pointer' }}
              >
                <div className="player-title">{currentSong.title}</div>
                <div className="player-artist">
                  <span>{currentSong.artistName || 'Unknown Artist'}</span>
                  {isPlaying && currentLyrics && currentLyrics[activeLyricIndex] && (
                    <span className="player-artist-singing-preview">
                      &nbsp;•&nbsp;<span className="singing-line-highlight">"{currentLyrics[activeLyricIndex].text}"</span>
                    </span>
                  )}
                </div>
              </div>
              <button
                className={`btn-icon-subtle ${likedSongIds.has(currentSong.id) ? 'liked' : ''}`}
                onClick={() => handleLikeToggle(currentSong)}
                title={likedSongIds.has(currentSong.id) ? 'Unlike' : 'Like'}
              >
                <Heart size={18} fill={likedSongIds.has(currentSong.id) ? '#f43f5e' : 'none'} />
              </button>
              <button
                className="btn-icon-subtle"
                onClick={() => setAddToPlaylistSong(currentSong)}
                title="Add to Playlist"
              >
                <ListPlus size={18} />
              </button>
            </>
          ) : (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Select any song to play
            </div>
          )}
        </div>

        {/* Transport Controls (Center) */}
        <div className="player-center">
          <div className="player-controls">
            <button
              className={`control-btn ${isShuffle ? 'active' : ''}`}
              onClick={() => setIsShuffle(!isShuffle)}
              title="Shuffle"
            >
              <Shuffle size={17} />
            </button>
            <button className="control-btn" onClick={handlePrevSong} title="Previous">
              <SkipBack size={20} />
            </button>
            <button className="play-pause-btn" onClick={handleTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" style={{ marginLeft: 2 }} />}
            </button>
            <button className="control-btn" onClick={handleNextSong} title="Next">
              <SkipForward size={20} />
            </button>
            <button
              className={`control-btn ${isRepeat ? 'active' : ''}`}
              onClick={() => setIsRepeat(!isRepeat)}
              title="Repeat"
            >
              <Repeat size={17} />
            </button>
          </div>

          <div className="player-timeline">
            <span className="timeline-time">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="timeline-slider"
            />
            <span className="timeline-time">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume & Extras (Right) */}
        <div className="player-right">
          {/* Smart Era Vibe Badge */}
          {activeVibe && (
            <div
              className="vibe-indicator-badge"
              title={`Voxa Smart Radio: ${activeVibe.label}. Playing similar generation songs continuously. Click to view Up Next.`}
              onClick={() => setShowQueueDrawer(!showQueueDrawer)}
            >
              <Sparkles size={13} className="sparkle-spin" />
              <span>{activeVibe.badge}</span>
            </div>
          )}

          {/* Synchronized Live Lyrics Button */}
          <button
            className={`queue-action-pill lyrics-pill ${showLyricsModal ? 'active' : ''}`}
            onClick={() => setShowLyricsModal(!showLyricsModal)}
            title="Live Synchronized Lyrics"
          >
            <FileText size={15} />
            <span>Lyrics</span>
          </button>

          {/* Up Next Queue Toggle Button */}
          <button
            className={`queue-action-pill ${showQueueDrawer || activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setShowQueueDrawer(!showQueueDrawer)}
            title="Up Next / Era Radio Queue"
          >
            <ListMusic size={15} />
            <span>Queue</span>
            {playbackQueue.length > 0 && (
              <span className="queue-count-pill">{playbackQueue.length}</span>
            )}
          </button>

          <div
            className="audio-quality-badge"
            title={isPreloaded ? 'Next queue song is pre-buffered in memory (0ms Gapless Playback)' : 'Lossless 320 kbps Streaming'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isPreloaded ? 'var(--accent-cyan)' : 'var(--accent-neon)',
                boxShadow: isPreloaded ? '0 0 8px var(--accent-cyan)' : '0 0 8px var(--accent-neon)'
              }}
            />
            <span>{isPreloaded ? 'Zero-Lag • 320k' : 'Lossless • 320k'}</span>
          </div>
          <button className="control-btn" onClick={() => setIsMuted(!isMuted)}>
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              setIsMuted(false);
            }}
            className="volume-slider"
          />
          <button
            className="control-btn expand-sheet-btn"
            onClick={() => setShowFullscreenPlayer(true)}
            title="Fullscreen Player Sheet"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </footer>

      {/* ====================================================================
          DRAWER: UP NEXT / SMART ERA RADIO QUEUE
          ==================================================================== */}
      {showQueueDrawer && (
        <div className="queue-drawer-backdrop" onClick={() => setShowQueueDrawer(false)}>
          <div className="queue-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="queue-header">
              <div className="queue-title">
                <ListMusic size={22} color="var(--accent-red)" />
                <span>Up Next Queue</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px', height: '28px', borderRadius: '14px' }}
                  onClick={() => {
                    setActiveTab('queue');
                    setShowQueueDrawer(false);
                  }}
                >
                  Full View
                </button>
                <button className="queue-close-btn" onClick={() => setShowQueueDrawer(false)}>✕</button>
              </div>
            </div>

            {/* Smart Era Vibe Banner */}
            <div className="queue-vibe-banner">
              <div className="queue-vibe-title">
                <Sparkles size={14} />
                <span>Voxa Era Radio: {activeVibe?.label || 'Continuous Radio'}</span>
              </div>
              <div className="queue-vibe-desc">
                When this song ends, Voxa automatically plays similar songs in this exact musical era until you switch tracks.
              </div>
            </div>

            {/* Queue List */}
            <div className="queue-list">
              {playbackQueue.map((song, idx) => {
                const isCurrent = idx === queueIndex;
                return (
                  <div
                    key={song.id || idx}
                    className={`queue-item ${isCurrent ? 'active' : ''}`}
                    onClick={() => {
                      setQueueIndex(idx);
                      playTrackDirect(song);
                    }}
                  >
                    <div className="queue-item-left">
                      <img src={song.imageUrl || FALLBACK_COVER} alt={song.title} className="queue-item-thumb" />
                      <div className="queue-item-info">
                        <span className="queue-item-title" style={{ color: isCurrent ? 'var(--accent-red)' : '#ffffff' }}>
                          {song.title}
                        </span>
                        <span className="queue-item-artist">{song.artistName}</span>
                      </div>
                    </div>
                    <div className="queue-item-time">
                      {isCurrent && isPlaying ? (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
                          <div className="eq-bar-1" style={{ width: 2, background: 'var(--accent-red)', borderRadius: 1 }}></div>
                          <div className="eq-bar-2" style={{ width: 2, background: 'var(--accent-coral)', borderRadius: 1 }}></div>
                          <div className="eq-bar-3" style={{ width: 2, background: 'var(--accent-red)', borderRadius: 1 }}></div>
                        </div>
                      ) : (
                        formatTime(song.durationSec || 210)
                      )}
                    </div>
                  </div>
                );
              })}
              {playbackQueue.length === 0 && (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Queue is empty. Play any song to activate the intelligent era queue!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: LOGIN / REGISTER (Apple Music Style with Google Sign-In)
          ==================================================================== */}
      {showAuthModal && (
        <div className="modal-backdrop" onClick={() => setShowAuthModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {authMode === 'verify-otp' ? 'Email Verification' : authMode === 'login' ? 'Sign In to Voxa' : 'Create Voxa Account'}
              </div>
              <button className="modal-close-btn" onClick={() => setShowAuthModal(false)}>✕</button>
            </div>

            {authMode === 'verify-otp' ? (
              <div>
                {/* Amazon-style White Logo Header Box */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
                  <div style={{
                    background: '#ffffff',
                    padding: '8px 24px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    <span style={{
                      fontSize: '28px',
                      fontWeight: 900,
                      color: '#0d0f17',
                      letterSpacing: '-0.8px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      voxa<span style={{ color: '#ff2a51' }}>.</span>
                    </span>
                  </div>
                </div>

                <h2 style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  textAlign: 'center',
                  margin: '0 0 10px 0',
                  letterSpacing: '-0.02em'
                }}>
                  Verify your new Voxa account
                </h2>

                <p style={{
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                  textAlign: 'center',
                  margin: '0 0 20px 0'
                }}>
                  To verify your email address, please use the One Time Password (OTP) sent to:<br />
                  <strong style={{ color: '#ffffff' }}>{authForm.email}</strong>{' '}
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-red)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline'
                    }}
                    onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccessMsg(''); }}
                  >
                    (Change)
                  </button>
                </p>

                {authSuccessMsg && (
                  <div style={{
                    background: 'rgba(34, 197, 94, 0.14)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: '#4ade80',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '16px',
                    fontSize: '0.84rem',
                    textAlign: 'center'
                  }}>
                    {authSuccessMsg}
                  </div>
                )}

                {authError && (
                  <div style={{
                    background: 'rgba(250, 36, 60, 0.16)',
                    border: '1px solid rgba(250, 36, 60, 0.45)',
                    color: '#ffffff',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '16px',
                    fontSize: '0.84rem'
                  }}>
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit}>
                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                      Enter 6-Digit OTP
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      required
                      className="form-input"
                      style={{
                        fontSize: '1.8rem',
                        fontWeight: 800,
                        letterSpacing: '10px',
                        textAlign: 'center',
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '2px solid rgba(255, 42, 81, 0.45)',
                        color: '#ffffff'
                      }}
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isAuthLoading || otpCode.length !== 6}
                    style={{
                      width: '100%',
                      padding: '13px',
                      marginTop: '12px',
                      fontSize: '0.96rem',
                      fontWeight: 700,
                      opacity: (isAuthLoading || otpCode.length !== 6) ? 0.6 : 1
                    }}
                  >
                    {isAuthLoading ? 'Verifying OTP & Creating Account...' : 'Create your Voxa account'}
                  </button>
                </form>

                <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Didn't receive the email?{' '}
                  {resendCooldown > 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>Resend code in {resendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-red)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                      onClick={() => handleSendOtp()}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                {/* Security notice matching Amazon screenshot verbatim */}
                <div style={{
                  marginTop: '22px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '0.76rem',
                  color: '#94a3b8',
                  lineHeight: '1.5'
                }}>
                  Don't share this OTP with anyone. Voxa takes your account security very seriously. Voxa Customer Service will never ask you to disclose or verify your Voxa password, OTP, credit card, or banking account number.
                </div>
              </div>
            ) : (
              <>
                {/* Mode Tabs Switcher */}
                <div className="modal-tabs">
                  <button
                    type="button"
                    className={`modal-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                    onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccessMsg(''); }}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    className={`modal-tab-btn ${authMode === 'register' ? 'active' : ''}`}
                    onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccessMsg(''); }}
                  >
                    Create Account
                  </button>
                </div>

                {/* Google One-Click Sign In */}
                <button
                  type="button"
                  className="google-auth-btn"
                  onClick={handleGoogleLogin}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="auth-divider">or with email</div>

                {authSuccessMsg && (
                  <div style={{
                    background: 'rgba(34, 197, 94, 0.14)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: '#4ade80',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '16px',
                    fontSize: '0.84rem'
                  }}>
                    {authSuccessMsg}
                  </div>
                )}

                {authError && (
                  <div style={{
                    background: 'rgba(250, 36, 60, 0.16)',
                    border: '1px solid rgba(250, 36, 60, 0.45)',
                    color: '#ffffff',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '16px',
                    fontSize: '0.84rem'
                  }}>
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit}>
                  {authMode === 'register' && (
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="Vishal Kumar"
                        value={authForm.name}
                        onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      placeholder="vishal@gmail.com"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="At least 6 characters"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isAuthLoading}
                    style={{ width: '100%', padding: '12px', marginTop: '8px', fontWeight: 700 }}
                  >
                    {isAuthLoading
                      ? (authMode === 'login' ? 'Signing in...' : 'Sending OTP...')
                      : (authMode === 'login' ? 'Sign In to Voxa' : 'Verify email')}
                  </button>
                </form>

                <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  {authMode === 'login' ? (
                    <>
                      Don't have a Voxa account?{' '}
                      <span
                        style={{ color: 'var(--accent-red)', fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccessMsg(''); }}
                      >
                        Sign up free
                      </span>
                    </>
                  ) : (
                    <>
                      Already registered?{' '}
                      <span
                        style={{ color: 'var(--accent-red)', fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccessMsg(''); }}
                      >
                        Log in here
                      </span>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Quick 1-Click Fast Logins for Testing */}
            <div style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '10px' }}>
                QUICK EVALUATION LOGINS
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="demo-account-pill"
                  onClick={() => handleDemoLogin('user@musicapp.com', 'user123')}
                >
                  User Demo
                </button>
                <button
                  type="button"
                  className="demo-account-pill"
                  style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: '#f43f5e' }}
                  onClick={() => handleDemoLogin('admin@musicapp.com', 'admin123')}
                >
                  Admin Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CREATE PLAYLIST
          ==================================================================== */}
      {showPlaylistModal && (
        <div className="modal-backdrop" onClick={() => setShowPlaylistModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create New Playlist</div>
              <button className="modal-close-btn" onClick={() => setShowPlaylistModal(false)}>✕</button>
            </div>

            {playlistModalError && (
              <div style={{
                background: 'rgba(250, 36, 60, 0.16)',
                border: '1px solid rgba(250, 36, 60, 0.45)',
                color: '#ffffff',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
                fontSize: '0.84rem'
              }}>
                {playlistModalError}
              </div>
            )}

            <form onSubmit={handleCreatePlaylist}>
              <div className="form-group">
                <label className="form-label">Playlist Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Midnight Driving Beats"
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Relaxing high-energy tunes for coding"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: '10px' }}>
                Create Playlist
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: ADD SONG TO PLAYLIST
          ==================================================================== */}
      {addToPlaylistSong && (
        <div className="modal-backdrop" onClick={() => setAddToPlaylistSong(null)}>
          <div className="modal-card add-to-playlist-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ListPlus size={20} color="var(--accent-red)" />
                <span>Add to Playlist</span>
              </div>
              <button className="modal-close-btn" onClick={() => setAddToPlaylistSong(null)}>✕</button>
            </div>

            {/* Song Preview Banner */}
            <div className="add-song-preview-box">
              <img
                src={addToPlaylistSong.imageUrl || FALLBACK_COVER}
                alt={addToPlaylistSong.title}
                className="add-song-thumb"
                onError={handleImageError}
              />
              <div className="add-song-info">
                <div className="add-song-title">{addToPlaylistSong.title}</div>
                <div className="add-song-artist">{addToPlaylistSong.artistName || 'Unknown Artist'}</div>
              </div>
            </div>

            {/* Existing Playlists Picker List */}
            <div className="playlist-picker-header">
              <span>Select a Playlist ({playlists.length})</span>
            </div>

            <div className="playlist-picker-list">
              {playlists.map(pl => {
                const isAlreadyIn = (pl.songs || []).some(
                  s => s.id === addToPlaylistSong.id || (s.title && addToPlaylistSong.title && s.title.toLowerCase() === addToPlaylistSong.title.toLowerCase())
                );
                return (
                  <div key={pl.id} className="playlist-picker-item">
                    <div className="playlist-picker-item-left">
                      <div className="playlist-mini-icon">
                        <Music size={16} color="#a78bfa" />
                      </div>
                      <div className="playlist-picker-meta">
                        <div className="playlist-picker-name">{pl.title || pl.name}</div>
                        <div className="playlist-picker-sub">
                          {pl.songs?.length || pl.songCount || 0} songs • {pl.isPublic ? 'Public' : 'Private'}
                        </div>
                      </div>
                    </div>
                    {isAlreadyIn ? (
                      <span className="playlist-added-badge">
                        <CheckCircle size={14} /> Added
                      </span>
                    ) : (
                      <button
                        className="btn-primary-sm"
                        onClick={() => handleAddSongToPlaylist(pl.id, addToPlaylistSong)}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                );
              })}

              {playlists.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No playlists created yet. Create one below!
                </div>
              )}
            </div>

            {/* Quick New Playlist Inline Form */}
            <div className="playlist-quick-create-section">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                OR CREATE NEW PLAYLIST:
              </div>
              <div className="playlist-quick-input-row">
                <input
                  type="text"
                  placeholder="New playlist name..."
                  value={quickPlaylistTitle}
                  onChange={(e) => setQuickPlaylistTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickCreateAndAdd(addToPlaylistSong);
                    }
                  }}
                  className="quick-playlist-input"
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleQuickCreateAndAdd(addToPlaylistSong)}
                  disabled={!quickPlaylistTitle.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', padding: '9px 16px', fontSize: '0.85rem' }}
                >
                  <FolderPlus size={16} />
                  <span>Create & Add</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MOBILE BOTTOM NAVIGATION (Spotify Mobile Layout)
          ==================================================================== */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-item ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          <Home size={20} />
          <span>Home</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('search');
            setSearchQuery('');
            setSearchResults(null);
          }}
        >
          <Compass size={20} />
          <span>Browse</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => {
            if (!currentUser) setShowAuthModal(true);
            else setActiveTab('library');
          }}
        >
          <Library size={20} />
          <span>Library</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === 'liked' ? 'active' : ''}`}
          onClick={() => {
            if (!currentUser) setShowAuthModal(true);
            else setActiveTab('liked');
          }}
        >
          <Heart size={20} fill={activeTab === 'liked' ? 'var(--accent-red)' : 'none'} />
          <span>Liked</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <ListMusic size={20} />
          <span>Queue</span>
          {playbackQueue.length > 0 && (
            <span className="mobile-nav-badge">{playbackQueue.length}</span>
          )}
        </button>
      </nav>

      {/* ====================================================================
          APPLE MUSIC-STYLE FULLSCREEN PLAYER SHEET
          ==================================================================== */}
      <div className={`fullscreen-player-sheet ${showFullscreenPlayer ? 'open' : ''}`}>
        <div className="fullscreen-player-backdrop-blur"></div>
        <div className="fullscreen-player-content">
          {/* Header with Collapse & Share */}
          <div className="fullscreen-header">
            <button
              className="fullscreen-collapse-btn"
              onClick={() => setShowFullscreenPlayer(false)}
              title="Collapse Player"
            >
              <ChevronDown size={30} />
            </button>
            <div className="fullscreen-header-title">
              <span className="fullscreen-playing-from">PLAYING FROM VOXA</span>
              <span className="fullscreen-vibe-name">{activeVibe?.label || 'Lossless Streaming'}</span>
            </div>
            <button
              className="btn-icon-subtle"
              onClick={() => handleShareTrack(currentSong)}
              title="Share Track"
            >
              <Share2 size={20} />
            </button>
          </div>

          {/* Dynamic Album Canvas */}
          <div className="fullscreen-art-wrapper">
            <img
              src={currentSong?.imageUrl || FALLBACK_COVER}
              alt={currentSong?.title || 'Song'}
              className={`fullscreen-artwork ${isPlaying ? 'playing' : ''}`}
              onError={handleImageError}
            />
          </div>

          {/* Track Titles & Like */}
          <div className="fullscreen-meta-row">
            <div className="fullscreen-titles">
              <h2 className="fullscreen-song-title">{currentSong?.title || 'Select a Song'}</h2>
              <p className="fullscreen-artist-name">{currentSong?.artistName || 'Voxa Artist'}</p>
              {currentLyrics && currentLyrics[activeLyricIndex] && (
                <div className="fullscreen-live-karaoke-chip" onClick={() => setShowLyricsModal(true)}>
                  <span className="live-karaoke-chip-note">♪</span>
                  <span className="live-karaoke-chip-text">{currentLyrics[activeLyricIndex].text}</span>
                </div>
              )}
            </div>
            {currentSong && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="btn-icon-subtle"
                  onClick={() => setAddToPlaylistSong(currentSong)}
                  title="Add to Playlist"
                  style={{ transform: 'scale(1.15)' }}
                >
                  <ListPlus size={22} />
                </button>
                <button
                  className={`btn-icon-subtle ${likedSongIds.has(currentSong.id) ? 'liked' : ''}`}
                  onClick={() => handleLikeToggle(currentSong)}
                  style={{ transform: 'scale(1.2)' }}
                >
                  <Heart size={24} fill={likedSongIds.has(currentSong.id) ? '#f43f5e' : 'none'} color={likedSongIds.has(currentSong.id) ? '#f43f5e' : '#fff'} />
                </button>
              </div>
            )}
          </div>

          {/* Scrubber Timeline */}
          <div className="fullscreen-scrubber">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="fullscreen-slider"
            />
            <div className="fullscreen-times">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Large Transport Controls */}
          <div className="fullscreen-controls">
            <button
              className={`control-btn ${isShuffle ? 'active' : ''}`}
              onClick={() => setIsShuffle(!isShuffle)}
            >
              <Shuffle size={22} />
            </button>
            <button className="control-btn" onClick={handlePrevSong}>
              <SkipBack size={30} />
            </button>
            <button className="fullscreen-play-btn" onClick={handleTogglePlay}>
              {isPlaying ? <Pause size={30} fill="white" /> : <Play size={30} fill="white" style={{ marginLeft: 3 }} />}
            </button>
            <button className="control-btn" onClick={handleNextSong}>
              <SkipForward size={30} />
            </button>
            <button
              className={`control-btn ${isRepeat ? 'active' : ''}`}
              onClick={() => setIsRepeat(!isRepeat)}
            >
              <Repeat size={22} />
            </button>
          </div>

          {/* Bottom Actions: Lyrics & Queue */}
          <div className="fullscreen-bottom-actions">
            <button
              className={`fullscreen-action-btn ${showLyricsModal ? 'active' : ''}`}
              onClick={() => setShowLyricsModal(!showLyricsModal)}
            >
              <FileText size={18} />
              <span>Lyrics</span>
            </button>
            <button
              className={`fullscreen-action-btn ${showQueueDrawer ? 'active' : ''}`}
              onClick={() => {
                setShowQueueDrawer(true);
                setShowFullscreenPlayer(false);
              }}
            >
              <ListMusic size={18} />
              <span>Queue ({playbackQueue.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          SYNCHRONIZED LIVE SCROLLING LYRICS OVERLAY (Musixmatch Style)
          ==================================================================== */}
      {showLyricsModal && (
        <div className="lyrics-overlay-backdrop" onClick={() => setShowLyricsModal(false)}>
          {/* Ambient blurred backdrop canvas of current song across screen */}
          <div 
            className="lyrics-screen-ambient-art"
            style={{ backgroundImage: `url(${currentSong?.imageUrl || FALLBACK_COVER})` }}
          />
          <div className="lyrics-screen-ambient-veil" />

          <div className="lyrics-overlay-modal" onClick={(e) => e.stopPropagation()}>
            {/* Song cover art dynamically placed BEHIND the lyrics */}
            <div 
              className="lyrics-modal-art-backdrop"
              style={{ backgroundImage: `url(${currentSong?.imageUrl || FALLBACK_COVER})` }}
            />
            <div className="lyrics-modal-glass-wash" />
            <div className="lyrics-modal-ambient-glow" />

            {/* Glowing spinning vinyl record positioned subtly behind lyrics text */}
            <div className="lyrics-behind-song-disc">
              <img 
                src={currentSong?.imageUrl || FALLBACK_COVER} 
                alt="Song Disc" 
                className={`lyrics-spinning-disc ${isPlaying ? 'spinning' : ''}`}
                onError={handleImageError}
              />
            </div>

            <div className="lyrics-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="lyrics-header-thumb-box">
                  <img
                    src={currentSong?.imageUrl || FALLBACK_COVER}
                    alt={currentSong?.title}
                    onError={handleImageError}
                    style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover' }}
                  />
                  {isPlaying && (
                    <div className="lyrics-header-live-indicator">
                      <span className="live-dot-glow"></span>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff', letterSpacing: '-0.01em' }}>
                    {currentSong?.title || 'Lyrics'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.72)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="lyrics-live-tag">LIVE KARAOKE</span>
                    <span>•</span>
                    <span>{currentSong?.artistName}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="lyrics-time-stamp">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <button className="queue-close-btn" onClick={() => setShowLyricsModal(false)}>✕</button>
              </div>
            </div>

            <div className="lyrics-lines-container" ref={lyricsContainerRef}>
              {currentLyrics && currentLyrics.length > 0 ? (
                currentLyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  const isPast = idx < activeLyricIndex;
                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeLyricRef : null}
                      className={`lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = line.time;
                          setCurrentTime(line.time);
                        }
                      }}
                    >
                      {line.text}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <FileText size={36} color="var(--accent-purple)" style={{ marginBottom: 12 }} />
                  <p>Searching synchronized lyrics...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share / Toast Notification */}
      {shareToast && (
        <div className="voxa-toast">
          <CheckCircle size={16} color="var(--accent-cyan)" />
          <span>{shareToast}</span>
        </div>
      )}
    </div>
  );
}
