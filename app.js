// app.js - CineMax Complete Optimized Version with Custom Scrollbars & Auto Hero

// Global variables
let currentPage = 1;
let currentTvPage = 1;
let isLoading = false;
let hasMore = true;
let currentGenre = 'all';
let currentMediaType = 'movie';
let allMovies = [];
let allTVShows = [];
let currentMovieId = null;
let currentVideoTime = 0;
let videoPlayer = null;
let searchTimeout = null;
let backendAvailable = false;
let searchSuggestionTimeout = null;
let currentAudio = null;
let touchStartY = 0;
let touchStartX = 0;
let isScrolling = false;
let scrollTimeout = null;
let currentSources = [];
let currentVideoIframe = null;
let welcomeMessageTimeout = null;
let appInitialized = false;
let preferredServer = null;
let serverLatencies = {};
let currentContentData = null;
let connectionSpeed = 'unknown';
let lastServerSwitch = 0;
let isVideoPlayerActive = false;
let lastViewedContent = null;
let heroRotationInterval = null;
let serverFailCount = {};
let bufferingDetected = false;
let lastBufferingTime = 0;
let bufferingCount = 0;

// New content tracking
let newContentIds = new Set();
let newContentExpiry = {};

// Server configuration - EXACTLY AS SPECIFIED (no changes to embeds)
const STREAMING_SERVERS = {
    'vidlux': {
        url: 'https://vidlux.online/embed/',
        name: 'VidLux',
        icon: '🎬',
        color: '#00a8ff',
        priority: 1,
        active: true,
        type: 'both',
        description: 'Fast streaming • High quality'
    },
    'vsembed_ru': {
        url: 'https://vsembed.ru/embed/',
        name: 'vsembed.ru',
        icon: '🇷🇺',
        color: '#ff6b6b',
        priority: 2,
        active: true,
        type: 'both',
        description: 'Russian server • Reliable'
    },
    'vsembed_su': {
        url: 'https://vsembed.su/embed/',
        name: 'vsembed.su',
        icon: '🌐',
        color: '#9b59b6',
        priority: 3,
        active: true,
        type: 'both',
        description: 'Global server • Stable'
    }
};

// Configuration
const APP_CONFIG = {
    TMDB_API_KEY: '3fd2be6f0c70a2a598f084ddfb75487c',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p/',
    BACKEND_URL: window.location.origin,
    POSTER_SIZES: {
        small: 'w185',
        medium: 'w342',
        large: 'w500',
        original: 'original'
    },
    CACHE_DURATION: 3600000,
    NEW_CONTENT_DAYS: 7,
    HERO_ROTATION_INTERVAL: 30 * 60 * 1000, // 30 minutes
    BUFFER_OPTIMIZATION: {
        PRELOAD_NEXT: true,
        CONNECTION_TIMEOUT: 15000, // Increased to 15 seconds for slow connections
        RETRY_DELAY: 1000, // Reduced to 1 second
        MAX_RETRIES: 5, // Increased retries
        QUALITY_ADAPTATION: true, // Auto adjust quality
        BUFFER_DETECTION: true, // Detect buffering and adapt
        CLEANUP_INTERVAL: 30000, // Clean up every 30 seconds
        MAX_FAILS_BEFORE_SWITCH: 3 // Switch server after 3 failures
    },
    STORAGE_KEYS: {
        WISHLIST: 'cinemax_wishlist',
        CONTINUE_WATCHING: 'cinemax_continue_watching',
        WATCH_HISTORY: 'cinemax_watch_history',
        CACHE: 'cinemax_cache',
        NEW_CONTENT: 'cinemax_new_content',
        LAST_SERVER: 'cinemax_last_server',
        SERVER_FAILS: 'cinemax_server_fails'
    },
    INITIAL_LOAD_COUNT: 20,
    MAX_RETRIES: 1
};

// Memory cache for faster access
const memoryCache = new Map();

const cache = {
    get: (key) => {
        if (memoryCache.has(key)) {
            const { value, timestamp } = memoryCache.get(key);
            if (Date.now() - timestamp < APP_CONFIG.CACHE_DURATION) {
                return value;
            }
            memoryCache.delete(key);
        }
        
        const cached = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CACHE);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (data[key] && Date.now() - data[key].timestamp < APP_CONFIG.CACHE_DURATION) {
                    memoryCache.set(key, { value: data[key].value, timestamp: data[key].timestamp });
                    return data[key].value;
                }
            } catch (e) {}
        }
        return null;
    },
    set: (key, value) => {
        memoryCache.set(key, { value, timestamp: Date.now() });
        try {
            const cached = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CACHE);
            const data = cached ? JSON.parse(cached) : {};
            data[key] = { value, timestamp: Date.now() };
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.CACHE, JSON.stringify(data));
        } catch (e) {}
    },
    clear: () => {
        memoryCache.clear();
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.CACHE);
    }
};

// Load server fail counts
function loadServerFailCounts() {
    const saved = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.SERVER_FAILS);
    if (saved) {
        try {
            serverFailCount = JSON.parse(saved);
        } catch (e) {
            serverFailCount = {};
        }
    }
}

// Save server fail counts
function saveServerFailCounts() {
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.SERVER_FAILS, JSON.stringify(serverFailCount));
}

// Increment server fail count
function incrementServerFail(server) {
    if (!serverFailCount[server]) {
        serverFailCount[server] = 0;
    }
    serverFailCount[server]++;
    saveServerFailCounts();
    
    // If server fails too many times, deprioritize it
    if (serverFailCount[server] >= APP_CONFIG.BUFFER_OPTIMIZATION.MAX_FAILS_BEFORE_SWITCH) {
        STREAMING_SERVERS[server].priority += 10; // Lower priority
        setTimeout(() => {
            STREAMING_SERVERS[server].priority -= 10; // Restore after 30 minutes
            serverFailCount[server] = 0;
            saveServerFailCounts();
        }, 30 * 60 * 1000);
    }
}

// Reset server fail count
function resetServerFail(server) {
    serverFailCount[server] = 0;
    saveServerFailCounts();
}

// New content manager
const newContentManager = {
    init: function() {
        const saved = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.NEW_CONTENT);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                newContentIds = new Set(data.ids || []);
                newContentExpiry = data.expiry || {};
                this.cleanup();
            } catch (e) {}
        }
        setInterval(() => this.cleanup(), 3600000);
    },
    
    add: function(contentId, type, releaseDate) {
        const id = `${type}_${contentId}`;
        if (releaseDate) {
            const release = new Date(releaseDate);
            const now = new Date();
            const daysDiff = (now - release) / (1000 * 60 * 60 * 24);
            if (daysDiff <= APP_CONFIG.NEW_CONTENT_DAYS) {
                newContentIds.add(id);
                newContentExpiry[id] = Date.now() + (APP_CONFIG.NEW_CONTENT_DAYS * 24 * 60 * 60 * 1000);
                this.save();
            }
        }
    },
    
    check: function(contentId, type) {
        const id = `${type}_${contentId}`;
        return newContentIds.has(id);
    },
    
    cleanup: function() {
        const now = Date.now();
        let changed = false;
        for (const [id, expiry] of Object.entries(newContentExpiry)) {
            if (now > expiry) {
                newContentIds.delete(id);
                delete newContentExpiry[id];
                changed = true;
            }
        }
        if (changed) this.save();
    },
    
    save: function() {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.NEW_CONTENT, JSON.stringify({
            ids: Array.from(newContentIds),
            expiry: newContentExpiry
        }));
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loadingScreen');
    
    newContentManager.init();
    loadServerFailCounts();
    detectConnectionSpeed();
    
    setTimeout(() => {
        if (loadingScreen) loadingScreen.classList.add('hide');
    }, 1000);
    
    initializeApp();
    setupEventListeners();
    setupInfiniteScroll();
    loadWishlist();
    loadContinueWatching();
    setupNavigation();
    setupVideoPlayerControls();
    setupSearchAutocomplete();
    setupMediaTypeToggle();
    setupMobileSearch();
    setupMobileTouchPrevention();
    setupAutoUpdate();
    setupCacheCleanup();
    createServerSelectionModal();
    startBufferMonitoring();
    
    // Start hero rotation
    startHeroRotation();
});

// Start buffer monitoring
function startBufferMonitoring() {
    setInterval(() => {
        if (isVideoPlayerActive && bufferingCount > 3) {
            // Too much buffering, suggest switching servers
            showNotification('Experiencing buffering? Try switching servers', 'warning');
            bufferingCount = 0;
        }
    }, 10000);
}

// Detect buffering in iframe
function detectBuffering() {
    const now = Date.now();
    if (now - lastBufferingTime < 2000) {
        bufferingCount++;
    } else {
        bufferingCount = 1;
    }
    lastBufferingTime = now;
    
    if (bufferingCount > 5) {
        // Severe buffering detected
        if (window.lastVideoParams) {
            const { server } = window.lastVideoParams;
            incrementServerFail(server);
        }
    }
}

// Start hero rotation every 30 minutes
function startHeroRotation() {
    // Initial load
    loadRandomHeroContent();
    
    // Set interval for rotation
    if (heroRotationInterval) {
        clearInterval(heroRotationInterval);
    }
    heroRotationInterval = setInterval(() => {
        loadRandomHeroContent();
    }, APP_CONFIG.HERO_ROTATION_INTERVAL);
}

// Load random content for hero section
async function loadRandomHeroContent() {
    try {
        // Randomly choose between movie and TV show
        const isMovie = Math.random() > 0.5;
        let endpoint, type;
        
        if (isMovie) {
            endpoint = 'movie';
            type = 'movie';
        } else {
            endpoint = 'tv';
            type = 'tv';
        }
        
        // Fetch popular content
        const response = await fetch(
            `${APP_CONFIG.TMDB_BASE_URL}/${endpoint}/popular?api_key=${APP_CONFIG.TMDB_API_KEY}&language=en-US&page=1`
        );
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            // Pick a random item from the first 10 popular items
            const randomIndex = Math.floor(Math.random() * Math.min(10, data.results.length));
            const featured = data.results[randomIndex];
            
            // Fetch additional details for better description
            const detailsResponse = await fetch(
                `${APP_CONFIG.TMDB_BASE_URL}/${endpoint}/${featured.id}?api_key=${APP_CONFIG.TMDB_API_KEY}&append_to_response=videos`
            );
            const details = await detailsResponse.json();
            
            // Update hero banner with fade effect
            updateHeroBannerWithFade(details, type);
        }
    } catch (error) {
        console.error('Error loading random hero content:', error);
    }
}

