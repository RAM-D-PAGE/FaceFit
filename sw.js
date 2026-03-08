const CACHE_NAME = 'facefit-rehab-v4';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './assets/logo.png',
    './assets/cheer-voice.mp3',
    './assets/success-sound.mp3',
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Mitr:wght@400;500;600;700&family=Sarabun:wght@400;600&display=swap'
];

// Install Event - Caches assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all assets');
                return cache.addAll(ASSETS);
            })
    );
    self.skipWaiting();
});

// Activate Event - Cleans up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Serves from cache or network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version if found
                if (response) {
                    return response;
                }

                // Otherwise fetch from network
                return fetch(event.request).then(
                    (networkResponse) => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // Clone the response
                        var responseToCache = networkResponse.clone();

                        // Only cache our own domain assets, never external APIs like Supabase
                        if (event.request.url.startsWith(self.location.origin)) {
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }

                        return networkResponse;
                    }
                );
            }).catch(() => {
                // If offline and request fails, could return an offline page here
            })
    );
});
