# Architecture: Sentiment Analysis

## Component Diagram

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ ReviewService │────▶│ SentimentService │────▶│ Anthropic Claude│
│ (submit)     │     │                  │     │ API (external)  │
│              │     │ analyzeAndRoute()│     │ Haiku 4.5       │
└──────────────┘     └────────┬─────────┘     └─────────────────┘
                              │
                       ┌──────┴───────┐
                       │ LlmService   │
                       │              │
                       │ analyzeSenti │
                       │ ment(text)   │
                       └──────────────┘
                              │
                       ┌──────┴───────┐
                       │ PostgreSQL   │
                       │ reviews      │
                       │ - sentiment  │
                       │ - confidence │
                       │ - routed_to  │
                       │ - promo_code │
                       └──────────────┘
```

## Integration Pattern

ReviewService → SentimentService (setter injection):
```typescript
reviewService.setSentimentService(sentimentService);
```

This allows ReviewService to work without SentimentService (pure star-based fallback) and enables easy testing with mocks.

## API Call Structure

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: {ANTHROPIC_API_KEY}
  anthropic-version: 2023-06-01
Body: {
  model: "claude-haiku-4-5-20251001",
  max_tokens: 100,
  messages: [{ role: "user", content: "Analyze..." }]
}
Response: {
  content: [{ type: "text", text: '{"sentiment":"positive","confidence":0.92}' }]
}
```

## Error Handling Chain

```
LLM API call
  ├─ Success → parse JSON → apply routing rules
  ├─ Network error → fallback to star rating
  ├─ API error (4xx/5xx) → fallback to star rating
  └─ Parse error (no JSON in response) → fallback to star rating
```