// Update hero banner with fade animation
function updateHeroBannerWithFade(item, type) {
    const heroBanner = document.getElementById('heroBanner');
    const heroTitle = document.getElementById('heroTitle');
    const heroDesc = document.getElementById('heroDesc');
    const heroButtons = document.querySelector('.hero-buttons');
    
    if (!heroBanner || !heroTitle || !heroDesc) return;
    
    // Add fade out class
    heroBanner.classList.add('fade-out');
    heroTitle.classList.add('fade-out');
    heroDesc.classList.add('fade-out');
    if (heroButtons) heroButtons.classList.add('fade-out');
    
    setTimeout(() => {
        const title = item.title || item.name;
        const backdrop = item.backdrop_path || item.poster_path;
        const posterUrl = backdrop 
            ? `${APP_CONFIG.TMDB_IMAGE_BASE}${APP_CONFIG.POSTER_SIZES.original}${backdrop}`
            : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'1920\' height=\'1080\' viewBox=\'0 0 1920 1080\'%3E%3Crect width=\'1920\' height=\'1080\' fill=\'%23192a56\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23ffffff\' font-family=\'Arial\' font-size=\'48\'%3EFeatured%3C/text%3E%3C/svg%3E';
        
        heroBanner.style.backgroundImage = `url(${posterUrl})`;
        heroTitle.textContent = title;
        heroDesc.textContent = item.overview ? item.overview.substring(0, 200) + '...' : 'No description available';
        
        heroBanner.dataset.contentId = item.id;
        heroBanner.dataset.contentType = type;
        heroBanner.dataset.contentData = JSON.stringify(item);
        
        // Add trailer information if available
        if (item.videos && item.videos.results) {
            const trailer = item.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
            if (trailer) {
                heroBanner.dataset.trailerKey = trailer.key;
            }
        }
        
        // Remove fade out class
        heroBanner.classList.remove('fade-out');
        heroTitle.classList.remove('fade-out');
        heroDesc.classList.remove('fade-out');
        if (heroButtons) heroButtons.classList.remove('fade-out');
    }, 300);
}

// Detect user's connection speed for optimal buffering
function detectConnectionSpeed() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
        const downlink = connection.downlink || 10;
        if (downlink < 2) connectionSpeed = 'slow';
        else if (downlink < 5) connectionSpeed = 'medium';
        else connectionSpeed = 'fast';
        console.log(`Connection speed detected: ${connectionSpeed} (${downlink} Mbps)`);
        
        // Adjust timeouts based on connection speed
        if (connectionSpeed === 'slow') {
            APP_CONFIG.BUFFER_OPTIMIZATION.CONNECTION_TIMEOUT = 20000;
        } else if (connectionSpeed === 'medium') {
            APP_CONFIG.BUFFER_OPTIMIZATION.CONNECTION_TIMEOUT = 15000;
        } else {
            APP_CONFIG.BUFFER_OPTIMIZATION.CONNECTION_TIMEOUT = 10000;
        }
    } else {
        connectionSpeed = 'unknown';
    }
}

// Cache cleanup
function setupCacheCleanup() {
    setInterval(() => {
        memoryCache.clear();
        try {
            const cached = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CACHE);
            if (cached) {
                const data = JSON.parse(cached);
                const now = Date.now();
                let changed = false;
                Object.keys(data).forEach(key => {
                    if (now - data[key].timestamp > APP_CONFIG.CACHE_DURATION * 2) {
                        delete data[key];
                        changed = true;
                    }
                });
                if (changed) {
                    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.CACHE, JSON.stringify(data));
                }
            }
        } catch (e) {}
    }, APP_CONFIG.BUFFER_OPTIMIZATION.CLEANUP_INTERVAL);
}

// Auto-update
function setupAutoUpdate() {
    setInterval(checkForNewContent, 60 * 60 * 1000);
}

async function checkForNewContent() {
    try {
        const [moviesResponse, tvResponse] = await Promise.all([
            fetch(`${APP_CONFIG.TMDB_BASE_URL}/movie/now_playing?api_key=${APP_CONFIG.TMDB_API_KEY}&language=en-US&page=1`),
            fetch(`${APP_CONFIG.TMDB_BASE_URL}/tv/on_the_air?api_key=${APP_CONFIG.TMDB_API_KEY}&language=en-US&page=1`)
        ]);
        
        const [moviesData, tvData] = await Promise.all([
            moviesResponse.json(),
            tvResponse.json()
        ]);
        
        if (moviesData.results) {
            moviesData.results.forEach(movie => {
                newContentManager.add(movie.id, 'movie', movie.release_date);
            });
        }
        
        if (tvData.results) {
            tvData.results.forEach(tv => {
                newContentManager.add(tv.id, 'tv', tv.first_air_date);
            });
        }
        
        if (appInitialized) {
            refreshContentDisplays();
        }
        
        showNotification('New content added!', 'success');
    } catch (error) {
        console.error('Error checking new content:', error);
    }
}

function refreshContentDisplays() {
    if (document.getElementById('trendingSlider')?.children.length === 0) {
        loadTrendingMovies();
    }
    if (document.getElementById('trendingTVSlider')?.children.length === 0) {
        loadTrendingTVShows();
    }
    if (document.getElementById('webSeriesSlider')?.children.length === 0) {
        loadPopularWebSeries();
    }
    if (document.getElementById('aiRecommendationsSlider')?.children.length === 0) {
        loadAIRecommendations();
    }
}

// Mobile touch prevention
function setupMobileTouchPrevention() {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    document.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        isScrolling = false;
        if (scrollTimeout) clearTimeout(scrollTimeout);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!touchStartY) return;
        const touchY = e.touches[0].clientY;
        const touchX = e.touches[0].clientX;
        const deltaY = Math.abs(touchY - touchStartY);
        const deltaX = Math.abs(touchX - touchStartX);
        if (deltaY > 10 || deltaX > 10) isScrolling = true;
    }, { passive: true });

    document.addEventListener('touchend', () => {
        scrollTimeout = setTimeout(() => { isScrolling = false; }, 100);
    });

    document.addEventListener('click', (e) => {
        if (isScrolling) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);
}

// Initialize app
async function initializeApp() {
    try {
        appInitialized = false;
        await Promise.all([
            checkBackendConnection(),
            loadTrendingMovies(),
            loadTrendingTVShows()
        ]);
        
        setTimeout(() => {
            Promise.all([
                loadAIRecommendations(),
                loadPopularWebSeries(),
                loadAllMovies(),
                loadAllTVShows()
            ]).catch(console.error);
        }, 100);
        
        appInitialized = true;
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error loading content. Please refresh.', 'error');
    }
}

// Mobile search
function setupMobileSearch() {
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    const searchInput = document.getElementById('searchInput');
    const searchContainer = document.querySelector('.search-container');
    const searchResults = document.getElementById('searchResults');
    const searchSuggestions = document.getElementById('searchSuggestions');
    
    if (mobileSearchBtn && searchInput && searchContainer) {
        const newMobileSearchBtn = mobileSearchBtn.cloneNode(true);
        mobileSearchBtn.parentNode.replaceChild(newMobileSearchBtn, mobileSearchBtn);
        
        newMobileSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            searchContainer.classList.toggle('active');
            if (searchContainer.classList.contains('active')) {
                searchInput.focus();
                setTimeout(() => {
                    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (searchResults) searchResults.style.maxHeight = '60vh';
                    if (searchSuggestions) searchSuggestions.style.maxHeight = '60vh';
                }, 300);
            }
        });

        newMobileSearchBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            searchContainer.classList.toggle('active');
            if (searchContainer.classList.contains('active')) {
                searchInput.focus();
                setTimeout(() => {
                    searchInput.focus();
                    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (searchResults) searchResults.style.maxHeight = '60vh';
                    if (searchSuggestions) searchSuggestions.style.maxHeight = '60vh';
                }, 100);
            }
        });
    }
    
    if (searchInput) {
        searchInput.style.fontSize = '16px';
        searchInput.style.color = '#ffffff';
        searchInput.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
        
        searchInput.addEventListener('focus', () => {
            setTimeout(() => searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
        });
        
        searchInput.addEventListener('click', (e) => e.stopPropagation());
        searchInput.addEventListener('touchstart', (e) => e.stopPropagation());
    }
    
    document.addEventListener('click', (e) => {
        const searchContainer = document.querySelector('.search-container');
        const mobileSearchBtn = document.getElementById('mobileSearchBtn');
        const searchResults = document.getElementById('searchResults');
        const searchSuggestions = document.getElementById('searchSuggestions');
        
        if (searchContainer && mobileSearchBtn) {
            if (!searchContainer.contains(e.target) && !mobileSearchBtn.contains(e.target)) {
                searchContainer.classList.remove('active');
                if (searchResults) searchResults.style.display = 'none';
                if (searchSuggestions) searchSuggestions.style.display = 'none';
            }
        }
    });
}

// Media type toggle
function setupMediaTypeToggle() {
    const movieTab = document.getElementById('movieTab');
    const tvTab = document.getElementById('tvTab');
    const movieGrid = document.getElementById('movieGrid');
    const tvGrid = document.getElementById('tvGrid');
    
    if (movieTab && tvTab && movieGrid && tvGrid) {
        movieTab.addEventListener('click', () => {
            movieTab.classList.add('active');
            tvTab.classList.remove('active');
            movieGrid.style.display = 'grid';
            tvGrid.style.display = 'none';
            currentMediaType = 'movie';
        });

        movieTab.addEventListener('touchstart', (e) => {
            e.preventDefault();
            movieTab.classList.add('active');
            tvTab.classList.remove('active');
            movieGrid.style.display = 'grid';
            tvGrid.style.display = 'none';
            currentMediaType = 'movie';
        });
        
        tvTab.addEventListener('click', () => {
            tvTab.classList.add('active');
            movieTab.classList.remove('active');
            tvGrid.style.display = 'grid';
            movieGrid.style.display = 'none';
            currentMediaType = 'tv';
        });

        tvTab.addEventListener('touchstart', (e) => {
            e.preventDefault();
            tvTab.classList.add('active');
            movieTab.classList.remove('active');
            tvGrid.style.display = 'grid';
            movieGrid.style.display = 'none';
            currentMediaType = 'tv';
        });
    }
}

