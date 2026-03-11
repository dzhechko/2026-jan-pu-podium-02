# [INS-012] Telegram webhook requires uploading self-signed certificate

**Date:** 2026-03-11
**Status:** 🟢 Active
**Severity:** 🔴 Critical
**Tags:** `telegram`, `webhook`, `ssl`, `deployment`
**Hits:** 0

## Error Signatures
```
Bad Request: bad webhook: An HTTPS URL must be provided for webhook
Webhook was set
pending_update_count: 0
telegramChatId undefined
has_tg: false
```

## Symptoms
Telegram webhook is registered successfully (`"Webhook was set"`) but bot never receives `/start` messages. Clients subscribe to the bot but `telegramChatId` is never saved. Sending via Telegram fails and falls back to SMS.

## Diagnostic Steps
1. `getWebhookInfo` shows `has_custom_certificate: false` — Telegram can't verify our self-signed cert
2. Telegram requires either:
   - A valid CA-signed certificate (Let's Encrypt, etc.)
   - A self-signed certificate uploaded via `setWebhook` API
3. Our server uses a self-signed cert for an IP address (no domain)
4. Without uploading the cert, Telegram silently drops all webhook requests

## Root Cause
Telegram Bot API validates SSL when delivering webhook updates. With a self-signed certificate:
- If the cert is NOT uploaded: Telegram can't verify the server → silently drops all updates
- If the cert IS uploaded: Telegram accepts the cert and delivers updates

The `setWebhook` call succeeds either way — the error is silent. `getWebhookInfo` shows `has_custom_certificate: false` as the only hint.

## Solution
1. Mount the SSL cert into the API container:
```yaml
# docker-compose.prod.yml
api:
  volumes:
    - ./nginx/ssl/selfsigned.crt:/app/ssl/selfsigned.crt:ro
```

2. Send the certificate when registering webhook (multipart/form-data):
```typescript
const formData = new FormData();
formData.append('url', webhookUrl);
formData.append('secret_token', secret);
formData.append('allowed_updates', JSON.stringify(['message']));
formData.append('certificate', new Blob([certData]), 'cert.pem');

await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  body: formData,
});
```

3. Verify: `getWebhookInfo` should show `has_custom_certificate: true`

4. After webhook registration, clients must re-subscribe (`/start`) to the bot

## Prevention
- After any SSL cert change, re-register all Telegram webhooks
- Always check `getWebhookInfo` → `has_custom_certificate` after registration
- Monitor `pending_update_count` — if it grows but updates aren't delivered, cert issue
- Consider using Let's Encrypt with a domain instead of self-signed certs for production

## Related
- [INS-009](INS-009-docker-monorepo-hoisted-deps.md) — Docker deployment
- [INS-010](INS-010-prisma-alpine-openssl3.md) — SSL/deployment
