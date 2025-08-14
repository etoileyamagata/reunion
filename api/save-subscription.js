const { Redis } = require('@upstash/redis');

const redis = new Redis({
  // Upstash / Vercel KV どちらの環境変数名でも動くよう両対応
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const { group_id, device_id, endpoint, p256dh, auth } = req.body || {};
    if (!group_id || !device_id || !endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'invalid body' });
    }
    // グループの購読集合に endpoint を登録
    await redis.sadd(`subs:${group_id}`, endpoint);
    // endpoint ごとの購読メタを保存（上書き）
    await redis.hset(`sub:${endpoint}`, { device_id, p256dh, auth });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
};
