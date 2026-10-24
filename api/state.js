// Vercel serverless function: stores the whole tournament in Upstash Redis.
// GET  /api/state  -> anyone can read (viewers)
// POST /api/state  -> only with the correct x-editor-password header (editor)
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = 'efootball:state';

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', req.method === 'GET' ? 'public, max-age=0, s-maxage=2, stale-while-revalidate=5' : 'no-store');
  try {
    if (req.method === 'GET') {
      const v = await redis(['GET', KEY]);
      return res.status(200).json(v ? JSON.parse(v) : null);
    }
    if (req.method === 'POST') {
      const pw = req.headers['x-editor-password'] || '';
      if (!process.env.EDITOR_PASSWORD || pw !== process.env.EDITOR_PASSWORD) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      const b = req.body;
      if (b && b.check) return res.status(200).json({ ok: true });
      if (!b || b.v !== 1 || !Array.isArray(b.players)) {
        return res.status(400).json({ error: 'bad data' });
      }
      await redis(['SET', KEY, JSON.stringify(b)]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};
