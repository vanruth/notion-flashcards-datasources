// pages/api/notion-page.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, pageId } = req.body;

  if (!token || !pageId) {
    return res.status(400).json({ error: 'Missing token or pageId' });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch page');
    }

    const page = await response.json();
    res.status(200).json(page);
  } catch (err) {
    console.error('Error fetching Notion page:', err);
    res.status(500).json({ error: err.message });
  }
}
