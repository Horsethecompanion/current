// Caches the app shell only — HTML/CSS/JS/icons — so the display keeps
// running through a wifi blip. Price data is deliberately never cached
// here: it's already handled by the Cloudflare Worker's own short-lived
// edge cache, and this service worker just leaves cross-origin requests
// (the worker, the WITS API) alone entirely.

const CACHE_NAME = "current-shell-v2";

const SHELL_FILES = [
    "./",
    "./index.html",
    "./css/style.css",
    "./js/config.js",
    "./js/mockdata.js",
    "./js/livedata.js",
    "./js/renderer.js",
    "./js/app.js",
    "./manifest.json",
    "./assets/icon-192.png",
    "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_FILES))
            .then(() => self.skipWaiting())
    );

});

self.addEventListener("activate", (event) => {

    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(
                names
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            )
        ).then(() => self.clients.claim())
    );

});

self.addEventListener("fetch", (event) => {

    const url = new URL(event.request.url);

    // Only handle same-origin GET requests for the shell. Everything
    // else (live price fetches to the worker, any future cross-origin
    // calls) passes straight through to the network untouched.

    if (event.request.method !== "GET" || url.origin !== self.location.origin)
        return;

    // Network-first: always prefer a fresh copy when there's a
    // connection, so code changes show up on the very next reload
    // rather than waiting on a manual cache clear. The cache only
    // kicks in if the network request genuinely fails (offline, wifi
    // blip) — that's the one thing it's actually there for.

    event.respondWith(

        fetch(event.request)
            .then(response => {

                if (response.ok) {

                    const copy = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, copy));

                }

                return response;

            })
            .catch(() => caches.match(event.request))

    );

});
