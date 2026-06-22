const CACHE_NAME = "chronos-otp-v1";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg"
];

// Install event: cache initial shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching offline shell");
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.error("[Service Worker] Pre-cache failed:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network first, fallback to Cache
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip API calls or non-GET requests (e.g. POST /api/ntp-sync)
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Skip non-HTTP/S protocols (e.g. extension schemes)
  if (!request.url.startsWith("http")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache valid successful responses
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch((err) => {
        console.log("[Service Worker] Network request failed. Falling back to Cache for:", request.url);
        
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // If navigation path fails, fall back to cached index root
          if (request.mode === "navigate") {
            return caches.match("/");
          }

          // Let it fail naturally if not cached
          return Promise.reject(err);
        });
      })
  );
});
