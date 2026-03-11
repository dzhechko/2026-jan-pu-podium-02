# Refinement: PWA Review Form

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Token not found | 404 error page |
| 2 | Token expired (>30 days) | 410 "Ссылка устарела" |
| 3 | Already reviewed | 410 "Уже оставлен" |
| 4 | Review text < 10 chars | 400 validation inline |
| 5 | Stars = 0 (not selected) | Client-side validation |
| 6 | Double submit (fast click) | Disable button on submit, backend idempotent (check reviews.length) |
| 7 | Network error during submit | Error message, button re-enabled |
| 8 | Admin has no yandex_maps_url | Positive review gets no redirect, just "thank you" |
| 9 | Opt-out for already opted-out client | Idempotent — no error |
| 10 | XSS in review text | HTML sanitization recommended (currently stored as-is) |

## Security

- Public endpoints: no auth required (token-based access)
- Rate limited: 5/min submit, 10/min form load
- Token: UUID without dashes (32 hex chars) — unguessable
- No PII exposed in form response (only company_name, discount)
- Review text should be sanitized before display in admin panel

## Testing Strategy

### Unit Tests
- ReviewService.getFormData: valid token → company info
- ReviewService.getFormData: expired token → error
- ReviewService.getFormData: already reviewed → error
- ReviewService.submitReview: creates Review + updates status
- ReviewService.submitReview: triggers sentiment analysis
- ReviewService.optOut: marks client as opted_out

### Integration Tests
- GET /api/reviews/form/:token → 200
- GET /api/reviews/form/:bad_token → 404
- POST /api/reviews/submit/:token → 200 with sentiment
- POST /api/reviews/submit/:token twice → 410 on second
- GET /api/optout/:token → 200

### E2E Tests (Playwright)
- Open review link → fill form → submit → see result
- Open expired link → see error page
- Click opt-out → see confirmation

## Mobile UX

- Touch-friendly star rating (44px tap targets)
- Large submit button
- Clear loading states
- Responsive: works on 320px+ screens
