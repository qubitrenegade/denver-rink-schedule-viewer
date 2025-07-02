const CACHE_NAME = 'denver-rink-schedule-v1';
const STATIC_CACHE_NAME = 'static-v1';
const API_CACHE_NAME = 'api-v1';

// Cache durations (in milliseconds)
const CACHE_DURATIONS = {
  static: 7 * 24 * 60 * 60 * 1000, // 7 days
  api: 5 * 60 * 1000, // 5 minutes
  images: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/all-events',
  '/api/all-metadata'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== STATIC_CACHE_NAME && 
              cacheName !== API_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - handle caching strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // Handle static assets
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(event.request));
    return;
  }
  
  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }
  
  // Default: network first, then cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Handle API requests with stale-while-revalidate strategy
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // If we have a cached response, return it while fetching fresh data
  if (cachedResponse) {
    // Return cached response immediately
    const response = cachedResponse.clone();
    
    // Fetch fresh data in the background
    fetch(request)
      .then(async (freshResponse) => {
        if (freshResponse.ok) {
          const responseToCache = freshResponse.clone();
          await cache.put(request, responseToCache);
          
          // Notify clients about fresh data
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'FRESH_DATA_AVAILABLE',
                url: request.url
              });
            });
          });
        }
      })
      .catch(err => console.log('Background fetch failed:', err));
    
    return response;
  }
  
  // No cached response, fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    console.log('API request failed:', error);
    // Return offline fallback
    return new Response(
      JSON.stringify({ 
        error: 'Offline - no cached data available',
        offline: true 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    console.log('Static asset request failed:', error);
    throw error;
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Return cached index.html for offline navigation
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match('/index.html');
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Check if URL is a static asset
function isStaticAsset(url) {
  return (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.includes('tailwindcss') ||
    url.pathname.includes('esm.sh')
  );
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_CLEAR') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    });
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic here
  console.log('Background sync triggered');
}