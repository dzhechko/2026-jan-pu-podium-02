# Validation Report: Messenger Auto-Linking

## Summary

- Stories analyzed: 4
- Average score: **77/100**
- Blocked: 0
- Validation iterations: 1 (gaps fixed inline)

## Results

| Story | Title | Score | INVEST | SMART | Security | Status |
|-------|-------|-------|--------|-------|----------|--------|
| US-1 | Webhook Registration | 82 | 5/6 | 4/5 | +8 | PASS |
| US-2 | Deep Link in SMS | 78 | 5/6 | 4/5 | +6 | PASS |
| US-3 | Auto-Linking via Webhook | 75 | 4/6 | 5/5 | +8 | PASS |
| US-4 | Admin UI — Linking Status | 71 | 5/6 | 4/5 | +2 | PASS |

## Architecture Validation: 82/100

| Area | Status |
|------|--------|
| Tech stack consistency | PASS |
| Module pattern (routes/service/schema) | PASS |
| File placement in monorepo | PASS |
| DB schema (no changes claim) | Verified correct |
| Encryption patterns | Consistent |
| Rate limiting | Consistent |
| CORS for webhook endpoints | GAP FIXED — added bypass strategy |
| WEBHOOK_SECRET / API_BASE_URL in env schema | GAP FIXED — noted as required |

## Pseudocode Validation: 72/100 → Fixed to ~85/100

| Gap | Status |
|-----|--------|
| Missing: Process Max Webhook algorithm | FIXED |
| Missing: Send Confirmation algorithm | FIXED |
| Missing: Settings Save trigger algorithm | FIXED |
| Missing: Deregister Webhook algorithm | FIXED |
| Missing: State machine backward edges | FIXED |
| Max webhook security (no built-in secret) | Documented — rate limiting + UUID obscurity |
| `telegramBotUsername` persistence | Covered in Settings Save trigger |

## Issues Addressed During Validation

### Critical (fixed)
1. **CORS bypass for webhooks** — Telegram/Max can't POST to our API without CORS exemption. Added CORS bypass strategy to Architecture.md.
2. **Missing Max webhook algorithm** — Added full `Process Max Webhook` pseudocode.
3. **Missing confirmation message algorithm** — Added `Send Confirmation Message` pseudocode.
4. **Incomplete state machine** — Added backward edges for token removal/rotation.
5. **Missing webhook lifecycle algorithms** — Added deregistration and settings trigger.

### Major (noted for implementation)
1. **WEBHOOK_SECRET + API_BASE_URL** must be added to `env.ts` Zod schema and `.env.example`.
2. **Max webhook security** — Max lacks Telegram's built-in `secret_token`. Mitigation: UUID obscurity in URL + rate limiting. Consider IP allowlist if Max publishes source IPs.
3. **SMS character budget** — Deep link appended to SMS may exceed 160 chars (Cyrillic = UCS-2). Implementation should check total length and omit bot link if over 306 chars (2-part SMS max).

### Minor (addressable during implementation)
1. US-1: "result logged" — should specify log level and structured fields.
2. US-2: Deep link UUID expiry not defined (acceptable: UUID is permanent client ID).
3. US-3: Consider splitting Telegram/Max into sub-stories if Max API research reveals significant differences.
4. US-4: SMS badge always shown (SMS is always available as fallback).
5. HMAC output encoding: must be lowercase hex string (64 chars) for Telegram compatibility.

## Gate Decision

```
✅ VALIDATION PASSED
  Average score: 77/100 (threshold: 70)
  Blocked stories: 0
  Critical gaps: 5 found, 5 fixed
  Major gaps: 3 noted for implementation

  Proceed to Phase 3: IMPLEMENT
```
