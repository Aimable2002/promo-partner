// CopyDesk service worker
// Scope: minimal, safe PWA installability + light offline resilience.
// This intentionally does NOT cache API/Supabase calls or hashed JS/CSS
// build output — trading data must always be fresh. It only pre-caches
// the static app-shell assets (icons, manifest) and falls back to a
// cached copy of the page shell when the network is unreachable.

const CACHE_VERSION = "copydesk-signals-shell-v1";
const APP_SHELL = [
  "/",
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests; let everything else (Supabase,
  // API calls, cross-origin fonts, etc.) pass straight through untouched.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API-style routes — always hit the network.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first so users always get fresh data/routing when
  // online, with a cached shell fallback when fully offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/", { ignoreSearch: true }))
    );
    return;
  }

  // Static app-shell assets (icons/manifest): cache-first, network fallback.
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
