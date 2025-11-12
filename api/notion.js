// api/notion.js - Supports single/multi-source with optional sourceId
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, databaseId, sourceId } = req.body; // New: sourceId optional
  if (!token || !databaseId) {
    return res.status(400).json({ error: 'Missing token or databaseId' });
  }

  try {
    // Step 1: Fetch the database to get data sources
    const databaseResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
      },
    });

    if (!databaseResponse.ok) {
      const errorData = await databaseResponse.json();
      return res.status(databaseResponse.status).json({ 
        error: errorData.message || 'Failed to fetch database' 
      });
    }

    const database = await databaseResponse.json();
    const dataSources = database.data_sources || [];

    let queryResults = [];
    let responseSources = [];

    if (sourceId) {
      // Single source requested: Query only that one
      if (!dataSources.some(ds => ds.id === sourceId)) {
        return res.status(404).json({ error: 'Specified data source not found in database' });
      }

      const queryResponse = await fetch(`https://api.notion.com/v1/data_sources/${sourceId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // No sort needed
      });

      if (!queryResponse.ok) {
        const errorData = await queryResponse.json();
        return res.status(queryResponse.status).json({ 
          error: errorData.message || 'Failed to query data source' 
        });
      }

      const queryData = await queryResponse.json();
      queryResults = queryData.results || [];
      responseSources = [{ id: sourceId, results: queryResults }]; // Wrap for consistency
    } else if (dataSources.length > 0) {
      // Multi-source: Query all
      for (const source of dataSources) {
        const queryResponse = await fetch(`https://api.notion.com/v1/data_sources/${source.id}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2025-09-03',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        });

        if (queryResponse.ok) {
          const queryData = await queryResponse.json();
          responseSources.push({ id: source.id, results: queryData.results || [] });
          queryResults.push(...queryData.results);
        } else {
          console.warn(`Failed to query source ${source.id}`);
        }
      }
    } else {
      // Legacy single-source fallback
      const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2025-09-03', // Still works for legacy
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (!queryResponse.ok) {
        const errorData = await queryResponse.json();
        return res.status(queryResponse.status).json({ error: errorData.message || 'Failed to query database' });
      }

      const queryData = await queryResponse.json();
      queryResults = queryData.results || [];
      responseSources = []; // No multi-source
    }

    // Return combined results
    return res.status(200).json({ 
      results: queryResults, 
      data_sources: responseSources 
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
