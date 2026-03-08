const CACHE_NAME = 'facefit-rehab-v2';
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

                        // Clone the response because it's a stream and can only be consumed once
                        var responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // Do not cache external cross-origin requests unless necessary
                                if (event.request.url.indexOf('http') === 0) {
                                    cache.put(event.request, responseToCache);
                                }
                            });

                        return networkResponse;
                    }
                );
            }).catch(() => {
                // If offline and request fails, could return an offline page here
            })
    );
});
