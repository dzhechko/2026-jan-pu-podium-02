# Specification: Analytics Dashboard

## API Endpoint

### GET /api/analytics/dashboard
- **Auth**: Bearer token required
- **Query**: `{ period: "7d"|"30d"|"90d" }` (default: "30d")
- **Output 200**:
```json
{
  "total_sms_sent": 150,
  "total_reviews": 45,
  "conversion_rate": 0.30,
  "positive_count": 35,
  "negative_count": 10,
  "avg_rating": 4.2,
  "reviews_by_day": [
    { "date": "2026-03-01", "count": 5 },
    { "date": "2026-03-02", "count": 8 }
  ]
}
```

## Metric Definitions

| Metric | Calculation |
|--------|-------------|
| total_sms_sent | COUNT(sms_logs WHERE status='SENT' AND sent_at >= since) |
| total_reviews | COUNT(reviews WHERE created_at >= since) |
| conversion_rate | total_reviews / total_sms_sent (0 if no SMS) |
| positive_count | COUNT(reviews WHERE sentiment='POSITIVE') |
| negative_count | COUNT(reviews WHERE sentiment='NEGATIVE') |
| avg_rating | AVG(reviews.stars) |
| reviews_by_day | GROUP BY DATE(created_at) ORDER BY date |

## Period Mapping
- 7d → 7 days ago
- 30d → 30 days ago
- 90d → 90 days ago
