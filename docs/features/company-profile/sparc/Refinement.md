# Refinement: Company Profile Setup

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Invalid Yandex Maps URL | 400 validation error |
| 2 | URL without org_id in path | Save URL but yandex_org_id = null |
| 3 | discount_percent = 0 | 400 validation (min 1) |
| 4 | discount_percent > 100 | 400 validation (max 100) |
| 5 | Empty update body | No changes, return current settings |
| 6 | Partial update (only company_name) | Only company_name updated, rest unchanged |
| 7 | Very long discount_text | 400 validation (max 500 chars) |

## Testing Strategy

### Unit Tests
- extractYandexOrgId: standard URL → org_id
- extractYandexOrgId: alt format URL → org_id
- extractYandexOrgId: non-Yandex URL → null
- SettingsService.updateSettings: partial update
- SettingsService.getSettings: returns mapped fields

### Integration Tests
- GET /api/settings → 200 with current values
- PUT /api/settings → 200 with updated values
- PUT /api/settings without auth → 401
- PUT /api/settings with invalid data → 400

## Performance

- Single DB read/write per request
- No external API calls
- O(1) regex parsing for Yandex URL
