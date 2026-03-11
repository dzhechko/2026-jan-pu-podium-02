# Refinement: Messenger Auto-Linking

## Edge Cases Matrix

| # | Scenario | Input | Expected | Handling |
|---|----------|-------|----------|----------|
| 1 | Client deleted after deep link sent | /start with deleted client UUID | No action | Silent ignore, return 200 |
| 2 | Admin deleted after webhook registered | Webhook for non-existent admin | No action | Silent ignore, return 200 |
| 3 | Client opted out | /start from opted-out client | No linking | Skip linking, no confirmation message |
| 4 | Same client links twice | /start with same UUID twice | Update chat_id | Idempotent — overwrites old chat_id |
| 5 | Different client same Telegram user | Same Telegram user, different deep links | Link to latest | Each client gets same chat_id, which is correct |
| 6 | Deep link without /start prefix | User sends text "abc-123" to bot | No linking | Only process messages starting with "/start " |
| 7 | Bot blocked by user | Telegram sends block event | N/A | No handler needed — next send will fail and fallback to SMS |
| 8 | Webhook URL not reachable | Telegram can't reach our server | No linking | Admin warned; falls back to SMS |
| 9 | Race condition: two /start simultaneously | Two webhook calls for same client | Last write wins | Both encrypt and write — last one persists, both valid |
| 10 | Max deep link mechanism differs | Max may not support /start params | Adapt | Use Max-specific deep link format |
| 11 | Telegram group chat /start | Bot added to group | Ignore | Filter: only process chat.type === 'private' |
| 12 | Bot token rotated | Admin changes token | Re-register webhook | Old webhook stops, new one registers |
| 13 | API_BASE_URL not configured | Can't build webhook URL | Skip registration | Warn in logs, admin can still use SMS |

## Testing Strategy

### Unit Tests

```
WebhookService:
  ✅ processUpdate() — valid Telegram /start with valid client
  ✅ processUpdate() — invalid secret token → rejected
  ✅ processUpdate() — missing /start parameter → ignored
  ✅ processUpdate() — invalid client UUID format → ignored
  ✅ processUpdate() — non-existent client → ignored
  ✅ processUpdate() — opted-out client → not linked
  ✅ processUpdate() — group chat → ignored
  ✅ linkClient() — encrypts chat_id correctly
  ✅ linkClient() — updates preferred_channel
  ✅ linkClient() — idempotent (second call overwrites)
  ✅ verifySecret() — valid HMAC passes
  ✅ verifySecret() — invalid HMAC fails
  ✅ registerWebhook() — calls Telegram setWebhook API
  ✅ registerWebhook() — handles API failure gracefully

DeepLink generation:
  ✅ includeDeepLink() — adds link when bot configured, client not linked
  ✅ includeDeepLink() — no link when bot not configured
  ✅ includeDeepLink() — no link when client already linked
```

### Integration Tests

```
Webhook endpoint:
  ✅ POST /api/webhooks/telegram/:adminId — valid /start → client linked in DB
  ✅ POST /api/webhooks/telegram/:adminId — invalid token → 200, no DB change
  ✅ POST /api/webhooks/telegram/:adminId — rate limited after 100 req/min

Settings + webhook registration:
  ✅ PUT /settings with telegram_bot_token → webhook registered with Telegram API (mocked)

SMS with deep link:
  ✅ POST /review-requests → SMS includes deep link when conditions met
  ✅ POST /review-requests → SMS without deep link when client already linked
```

### Test Cases (Gherkin)

```gherkin
Feature: Messenger Auto-Linking

  Background:
    Given admin "Coffee Shop" with id "admin-1" exists
    And Telegram bot with username "coffee_review_bot" is configured for admin "admin-1"
    And webhook secret is "test-secret-key"

  Scenario: Successful Telegram auto-linking
    Given client "Ivan" with id "client-abc" exists for admin "admin-1"
    And Ivan does not have a Telegram chat_id
    When Telegram sends webhook to /api/webhooks/telegram/admin-1
      | field | value |
      | message.from.id | 12345 |
      | message.chat.type | private |
      | message.text | /start client-abc |
    And secret token header matches HMAC("admin-1", "test-secret-key")
    Then client "client-abc" has encrypted telegram_chat_id
    And client "client-abc" preferred_channel is "telegram"
    And webhook returns 200

  Scenario: Invalid secret token rejected
    When Telegram sends webhook to /api/webhooks/telegram/admin-1
    And secret token header is "wrong-token"
    Then webhook returns 200
    And no client data is modified

  Scenario: Deep link included in first SMS
    Given client "Ivan" with id "client-abc" exists for admin "admin-1"
    And Ivan does not have a Telegram chat_id
    When admin sends review request to Ivan via SMS
    Then SMS text contains "t.me/coffee_review_bot?start=client-abc"
```

## Performance Considerations

- Webhook handlers must respond within 100ms (Telegram timeout)
- Use `reply.send()` before async DB operations (fire-and-forget linking)
- Webhook registration (setWebhook) — called only on settings save, not hot path
- No additional DB queries in existing hot paths

## Security Hardening

- HMAC-SHA256 for webhook secret prevents forged requests
- Always return 200 — prevents information leakage via HTTP status codes
- Client UUID in deep link (not phone number) — prevents enumeration
- Rate limiting on webhook endpoints — prevents abuse
- Webhook payloads validated with Zod schemas

## Technical Debt Items

- [ ] Max deep link mechanism needs API documentation verification
- [ ] Consider webhook health monitoring (alert if no webhooks received in 24h when bot is configured)
- [ ] Consider storing webhook registration status in DB for admin visibility
