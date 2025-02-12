const CACHE_NAME = "raspberry-electric-lock:1.0.0-alpha.0";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll([
          "/",
          "/index.html",
          "/style.css",
          "/script.js",
          "/manifest.json",
          "https://cdn.tailwindcss.com",
        ]),
      ),
  );
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request)),
  );
});
