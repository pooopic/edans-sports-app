const CACHE = "edan-tracker-v43";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./js/core/constants.js",
  "./js/core/dates.js",
  "./js/core/defaults.js",
  "./js/core/migrations.js",
  "./js/core/model.js",
  "./js/core/nav.js",
  "./js/core/settings.js",
  "./js/core/state.js",
  "./js/core/sync.js",
  "./js/core/ui.js",
  "./js/fitness/model.js",
  "./js/fitness/progress.js",
  "./js/fitness/runbuilder.js",
  "./js/fitness/workout.js",
  "./js/gantt/plan.js",
  "./js/main.js",
  "./js/nutrition/food.js",
  "./js/nutrition/menu.js",
  "./js/nutrition/model.js",
  "./js/nutrition/shopping.js",
  "./js/projects/projects.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// network-first לכל קבצי הליבה (HTML/JS/CSS) — מונע מצב של עיצוב חדש עם קוד ישן.
// הקאש משמש רק כשאין רשת (אופליין). אייקונים ותמונות נשארים cache-first.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // קריאות חוץ (כמו סנכרון GitHub) — ישירות לרשת, בלי קאש
  const isCore =
    e.request.mode === "navigate" ||
    ["document", "script", "style", "manifest"].includes(e.request.destination) ||
    /\.(html|js|css|webmanifest)$/.test(url.pathname);
  if (isCore) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          })
      )
    );
  }
});
