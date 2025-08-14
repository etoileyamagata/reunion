const { Redis } = require('@upstash/redis');
const webpush = require('web-push');

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails('mailto:noreply@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const redis = new Redis({
  // Upstash / Vercel KV の両方の環境変数名に対応
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { group_id, exclude_device_id, title, body } = req.body || {};
    if (!group_id) return res.status(400).json({ error: 'missing group_id' });

    // グループ購読者のendpoint一覧
    const endpoints = await redis.smembers(`subs:${group_id}`);
    if (!endpoints || endpoints.length === 0) return res.status(200).json({ ok: true, sent: 0 });

    const payload = JSON.stringify({
      title: title || '新しい予定',
      body: body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'classparty'
    });

    let sent = 0;
    const toDelete = [];

    for (const ep of endpoints) {
      const meta = await redis.hgetall(`sub:${ep}`);
      if (!meta) { toDelete.push(ep); continue; }
      if (exclude_device_id && meta.device_id === exclude_device_id) continue;

      // 保存時にbase64化済みの鍵をそのまま渡す
      const sub = { endpoint: ep, keys: { p256dh: meta.p256dh, auth: meta.auth } };

      try {
        await webpush.sendNotification(sub, payload);
        sent += 1;
      } catch (e) {
        // 404/410 は無効購読なので掃除候補へ
        if (e.statusCode === 404 || e.statusCode === 410) {
          toDelete.push(ep);
        } else {
          console.error('push error', e.statusCode, e.body);
        }
      }
    }

    // 無効購読の掃除
    for (const ep of toDelete) {
      await redis.srem(`subs:${group_id}`, ep);
      await redis.del(`sub:${ep}`);
    }

    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
};
