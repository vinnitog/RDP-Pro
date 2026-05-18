// RDP Pro — Service Worker
// Estratégia: network-first para JS/CSS/HTML (garante updates imediatos),
// cache-first para assets estáticos (ícones, manifest).
// Incrementar CACHE_NAME a cada deploy.

const CACHE_NAME = 'rdp-pro-v1.9';

const STATIC_ASSETS = [
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const NETWORK_FIRST = [
  './index.html',
  './paciente.html',
  './',
  './css/app.css',
  './css/therapist.css',
  './js/config.js',
  './js/db.js',
  './js/app.js',
  './js/therapist.js',
  './psicologo.html',
  './therapist.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([...STATIC_ASSETS, ...NETWORK_FIRST]).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith('chrome-extension')) return;

  // Nunca intercepta chamadas externas
  const external = ['supabase.co', 'googleapis.com', 'jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.g'];
  if (external.some(d => e.request.url.includes(d))) return;

  const url = new URL(e.request.url);
  const path = url.pathname;

  // Assets estáticos: cache-first (ícones, manifest — mudam raramente)
  const isStatic = STATIC_ASSETS.some(a => path.endsWith(a.replace('./', '/')));
  if (isStatic) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // JS, CSS, HTML: network-first — garante que deploys aparecem no Ctrl+R
  // Fallback para cache se offline
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          return caches.match('./paciente.html').then(page => page || caches.match('./index.html'));
        }
      }))
  );
});
