// Service worker: caches the app shell so it opens fast and works offline.
const CACHE = "andiks-v5";
const SHELL = [
  "./", "./index.html", "./login.html", "./staff.html", "./riders.html", "./account.html",
  "./css/style.css", "./js/store.js", "./js/ui.js", "./js/student.js", "./js/login.js", "./js/staff.js", "./js/riders.js", "./js/account.js", "./js/firebase-config.js",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"
];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Firebase traffic goes straight to the network
  // Network first, fall back to cache when offline
  e.respondWith(
    fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
