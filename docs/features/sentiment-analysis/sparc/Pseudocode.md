# Pseudocode: Sentiment Analysis

## LLM Service
```
FUNCTION analyzeSentiment(text):
  1. Call Anthropic Claude API with prompt:
     "Analyze the sentiment of this Russian review.
      Return JSON: {sentiment: 'positive'|'negative'|'neutral', confidence: 0.0-1.0}"
  2. Parse JSON response
  3. Return { sentiment, confidence }
  ON ERROR: throw to trigger fallback
```

## Analyze and Route
```
FUNCTION analyzeAndRoute(review_id):
  1. Load review + admin
  2. Try LLM analysis
  3. On failure: fallback (stars >= 4 → positive, confidence 0.5)
  4. Apply routing rules
  5. If INTERNAL_HIDDEN → generate promo code
  6. Update review record
  7. Return { sentiment, confidence, routed_to, redirect_url?, promo_code? }
```

## Module Structure
```
packages/api/src/services/llm.ts              — Anthropic API wrapper
packages/api/src/modules/sentiment/
├── service.ts  — SentimentService (analyze + route)
└── index.ts    — exports
```
