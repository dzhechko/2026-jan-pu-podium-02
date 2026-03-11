# PRD: Analytics Dashboard (US-006, US-007)

## Overview
Analytics API endpoint returning aggregated stats: total SMS sent, reviews count, conversion rate, positive/negative breakdown, average rating, reviews by day.

## User Stories
- **US-006**: As an admin, I can see overall review statistics
- **US-007**: As an admin, I can see conversion rate and trends over time

## API
- GET /api/analytics/dashboard?period=7d|30d|90d (auth required)

## Response
```json
{
  "total_sms_sent": 150,
  "total_reviews": 45,
  "conversion_rate": 0.30,
  "positive_count": 35,
  "negative_count": 10,
  "avg_rating": 4.2,
  "reviews_by_day": [{"date": "2026-03-01", "count": 5}, ...]
}
```