// Backend connection check
async function checkBackendConnection() {
    const cacheKey = 'backend_connection';
    const cached = cache.get(cacheKey);
    if (cached !== null) {
        backendAvailable = cached;
        return;
    }
    
    try {
        const possiblePorts = [5500, 5501, 5502, 5503, 3000, 3001, 3002, 3003, 3004, 3005];
        const currentPort = window.location.port || '80';
        
        try {
            const url = `${window.location.protocol}//${window.location.hostname}:${currentPort}/health`;
            const response = await fetch(url, { 
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(1000)
            });
            if (response.ok) {
                APP_CONFIG.BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:${currentPort}`;
                backendAvailable = true;
                cache.set(cacheKey, true);
                return;
            }
        } catch (e) {}

        for (const port of possiblePorts) {
            if (port.toString() === currentPort) continue;
            try {
                const url = `${window.location.protocol}//${window.location.hostname}:${port}/health`;
                const response = await fetch(url, { 
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(1000)
                });
                if (response.ok) {
                    APP_CONFIG.BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:${port}`;
                    backendAvailable = true;
                    cache.set(cacheKey, true);
                    return;
                }
            } catch (e) {}
        }
        
        backendAvailable = false;
        cache.set(cacheKey, false);
    } catch (error) {
        backendAvailable = false;
        cache.set(cacheKey, false);
    }
}

// Load trending movies
async function loadTrendingMovies() {
    const cacheKey = 'trending_movies';
    let data = cache.get(cacheKey);
    
    if (data) {
        displayMoviesInSlider(data, 'trendingSlider', 'movie');
        return;
    }
    
    try {
        const response = await fetch(
            `${APP_CONFIG.TMDB_BASE_URL}/trending/movie/week?api_key=${APP_CONFIG.TMDB_API_KEY}`
        );
        const result = await response.json();
        cache.set(cacheKey, result.results);
        displayMoviesInSlider(result.results, 'trendingSlider', 'movie');
    } catch (error) {
        console.error('Error loading trending movies:', error);
        const slider = document.getElementById('trendingSlider');
        if (slider) slider.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Unable to load</p>';
    }
}

// Load trending TV shows
async function loadTrendingTVShows() {
    const cacheKey = 'trending_tv';
    let data = cache.get(cacheKey);
    
    if (data) {
        displayMoviesInSlider(data, 'trendingTVSlider', 'tv');
        return;
    }
    
    try {
        const response = await fetch(
            `${APP_CONFIG.TMDB_BASE_URL}/trending/tv/week?api_key=${APP_CONFIG.TMDB_API_KEY}`
        );
        const result = await response.json();
        cache.set(cacheKey, result.results);
        displayMoviesInSlider(result.results, 'trendingTVSlider', 'tv');
    } catch (error) {
        console.error('Error loading trending TV shows:', error);
        const slider = document.getElementById('trendingTVSlider');
        if (slider) slider.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Unable to load</p>';
    }
}

// Load popular web series
async function loadPopularWebSeries() {
    const cacheKey = 'web_series';
    let data = cache.get(cacheKey);
    
    if (data) {
        displayMoviesInSlider(data, 'webSeriesSlider', 'tv');
        return;
    }
    
    try {
        const response = await fetch(
            `${APP_CONFIG.TMDB_BASE_URL}/discover/tv?api_key=${APP_CONFIG.TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc&with_genres=18,10765`
        );
        const result = await response.json();
        cache.set(cacheKey, result.results);
        displayMoviesInSlider(result.results, 'webSeriesSlider', 'tv');
    } catch (error) {
        console.error('Error loading web series:', error);
        const slider = document.getElementById('webSeriesSlider');
        if (slider) slider.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Unable to load</p>';
    }
}

// Load AI recommendations
async function loadAIRecommendations() {
    const cacheKey = 'recommendations';
    let data = cache.get(cacheKey);
    
    if (data) {
        displayMoviesInSlider(data, 'aiRecommendationsSlider', 'movie');
        return;
    }
    
    try {
        const history = getWatchHistory();
        let recommendations = [];
        
        if (history.length > 0) {
            const randomId = history[Math.floor(Math.random() * history.length)];
            if (randomId) {
                const response = await fetch(
                    `${APP_CONFIG.TMDB_BASE_URL}/movie/${randomId}/similar?api_key=${APP_CONFIG.TMDB_API_KEY}`
                );
                const data = await response.json();
                recommendations = data.results.slice(0, 10);
            }
        }
        
        if (recommendations.length === 0) {
            const response = await fetch(
                `${APP_CONFIG.TMDB_BASE_URL}/movie/top_rated?api_key=${APP_CONFIG.TMDB_API_KEY}&language=en-US&page=1`
            );
            const data = await response.json();
            recommendations = data.results.slice(0, 10);
        }
        
        cache.set(cacheKey, recommendations);
        displayMoviesInSlider(recommendations, 'aiRecommendationsSlider', 'movie');
    } catch (error) {
        console.error('Error loading AI recommendations:', error);
        const slider = document.getElementById('aiRecommendationsSlider');
        if (slider) slider.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Unable to load</p>';
    }
}

// Load all movies
async function loadAllMovies(reset = false) {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'block';
    
    try {
        let url;
        if (currentGenre === 'all') {
            url = `${APP_CONFIG.TMDB_BASE_URL}/discover/movie?api_key=${APP_CONFIG.TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&page=${currentPage}`;
        } else {
            const genreMap = {
                'action': 28, 'comedy': 35, 'drama': 18, 'sci-fi': 878, 'horror': 27,
                'romance': 10749, 'thriller': 53, 'documentary': 99, 'animation': 16,
                'adventure': 12, 'fantasy': 14, 'mystery': 9648, 'crime': 80,
                'family': 10751, 'war': 10752, 'history': 36, 'music': 10402, 'western': 37
            };
            const genreId = genreMap[currentGenre];
            url = `${APP_CONFIG.TMDB_BASE_URL}/discover/movie?api_key=${APP_CONFIG.TMDB_API_KEY}&with_genres=${genreId}&page=${currentPage}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (reset) {
            allMovies = data.results;
            const movieGrid = document.getElementById('movieGrid');
            if (movieGrid) movieGrid.innerHTML = '';
        } else {
            allMovies = [...allMovies, ...data.results];
        }
        
        displayMoviesInGrid(data.results, 'movieGrid', 'movie');
        
        currentPage++;
        hasMore = data.page < data.total_pages;
        const movieCount = document.getElementById('movieCount');
        if (movieCount) movieCount.textContent = `(${allMovies.length} movies)`;
    } catch (error) {
        console.error('Error loading movies:', error);
        hasMore = false;
        const movieGrid = document.getElementById('movieGrid');
        if (movieGrid) movieGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Unable to load movies</p>';
    } finally {
        isLoading = false;
        if (spinner) spinner.style.display = 'none';
    }
}

// Load all TV shows
async function loadAllTVShows(reset = false) {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    const spinner = document.getElementById('tvLoadingSpinner');
    if (spinner) spinner.style.display = 'block';
    
    try {
        let url;
        if (currentGenre === 'all') {
            url = `${APP_CONFIG.TMDB_BASE_URL}/discover/tv?api_key=${APP_CONFIG.TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&page=${currentTvPage}`;
        } else {
            const genreMap = {
                'action': 10759, 'comedy': 35, 'drama': 18, 'sci-fi': 10765, 'horror': 9648,
                'romance': 10749, 'thriller': 80, 'documentary': 99, 'animation': 16,
                'adventure': 10759, 'fantasy': 10765, 'mystery': 9648, 'crime': 80,
                'family': 10751, 'war': 10768, 'history': 36, 'music': 10402, 'western': 37
            };
            const genreId = genreMap[currentGenre];
            url = `${APP_CONFIG.TMDB_BASE_URL}/discover/tv?api_key=${APP_CONFIG.TMDB_API_KEY}&with_genres=${genreId}&page=${currentTvPage}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (reset) {
            allTVShows = data.results;
            const tvGrid = document.getElementById('tvGrid');
            if (tvGrid) tvGrid.innerHTML = '';
        } else {
            allTVShows = [...allTVShows, ...data.results];
        }
        
        displayMoviesInGrid(data.results, 'tvGrid', 'tv');
        
        currentTvPage++;
        hasMore = data.page < data.total_pages;
    } catch (error) {
        console.error('Error loading TV shows:', error);
        hasMore = false;
        const tvGrid = document.getElementById('tvGrid');
        if (tvGrid) tvGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Unable to load TV shows</p>';
    } finally {
        isLoading = false;
        if (spinner) spinner.style.display = 'none';
    }
}

// Display movies in slider
function displayMoviesInSlider(items, containerId, type = 'movie') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No content available</p>';
        return;
    }
    
    container.innerHTML = '';
    
    items.slice(0, 20).forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.dataset.contentId = item.id;
        card.dataset.contentType = type;
        card.dataset.releaseDate = item.release_date || item.first_air_date || '';
        
        const isNew = newContentManager.check(item.id, type);
        
        card.innerHTML = createContentCard(item, type, isNew);
        container.appendChild(card);
        
        let touchMoved = false;
        
        card.addEventListener('touchstart', (e) => {
            touchMoved = false;
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (!touchStartY) return;
            const touchY = e.touches[0].clientY;
            const touchX = e.touches[0].clientX;
            const deltaY = Math.abs(touchY - touchStartY);
            const deltaX = Math.abs(touchX - touchStartX);
            if (deltaY > 10 || deltaX > 10) touchMoved = true;
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!touchMoved && !isScrolling) {
                const contentId = card.dataset.contentId;
                const contentType = card.dataset.contentType;
                showContentDetails(contentId, contentType);
            }
        });

        card.addEventListener('click', (e) => {
            if (isScrolling) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            const contentId = card.dataset.contentId;
            const contentType = card.dataset.contentType;
            showContentDetails(contentId, contentType);
        });
    });
}

// Display movies in grid
function displayMoviesInGrid(items, gridId, type = 'movie') {
    const grid = document.getElementById(gridId);
    if (!grid || !items || items.length === 0) return;
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.dataset.contentId = item.id;
        card.dataset.contentType = type;
        card.dataset.releaseDate = item.release_date || item.first_air_date || '';
        
        const isNew = newContentManager.check(item.id, type);
        
        card.innerHTML = createContentCard(item, type, isNew);
        grid.appendChild(card);
        
        let touchMoved = false;
        
        card.addEventListener('touchstart', (e) => {
            touchMoved = false;
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (!touchStartY) return;
            const touchY = e.touches[0].clientY;
            const touchX = e.touches[0].clientX;
            const deltaY = Math.abs(touchY - touchStartY);
            const deltaX = Math.abs(touchX - touchStartX);
            if (deltaY > 10 || deltaX > 10) touchMoved = true;
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!touchMoved && !isScrolling) {
                showContentDetails(item.id, type);
            }
        });

        card.addEventListener('click', (e) => {
            if (isScrolling) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            showContentDetails(item.id, type);
        });
    });
}

// Create content card HTML
function createContentCard(item, type = 'movie', isNew = false) {
    const title = item.title || item.name || 'Unknown';
    const posterPath = item.poster_path 
        ? `${APP_CONFIG.TMDB_IMAGE_BASE}${APP_CONFIG.POSTER_SIZES.medium}${item.poster_path}`
        : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'450\' viewBox=\'0 0 300 450\'%3E%3Crect width=\'300\' height=\'450\' fill=\'%23192a56\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23ffffff\' font-family=\'Arial\' font-size=\'16\'%3ENo Poster%3C/text%3E%3C/svg%3E';
    
    const year = item.release_date ? item.release_date.split('-')[0] : (item.first_air_date ? item.first_air_date.split('-')[0] : 'N/A');
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const typeIcon = type === 'movie' ? '🎬' : '📺';
    const newBadge = isNew ? '<span class="new-badge">NEW</span>' : '';
    
    return `
        <img class="movie-poster" src="${posterPath}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'450\' viewBox=\'0 0 300 450\'%3E%3Crect width=\'300\' height=\'450\' fill=\'%23192a56\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23ffffff\' font-family=\'Arial\' font-size=\'16\'%3ENo Poster%3C/text%3E%3C/svg%3E'">
        ${newBadge}
        <div class="movie-info">
            <div class="movie-title">${title}</div>
            <div class="movie-year">${year} ${typeIcon}</div>
        </div>
        <div class="movie-rating">
            <i class="fas fa-star" style="color: var(--accent);"></i> ${rating}
        </div>
    `;
}

// Create beautiful server selection modal
function createServerSelectionModal() {
    if (document.getElementById('serverSelectionModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'serverSelectionModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; background: linear-gradient(135deg, var(--surface) 0%, #1a1a2e 100%); border: 2px solid var(--primary); border-radius: 20px; overflow: hidden;">
            <div style="padding: 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <h2 style="color: var(--text); margin: 0; font-size: 24px;">🎬 Select Server</h2>
                <p style="color: var(--text-secondary); margin-top: 10px; font-size: 14px;">Choose your preferred streaming source</p>
            </div>
            <div id="serverSelectionContent" style="padding: 30px 20px;">
                <!-- Server options will be dynamically inserted here -->
            </div>
            <div style="padding: 20px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1);">
                <button id="closeServerModal" style="
                    padding: 12px 30px;
                    background: transparent;
                    color: var(--text);
                    border: 2px solid var(--primary);
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.3s ease;
                ">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('closeServerModal').addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
}

// Show server selection modal
function showServerSelectionModal(contentData) {
    const modal = document.getElementById('serverSelectionModal');
    if (!modal) return;
    
    currentContentData = contentData;
    const contentDiv = document.getElementById('serverSelectionContent');
    
    const title = contentData.title || contentData.name;
    const type = contentData.type || 'movie';
    const typeIcon = type === 'movie' ? '🎬' : '📺';
    const posterUrl = contentData.poster_path 
        ? `${APP_CONFIG.TMDB_IMAGE_BASE}w185${contentData.poster_path}`
        : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'185\' height=\'278\' viewBox=\'0 0 185 278\'%3E%3Crect width=\'185\' height=\'278\' fill=\'%23192a56\'/%3E%3C/svg%3E';
    
    const lastServer = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.LAST_SERVER) || 'vidlux';
    
    // Sort servers by priority and fail count
    const sortedServers = Object.entries(STREAMING_SERVERS)
        .sort((a, b) => {
            const failA = serverFailCount[a[0]] || 0;
            const failB = serverFailCount[b[0]] || 0;
            if (failA !== failB) return failA - failB;
            return a[1].priority - b[1].priority;
        });
    
    let serversHtml = '';
    sortedServers.forEach(([key, server]) => {
        const failCount = serverFailCount[key] || 0;
        const failWarning = failCount > 2 ? ' (May be slow)' : '';
        
        serversHtml += `
            <div class="server-option" data-server="${key}" style="
                background: ${lastServer === key ? `linear-gradient(135deg, ${server.color}20, ${server.color}10)` : 'rgba(255,255,255,0.05)'};
                border: 2px solid ${lastServer === key ? server.color : 'rgba(255,255,255,0.1)'};
                border-radius: 15px;
                padding: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 15px;
                position: relative;
                overflow: hidden;
                margin-bottom: 10px;
                opacity: ${server.active ? 1 : 0.5};
            ">
                <div style="
                    width: 50px;
                    height: 50px;
                    background: linear-gradient(135deg, ${server.color}, ${server.color}dd);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    box-shadow: 0 5px 15px ${server.color}40;
                ">${server.icon}</div>
                <div style="flex: 1;">
                    <h4 style="color: var(--text); margin: 0 0 5px 0; font-size: 18px;">${server.name}${failWarning}</h4>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">${server.description}</p>
                </div>
                ${lastServer === key ? '<div style="background: ' + server.color + '; color: white; padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">LAST USED</div>' : ''}
            </div>
        `;
    });
    
    contentDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 30px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 15px;">
            <img src="${posterUrl}" alt="${title}" style="width: 60px; height: 90px; border-radius: 10px; object-fit: cover; border: 2px solid var(--primary);">
            <div>
                <h3 style="color: var(--text); margin: 0 0 5px 0; font-size: 18px;">${title}</h3>
                <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">${typeIcon} ${type === 'movie' ? 'Movie' : 'TV Series'}</p>
                <p style="color: var(--text-secondary); margin: 5px 0 0 0; font-size: 12px;">⚡ ${connectionSpeed} connection detected</p>
            </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${serversHtml}
        </div>
        
        <p style="color: var(--text-secondary); text-align: center; margin-top: 25px; font-size: 12px;">
            <i class="fas fa-info-circle"></i> Click to start streaming. Your choice will be saved.
        </p>
    `;
    
    // Add hover effects
    const style = document.createElement('style');
    let hoverStyles = '';
    Object.keys(STREAMING_SERVERS).forEach(key => {
        hoverStyles += `
            .server-option[data-server="${key}"]:hover {
                border-color: ${STREAMING_SERVERS[key].color} !important;
                background: linear-gradient(135deg, ${STREAMING_SERVERS[key].color}20, ${STREAMING_SERVERS[key].color}10) !important;
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            }
        `;
    });
    style.textContent = hoverStyles;
    document.head.appendChild(style);
    
    // Add click handlers
    document.querySelectorAll('.server-option').forEach(option => {
        option.addEventListener('click', () => {
            const server = option.dataset.server;
            if (!STREAMING_SERVERS[server].active) {
                showNotification('This server is temporarily unavailable', 'warning');
                return;
            }
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.LAST_SERVER, server);
            modal.classList.remove('show');
            
            if (currentContentData) {
                if (currentContentData.type === 'movie') {
                    playContentWithServer(currentContentData.contentId, 'movie', server);
                } else {
                    const season = currentContentData.season || 1;
                    const episode = currentContentData.episode || 1;
                    playContentWithServer(currentContentData.contentId, 'tv', server, season, episode);
                }
            }
        });
    });
    
    modal.classList.add('show');
}

// Get movie source with specific server (EMBEDS UNCHANGED)
function getMovieSourceWithServer(movieId, server = 'vidlux') {
    const baseUrl = STREAMING_SERVERS[server].url;
    return `${baseUrl}movie/${movieId}?t=${Date.now()}`;
}

// Get TV source with specific server (EMBEDS UNCHANGED)
function getTVSourceWithServer(tvId, season, episode, server = 'vidlux') {
    const baseUrl = STREAMING_SERVERS[server].url;
    return `${baseUrl}tv/${tvId}/${season}/${episode}?t=${Date.now()}`;
}

// OPTIMIZED: Play content with advanced buffering fixes
async function playContentWithServer(contentId, type = 'movie', server = 'vidlux', season = 1, episode = 1) {
    try {
        const videoContainer = document.getElementById('videoContainer');
        if (!videoContainer) return;
        
        // Set video player active flag
        isVideoPlayerActive = true;
        
        // Don't allow too frequent server switches
        const now = Date.now();
        if (now - lastServerSwitch < 3000) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        lastServerSwitch = now;
        
        // Clean up previous iframe completely
        if (currentVideoIframe) {
            currentVideoIframe.onload = null;
            currentVideoIframe.onerror = null;
            currentVideoIframe.onplaying = null;
            currentVideoIframe.onwaiting = null;
            currentVideoIframe.src = 'about:blank';
            if (currentVideoIframe.parentNode) {
                currentVideoIframe.parentNode.removeChild(currentVideoIframe);
            }
            currentVideoIframe = null;
        }
        
        videoContainer.innerHTML = '';
        
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        
        if (welcomeMessageTimeout) {
            clearTimeout(welcomeMessageTimeout);
        }
        
        showNotification(`Loading from ${STREAMING_SERVERS[server].name}...`, 'info');
        
        const isMobile = window.innerWidth <= 768;
        
        // Create player container with optimized loading
        const playerContainer = document.createElement('div');
        playerContainer.className = 'custom-video-player';
        playerContainer.style.cssText = `
            position: relative;
            width: 100%;
            background: black;
            height: ${isMobile ? '50vh' : '80vh'};
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // Show loading spinner with server color and connection info
        playerContainer.innerHTML = `
            <div style="text-align: center;">
                <div class="loading-spinner" style="
                    width: 50px;
                    height: 50px;
                    border: 5px solid var(--surface);
                    border-top-color: ${STREAMING_SERVERS[server].color};
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <p style="color: var(--text);">Connecting to ${STREAMING_SERVERS[server].name}...</p>
                <p style="color: var(--text-secondary); font-size: 12px; margin-top: 10px;">⚡ ${connectionSpeed} connection • Please wait</p>
                <div class="progress-bar" style="
                    width: 200px;
                    height: 4px;
                    background: var(--surface);
                    border-radius: 2px;
                    margin: 20px auto 0;
                    overflow: hidden;
                ">
                    <div class="progress-fill" style="
                        width: 0%;
                        height: 100%;
                        background: ${STREAMING_SERVERS[server].color};
                        transition: width 0.3s ease;
                    "></div>
                </div>
            </div>
        `;
        
        videoContainer.appendChild(playerContainer);
        
        // Animate progress bar
        const progressFill = playerContainer.querySelector('.progress-fill');
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 1;
            if (progressFill) {
                progressFill.style.width = Math.min(progress, 90) + '%';
            }
            if (progress >= 90) clearInterval(progressInterval);
        }, 100);
        
        if (!document.querySelector('#spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
        
        // Get source with cache buster (EMBEDS UNCHANGED)
        let source;
        if (type === 'movie') {
            source = getMovieSourceWithServer(contentId, server);
        } else {
            source = getTVSourceWithServer(contentId, season, episode, server);
        }
        
        // Add quality hints based on connection speed (doesn't change embed)
        if (connectionSpeed === 'slow') {
            source += '&preferred_quality=480p';
        } else if (connectionSpeed === 'medium') {
            source += '&preferred_quality=720p';
        }
        
        const iframe = document.createElement('iframe');
        iframe.id = 'videoIframe';
        iframe.src = source;
        iframe.allowFullscreen = true;
        iframe.allow = "autoplay; encrypted-media; picture-in-picture";
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            opacity: 0;
            transition: opacity 0.5s ease;
        `;
        iframe.loading = "eager";
        
        if (isMobile) {
            iframe.setAttribute('webkit-playsinline', 'true');
            iframe.setAttribute('playsinline', 'true');
        }
        
        // Track buffering events
        iframe.onwaiting = () => {
            detectBuffering();
        };
        
        // Optimized load handler with timeout
        let loadTimeout = setTimeout(() => {
            clearInterval(progressInterval);
            if (iframe.style.opacity !== '1') {
                console.log('Loading timeout - showing iframe anyway');
                iframe.style.opacity = '1';
                const spinner = playerContainer.querySelector('.loading-spinner');
                if (spinner) spinner.remove();
                const loadingText = playerContainer.querySelector('p');
                if (loadingText) loadingText.style.display = 'none';
                const progressBar = playerContainer.querySelector('.progress-bar');
                if (progressBar) progressBar.style.display = 'none';
                
                // Auto-switch if too slow
                if (connectionSpeed === 'slow') {
                    setTimeout(() => {
                        if (iframe.style.opacity === '1' && !iframe.dataset.switched) {
                            iframe.dataset.switched = 'true';
                            const servers = ['vidlux', 'vsembed_ru', 'vsembed_su'];
                            const currentIndex = servers.indexOf(server);
                            const nextServer = servers[(currentIndex + 1) % servers.length];
                            showNotification('Slow connection - trying alternative server...', 'info');
                            setTimeout(() => {
                                playContentWithServer(contentId, type, nextServer, season, episode);
                            }, 1000);
                        }
                    }, 5000);
                }
            }
        }, APP_CONFIG.BUFFER_OPTIMIZATION.CONNECTION_TIMEOUT);
        
        iframe.onload = () => {
            clearTimeout(loadTimeout);
            clearInterval(progressInterval);
            iframe.style.opacity = '1';
            const spinner = playerContainer.querySelector('.loading-spinner');
            if (spinner) spinner.remove();
            const loadingText = playerContainer.querySelector('p');
            if (loadingText) loadingText.style.display = 'none';
            const progressBar = playerContainer.querySelector('.progress-bar');
            if (progressBar) progressBar.style.display = 'none';
            
            // Reset fail count on successful load
            resetServerFail(server);
            
            showNotification(`Connected to ${STREAMING_SERVERS[server].name}`, 'success');
            
            // Start buffer monitoring for this iframe
            startIframeBufferMonitoring(iframe);
        };
        
        // Optimized error handler with smart retry
        iframe.onerror = (e) => {
            clearTimeout(loadTimeout);
            clearInterval(progressInterval);
            console.log(`Error loading from ${server}:`, e);
            
            incrementServerFail(server);
            
            if (!iframe.dataset.retries) {
                iframe.dataset.retries = '1';
                
                // Try again with cache buster
                let retrySource = source.split('?')[0] + '?t=' + Date.now() + '&retry=1';
                
                setTimeout(() => {
                    iframe.src = retrySource;
                    showNotification('Retrying connection...', 'warning');
                }, APP_CONFIG.BUFFER_OPTIMIZATION.RETRY_DELAY);
                
            } else if (iframe.dataset.retries === '1') {
                iframe.dataset.retries = '2';
                
                // Try the next server automatically
                const servers = ['vidlux', 'vsembed_ru', 'vsembed_su'];
                const currentIndex = servers.indexOf(server);
                const nextServer = servers[(currentIndex + 1) % servers.length];
                
                playerContainer.innerHTML = `
                    <div style="text-align: center;">
                        <div class="loading-spinner" style="
                            width: 50px;
                            height: 50px;
                            border: 5px solid var(--surface);
                            border-top-color: ${STREAMING_SERVERS[nextServer].color};
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 20px;
                        "></div>
                        <p style="color: var(--text);">Switching to ${STREAMING_SERVERS[nextServer].name}...</p>
                    </div>
                `;
                
                setTimeout(() => {
                    playContentWithServer(contentId, type, nextServer, season, episode);
                }, 1500);
                
            } else {
                // Show manual retry options
                playerContainer.innerHTML = `
                    <div style="text-align: center; color: var(--error); padding: 20px;">
                        <i class="fas fa-exclamation-circle" style="font-size: 48px; margin-bottom: 20px;"></i>
                        <p>Failed to load from all servers.</p>
                        <p style="font-size: 14px; margin: 10px 0;">Try these alternatives:</p>
                        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px; flex-wrap: wrap;">
                            <button onclick="retryWithServer('vidlux')" style="
                                padding: 10px 20px;
                                background: #00a8ff;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                cursor: pointer;
                            ">VidLux</button>
                            <button onclick="retryWithServer('vsembed_ru')" style="
                                padding: 10px 20px;
                                background: #ff6b6b;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                cursor: pointer;
                            ">vsembed.ru</button>
                            <button onclick="retryWithServer('vsembed_su')" style="
                                padding: 10px 20px;
                                background: #9b59b6;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                cursor: pointer;
                            ">vsembed.su</button>
                        </div>
                    </div>
                `;
                showNotification('Failed to load video', 'error');
            }
        };
        
        // Add iframe to container after a small delay
        setTimeout(() => {
            playerContainer.innerHTML = '';
            playerContainer.appendChild(iframe);
            currentVideoIframe = iframe;
        }, 500);
        
        // Store params for retry
        window.lastVideoParams = { contentId, type, season, episode, server };
        
        // Show modal
        const modal = document.getElementById('videoPlayerModal');
        if (modal) {
            modal.classList.add('show');
            if (isMobile) document.body.style.overflow = 'hidden';
            
            // Prevent background scrolling while video is playing
            document.body.classList.add('video-playing');
        }
        
        addToWatchHistory(contentId, type);
        
        // Preload next episode for TV shows
        if (type === 'tv' && APP_CONFIG.BUFFER_OPTIMIZATION.PRELOAD_NEXT) {
            setTimeout(() => {
                preloadNextEpisode(contentId, season, episode, server);
            }, 10000);
        }
        
    } catch (error) {
        console.error('Error playing content:', error);
        showNotification('Error playing video. Please try again.', 'error');
    }
}

// Monitor iframe for buffering
function startIframeBufferMonitoring(iframe) {
    let lastTime = Date.now();
    let stallCount = 0;
    
    const checkInterval = setInterval(() => {
        if (!iframe.contentWindow) {
            clearInterval(checkInterval);
            return;
        }
        
        // Check if video is stalled by monitoring time updates
        try {
            const videoElement = iframe.contentDocument?.querySelector('video');
            if (videoElement) {
                if (videoElement.readyState < 3) { // HAVE_FUTURE_DATA
                    stallCount++;
                    if (stallCount > 5) {
                        detectBuffering();
                        stallCount = 0;
                    }
                } else {
                    stallCount = Math.max(0, stallCount - 1);
                }
            }
        } catch (e) {
            // Cross-origin restrictions - can't access
        }
    }, 2000);
    
    // Clear interval when iframe is removed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (!document.body.contains(iframe)) {
                clearInterval(checkInterval);
                observer.disconnect();
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// Preload next episode for seamless playback
function preloadNextEpisode(contentId, season, episode, server) {
    const nextEpisode = episode + 1;
    const baseUrl = STREAMING_SERVERS[server].url;
    const nextSource = `${baseUrl}tv/${contentId}/${season}/${nextEpisode}?preload=1`;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'document';
    link.href = nextSource;
    document.head.appendChild(link);
    
    setTimeout(() => {
        if (link.parentNode) link.remove();
    }, 30000);
}

// Retry with specific server
window.retryWithServer = function(server) {
    if (window.lastVideoParams) {
        const { contentId, type, season, episode } = window.lastVideoParams;
        playContentWithServer(contentId, type, server, season, episode);
    }
};

// Close video player
function closeVideoPlayer() {
    const modal = document.getElementById('videoPlayerModal');
    if (modal) {
        modal.classList.remove('show');
    }
    
    if (currentVideoIframe) {
        currentVideoIframe.onload = null;
        currentVideoIframe.onerror = null;
        currentVideoIframe.onwaiting = null;
        try { currentVideoIframe.src = 'about:blank'; } catch (e) {}
        if (currentVideoIframe.parentNode) {
            currentVideoIframe.parentNode.removeChild(currentVideoIframe);
        }
        currentVideoIframe = null;
    }
    
    const videoContainer = document.getElementById('videoContainer');
    if (videoContainer) videoContainer.innerHTML = '';
    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    if (welcomeMessageTimeout) clearTimeout(welcomeMessageTimeout);
    
    // Remove video playing class
    document.body.classList.remove('video-playing');
    document.body.style.overflow = '';
    
    // Reset video player active flag
    isVideoPlayerActive = false;
    bufferingCount = 0;
    
    // Return to content details if we have last viewed content
    if (lastViewedContent) {
        setTimeout(() => {
            showContentDetails(lastViewedContent.id, lastViewedContent.type);
        }, 100);
    }
}

// Show content details
async function showContentDetails(contentId, type = 'movie') {
    try {
        // Store this as the last viewed content
        lastViewedContent = { id: contentId, type: type };
        
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const response = await fetch(
            `${APP_CONFIG.TMDB_BASE_URL}/${endpoint}/${contentId}?api_key=${APP_CONFIG.TMDB_API_KEY}&append_to_response=credits,videos,similar`
        );
        const content = await response.json();
        
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        
        const posterUrl = content.poster_path 
            ? `${APP_CONFIG.TMDB_IMAGE_BASE}${APP_CONFIG.POSTER_SIZES.large}${content.poster_path}`
            : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'500\' height=\'750\' viewBox=\'0 0 500 750\'%3E%3Crect width=\'500\' height=\'750\' fill=\'%23192a56\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23ffffff\' font-family=\'Arial\' font-size=\'24\'%3ENo Poster%3C/text%3E%3C/svg%3E';
        
        const trailer = content.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        const cast = content.credits?.cast?.slice(0, 8) || [];
        const title = content.title || content.name;
        const releaseDate = content.release_date || content.first_air_date;
        const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
        const runtime = content.runtime ? content.runtime + ' min' : (content.episode_run_time ? content.episode_run_time[0] + ' min/ep' : 'N/A');
        const voteAverage = content.vote_average ? content.vote_average.toFixed(1) : 'N/A';
        const typeIcon = type === 'movie' ? '🎬 Movie' : '📺 TV Series';
        const seasons = content.seasons || [];
        
        const isNew = newContentManager.check(contentId, type);
        const newBadge = isNew ? '<span class="new-badge-large">NEW</span>' : '';
        
        let episodeSelectorHTML = '';
        if (type === 'tv' && seasons.length > 0) {
            episodeSelectorHTML = `
                <div style="margin: 20px 0; background: var(--surface); padding: 15px; border-radius: 10px;">
                    <h3 style="color: var(--text); margin-bottom: 15px;">Select Season & Episode</h3>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <select id="seasonSelect" style="padding: 12px; background: var(--secondary); color: white; border: 2px solid var(--primary); border-radius: 5px; flex: 1; font-size: 16px; cursor: pointer;">
                            <option value="">-- Select Season --</option>
                            ${seasons.filter(s => s.season_number > 0).map(season => `
                                <option value="${season.season_number}">
                                    ${season.name || `Season ${season.season_number}`} (${season.episode_count || 0} episodes)
                                </option>
                            `).join('')}
                        </select>
                        
                        <select id="episodeSelect" style="padding: 12px; background: var(--secondary); color: white; border: 2px solid var(--primary); border-radius: 5px; flex: 1; font-size: 16px; cursor: pointer;" disabled>
                            <option value="">-- Select Episode --</option>
                        </select>
                        
                        <button id="playSelectedBtn" class="btn btn-primary" style="padding: 12px 20px; background: var(--primary); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; display: none;">
                            <i class="fas fa-play"></i> Play Selected
                        </button>
                    </div>
                </div>
            `;
        }
        
        modalBody.innerHTML = `
            <div class="movie-detail">
                <img class="movie-detail-poster" src="${posterUrl}" alt="${title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'500\' height=\'750\' viewBox=\'0 0 500 750\'%3E%3Crect width=\'500\' height=\'750\' fill=\'%23192a56\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23ffffff\' font-family=\'Arial\' font-size=\'24\'%3ENo Poster%3C/text%3E%3C/svg%3E'">
                <div class="movie-detail-info">
                    <h2 style="color: var(--text);">${title} <span style="font-size: 16px; color: var(--primary);">${typeIcon}</span> ${newBadge}</h2>
                    <div class="movie-meta">
                        <span>${year}</span>
                        <span>${runtime}</span>
                        <span><i class="fas fa-star" style="color: var(--accent);"></i> ${voteAverage}</span>
                    </div>
                    <div class="movie-genres">
                        ${content.genres ? content.genres.map(g => `<span class="genre-tag">${g.name}</span>`).join('') : ''}
                    </div>
                    <p class="movie-description" style="color: var(--text-secondary);">${content.overview || 'No description available.'}</p>
                    
                    ${episodeSelectorHTML}
                    
                    <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                        <button class="btn btn-primary" id="watchNowDetailBtn">
                            <i class="fas fa-play"></i> Watch Now
                        </button>
                        ${trailer ? `
                            <button class="btn btn-secondary" id="trailerDetailBtn">
                                <i class="fas fa-film"></i> Trailer
                            </button>
                        ` : ''}
                        <button class="btn btn-outline" id="wishlistDetailBtn">
                            <i class="fas fa-heart"></i> Wishlist
                        </button>
                    </div>
                    
                    <div class="cast-section">
                        <h3 style="color: var(--text);">Cast</h3>
                        <div class="cast-grid">
                            ${cast.map(actor => `
                                <div class="cast-item">
                                    <img class="cast-image" src="${actor.profile_path ? `${APP_CONFIG.TMDB_IMAGE_BASE}w185${actor.profile_path}` : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\' viewBox=\'0 0 80 80\'%3E%3Ccircle cx=\'40\' cy=\'40\' r=\'40\' fill=\'%23333\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23fff\' font-size=\'12\'%3ENo Image%3C/text%3E%3C/svg%3E'}" alt="${actor.name}">
                                    <div class="cast-name">${actor.name}</div>
                                    <div class="cast-character">${actor.character || ''}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const watchNowBtn = document.getElementById('watchNowDetailBtn');
        if (watchNowBtn) {
            watchNowBtn.addEventListener('click', () => {
                document.getElementById('movieModal').classList.remove('show');
                
                const contentData = {
                    contentId: contentId,
                    type: type,
                    title: title,
                    poster_path: content.poster_path
                };
                
                if (type === 'tv') {
                    const seasonSelect = document.getElementById('seasonSelect');
                    const episodeSelect = document.getElementById('episodeSelect');
                    if (seasonSelect && episodeSelect && seasonSelect.value && episodeSelect.value) {
                        contentData.season = seasonSelect.value;
                        contentData.episode = episodeSelect.value;
                    } else {
                        contentData.season = 1;
                        contentData.episode = 1;
                    }
                }
                
                showServerSelectionModal(contentData);
            });
        }
        
        const trailerBtn = document.getElementById('trailerDetailBtn');
        if (trailerBtn && trailer) {
            trailerBtn.addEventListener('click', () => playTrailer(trailer.key));
        }
        
        const wishlistBtn = document.getElementById('wishlistDetailBtn');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', () => {
                toggleWishlist(contentId, title, posterUrl, type);
            });
        }
        
        if (type === 'tv') {
            setupEpisodeSelector(contentId, type);
        }
        
        document.getElementById('movieModal').classList.add('show');
    } catch (error) {
        console.error('Error loading content details:', error);
        showNotification('Error loading details', 'error');
    }
}

// Setup episode selector
function setupEpisodeSelector(contentId, type) {
    const seasonSelect = document.getElementById('seasonSelect');
    const episodeSelect = document.getElementById('episodeSelect');
    const playSelectedBtn = document.getElementById('playSelectedBtn');
    
    if (seasonSelect && episodeSelect) {
        let selectedSeason = null;
        let selectedEpisode = null;
        
        seasonSelect.addEventListener('change', async (e) => {
            const seasonNumber = e.target.value;
            selectedSeason = seasonNumber;
            
            if (!seasonNumber) {
                episodeSelect.disabled = true;
                episodeSelect.innerHTML = '<option value="">-- Select Episode --</option>';
                if (playSelectedBtn) playSelectedBtn.style.display = 'none';
                return;
            }
            
            try {
                showNotification(`Loading Season ${seasonNumber} episodes...`, 'info');
                
                const response = await fetch(
                    `${APP_CONFIG.TMDB_BASE_URL}/tv/${contentId}/season/${seasonNumber}?api_key=${APP_CONFIG.TMDB_API_KEY}`
                );
                
                if (!response.ok) throw new Error('Failed to load episodes');
                
                const seasonData = await response.json();
                
                episodeSelect.disabled = false;
                
                let episodeOptions = '<option value="">-- Select Episode --</option>';
                if (seasonData.episodes && seasonData.episodes.length > 0) {
                    episodeOptions += seasonData.episodes.map(ep => 
                        `<option value="${ep.episode_number}">Episode ${ep.episode_number}: ${ep.name || `Episode ${ep.episode_number}`}</option>`
                    ).join('');
                }
                
                episodeSelect.innerHTML = episodeOptions;
                if (playSelectedBtn) playSelectedBtn.style.display = 'none';
                
            } catch (error) {
                console.error('Error loading episodes:', error);
                showNotification('Error loading episodes', 'error');
                episodeSelect.disabled = true;
                episodeSelect.innerHTML = '<option value="">Failed to load episodes</option>';
            }
        });
        
        episodeSelect.addEventListener('change', (e) => {
            selectedEpisode = e.target.value;
            if (playSelectedBtn) {
                playSelectedBtn.style.display = (selectedSeason && selectedEpisode) ? 'block' : 'none';
            }
        });
        
        if (playSelectedBtn) {
            playSelectedBtn.addEventListener('click', () => {
                if (selectedSeason && selectedEpisode) {
                    document.getElementById('movieModal').classList.remove('show');
                    
                    const contentData = {
                        contentId: contentId,
                        type: type,
                        season: selectedSeason,
                        episode: selectedEpisode
                    };
                    
                    showServerSelectionModal(contentData);
                } else {
                    showNotification('Please select both season and episode', 'warning');
                }
            });
        }
    }
}

// Play trailer
function playTrailer(trailerKey) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    const trailerContainer = document.getElementById('trailerContainer');
    if (!trailerContainer) return;
    
    const isMobile = window.innerWidth <= 768;
    trailerContainer.innerHTML = '';
    
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`;
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.style.width = "100%";
    iframe.style.height = isMobile ? "50vh" : "80vh";
    iframe.style.border = "none";
    
    if (isMobile) {
        iframe.setAttribute('webkit-playsinline', 'true');
        iframe.setAttribute('playsinline', 'true');
    }
    
    trailerContainer.appendChild(iframe);
    
    const modal = document.getElementById('trailerModal');
    if (modal) {
        modal.classList.add('show');
        if (isMobile) document.body.style.overflow = 'hidden';
    }
}

// Close trailer
function closeTrailer() {
    const modal = document.getElementById('trailerModal');
    if (modal) modal.classList.remove('show');
    
    const trailerContainer = document.getElementById('trailerContainer');
    if (trailerContainer) trailerContainer.innerHTML = '';
    
    document.body.style.overflow = '';
}

// Setup search autocomplete
function setupSearchAutocomplete() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    newSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchSuggestionTimeout);
        
        const query = e.target.value.trim();
        if (query.length < 2) {
            hideSearchSuggestions();
            return;
        }
        
        searchSuggestionTimeout = setTimeout(async () => {
            try {
                const [movieRes, tvRes] = await Promise.all([
                    fetch(`${APP_CONFIG.TMDB_BASE_URL}/search/movie?api_key=${APP_CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}`),
                    fetch(`${APP_CONFIG.TMDB_BASE_URL}/search/tv?api_key=${APP_CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}`)
                ]);
                
                const [movieData, tvData] = await Promise.all([
                    movieRes.json(),
                    tvRes.json()
                ]);
                
                const allResults = [
                    ...(movieData.results || []).map(m => ({...m, media_type: 'movie'})),
                    ...(tvData.results || []).map(t => ({...t, media_type: 'tv'}))
                ].sort((a, b) => b.popularity - a.popularity).slice(0, 10);
                
                if (allResults.length > 0) {
                    showSearchSuggestions(allResults, query);
                } else {
                    hideSearchSuggestions();
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        }, 300);
    });
    
    newSearchInput.addEventListener('focus', () => {
        const query = newSearchInput.value.trim();
        if (query.length >= 2) {
            newSearchInput.dispatchEvent(new Event('input'));
        }
    });
}

// Show search suggestions
function showSearchSuggestions(items, query) {
    let suggestionsContainer = document.getElementById('searchSuggestions');
    
    if (!suggestionsContainer) {
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'searchSuggestions';
        suggestionsContainer.className = 'search-suggestions';
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) searchContainer.appendChild(suggestionsContainer);
    }
    
    suggestionsContainer.innerHTML = items.map(item => {
        const title = item.title || item.name || 'Unknown';
        const year = item.release_date ? item.release_date.split('-')[0] : (item.first_air_date ? item.first_air_date.split('-')[0] : 'N/A');
        const type = item.media_type === 'movie' ? '🎬' : '📺';
        const poster = item.poster_path 
            ? `${APP_CONFIG.TMDB_IMAGE_BASE}w92${item.poster_path}`
            : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'46\' height=\'69\' viewBox=\'0 0 46 69\'%3E%3Crect width=\'46\' height=\'69\' fill=\'%23333\'/%3E%3C/svg%3E';
        
        const highlightedTitle = title.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 
            match => `<span style="color: var(--primary); font-weight: bold;">${match}</span>`
        );
        
        return `
            <div class="suggestion-item" data-id="${item.id}" data-type="${item.media_type}">
                <img src="${poster}" alt="${title}" style="width: 40px; height: 60px; object-fit: cover; border-radius: 3px;" loading="lazy">
                <div style="flex: 1;">
                    <div style="color: var(--text);">${highlightedTitle}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${year} ${type}</div>
                </div>
            </div>
        `;
    }).join('');
    
    suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const id = item.dataset.id;
            const type = item.dataset.type;
            
            if (id && type) {
                hideSearchSuggestions();
                const searchContainer = document.querySelector('.search-container');
                if (searchContainer) searchContainer.classList.remove('active');
                showContentDetails(id, type);
            }
        });
    });
    
    suggestionsContainer.style.display = 'block';
    suggestionsContainer.style.maxHeight = window.innerWidth <= 768 ? '300px' : '400px';
    suggestionsContainer.style.overflowY = 'auto';
    suggestionsContainer.style.zIndex = '9999';
}

// Hide search suggestions
function hideSearchSuggestions() {
    const suggestions = document.getElementById('searchSuggestions');
    if (suggestions) suggestions.style.display = 'none';
}

// Wishlist functions
function toggleWishlist(id, title, poster, type = 'movie') {
    let wishlist = getWishlist();
    const index = wishlist.findIndex(item => item.id == id && item.type === type);
    
    if (index === -1) {
        wishlist.push({ id, title, poster, type, addedAt: Date.now() });
        showNotification(`✓ Added to wishlist (${type === 'movie' ? 'Movie' : 'TV Show'})`, 'success');
    } else {
        wishlist.splice(index, 1);
        showNotification('✗ Removed from wishlist', 'info');
    }
    
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.WISHLIST, JSON.stringify(wishlist));
    updateWishlistCount();
}

function getWishlist() {
    return JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_KEYS.WISHLIST) || '[]');
}

function updateWishlistCount() {
    const wishlist = getWishlist();
    const count = wishlist.length;
    
    const wishlistBtn = document.getElementById('wishlistBtn');
    if (wishlistBtn) {
        let badge = wishlistBtn.querySelector('.wishlist-count');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'wishlist-count';
                wishlistBtn.appendChild(badge);
            }
            badge.textContent = count;
        } else if (badge) {
            badge.remove();
        }
    }
}

function loadWishlist() {
    updateWishlistCount();
}

function showWishlist() {
    const wishlist = getWishlist();
    const grid = document.getElementById('wishlistGrid');
    if (!grid) return;
    
    if (wishlist.length === 0) {
        grid.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">Your wishlist is empty</p>';
    } else {
        grid.innerHTML = wishlist.map(item => {
            const typeIcon = item.type === 'movie' ? '🎬' : '📺';
            return `
                <div class="movie-card" data-id="${item.id}" data-type="${item.type}">
                    <img class="movie-poster" src="${item.poster}" alt="${item.title}" loading="lazy">
                    <div class="movie-info">
                        <div class="movie-title">${item.title} ${typeIcon}</div>
                    </div>
                    <button class="remove-wishlist" data-id="${item.id}" data-type="${item.type}" data-title="${item.title.replace(/'/g, "\\'")}" data-poster="${item.poster}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        grid.querySelectorAll('.remove-wishlist').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const type = btn.dataset.type;
                const title = btn.dataset.title;
                const poster = btn.dataset.poster;
                toggleWishlist(id, title, poster, type);
                showWishlist();
            });
        });
    }
    
    document.getElementById('wishlistModal').classList.add('show');
}

