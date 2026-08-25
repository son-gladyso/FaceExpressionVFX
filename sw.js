/* ═══════════════════════════════════════════════════════════════
 *  sw.js  –  Service Worker for PWA Offline Support
 *  Strategy: Cache-first for static assets, network-first for CDN
 * ═══════════════════════════════════════════════════════════════ */
'use strict';

var CACHE_NAME = 'facevfx-v3.11.0';

/* Static assets to pre-cache on install */
var PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './face-config.js',
  './face-i18n.js',
  './face-policies.js',
  './face-helpers.js',
  './face-au-detector.js',
  './face-quality.js',
  './face-temporal.js',
  './face-observables.js',
  './face-model-adapter.js',
  './face-detector.js',
  './face-export.js',
  './face-history.js',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* CDN resources (network-first, cached as fallback) */
var CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

/* ── Install: pre-cache local assets ── */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: cache-first for local, network-first for CDN ── */
self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  /* Skip non-GET requests */
  if (event.request.method !== 'GET') return;

  /* CDN resources: network-first with cache fallback */
  var isCDN = CDN_HOSTS.some(function (h) { return url.hostname === h; });
  if (isCDN) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        /* Cache successful CORS (200) and opaque (status 0) responses */
        if (response && (response.status === 200 || response.type === 'opaque')) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(event.request);
      })
    );
    return;
  }

  /* Local assets: cache-first */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        return cached || fetch(event.request).then(function (response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
  }
});
