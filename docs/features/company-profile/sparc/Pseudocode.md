# Pseudocode: Company Profile Setup

## Get Settings
```
FUNCTION getSettings(admin_id):
  1. Find admin by id
  2. Return { company_name, yandex_maps_url, yandex_org_id, discount_percent, discount_text }
```

## Update Settings
```
FUNCTION updateSettings(admin_id, input):
  1. Validate input with Zod
  2. If yandex_maps_url provided:
     a. Parse URL to extract org_id (regex: /org\/[^/]+\/(\d+)/ or /org\/(\d+)/)
     b. Store both URL and org_id
  3. Update admin record with provided fields
  4. Return updated settings
```

## Module Structure
```
packages/api/src/modules/settings/
├── schema.ts    — Zod validation
├── service.ts   — SettingsService
└── routes.ts    — GET/PUT /api/settings
```
