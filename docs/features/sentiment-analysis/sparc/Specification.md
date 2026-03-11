# Specification: Sentiment Analysis

## Service Interface

### SentimentService.analyzeAndRoute(reviewId)
- **Input**: Review UUID
- **Output**: `{ sentiment, confidence, routed_to, redirect_url?, promo_code? }`

### LlmService.analyzeSentiment(text)
- **Input**: Review text (Russian)
- **Output**: `{ sentiment: 'positive'|'negative'|'neutral', confidence: 0.0-1.0 }`

## Anthropic Claude API Call
- Model: `claude-haiku-4-5-20251001`
- Max tokens: 100
- Prompt: "Analyze the sentiment of this Russian customer review. Return ONLY valid JSON."
- Response parsing: regex match `{...}` from response text

## Routing Rules

| Sentiment | Confidence | Stars | Route |
|-----------|-----------|-------|-------|
| POSITIVE | >= 0.7 | any | YANDEX_REDIRECT |
| POSITIVE | < 0.7 | >= 4 | YANDEX_REDIRECT |
| POSITIVE | < 0.7 | < 4 | INTERNAL_HIDDEN |
| NEGATIVE | any | any | INTERNAL_HIDDEN |
| NEUTRAL | any | any | INTERNAL_HIDDEN |

## Fallback (LLM unavailable)
- Stars >= 4 → sentiment: POSITIVE, confidence: 0.5
- Stars < 4 → sentiment: NEGATIVE, confidence: 0.5
- Triggers: API key missing, API error, parse failure

## Promo Code Generation
- Generated for INTERNAL_HIDDEN reviews only
- Format: `RH-{8 hex chars}` (e.g., RH-A1B2C3D4)
- Stored on Review record
