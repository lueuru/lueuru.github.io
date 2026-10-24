/* 新笔文学社 · 基础版本 —— Service Worker
 * 策略：同源静态资源 cache-first（后台更新）；跨域请求（Supabase）直接走网络。 */
var CACHE = "xinbi-basic-v1";
var SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./work.html",
  "./journal.html",
  "./404.html",
  "./manifest.json",
  "./assets/css/style.css",
  "./assets/js/data.js",
  "./assets/js/config.js",
  "./assets/js/app.js",
  "./assets/icons/icon.svg"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* Supabase 等走网络 */

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        if (req.mode === "navigate") return caches.match("./index.html");
        return hit;
      });
      return hit || net;
    })
  );
});
