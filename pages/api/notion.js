// pages/api/notion.js
export default async function handler(req, res) {
  // ---------- CORS ----------
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,Accept'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { token, databaseId, sourceId } = req.body;
  if (!token || !databaseId) return res.status(400).json({ error: 'token & databaseId required' });

  try {
    // 1. Get DB meta (to discover data_sources)
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });
    if (!dbRes.ok) {
      const e = await dbRes.json();
      return res.status(dbRes.status).json({ error: e.message ?? 'DB fetch failed' });
    }
    const db = await dbRes.json();
    const dataSources = db.data_sources || [];

    let results = [];
    let sources = [];

    if (sourceId) {
      // ---- single source ----
      if (!dataSources.some(s => s.id === sourceId))
        return res.status(404).json({ error: 'sourceId not found' });

      const q = await fetch(`https://api.notion.com/v1/data_sources/${sourceId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const d = await q.json();
      results = d.results || [];
      sources = [{ id: sourceId, results }];
    } else if (dataSources.length) {
      // ---- multi source ----
      for (const src of dataSources) {
        const q = await fetch(`https://api.notion.com/v1/data_sources/${src.id}/query`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        if (q.ok) {
          const d = await q.json();
          const r = d.results || [];
          sources.push({ id: src.id, results: r });
          results.push(...r);
        }
      }
    } else {
      // ---- legacy single DB ----
      const q = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const d = await q.json();
      results = d.results || [];
    }

    return res.status(200).json({ results, data_sources: sources });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
