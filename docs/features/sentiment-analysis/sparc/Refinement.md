# Refinement: Sentiment Analysis

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | API key not configured | Fallback to star rating |
| 2 | API returns 429 (rate limit) | Fallback to star rating |
| 3 | API returns 500 | Fallback to star rating |
| 4 | LLM returns invalid JSON | Fallback to star rating |
| 5 | LLM returns confidence > 1 | Clamp to 1.0 |
| 6 | LLM returns confidence < 0 | Clamp to 0.0 |
| 7 | Very short review text | LLM may return low confidence → star tiebreaker |
| 8 | Mixed sentiment text | LLM determines primary sentiment |
| 9 | Non-Russian text | LLM handles, but confidence may be lower |
| 10 | Admin has no Yandex Maps URL | YANDEX_REDIRECT but redirect_url = null |

## Testing Strategy

### Unit Tests (LLM mocked)
- SentimentService: positive high confidence → YANDEX_REDIRECT
- SentimentService: positive low confidence, 5 stars → YANDEX_REDIRECT
- SentimentService: positive low confidence, 3 stars → INTERNAL_HIDDEN
- SentimentService: negative → INTERNAL_HIDDEN + promo code
- SentimentService: LLM failure → star fallback
- LlmService: valid response → parsed result
- LlmService: invalid response → throws

### Integration Tests
- Submit positive review → routed_to = YANDEX_REDIRECT
- Submit negative review → routed_to = INTERNAL_HIDDEN + promo

## Performance

- LLM API call: 200-500ms (Haiku is fast)
- Synchronous in review submission flow (acceptable latency)
- Could be made async for better UX (return preliminary result, update later)

## Cost Estimate

- Haiku: ~$0.001 per review (100 tokens output, ~200 tokens input)
- 1000 reviews/month ≈ $1/month
