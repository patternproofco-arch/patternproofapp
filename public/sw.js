// Offline shell for the installed app.
//
// PRIVACY RULE: this worker never stores anything that belongs to a signed-in person. Pages,
// server-function responses and API data are NOT cached. Anything cached here could still be read
// after sign-out, after Quick Exit, or by someone using the device while offline. Only public files
// are kept: the app's static assets (scripts, styles, fonts, images) and the public sign-in/home
// shell, so the installed app can still open and show the sign-in screen with no connection.
const CACHE_VERSION = "v7-prep-no-store";
const CACHE_NAME = `patternproof-${CACHE_VERSION}`;

const SHELL = ["/", "/signin", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png"];

// Static, public, identical for everyone.
const STATIC_FILE = /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|ico|webp|webmanifest)$/i;

function isPrepPath(pathname) {
  // Court-prep intake/study routes: never offline-cached (spec v5).
  return pathname === "/prep" || pathname.startsWith("/prep/");
}

function isCacheableStatic(url) {
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return false;
  if (isPrepPath(url.pathname)) return false;
  return url.pathname.startsWith("/assets/") || STATIC_FILE.test(url.pathname);
}

self.addEventListener("install", (event) => {
  // Cache each entry on its own so one missing file can't block the install.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        SHELL.map((url) =>
          fetch(url, { cache: "reload", credentials: "omit" })
            .then((res) => (res.ok ? cache.put(url, res) : undefined))
            .catch(() => undefined),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Removes every older cache, including earlier versions of this worker that stored pages and
  // data from signed-in sessions.
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET") return;

  // Pages: always the network. Never stored. Offline, fall back to the PUBLIC shell only.
  // /prep/* must never be served from cache (intake / study guide privacy).
  if (request.mode === "navigate") {
    if (isPrepPath(url.pathname)) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match("/signin")) || (await caches.match("/")) || Response.error(),
      ),
    );
    return;
  }

  // Server functions and API calls carry private data: straight to the network, never cached.
  if (!isCacheableStatic(url)) return;

  // Static files: network first, keep a copy for offline. Nothing here varies by person.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const noStore = (response.headers.get("cache-control") || "").includes("no-store");
        if (response && response.status === 200 && response.type === "basic" && !noStore) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
