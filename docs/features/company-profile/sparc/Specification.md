# Specification: Company Profile Setup

## API Endpoints

### GET /api/settings
- **Auth**: Bearer token required
- **Output 200**: `{ data: { company_name, yandex_maps_url, yandex_org_id, discount_percent, discount_text } }`

### PUT /api/settings
- **Auth**: Bearer token required
- **Input**: `{ company_name?, yandex_maps_url?, discount_percent?, discount_text? }`
- **Output 200**: `{ data: AdminSettings }`
- **Output 400**: Validation error

## Yandex Maps URL Parsing
- Supported formats: `https://yandex.ru/maps/org/{name}/{org_id}/`, `https://maps.yandex.ru/org/{org_id}`
- Extract org_id from URL path
- Store both full URL and extracted org_id

## Validation
- company_name: string, min 1
- yandex_maps_url: valid URL containing yandex maps org path
- discount_percent: integer 1-100
- discount_text: string, max 500 chars
