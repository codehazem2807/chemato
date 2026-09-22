/* ============================================================
   كيماتو - Service Worker v4.0
   ============================================================ */

const CACHE_VERSION = 'chemato-v4.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const MAX_DYNAMIC_ITEMS = 50;
const MAX_IMAGE_ITEMS = 100;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/all-products.html',
    '/all-requests.html',
    '/chemato-suppliers.html',
    '/blog.html',
    '/manifest.json',
    '/logo.png',
    '/offline.html',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...', CACHE_VERSION);
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(STATIC_ASSETS).catch(err => console.warn('Cache addAll:', err)))
            .then(() => self.skipWaiting())
    );
});

// ============================================================
// ACTIVATE
// ============================================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...', CACHE_VERSION);
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter(name => !name.startsWith(CACHE_VERSION))
                        .map(name => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip supabase requests
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE, 1000 * 60 * 5));
        return;
    }

    // Skip chrome-extension requests
    if (url.protocol === 'chrome-extension:') return;

    // Images: Cache first
    if (request.destination === 'image') {
        event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE, MAX_IMAGE_ITEMS));
        return;
    }

    // Fonts/CSS/JS: Stale-while-revalidate
    if (['style', 'script', 'font'].includes(request.destination)) {
        event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
        return;
    }

    // HTML: Network first with cache fallback
    if (request.destination === 'document') {
        event.respondWith(networkFirstWithCache(request, STATIC_CACHE));
        return;
    }

    // Default
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
});

// ============================================================
// STRATEGIES
// ============================================================
async function cacheFirstWithLimit(request, cacheName, maxItems = MAX_DYNAMIC_ITEMS) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
            // Trim cache
            trimCache(cacheName, maxItems);
        }
        return response;
    } catch (err) {
        return new Response('', { status: 408, statusText: 'Offline' });
    }
}

async function networkFirstWithCache(request, cacheName, timeout = 3000) {
    const cache = await caches.open(cacheName);
    try {
        const networkPromise = fetch(request);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeout)
        );
        const response = await Promise.race([networkPromise, timeoutPromise]);

        if (response.ok) {
            cache.put(request, response.clone());
            trimCache(cacheName, MAX_DYNAMIC_ITEMS);
        }
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;

        // If HTML and no cache → offline page
        if (request.destination === 'document') {
            const offlinePage = await caches.match('/offline.html');
            if (offlinePage) return offlinePage;
        }

        return new Response('Offline', { status: 503 });
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    }).catch(() => cached);

    return cached || fetchPromise;
}

// ============================================================
// TRIM CACHE
// ============================================================
async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        await cache.delete(keys[0]);
        trimCache(cacheName, maxItems);
    }
}

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');
    let data = { title: 'كيماتو', body: 'لديك إشعار جديد', icon: '/logo-192.png', url: '/' };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch (e) {}

    const options = {
        body: data.body,
        icon: data.icon || '/logo-192.png',
        badge: '/badge-72.png',
        vibrate: [100, 50, 100],
        dir: 'rtl',
        lang: 'ar',
        tag: data.tag || 'chemato-notification',
        renotify: true,
        requireInteraction: false,
        actions: data.actions || [
            { action: 'open', title: 'افتح', icon: '/icon-open.png' },
            { action: 'close', title: 'إغلاق', icon: '/icon-close.png' },
        ],
        data: { url: data.url || '/' },
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const action = event.action;
    const url = event.notification.data?.url || '/';

    if (action === 'close') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(url);
                        return client.focus();
                    }
                }
                if (clients.openWindow) return clients.openWindow(url);
            })
    );
});

// ============================================================
// BACKGROUND SYNC
// ============================================================
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    if (event.tag === 'chemato-sync') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Placeholder for background sync
    console.log('[SW] Syncing data...');
}

// ============================================================
// MESSAGE FROM CLIENT
// ============================================================
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data?.type === 'CLEAR_CACHE') {
        caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
    }
});

console.log('[SW] Loaded:', CACHE_VERSION);
