# Architecture: Analytics Dashboard

## Component Diagram

```
┌──────────────┐     ┌──────────────┐     ┌────────────┐
│ Admin Panel   │────▶│  Fastify API │────▶│ PostgreSQL │
│ Dashboard pg  │     │              │     │            │
│               │     │ /api/        │     │ sms_logs   │
│ StatCards     │     │ analytics/   │     │ reviews    │
│ BarChart      │     │ dashboard    │     │            │
└──────────────┘     └──────┬───────┘     └────────────┘
                            │
                     ┌──────┴───────┐
                     │ Analytics    │
                     │ Module       │
                     │ schema.ts    │
                     │ service.ts   │ ← 6 parallel DB queries
                     │ routes.ts    │
                     └──────────────┘
```

## Query Strategy

All 6 metrics fetched in parallel via `Promise.all`:
1. `prisma.smsLog.count(...)` — total SMS sent
2. `prisma.review.count(...)` — total reviews
3. `prisma.review.count(sentiment: POSITIVE)` — positive count
4. `prisma.review.count(sentiment: NEGATIVE)` — negative count
5. `prisma.review.aggregate({ _avg: stars })` — avg rating
6. `prisma.$queryRaw(GROUP BY DATE)` — reviews by day

## Frontend Components

```
Dashboard.tsx
├── Period selector (select dropdown)
├── StatCard grid (4 cards)
│   ├── SMS отправлено
│   ├── Отзывов
│   ├── Конверсия
│   └── Средний рейтинг
├── Positive/Negative cards (2 cards)
└── Reviews by day bar chart (CSS bars)
```

## Caching

- TanStack Query: staleTime 5min
- No server-side caching (queries are fast with indexes)
