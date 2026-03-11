# Refinement: ReviewHub

## Edge Cases Matrix

| Scenario | Input | Expected | Handling |
|----------|-------|----------|----------|
| Empty review text | stars=5, text="" | Accept with stars only | Skip LLM, route by stars |
| Very long review | text > 2000 chars | Truncate | Truncate to 2000, analyze truncated |
| Review in English | English text | Analyze normally | LLM handles multilingual |
| Emoji-only review | text = "👍👍👍" | Positive sentiment | LLM handles, fallback to stars |
| SQL injection in text | Malicious SQL | Sanitized | Parameterized queries, Prisma |
| XSS in review text | `<script>` tags | Sanitized | HTML escape on input + output |
| Invalid phone format | "123abc" | Reject | Validate E.164 format |
| Duplicate phone in import | Same phone twice | Skip duplicate | Unique constraint, report skipped |
| SMS to landline | Fixed phone number | Will fail | SMSC returns error, log as failed |
| Token reuse (already reviewed) | Same token submitted twice | Reject | Check status == REVIEWED |
| Expired token (30+ days) | Old link clicked | Show expired message | Check expires_at |
| Concurrent review submissions | Two tabs open | First wins | DB unique constraint on review_request_id |
| SMSC rate limit exceeded | Bulk send > 100/min | Queue overflow | Process in batches of 50 |
| LLM returns invalid JSON | Malformed response | Fallback | Try/catch, use star-based routing |
| Admin deletes client mid-cascade | Client removed | Stop reminders | CASCADE delete on review_requests |
| Opt-out during cascade | Client clicks opt-out | Stop all future SMS | Set opted_out=true, cancel reminders |

## Testing Strategy

### Unit Tests
- Coverage target: 80%+ on business logic
- Focus: Sentiment routing logic, cascade timing, SMS formatting, auth

### Integration Tests
- API endpoint tests with test database
- SMSC.ru mock (don't send real SMS in tests)
- LLM mock (deterministic responses)

### E2E Tests
- Full flow: register → add client → send SMS → submit review → check routing
- Playwright for admin panel UI
- Mobile viewport for PWA

### Performance Tests
- PWA load time under 3G throttle
- API response time under load (100 concurrent users)
- SMS batch sending (500 clients)

## Test Cases

### Feature: Sentiment Routing

```gherkin
Scenario: Route positive review to Yandex
  Given review with text "Замечательный сервис!" and 5 stars
  When sentiment analysis returns positive (0.95)
  Then review.routed_to = "YANDEX_REDIRECT"
  And response includes yandex_maps_url

Scenario: Route negative review to hidden
  Given review with text "Очень плохо" and 1 star
  When sentiment analysis returns negative (0.92)
  Then review.routed_to = "INTERNAL_HIDDEN"
  And response includes promo_code
  And no redirect URL returned

Scenario: Mixed sentiment uses stars as tiebreaker
  Given review with text "Нормально, но могло быть лучше" and 4 stars
  When sentiment confidence < 0.7
  Then use star rating (4 >= 4 → positive)
  And route to YANDEX_REDIRECT

Scenario: LLM failure falls back to stars
  Given LLM API returns 500 error
  When review submitted with 5 stars
  Then route by stars (5 >= 4 → positive)
  And log LLM error
```

### Feature: Cascade Reminders

```gherkin
Scenario: Full cascade timing
  Given review request created at 2026-03-11 14:00
  Then reminder 1 scheduled at 16:00 (2h)
  And reminder 2 at 2026-03-12 14:00 (24h)
  And reminder 3 at 2026-03-14 14:00 (3d)
  And reminder 4 at 2026-03-18 14:00 (7d)
  And no reminder 5

Scenario: Stop cascade on review
  Given client has pending reminder 3
  When client submits review
  Then reminder 3 and 4 are cancelled
  And review_request.status = "REVIEWED"
```

### Feature: PWA Form

```gherkin
Scenario: Load form with valid token
  Given valid token "abc123"
  When GET /api/reviews/form/abc123
  Then response includes company_name and discount_text
  And form renders correctly on mobile

Scenario: Submit with minimum data
  Given valid token
  When POST with stars=3 and text=""
  Then review is created with stars only
  And sentiment determined by stars

Scenario: Expired token
  Given token expired 5 days ago
  When GET /api/reviews/form/expired_token
  Then response 404 with "Link expired"
```

## Performance Optimizations

- **PWA bundle splitting:** Separate vendor chunk, lazy load non-critical
- **API pagination:** All list endpoints paginated (default 20, max 100)
- **DB indexes:** On foreign keys, token lookups, reminder scheduling
- **Redis caching:** Admin settings (5 min TTL), analytics aggregations
- **SMS batching:** Process reminders in batches of 50 to avoid SMSC rate limits
- **Connection pooling:** Prisma connection pool (min 2, max 10)

## Security Hardening

- **Rate limiting:** 100 req/min per IP (general), 5/15min (auth endpoints)
- **Input validation:** Zod schemas on all endpoints
- **CORS:** Whitelist admin and PWA domains only
- **Helmet:** Security headers (CSP, X-Frame-Options, etc.)
- **SQL injection:** Prisma parameterized queries (no raw SQL)
- **XSS:** React auto-escapes, CSP headers
- **SMS opt-out:** Every SMS includes STOP link
- **Token security:** Crypto.randomBytes(32), URL-safe base64

## Technical Debt Items (Known Shortcuts for MVP)

- Single-instance reminder scheduler (no distributed locking)
- No email notifications (SMS only)
- No admin password reset flow
- No API versioning (add /v1/ prefix in v1.0)
- No WebSocket for real-time review notifications (polling instead)
- No automated backup verification
