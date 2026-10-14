/* OnMatKoi ? — service worker
   Fichiers de l'appli : réseau d'abord (mises à jour automatiques), cache si hors ligne.
   Affiches TMDB : cache d'abord. Appels à l'API TMDB : jamais mis en cache ici. */
const VERSION = "onmatkoi-1.1";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./config.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== VERSION && k !== "onmatkoi-img").map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }
  if (url.hostname === "image.tmdb.org") {
    e.respondWith(caches.open("onmatkoi-img").then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") c.put(req, res.clone());
      return res;
    }))));
  }
});
