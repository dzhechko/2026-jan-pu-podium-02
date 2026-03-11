# Architecture: Company Profile Setup

## Component Diagram

```
┌──────────────┐     ┌──────────────┐     ┌────────────┐
│ Admin Panel   │────▶│  Fastify API │────▶│ PostgreSQL │
│ Settings page │     │              │     │            │
│               │     │ GET/PUT      │     │ admins     │
│               │     │ /api/settings│     │            │
└──────────────┘     └──────┬───────┘     └────────────┘
                            │
                     ┌──────┴───────┐
                     │ Settings     │
                     │ Module       │
                     │              │
                     │ schema.ts    │ ← Zod + Yandex URL parser
                     │ service.ts   │ ← CRUD settings
                     │ routes.ts    │ ← Auth-protected endpoints
                     └──────────────┘
```

## Data Flow

### GET /api/settings
```
Client → Bearer token → authenticate middleware
  → SettingsService.getSettings(adminId)
  → Prisma.admin.findUniqueOrThrow(id)
  → Map to response shape
  → { data: { company_name, yandex_maps_url, ... } }
```

### PUT /api/settings
```
Client → Bearer token → authenticate middleware
  → Zod validation (updateSettingsSchema)
  → If yandex_maps_url: extractYandexOrgId(url)
  → Prisma.admin.update(id, data)
  → Return updated settings
```

## Yandex Maps URL Parsing

Supported formats:
- `https://yandex.ru/maps/org/{name}/{org_id}/` → regex `/org/[^/]+/(\d+)/`
- `https://maps.yandex.ru/org/{org_id}` → regex `/org/(\d+)/`

## Database Fields

| Column | Type | Purpose |
|--------|------|---------|
| yandex_maps_url | TEXT | Full Yandex Maps organization URL |
| yandex_org_id | VARCHAR(100) | Extracted org ID for redirect |
| discount_percent | INT (1-100) | Discount for negative review promo |
| discount_text | TEXT | Human-readable discount description |

## Dependencies

All settings stored in the `admins` table — no additional tables needed.
