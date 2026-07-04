/**
 * Minimal Service Worker for PWA
 * Phase 1: Basic registration only, no offline logic
 */

const CACHE_NAME = 'sufra-lite-v1';
const CACHE_VERSION = '1.0.0';

// Install event - minimal setup
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...', CACHE_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - pass through to network (no caching in Phase 1)
self.addEventListener('fetch', (event) => {
  // Phase 1: Only intercept same-origin requests
  // External requests (fonts, CDNs, etc.) bypass service worker
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  
  if (!isSameOrigin) {
    // Let external requests pass through without interception
    return;
  }
  
  // Same-origin requests: pass through to network (no caching in Phase 1)
  event.respondWith(fetch(event.request));
});
