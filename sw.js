/* سرویس‌ورکر «میز کار علی رأفتی» — کار آفلاین و اطلاع نسخهٔ جدید
   فقط درخواست‌های همین دامنه را می‌گیرد؛ APIها و فاویکون‌های بیرونی مستقیم رد می‌شوند */
var CACHE = 'mezkar-ali-v23';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* هر فایل جداگانه؛ اگر یکی نبود، بقیهٔ کش خراب نمی‌شود */
      return Promise.all(ASSETS.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      var old = keys.filter(function (k) { return k !== CACHE; });
      return Promise.all(old.map(function (k) { return caches.delete(k); })).then(function () {
        return old.length > 0;   /* فقط وقتی نسخهٔ قبلی وجود داشت، «به‌روزرسانی» اعلام شود */
      });
    }).then(function (updated) {
      return self.clients.claim().then(function () {
        if (!updated) return;
        return self.clients.matchAll({ includeUncontrolled: true }).then(function (cs) {
          cs.forEach(function (c) { c.postMessage({ type: 'updated' }); });
        });
      });
    })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   /* API و فاویکون‌های بیرونی: بدون دخالت */

  /* صفحهٔ اصلی: اول کش (لود فوری)، بعد به‌روزرسانی بی‌صدا در پس‌زمینه؛
     اگر نسخهٔ تازه‌تر رسید، یک بار «نسخهٔ جدیدتر آماده است» اعلام می‌شود */
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      caches.match('./index.html').then(function (cached) {
        /* بدنهٔ هر Response فقط یک بار خوانده می‌شود؛ پس برای مقایسه نسخهٔ جدا (clone) نگه می‌داریم */
        var oldCopy = cached ? cached.clone() : null;
        var bg = null;
        var net = fetch(e.request).then(function (r) {
          if (!r || !r.ok) return r;
          var forCache = r.clone(), forCompare = r.clone();
          bg = caches.open(CACHE).then(function (c) { return c.put('./index.html', forCache); }).then(function () {
            if (!oldCopy) return;
            return Promise.all([oldCopy.text(), forCompare.text()]).then(function (t) {
              if (t[0] === t[1]) return;
              return self.clients.matchAll({ includeUncontrolled: true }).then(function (cs) {
                cs.forEach(function (c) { c.postMessage({ type: 'updated' }); });
              });
            });
          }).catch(function () {});
          return r;
        }).catch(function () { return Response.error(); });
        /* سرویس‌ورکر تا تمام‌شدن به‌روزرسانی پس‌زمینه زنده بماند */
        e.waitUntil(net.then(function () { return bg; }).catch(function () {}));
        return cached || net;
      })
    );
    return;
  }

  /* بقیهٔ فایل‌های همین دامنه: اول کش، بعد شبکه */
  e.respondWith(
    caches.match(e.request).then(function (r) {
      if (r) return r;
      return fetch(e.request).then(function (resp) {
        if (resp.ok) {
          var cp = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
        }
        return resp;
      });
    })
  );
});
