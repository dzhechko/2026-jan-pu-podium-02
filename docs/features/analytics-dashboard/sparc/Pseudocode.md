# Pseudocode: Analytics Dashboard

## Get Dashboard Stats
```
FUNCTION getDashboardStats(admin_id, period):
  1. Calculate date range from period (7d/30d/90d)
  2. Count total SMS sent (SmsLog where status=SENT in range)
  3. Count total reviews in range
  4. Compute conversion_rate = reviews / sms_sent
  5. Count positive/negative reviews
  6. Compute avg star rating
  7. Group reviews by day for chart data
  8. Return aggregated stats
```

## Module Structure
```
packages/api/src/modules/analytics/
├── schema.ts    — Zod validation (period query param)
├── service.ts   — AnalyticsService
└── routes.ts    — GET /api/analytics/dashboard
```
