/**
 * FaceFit Service Worker v3.0
 * Phase 1-4: Offline support + new asset caching
 */
const CACHE_NAME = 'facefit-rehab-v3';

const CORE_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './style.css',
  './game.js',
  './db.js',
  './config.js',
  './manifest.json',
  './assets/logo.png',
  './assets/cheer-voice.mp3',
  './assets/success-sound.mp3',
];

const CDN_ASSETS = [
  // MediaPipe
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
  // FontAwesome
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  // Google Fonts — Kanit + Sarabun (v3 design)
  'https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;800&family=Sarabun:wght@400;500;600&display=swap',
  // Chart.js (for dashboard)
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// ── Install: cache everything ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Caching core assets...');
      // Cache core assets (allow partial failure for missing audio)
      await Promise.allSettled(
        CORE_ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] Skip:', url, e.message)))
      );
      // Cache CDN assets
      await Promise.allSettled(
        CDN_ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] Skip CDN:', url)))
      );
      console.log('[SW] ✅ Cache complete');
    })
  );
  self.skipWaiting();
});

// ── Activate: clear old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter(n => n !== CACHE_NAME)
          .map(n => { console.log('[SW] Clearing old cache:', n); return caches.delete(n); })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for assets, network-first for API ──────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Supabase, Claude API, or other external API calls
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('googleapis.com') && url.pathname.includes('/token') ||
    event.request.method !== 'GET'
  ) {
    return; // Let network handle it
  }

  // Cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          // Cache same-origin assets and approved CDN
          const isSameOrigin = url.origin === self.location.origin;
          const isApprovedCDN = CDN_ASSETS.some(cdn => event.request.url.startsWith(cdn.split('/').slice(0,3).join('/')));
          if (isSameOrigin || isApprovedCDN) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback for HTML pages
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
    })
  );
});

// ── Background sync for saving sessions when back online ──────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sessions') {
    event.waitUntil(syncPendingSessions());
  }
});

async function syncPendingSessions() {
  // Notify all clients to retry saving pending sessions
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_SESSIONS' }));
}