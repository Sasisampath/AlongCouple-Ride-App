const CACHE = "along-static-webp-v2";
const OFFLINE = "/offline.html";
const PRECACHE = [
  OFFLINE,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll(PRECACHE);
    // Only bundled UI assets are listed here. Auth, pair data and user photos
    // never enter this shared static cache. Missing legacy sources are excluded.
    try {
      const response = await fetch("/image-precache.json", { cache: "no-store" });
      if (response.ok) {
        const assets = await response.json();
        await Promise.allSettled(assets.filter(path => /^\/(brand|onboarding|setup|requests|together)\/[\w-]+\.webp$/.test(path)).map(path => cache.add(path)));
      }
    } catch { /* Runtime requests populate the cache when install is offline. */ }
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }

  const staticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /^\/(brand|onboarding|setup|requests|together)\/[\w-]+\.webp$/.test(url.pathname) ||
    ["/manifest.webmanifest", "/favicon.svg", "/og.png"].includes(url.pathname);

  if (!staticAsset) return;

  const fresh = fetch(request).then(async (response) => {
    if (response.ok) await caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    return response;
  });
  // Keep refresh alive and handle offline failures even when a cached response wins.
  event.waitUntil(fresh.catch(() => {}));
  event.respondWith(caches.match(request).then(cached => cached || fresh));
});
