// api/notion.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { token, databaseId, sourceId } = req.body;
  if (!token || !databaseId) return res.status(400).json({ error: 'token & databaseId required' });

  try {
    // 1. Get DB to discover data_sources
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });
    if (!dbRes.ok) {
      const err = await dbRes.json();
      return res.status(dbRes.status).json({ error: err.message || 'DB fetch failed' });
    }
    const db = await dbRes.json();
    const sources = db.data_sources || [];
    const results = [];

    if (sourceId) {
      // Single source
      if (!sources.some(s => s.id === sourceId)) {
        return res.status(404).json({ error: 'sourceId not found' });
      }
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
      results.push(...(d.results || []));
    } else if (sources.length) {
      // Multi-source
      for (const s of sources) {
        const q = await fetch(`https://api.notion.com/v1/data_sources/${s.id}/query`, {
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
          results.push(...(d.results || []));
        }
      }
    } else {
      // Legacy single DB
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
      results.push(...(d.results || []));
    }

    // Return flattened results (as original)
    res.status(200).json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
