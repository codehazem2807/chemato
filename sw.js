/* ============================================================
   CHEMOTO — Service Worker V5 (بسيط ومستقر)
   ============================================================ */

const CACHE_VERSION = 'chemato-v5';
const STATIC_CACHE = CACHE_VERSION + '-static';
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';

// الملفات الأساسية
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png'
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', (event) => {
    console.log('📦 SW: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                return Promise.all(
                    PRECACHE_URLS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn('⚠️ Precache failed:', url, err);
                        })
                    )
                );
            })
            .then(() => {
                console.log('✅ SW: Installed');
                return self.skipWaiting();
            })
    );
});

// ============================================================
// ACTIVATE
// ============================================================
self.addEventListener('activate', (event) => {
    console.log('🎬 SW: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => !name.startsWith(CACHE_VERSION))
                    .map(name => caches.delete(name))
            );
        }).then(() => {
            console.log('✅ SW: Activated');
            return self.clients.claim();
        })
    );
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;

    // Supabase API — Network first
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(networkFirst(request, DYNAMIC_CACHE));
        return;
    }

    // Navigation — Network first
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, STATIC_CACHE));
        return;
    }

    // الباقي — Cache first
    event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ============================================================
// STRATEGIES
// ============================================================
async function cacheFirst(request, cacheName) {
    try {
        const cached = await caches.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response && response.status === 200 && response.type === 'basic') {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
    }
}

// ============================================================
// MESSAGES
// ============================================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
