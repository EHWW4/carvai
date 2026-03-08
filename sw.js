/*
 * © 2025 Edward Hirth WoodWorks. All Rights Reserved. Patent Pending.
 * Service Worker — Offline PWA Support
 */
const CACHE = 'carvai-pro-v1';
const ASSETS = ['/', '/index.html', '/app.html', '/manifest.json',
  '/js/auth.js', '/js/engine.js', '/js/ai.js',
  '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.url.includes('anthropic.com') || e.request.url.includes('stripe.com')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    })).catch(() => caches.match('/app.html'))
  );
});
