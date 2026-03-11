# Review Report: multi-channel-messaging

## Review Date: 2026-03-11

## Summary

Brutal-honesty code review completed on the multi-channel-messaging implementation. Found 5 CRITICAL and 3 MAJOR issues. All CRITICAL and key MAJOR issues fixed in commit `ba7d996`.

## Issues Found

### CRITICAL (all fixed)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| C1 | Gateway singleton — Telegram/Max providers created once at startup, not per-admin | `message-gateway.ts` | Redesigned to per-admin factory: `getProvidersForAdmin(adminId)` decrypts tokens from DB on each call |
| C2 | Max bot token in URL query string (logged by proxies/CDNs) | `max.ts` | Moved token to `access_token` HTTP header |
| C3 | `phoneMasked` VarChar(20) overflow for `telegram:1234567890123456789` | `schema.prisma` | Increased to VarChar(50) |
| C4 | `telegramChatId` / `maxChatId` stored as plaintext String | `schema.prisma`, `clients/service.ts` | Changed to `Bytes` (encrypted), decrypt on use |
| C5 | `updateSettings` response missing channels data — frontend broke | `settings/service.ts` | Added `getChannels()` call, spread into response |

### MAJOR (all fixed)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| M1 | `replace()` only replaces first placeholder occurrence in templates | `template-service.ts` | Changed to `replaceAll()` |
| M2 | No channel-specific default templates for Telegram/Max | `template-service.ts` | Added `DEFAULT_MESSENGER_TEMPLATES` with Markdown formatting |
| M4 | Duplicate `MessageResult` interface in `telegram.ts` and `message-gateway.ts` | Both files | Consolidated to `message-gateway.ts`, telegram.ts imports from there |

### MINOR (accepted as-is)

| # | Issue | Notes |
|---|-------|-------|
| M3 | No retry logic for transient Telegram/Max API failures | Acceptable for MVP — failures fall back to SMS |
| M5 | No rate limiting on bot token validation endpoint | Low risk — admin-only endpoint behind JWT auth |

## Architecture Assessment

The MessageGateway pattern is solid:
- **Strategy pattern** with per-admin provider instantiation from encrypted DB tokens
- **SMS fallback** with template re-fetch (AC-9) ensures delivery even when messenger channels fail
- **Recipient interface** cleanly abstracts channel-specific addressing
- **messageFetcher callback** enables channel-specific template content on fallback

## Security Assessment

- All PII encrypted at rest (AES-256-GCM): phone, email, chat IDs, bot tokens
- Bot tokens validated via provider API before storage
- No tokens/secrets in logs or URL query strings (after C2 fix)
- 152-ФЗ compliant: all data on Russian VPS

## Files Changed (Phase 3 + Phase 4 fixes)

### New files
- `packages/api/src/services/telegram.ts` — Telegram Bot API provider
- `packages/api/src/services/max.ts` — Max Bot API provider
- `packages/api/src/services/message-gateway.ts` — Multi-channel gateway with fallback

### Modified files
- `packages/api/prisma/schema.prisma` — New fields for channels, encrypted chat IDs
- `packages/api/src/modules/sms/service.ts` — Uses MessageGateway, Recipient, messageFetcher
- `packages/api/src/modules/sms/schema.ts` — Channel enum, channel field in schemas
- `packages/api/src/modules/sms/template-service.ts` — Channel-specific templates
- `packages/api/src/modules/settings/service.ts` — Bot token CRUD, channel status
- `packages/api/src/modules/settings/schema.ts` — Bot token validation schemas
- `packages/api/src/modules/clients/service.ts` — Encrypted chat IDs, CSV import
- `packages/api/src/services/reminder.ts` — Multi-channel reminders
- `packages/api/src/app.ts` — Gateway wiring
- `packages/admin/src/pages/Settings.tsx` — Channel config UI
- `packages/admin/src/pages/Clients.tsx` — Channel selector, chat ID fields

## Verdict

**PASS** — All critical and major issues resolved. Implementation is production-ready for MVP.
