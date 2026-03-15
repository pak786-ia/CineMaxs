// API Configuration
const CONFIG = {
    TMDB_API_KEY: '8d576c8468ee033709f1ea35619de69d',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p/',
    BACKEND_URL: window.location.protocol + '//' + window.location.host,
    
    // Image sizes
    POSTER_SIZES: {
        small: 'w185',
        medium: 'w342',
        large: 'w500',
        original: 'original'
    },
    
    // Backend servers
    SERVERS: ['vixsrc'], // Add more servers as they become available
    
    // Cache settings
    CACHE_DURATION: 3600000, // 1 hour in milliseconds
    
    // Infinite scroll settings
    MOVIES_PER_PAGE: 20,
    
    // AI Settings
    AI_ENABLED: true
};

// Local storage keys
const STORAGE_KEYS = {
    WISHLIST: 'cinemax_wishlist',
    CONTINUE_WATCHING: 'cinemax_continue_watching',
    WATCH_HISTORY: 'cinemax_watch_history',
    CACHE: 'cinemax_cache'
};