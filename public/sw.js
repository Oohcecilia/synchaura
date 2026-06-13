const CACHE_VERSION = "v1";
const STATIC_CACHE = `synchaura-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `synchaura-runtime-${CACHE_VERSION}`;

const APP_SHELL = new URL("./", self.location.origin).href;
const SHELL_ASSETS = [
  new URL("/offline.html", self.location.origin).href,
  new URL("/manifest.webmanifest", self.location.origin).href,
  new URL("/pwa-icon-192.svg", self.location.origin).href,
  new URL("/pwa-icon-512.svg", self.location.origin).href,
];

const SAME_ORIGIN = self.location.origin;

function toAbsoluteUrl(url) {
  try {
    return new URL(url, self.location.href).href;
  } catch {
    return null;
  }
}

function extractShellAssetUrls(html) {
  const urls = new Set();
  const regex = /(?:src|href)=["']([^"'#?]+(?:\?[^"']*)?)["']/g;
  let match;

  while ((match = regex.exec(html))) {
    const absolute = toAbsoluteUrl(match[1]);
    if (absolute && absolute.startsWith(SAME_ORIGIN)) {
      urls.add(absolute);
    }
  }

  return [...urls];
}

async function cacheResponse(cacheName, request, response) {
  if (!response || !response.ok || response.type === "opaque") return;

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function precacheShell() {
  const cache = await caches.open(STATIC_CACHE);
  const response = await fetch(new Request(APP_SHELL, { cache: "no-store" }));

  if (response.ok) {
    await cache.put(APP_SHELL, response.clone());

    const html = await response.text();
    const assetUrls = extractShellAssetUrls(html);
    const requests = [APP_SHELL, ...SHELL_ASSETS, ...assetUrls]
      .filter(Boolean)
      .map((url) => new Request(url, { credentials: "same-origin" }));

    await cache.addAll(requests);
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cacheResponse(STATIC_CACHE, request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const shell = await caches.match(APP_SHELL, { ignoreSearch: true });
    if (shell) return shell;

    return caches.match(new URL("/offline.html", self.location.origin).href);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cacheResponse(RUNTIME_CACHE, request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precacheShell();
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => (keep.has(key) ? Promise.resolve() : caches.delete(key)))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== SAME_ORIGIN) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/pwa-icon")) {
    event.respondWith(cacheFirst(request));
    return;
  }
});
