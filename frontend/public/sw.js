/* CrewBook Service Worker v3 — PWA caching + push notifications */

const CACHE_VERSION = "crewbook-v3";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Assets to precache on SW install
const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// ── Install ──────────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Non-fatal — assets may not exist yet in dev
      })
    )
  );
});

// ── Activate ────────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const KEEP = [STATIC_CACHE, DYNAMIC_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch routing strategy ────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never intercept API calls or cross-origin requests
  if (url.pathname.startsWith("/api/")) return;
  if (url.origin !== self.location.origin) return;

  // ── Cache-first for CRA static assets (content-hashed → immutable) ─────
  if (url.pathname.startsWith("/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }

  // ── Cache-first for icons / manifest (rarely change) ─────────────────
  if (
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }

  // ── Network-first for HTML navigation; fallback → offline.html ────────
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            caches.open(DYNAMIC_CACHE).then((c) => c.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || caches.match("/offline.html");
        })
    );
    return;
  }
});

// ── Push Notification ────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {
    title: "CrewBook",
    body: "You have a new notification",
    url: "/notifications",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "crewbook-notification",
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: data.url || "/notifications" },
    actions: [
      { action: "open", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Notification Click ───────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
