export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shipmentId, route, carrier, riskFactors } = req.body;

  if (!shipmentId) {
    return res.status(400).json({ error: 'shipmentId is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  const prompt = `You are ChainGuard AI, an expert supply chain disruption analyst.

Analyse this shipment and respond in valid JSON only — no markdown, no explanation outside the JSON.

Shipment data:
- ID: ${shipmentId}
- Route: ${route}
- Carrier: ${carrier}
- Risk factors: ${riskFactors}

Respond with exactly this JSON structure:
{
  "riskScore": <integer 0-100>,
  "severity": "<CRITICAL | HIGH | MEDIUM | LOW>",
  "primaryCause": "<one sentence>",
  "estimatedDelay": "<e.g. 4-6 hours>",
  "recommendation": "<one sentence action>",
  "alternateRoute": "<brief description>",
  "costImpact": "<e.g. +$340 or -$200>",
  "carbonImpact": "<e.g. -8% CO2 or +5% CO2>",
  "confidence": <integer 0-100>
}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: 'Gemini API error', detail: errText });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'Failed to analyse shipment', detail: err.message });
  }
}
