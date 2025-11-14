// api/notion.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { token, databaseId, sourceId } = req.body;
  if (!token || !databaseId) return res.status(400).json({ error: 'token & databaseId required' });

  const version = '2025-09-03';

  try {
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': version }
    });
    if (!dbRes.ok) {
      const err = await dbRes.json();
      return res.status(dbRes.status).json({ error: err.message || 'DB fetch failed' });
    }
    const db = await dbRes.json();
    const sources = db.data_sources || [];
    const results = [];

    // Helper: fetch all pages with pagination
    const fetchAll = async (url, body = {}) => {
      let start_cursor = undefined;
      do {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': version,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...body, start_cursor, page_size: 100 })
        });
        const data = await res.json();
        results.push(...(data.results || []));
        start_cursor = data.next_cursor;
      } while (start_cursor);
    };

    if (sourceId) {
      if (!sources.some(s => s.id === sourceId)) return res.status(404).json({ error: 'sourceId not found' });
      await fetchAll(`https://api.notion.com/v1/data_sources/${sourceId}/query`);
    } else if (sources.length) {
      for (const s of sources) {
        await fetchAll(`https://api.notion.com/v1/data_sources/${s.id}/query`);
      }
    } else {
      await fetchAll(`https://api.notion.com/v1/databases/${databaseId}/query`);
    }

    res.status(200).json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
