/* ============================================================
   CHEMOTO 4.0 — Service Worker
   Cache Strategy:
   - App shell: Cache-first
   - API (Supabase): Network-first
   - Images: Stale-while-revalidate
   ============================================================ */

const CACHE_VERSION = 'chemato-v4.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Core assets to precache
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png',
    '/logo-120.png',
    '/logo-152.png',
    '/logo-180.png',
    '/logo-192.png',
    '/logo-512.png',
    '/offline.html'
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                return Promise.allSettled(
                    PRECACHE_URLS.map(url =>
                        cache.add(url).catch(err => console.warn('Precache failed:', url, err))
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================================
// ACTIVATE
// ============================================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => !name.startsWith(CACHE_VERSION))
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET
    if (request.method !== 'GET') return;

    // Skip chrome-extension, etc.
    if (!url.protocol.startsWith('http')) return;

    // Skip Supabase auth requests (always network)
    if (url.hostname.includes('supabase.co') && url.pathname.includes('/auth/')) {
        return;
    }

    // === API calls (Supabase) — Network-first ===
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(networkFirst(request, DYNAMIC_CACHE));
        return;
    }

    // === Images — Stale-while-revalidate ===
    if (request.destination === 'image' ||
        url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i)) {
        event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
        return;
    }

    // === Fonts/CSS from CDN — Cache-first ===
    if (url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('cdn.jsdelivr.net')) {
        event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
        return;
    }

    // === Navigation (HTML pages) — Network-first with offline fallback ===
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    // === Everything else — Cache-first ===
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
        return new Response('Offline', { status: 503, statusText: 'Offline' });
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
        return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function networkFirstNavigation(request) {
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Fallback to offline page
        const offline = await caches.match('/offline.html');
        if (offline) return offline;

        // Ultimate fallback
        return new Response(
            `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>غير متصل</title></head>
            <body style="font-family:sans-serif;text-align:center;padding:40px;background:#f6f8fb;">
            <h1>🔌 أنت غير متصل بالإنترنت</h1>
            <p>يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.</p>
            <button onclick="location.reload()" style="padding:12px 24px;background:#2ecc71;color:#fff;border:none;border-radius:999px;font-weight:bold;cursor:pointer;">إعادة المحاولة</button>
            </body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => cached);

    return cached || fetchPromise;
}

// ============================================================
// MESSAGE HANDLING
// ============================================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
    }
});

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data = { title: 'كيماتو', body: 'لديك إشعار جديد', icon: '/logo-192.png', badge: '/logo-192.png' };

    try {
        const parsed = event.data.json();
        data = { ...data, ...parsed };
    } catch (e) {
        data.body = event.data.text();
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || '/logo-192.png',
            badge: data.badge || '/logo-192.png',
            dir: 'rtl',
            lang: 'ar',
            tag: data.tag || 'chemato-notification',
            data: { url: data.url || '/' },
            vibrate: [200, 100, 200],
            requireInteraction: false
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
