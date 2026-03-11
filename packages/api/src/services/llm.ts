export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export class LlmService {
  constructor(private apiKey: string) {}

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    if (!this.apiKey || this.apiKey === 'sk-ant-...') {
      throw new Error('LLM API key not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Analyze the sentiment of this Russian customer review. Return ONLY valid JSON: {"sentiment": "positive"|"negative"|"neutral", "confidence": 0.0-1.0}\n\nReview: "${text}"`,
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const responseText = data.content[0]?.text ?? '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse LLM response: no JSON found');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse LLM response: invalid JSON');
    }

    const sentiment = String(parsed.sentiment ?? '').toLowerCase();
    if (!['positive', 'negative', 'neutral'].includes(sentiment)) {
      throw new Error(`Invalid sentiment value: ${sentiment}`);
    }

    const confidence = Number(parsed.confidence);
    if (Number.isNaN(confidence)) {
      throw new Error('Invalid confidence value');
    }

    return {
      sentiment: sentiment as SentimentResult['sentiment'],
      confidence: Math.min(1, Math.max(0, confidence)),
    };
  }
}
