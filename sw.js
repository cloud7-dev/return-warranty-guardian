self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("return-warranty-guardian-v1").then((cache) =>
      cache.addAll([
        "./",
        "./index.html",
        "./styles.css",
        "./manifest.webmanifest",
        "./src/app.js",
        "./src/deadline-engine.js",
        "./src/exporters.js",
        "./src/receipt-parser.js",
        "./src/sample-data.js",
        "./src/storage.js",
        "./assets/icon.svg",
      ]),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
