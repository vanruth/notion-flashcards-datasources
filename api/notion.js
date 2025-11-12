// api/notion.js - Updated for Notion API v2025-09-03 (multi-source support)
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

  const { token, databaseId } = req.body;
  if (!token || !databaseId) {
    return res.status(400).json({ error: 'Missing token or databaseId' });
  }

  try {
    // Step 1: Fetch the database to get data sources
    let databaseResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2025-09-03', // Updated for multi-source
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
    const dataSources = database.data_sources || [{ id: databaseId }]; // Fallback for single-source

    // Step 2: Query each data source for pages
    const allResults = [];
    for (const source of dataSources) {
      const queryResponse = await fetch(`https://api.notion.com/v1/data_sources/${source.id}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // No sort needed for flashcards
      });

      if (!queryResponse.ok) {
        console.warn(`Failed to query source ${source.id}`);
        continue;
      }

      const queryData = await queryResponse.json();
      allResults.push(...(queryData.results || []));
    }

    // Step 3: Combine and return (include data_sources count for UI)
    return res.status(200).json({ 
      results: allResults, 
      data_sources: dataSources 
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
