export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { image, type } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Build prompt based on type
    const prompt = type === 'flyer' 
      ? `Extract all text from this flyer/document image. Return JSON:
{"title": "main heading or product name", "notes": "all other text content"}`
      : `Read this business card image carefully. Extract all contact information. Return ONLY valid JSON with these fields (empty string if not found):
{"name": "full name", "title": "job title", "company": "company name", "phone": "all phone numbers separated by /", "email": "email address", "address": "full mailing address", "web": "website URL without http://"}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://awg-showcase-app.vercel.app',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` 
                } 
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenRouter error:', err);
      return res.status(502).json({ error: 'Vision API failed', detail: err });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.status(200).json({ ok: true, data: parsed, raw: content });
    }
    
    return res.status(200).json({ ok: false, raw: content, error: 'Could not parse response' });
    
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}
