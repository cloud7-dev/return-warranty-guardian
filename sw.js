const CACHE_NAME = "return-warranty-guardian-v12";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/attachment-storage.js",
  "./src/deadline-engine.js",
  "./src/exporters.js",
  "./src/i18n.js",
  "./src/importers.js",
  "./src/local-extraction.js",
  "./src/local-ocr-worker.js",
  "./src/policy-templates.js",
  "./src/receipt-parser.js",
  "./src/sample-data.js",
  "./src/storage.js",
  "./assets/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./offline.html").then((cached) => cached || caches.match("./index.html"))));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
    ),
  );
});
