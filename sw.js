self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("return-warranty-guardian-v11").then((cache) =>
      cache.addAll([
        "./",
        "./index.html",
        "./styles.css",
        "./manifest.webmanifest",
        "./src/app.js",
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
      ]),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== "return-warranty-guardian-v11").map((key) => caches.delete(key)))),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
