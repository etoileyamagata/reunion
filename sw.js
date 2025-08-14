const CACHE = 'party-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

// 通知クリックでクライアントをフォーカス
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window' });
    if (all.length > 0) {
      all[0].focus();
    } else {
      clients.openWindow('/');
    }
  })());
});
// Push受信で通知を表示
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); }
  catch { payload = { title: 'お知らせ', body: event.data.text() }; }

  const title = payload.title || 'お知らせ';
  const body  = payload.body  || '';
  const icon  = payload.icon  || '/icon-192.png';
  const badge = payload.badge || '/icon-192.png';
  const tag   = payload.tag   || 'classparty';

  event.waitUntil(self.registration.showNotification(title, { body, icon, badge, tag }));
});

