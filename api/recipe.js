export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mealName } = req.body;
  if (!mealName) return res.status(400).json({ error: 'mealName required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: `You are a recipe assistant. Given a recipe name, return ONLY a JSON object with this exact structure (no markdown, no backticks):
{"serves":"2","time":"30 mins","ingredients":["500g chicken thigh, diced","2 tbsp soy sauce"],"steps":["Heat oil in pan over high heat.","Add chicken, cook 3 min."]}
Keep steps short and action-focused. Max 8 steps. Return ONLY valid JSON.`,
        messages: [{ role: 'user', content: `Recipe: ${mealName}` }],
      }),
    });

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const recipe = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json(recipe);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
}
