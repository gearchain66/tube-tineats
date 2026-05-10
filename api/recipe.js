module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const mealName = req.body.meal || req.body.mealName;
  if (!mealName) return res.status(400).json({ error: 'meal required' });

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
        system: `You are a recipe assistant. Given a recipe name, return ONLY a structured recipe as plain text with these exact sections in this exact format:

Serves: 2

Ingredients
- [qty] [unit] [ingredient]
- [qty] [unit] [ingredient]

Method
1. [step]
2. [step]
3. [step]

Rules:
- You MUST include both the Ingredients section AND the Method section
- The Method section MUST have numbered steps starting with 1.
- Keep steps short and action-focused, max 8 steps
- No markdown, no bold, no JSON, just plain text exactly as shown above`,
        messages: [{ role: 'user', content: `Recipe: ${mealName}` }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: 'Anthropic error', details: data });

    const text = data.content?.find(b => b.type === 'text')?.text || '';
    res.status(200).json({ recipe: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
