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
    const jsonMatch = responseText.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as SentimentResult;
    return {
      sentiment: parsed.sentiment,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
    };
  }
}
