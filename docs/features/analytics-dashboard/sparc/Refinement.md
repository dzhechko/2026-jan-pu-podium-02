# Refinement: Analytics Dashboard

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | No data (new admin) | All zeroes, empty reviews_by_day |
| 2 | No SMS sent | conversion_rate = 0 |
| 3 | No reviews | avg_rating = 0, all counts = 0 |
| 4 | Reviews without sentiment | Not counted in positive/negative |
| 5 | Invalid period param | Default to "30d" |
| 6 | Very large dataset | Parallel queries, indexed columns |
| 7 | BigInt from raw query | Convert to Number for JSON |

## Testing Strategy

### Unit Tests
- AnalyticsService: empty data → all zeroes
- AnalyticsService: mixed data → correct counts
- AnalyticsService: conversion rate calculation

### Integration Tests
- GET /api/analytics/dashboard → 200 with stats
- GET /api/analytics/dashboard?period=7d → filtered
- GET /api/analytics/dashboard without auth → 401

## Performance

- 6 queries in parallel: ~50ms total
- Indexes: admin_id on sms_logs (via review_request), admin_id on reviews
- Raw SQL for GROUP BY: faster than Prisma groupBy
- BigInt → Number conversion for JSON serialization