// Continue watching functions
function getContinueWatching() {
    return JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CONTINUE_WATCHING) || '[]');
}

function loadContinueWatching() {
    const continueWatching = getContinueWatching();
    const section = document.getElementById('continueWatchingSection');
    const slider = document.getElementById('continueWatchingSlider');
    
    if (!section || !slider) return;
    
    if (continueWatching.length > 0) {
        section.style.display = 'block';
        
        Promise.all(continueWatching.slice(0, 10).map(async (item) => {
            try {
                const endpoint = item.type === 'movie' ? 'movie' : 'tv';
                const response = await fetch(
                    `${APP_CONFIG.TMDB_BASE_URL}/${endpoint}/${item.id}?api_key=${APP_CONFIG.TMDB_API_KEY}`
                );
                const content = await response.json();
                return { ...content, progress: item, type: item.type };
            } catch (error) {
                return null;
            }
        })).then(contents => {
            const validContents = contents.filter(c => c && c.id);
            if (validContents.length > 0) {
                slider.innerHTML = validContents.map(content => {
                    const title = content.title || content.name;
                    const percent = (content.progress.timestamp / content.progress.duration) * 100;
                    const typeIcon = content.type === 'movie' ? '🎬' : '📺';
                    
                    const poster = content.poster_path 
                        ? `${APP_CONFIG.TMDB_IMAGE_BASE}w342${content.poster_path}`
                        : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'342\' height=\'513\' viewBox=\'0 0 342 513\'%3E%3Crect width=\'342\' height=\'513\' fill=\'%23192a56\'/%3E%3C/svg%3E';
                    
                    return `
                        <div class="movie-card" data-id="${content.id}" data-type="${content.type}">
                            <img class="movie-poster" src="${poster}" alt="${title}" loading="lazy">
                            <div class="movie-info">
                                <div class="movie-title">${title} ${typeIcon}</div>
                                <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.3); margin-top: 5px; border-radius: 2px;">
                                    <div style="width: ${percent}%; height: 100%; background: var(--primary); border-radius: 2px;"></div>
                                </div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">
                                    ${Math.floor(content.progress.timestamp / 60)}:${Math.floor(content.progress.timestamp % 60).toString().padStart(2, '0')} / ${Math.floor(content.progress.duration / 60)}:${Math.floor(content.progress.duration % 60).toString().padStart(2, '0')}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                section.style.display = 'none';
            }
        });
    } else {
        section.style.display = 'none';
    }
}

// Watch history
function addToWatchHistory(contentId, type = 'movie') {
    let history = getWatchHistory();
    const entry = { id: contentId, type, timestamp: Date.now() };
    
    const existingIndex = history.findIndex(item => item.id == contentId && item.type === type);
    if (existingIndex !== -1) history.splice(existingIndex, 1);
    
    history.unshift(entry);
    if (history.length > 50) history = history.slice(0, 50);
    
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.WATCH_HISTORY, JSON.stringify(history));
}

function getWatchHistory() {
    return JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_KEYS.WATCH_HISTORY) || '[]');
}

// Setup search
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchInput || !searchResults) return;
    
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    newSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        
        const query = e.target.value.trim();
        if (query.length < 2) {
            searchResults.classList.remove('show');
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(
                    `${APP_CONFIG.TMDB_BASE_URL}/search/multi?api_key=${APP_CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}`
                );
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const filteredResults = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
                    
                    searchResults.innerHTML = filteredResults.slice(0, 8).map(item => {
                        const title = item.title || item.name;
                        const poster = item.poster_path 
                            ? `${APP_CONFIG.TMDB_IMAGE_BASE}w92${item.poster_path}`
                            : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'46\' height=\'69\' viewBox=\'0 0 46 69\'%3E%3Crect width=\'46\' height=\'69\' fill=\'%23333\'/%3E%3C/svg%3E';
                        const year = (item.release_date || item.first_air_date || '').split('-')[0];
                        const typeIcon = item.media_type === 'movie' ? '🎬' : '📺';
                        
                        return `
                            <div class="search-result-item" data-id="${item.id}" data-type="${item.media_type}">
                                <img src="${poster}" alt="${title}" style="width: 46px; height: 69px; object-fit: cover;">
                                <div>
                                    <div style="color: var(--text);">${title}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${year || ''} ${typeIcon}</div>
                                </div>
                            </div>
                        `;
                    }).join('');
                    
                    searchResults.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const id = item.dataset.id;
                            const type = item.dataset.type;
                            showContentDetails(id, type);
                            searchResults.classList.remove('show');
                            newSearchInput.value = '';
                            const searchContainer = document.querySelector('.search-container');
                            if (searchContainer) searchContainer.classList.remove('active');
                        });
                    });
                    
                    searchResults.classList.add('show');
                } else {
                    searchResults.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-secondary);">No results found</div>';
                    searchResults.classList.add('show');
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        }, 500);
    });
    
    document.addEventListener('click', (e) => {
        if (!newSearchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('show');
            hideSearchSuggestions();
        }
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const isMobile = window.innerWidth <= 768;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;
    notification.style.cssText = `
        position: fixed;
        top: ${isMobile ? '10px' : '20px'};
        right: ${isMobile ? '10px' : '20px'};
        left: ${isMobile ? '10px' : 'auto'};
        padding: ${isMobile ? '12px 15px' : '15px 25px'};
        background: var(--secondary);
        color: var(--text);
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        z-index: 3000;
        transform: translateX(${isMobile ? '0' : '400px'});
        transition: transform 0.3s ease;
        border-left: 4px solid ${type === 'success' ? '#00ff88' : type === 'error' ? '#ff4757' : 'var(--primary)'};
        text-align: ${isMobile ? 'center' : 'left'};
        font-size: ${isMobile ? '14px' : '16px'};
    `;
    
    document.body.appendChild(notification);
    
    if (!isMobile) {
        setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 10);
    }
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Infinite scroll
function setupInfiniteScroll() {
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        
        scrollTimeout = setTimeout(() => {
            const scrollPosition = window.innerHeight + window.scrollY;
            const threshold = document.body.offsetHeight - 500;
            
            if (scrollPosition >= threshold) {
                if (!isLoading && hasMore) {
                    if (currentMediaType === 'movie') {
                        loadAllMovies();
                    } else {
                        loadAllTVShows();
                    }
                }
            }
        }, 100);
    });
}

// Filter by genre
function filterByGenre(genre) {
    currentGenre = genre;
    currentPage = 1;
    currentTvPage = 1;
    hasMore = true;
    
    if (currentMediaType === 'movie') {
        const movieGrid = document.getElementById('movieGrid');
        if (movieGrid) movieGrid.innerHTML = '';
        loadAllMovies(true);
    } else {
        const tvGrid = document.getElementById('tvGrid');
        if (tvGrid) tvGrid.innerHTML = '';
        loadAllTVShows(true);
    }
    
    const section = document.getElementById('allMoviesSection');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Setup navigation
function setupNavigation() {
    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // If video is playing, don't navigate away
            if (isVideoPlayerActive) {
                showNotification('Please close the video player first', 'warning');
                return;
            }
            
            const href = link.getAttribute('href');
            
            document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            if (href === '#home') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (href === '#movies') {
                document.getElementById('allMoviesSection')?.scrollIntoView({ behavior: 'smooth' });
                currentMediaType = 'movie';
                document.getElementById('movieTab')?.classList.add('active');
                document.getElementById('tvTab')?.classList.remove('active');
            } else if (href === '#tvshows') {
                document.getElementById('allMoviesSection')?.scrollIntoView({ behavior: 'smooth' });
                currentMediaType = 'tv';
                document.getElementById('tvTab')?.classList.add('active');
                document.getElementById('movieTab')?.classList.remove('active');
            } else if (href === '#ai-recommendations') {
                document.getElementById('aiRecommendationsSection')?.scrollIntoView({ behavior: 'smooth' });
            } else if (href === '#search') {
                document.getElementById('searchInput')?.focus();
            } else if (href === '#wishlist') {
                showWishlist();
            }
        });
    });
}

// Setup video player controls with custom scrollbars
function setupVideoPlayerControls() {
    const style = document.createElement('style');
    style.textContent = `
        /* Custom Scrollbar Styles */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        
        ::-webkit-scrollbar-track {
            background: var(--surface);
            border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            border-radius: 10px;
            border: 2px solid var(--surface);
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, var(--primary-dark), var(--primary));
        }
        
        ::-webkit-scrollbar-corner {
            background: var(--surface);
        }
        
        /* Firefox Scrollbar */
        * {
            scrollbar-width: thin;
            scrollbar-color: var(--primary) var(--surface);
        }
        
        /* Modal content scrollbars */
        .modal-content {
            scrollbar-width: thin;
            scrollbar-color: var(--primary) var(--surface);
        }
        
        .modal-content::-webkit-scrollbar {
            width: 8px;
        }
        
        .modal-content::-webkit-scrollbar-track {
            background: var(--surface);
            border-radius: 8px;
        }
        
        .modal-content::-webkit-scrollbar-thumb {
            background: var(--primary);
            border-radius: 8px;
        }
        
        /* Search suggestions scrollbar */
        .search-suggestions {
            scrollbar-width: thin;
            scrollbar-color: var(--primary) var(--surface);
        }
        
        .search-suggestions::-webkit-scrollbar {
            width: 6px;
        }
        
        .search-suggestions::-webkit-scrollbar-track {
            background: var(--surface);
            border-radius: 6px;
        }
        
        .search-suggestions::-webkit-scrollbar-thumb {
            background: var(--primary);
            border-radius: 6px;
        }
        
        /* Movie sliders horizontal scrollbar */
        .movie-slider {
            scrollbar-width: thin;
            scrollbar-color: var(--primary) var(--surface);
            padding-bottom: 10px;
        }
        
        .movie-slider::-webkit-scrollbar {
            height: 8px;
        }
        
        .movie-slider::-webkit-scrollbar-track {
            background: var(--surface);
            border-radius: 8px;
        }
        
        .movie-slider::-webkit-scrollbar-thumb {
            background: var(--primary);
            border-radius: 8px;
        }
        
        /* Hide scrollbar when not needed but keep functionality */
        .movie-slider {
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
        }
        
        /* Custom video player */
        .custom-video-player { 
            position: relative; 
            width: 100%; 
            background: black; 
        }
        
        .control-btn.close-btn { 
            position: relative; 
            z-index: 30; 
        }
        
        iframe { 
            width: 100%; 
            height: 100%; 
            border: none; 
        }
        
        .new-badge {
            position: absolute;
            top: 10px;
            left: 10px;
            background: linear-gradient(135deg, #ff4757, #ff6b81);
            color: white;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: bold;
            z-index: 10;
            box-shadow: 0 2px 10px rgba(255, 71, 87, 0.3);
            animation: pulse 2s infinite;
            border: 1px solid rgba(255, 255, 255, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .new-badge-large {
            display: inline-block;
            background: linear-gradient(135deg, #ff4757, #ff6b81);
            color: white;
            padding: 5px 15px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: bold;
            margin-left: 15px;
            box-shadow: 0 2px 15px rgba(255, 71, 87, 0.4);
            animation: pulse 2s infinite;
            border: 1px solid rgba(255, 255, 255, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        #serverSelectionModal .modal-content {
            animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
            from {
                transform: translateY(50px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        /* Hero section fade animation */
        .hero-banner {
            transition: background-image 0.5s ease-in-out;
        }
        
        .hero-title, .hero-desc, .hero-buttons {
            transition: opacity 0.3s ease-in-out;
        }
        
        .fade-out {
            opacity: 0;
        }
        
        /* Video playing state */
        body.video-playing {
            overflow: hidden;
        }
        
        body.video-playing .header,
        body.video-playing .nav-links,
        body.video-playing .mobile-nav {
            pointer-events: none;
            opacity: 0.5;
        }
        
        @media (max-width: 768px) {
            .search-container {
                position: fixed;
                top: 70px;
                left: 10px;
                right: 10px;
                width: auto !important;
                z-index: 9999;
                background: var(--surface);
                border-radius: 30px;
                padding: 5px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                border: 2px solid var(--primary);
                display: none;
            }
            
            .search-container.active { display: block; animation: slideDown 0.3s ease; }
            
            .search-container input {
                width: 100% !important;
                padding: 15px 45px 15px 20px !important;
                font-size: 16px !important;
                background: var(--secondary) !important;
                border: none !important;
                color: white !important;
                border-radius: 25px !important;
            }
            
            .search-container input::placeholder {
                color: rgba(255, 255, 255, 0.6);
                font-size: 16px;
            }
            
            .search-results, .search-suggestions {
                position: fixed;
                top: 140px;
                left: 10px;
                right: 10px;
                max-height: 60vh !important;
                background: var(--surface);
                border-radius: 15px;
                border: 2px solid var(--primary);
                z-index: 9999 !important;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            }
            
            .search-result-item, .suggestion-item {
                padding: 15px !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .custom-video-player { height: 50vh; }
            
            .modal .modal-content {
                max-height: 90vh;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            body.modal-open {
                overflow: hidden;
                position: fixed;
                width: 100%;
            }
        }
        
        @media (max-width: 480px) {
            .search-container input { font-size: 16px !important; padding: 12px 40px 12px 15px !important; }
            .search-results, .search-suggestions { top: 130px; }
            .new-badge { font-size: 9px; padding: 3px 6px; }
            .new-badge-large { font-size: 12px; padding: 4px 12px; margin-left: 10px; }
            
            /* Smaller scrollbars on mobile */
            ::-webkit-scrollbar {
                width: 4px;
                height: 4px;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Welcome message
function showWelcomeMessage(container) {
    const isMobile = window.innerWidth <= 768;
    
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(0, 168, 255, 0.95), rgba(0, 102, 255, 0.95));
        color: white;
        padding: ${isMobile ? '8px 16px' : '10px 20px'};
        border-radius: 30px;
        text-align: center;
        z-index: 1000;
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        animation: slideDown 0.5s ease;
        font-size: ${isMobile ? '11px' : '13px'};
        font-weight: 500;
        pointer-events: none;
        border-left: 4px solid #ffd700;
    `;
    
    welcomeDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
            <span>🎬</span>
            <span>Loading video player...</span>
            <span>🎬</span>
        </div>
    `;
    
    container.appendChild(welcomeDiv);
    
    welcomeMessageTimeout = setTimeout(() => {
        welcomeDiv.classList.add('fade-out');
        setTimeout(() => welcomeDiv.remove(), 500);
    }, 5000);
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('closeModal')?.addEventListener('click', () => {
        document.getElementById('movieModal').classList.remove('show');
        lastViewedContent = null;
    });
    
    document.getElementById('closeTrailerModal')?.addEventListener('click', closeTrailer);
    document.getElementById('closeVideoModal')?.addEventListener('click', closeVideoPlayer);
    document.getElementById('closeWishlistModal')?.addEventListener('click', () => {
        document.getElementById('wishlistModal').classList.remove('show');
    });
    
    document.getElementById('wishlistBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (isVideoPlayerActive) {
            showNotification('Please close the video player first', 'warning');
            return;
        }
        
        showWishlist();
    });
    
    document.getElementById('watchNowHero')?.addEventListener('click', () => {
        if (isVideoPlayerActive) {
            showNotification('Please close the current video first', 'warning');
            return;
        }
        
        const heroData = document.getElementById('heroBanner').dataset;
        if (heroData.contentId && heroData.contentType) {
            document.getElementById('movieModal').classList.remove('show');
            
            const contentData = {
                contentId: heroData.contentId,
                type: heroData.contentType,
                title: JSON.parse(heroData.contentData).title || JSON.parse(heroData.contentData).name,
                poster_path: JSON.parse(heroData.contentData).poster_path
            };
            
            showServerSelectionModal(contentData);
        }
    });
    
    document.getElementById('watchTrailerHero')?.addEventListener('click', async () => {
        if (isVideoPlayerActive) {
            showNotification('Please close the video player first', 'warning');
            return;
        }
        
        const heroData = document.getElementById('heroBanner').dataset;
        if (heroData.contentData) {
            const content = JSON.parse(heroData.contentData);
            try {
                const endpoint = heroData.contentType === 'movie' ? 'movie' : 'tv';
                const response = await fetch(
                    `${APP_CONFIG.TMDB_BASE_URL}/${endpoint}/${content.id}/videos?api_key=${APP_CONFIG.TMDB_API_KEY}`
                );
                const data = await response.json();
                const trailer = data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                if (trailer) {
                    playTrailer(trailer.key);
                } else {
                    showNotification('No trailer available', 'info');
                }
            } catch (error) {
                console.error('Error loading trailer:', error);
                showNotification('Error loading trailer', 'error');
            }
        }
    });
    
    document.getElementById('wishlistHero')?.addEventListener('click', () => {
        const heroData = document.getElementById('heroBanner').dataset;
        if (heroData.contentData) {
            const content = JSON.parse(heroData.contentData);
            const title = content.title || content.name;
            const posterUrl = content.poster_path 
                ? `${APP_CONFIG.TMDB_IMAGE_BASE}w342${content.poster_path}`
                : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'342\' height=\'513\' viewBox=\'0 0 342 513\'%3E%3Crect width=\'342\' height=\'513\' fill=\'%23192a56\'/%3E%3C/svg%3E';
            toggleWishlist(content.id, title, posterUrl, heroData.contentType || 'movie');
        }
    });
    
    document.querySelectorAll('.genre-item').forEach(item => {
        item.addEventListener('click', () => {
            if (isVideoPlayerActive) {
                showNotification('Please close the video player first', 'warning');
                return;
            }
            
            document.querySelectorAll('.genre-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            filterByGenre(item.dataset.genre);
        });
    });
    
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        const header = document.querySelector('.header');
        if (header) {
            if (currentScroll > lastScroll && currentScroll > 100) {
                header.classList.add('hide');
            } else {
                header.classList.remove('hide');
            }
        }
        lastScroll = currentScroll;
    });
    
    setupSearch();
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
            if (e.target.id === 'trailerModal') closeTrailer();
            if (e.target.id === 'videoPlayerModal') closeVideoPlayer();
        }
    });
}

// Additional styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: var(--secondary);
        color: var(--text);
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        z-index: 3000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        border-left: 4px solid var(--primary);
    }
    
    .notification.show { transform: translateX(0); }
    .notification.success { border-left-color: #00ff88; }
    .notification.error { border-left-color: #ff4757; }
    .notification.info { border-left-color: var(--primary); }
    
    .search-result-item, .suggestion-item {
        display: flex;
        gap: 10px;
        padding: 10px;
        cursor: pointer;
        transition: background 0.3s ease;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        background: var(--secondary);
        color: var(--text);
    }
    
    .search-result-item:hover, .suggestion-item:hover { background: var(--surface); }
    .search-result-item:last-child, .suggestion-item:last-child { border-bottom: none; }
    
    .search-suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--secondary);
        border-radius: 5px;
        margin-top: 5px;
        max-height: 400px;
        overflow-y: auto;
        z-index: 2000;
        display: none;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
    }
    
    .wishlist-count {
        position: absolute;
        top: -5px;
        right: -5px;
        background: var(--primary);
        color: white;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .remove-wishlist {
        position: absolute;
        top: 5px;
        right: 5px;
        background: rgba(255, 71, 87, 0.8);
        border: none;
        color: white;
        width: 25px;
        height: 25px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 10;
    }
    
    .movie-card:hover .remove-wishlist { opacity: 1; }
    .remove-wishlist:hover { background: #ff4757; }
    
    .media-tabs {
        display: flex;
        gap: 20px;
        margin: 20px 0;
        justify-content: center;
    }
    
    .media-tab {
        padding: 12px 30px;
        background: var(--surface);
        border: 2px solid var(--primary);
        border-radius: 30px;
        color: var(--text);
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s ease;
    }
    
    .media-tab:hover, .media-tab.active {
        background: var(--primary);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 168, 255, 0.3);
    }
`;

document.head.appendChild(style);

// Global functions
window.showContentDetails = showContentDetails;
window.playContentWithServer = playContentWithServer;
window.playTrailer = playTrailer;
window.toggleWishlist = toggleWishlist;
window.showWishlist = showWishlist;
window.closeVideoPlayer = closeVideoPlayer;
window.closeTrailer = closeTrailer;
window.retryWithServer = retryWithServer;