# Specification: PWA Review Form

## API Endpoints (Public — no auth)

### GET /api/reviews/form/:token
- **Rate limit**: 10 req/min
- **Output 200**: `{ company_name, discount_text, discount_percent }`
- **Output 404**: Invalid token
- **Output 410**: Expired or already reviewed

### POST /api/reviews/submit/:token
- **Rate limit**: 5 req/min
- **Input**: `{ stars: 1-5, text: string (min 10, max 2000) }`
- **Output 200**: `{ sentiment, redirect_url?, promo_code?, discount_text?, discount_percent? }`
- **Output 400**: Validation error
- **Output 404**: Invalid token
- **Output 410**: Expired or already reviewed

### GET /api/optout/:token
- **Rate limit**: 10 req/min
- **Output 200**: `{ message: "Вы отписаны от SMS рассылки" }`
- **Output 404**: Invalid token

### GET /api/reviews (Admin, auth required)
- **Query**: `{ page, limit, sentiment?, date_from?, date_to? }`
- **Output 200**: `{ data: Review[], meta }`

## PWA Pages
| Route | Component | Purpose |
|-------|-----------|---------|
| /review/:token | ReviewForm | Star rating + text form |
| /thank-you | ThankYou | Redirect to Yandex or show promo |
| /optout/:token | OptOut | Opt-out confirmation |
| /* | Fallback | "Open link from SMS" message |

## Validation
- stars: integer 1-5 (required)
- text: string, min 10 chars, max 2000 chars
