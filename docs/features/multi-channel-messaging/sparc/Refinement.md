# Refinement: Multi-Channel Messaging

## Edge Cases

### EC-1: Bot token revoked after configuration
- **Scenario:** Admin configures Telegram bot, sends messages, then revokes token
- **Handling:** Provider returns `success: false`, gateway falls back to SMS
- **Detection:** Settings page shows "Token invalid" on next validation check
- **No automatic retry** via revoked channel — uses SMS until admin reconfigures

### EC-2: Client has telegram_chat_id but bot was never configured
- **Scenario:** Client imported with telegram_chat_id, but admin never set Telegram token
- **Handling:** `gateway.hasChannel("telegram")` returns false → fall back to SMS
- **UI:** Channel selector disables "Telegram" option if not configured

### EC-3: Telegram chat_id is wrong or user blocked the bot
- **Scenario:** Telegram API returns 403 Forbidden or 400 Bad Request
- **Handling:** Provider returns `success: false` with error message
- **Fallback:** Gateway tries SMS
- **Log:** MessageLog records `channel: "telegram"`, `status: "FAILED"`, error message

### EC-4: Max API rate limit exceeded (30 req/sec)
- **Scenario:** Bulk send to 100+ clients hits Max rate limit
- **Handling:** Provider catches 429 response, returns `success: false`
- **Fallback:** Gateway tries SMS for that specific message
- **Future:** Add request queuing with delay (out of scope for v1)

### EC-5: Message too long for SMS fallback
- **Scenario:** Telegram template is 500 chars, falls back to SMS (160 char awareness)
- **Handling:** Use SMS-specific template for fallback, not the messenger template
- **Implementation:** Gateway passes `channel` to template service, if fallback → re-fetch SMS template

### EC-6: Client has no phone (only messenger)
- **Scenario:** Future case where client only has telegram_chat_id, no phone
- **Handling:** Current design requires phone (encrypted). Keep phone as required field
- **Fallback chain stops** if no phone and messenger fails

### EC-7: Concurrent reminder + manual send
- **Scenario:** Admin manually sends while reminder scheduler also triggers
- **Handling:** ReviewRequest status check prevents double send
- **The first to update status wins** — second sees already-sent status

### EC-8: CSV import with mixed channels
- **Scenario:** CSV has some rows with telegram_chat_id, some without
- **Handling:** Import sets `preferredChannel` based on available IDs
- **If telegram_chat_id present → default to "telegram"**
- **If only phone → default to "sms"**

## Testing Strategy

### Unit Tests

| Test | Description |
|------|-------------|
| TelegramProvider.send() | Mock HTTP, verify request format, parse response |
| TelegramProvider.send() error | Mock 403/400/timeout, verify error result |
| MaxProvider.send() | Mock HTTP, verify request format with access_token |
| MaxProvider.send() error | Mock error responses |
| MessageGateway.send() | Verify correct provider selected |
| MessageGateway fallback | Verify SMS fallback when messenger fails |
| MessageGateway no fallback | Verify no fallback when SMS fails |
| TemplateService channel | Verify correct template per channel |
| TemplateService fallback template | Verify SMS template used on fallback |
| Settings validation | Verify token validation calls |

### Integration Tests

| Test | Description |
|------|-------------|
| Send via Telegram | Full flow: create request → send → verify log |
| Send via Max | Full flow: create request → send → verify log |
| Fallback SMS | Telegram fails → SMS succeeds → verify both logs |
| Reminder via Telegram | Scheduler picks up → sends via Telegram |
| Channel in review request | Verify channel persisted in ReviewRequest |
| CSV import with channels | Import CSV with telegram_chat_id column |

### Mock Strategy
- **Telegram API:** Mock `fetch` calls to `api.telegram.org` with predefined responses
- **Max API:** Mock `fetch` calls to `botapi.max.ru` with predefined responses
- **SMSC.ru:** Existing mock (never send real SMS in tests)
- **Never make real API calls** in any test environment

## Security Considerations

### Token Storage
- Telegram bot token and Max bot token stored with AES-256-GCM encryption
- Same `EncryptionService` used for phone numbers
- Tokens never appear in logs (pino redaction)
- API responses return only `configured: true/false`, never the token itself

### Input Validation
- `telegram_chat_id`: must be numeric string (Zod regex: `/^\d+$/`)
- `max_chat_id`: must be non-empty string
- `preferred_channel`: strict enum validation via Zod
- Bot tokens: format validation + live API validation before save

### Rate Limiting
- No new public endpoints (all channel config is admin-only)
- Existing rate limits apply to `/api/review-requests`
- Internal: respect Telegram 30 msg/sec, Max 30 req/sec limits

## Performance Considerations

### Batch Sending
- Current: sequential send per client (adequate for SMB volumes)
- Telegram/Max: similar latency to SMSC.ru (~100-500ms per call)
- For large batches (>50): consider chunking with 1-sec delays to respect rate limits
- v1: keep sequential, add batching in v2 if needed

### Gateway Initialization
- Gateway created once at app startup (like SmscService)
- Bot tokens loaded from DB on startup, cached in memory
- Token changes require gateway refresh (settings update triggers rebuild)

## Migration Plan

1. **Database migration:** Add new columns (all nullable, non-breaking)
2. **Backend services:** Add providers, gateway, modify existing services
3. **Admin UI:** Add channel config in Settings, channel selector in Clients
4. **Templates:** Add channel dimension to template management
5. **Testing:** Unit + integration tests for new providers
6. **Rollout:** Feature flag not needed — channels are opt-in (admin configures tokens)
