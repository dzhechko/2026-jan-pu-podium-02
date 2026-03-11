# INS-004: SMSC Dev Mode Bypass — Fake SMS Sent Successfully

**Status:** 🟢 Active
**Hits:** 1
**Created:** 2026-03-11

## Problem

SMS reported as "Отправлено: 1, Ошибок: 0" but no actual SMS delivered. SMSC.ru console shows nothing. User receives nothing.

## Error Signatures

- `Отправлено: 1, Ошибок: 0` but no SMS received
- `[SMSC DEV] To:` in API logs
- SMSC.ru console empty

## Root Cause

`SmscService.sendSms()` in `packages/api/src/services/smsc.ts` has a dev-mode guard:

```typescript
if (!this.login || !this.password) {
  console.log(`[SMSC DEV] To: ...`);
  return { success: true, messageId: `dev-${Date.now()}` };
}
```

This returns `success: true` without actually sending. If credentials are empty/missing, it silently fakes success. The app shows "sent" to the admin, but nothing happened.

Additionally, if credentials are set to dummy values like `test`/`test`, the real SMSC.ru API is called but returns an auth error — which was also not surfaced clearly to the user.

## Solution

1. Ensure real SMSC.ru credentials in `packages/api/.env`
2. Dev-mode guard only triggers on empty credentials (correct behavior)
3. When SMSC.ru returns an error, it's properly counted as `failed++` in the service

## Files Affected

- `packages/api/src/services/smsc.ts` — dev mode logic
- `packages/api/.env` — SMSC_LOGIN, SMSC_PASSWORD

## Prevention

Log a clear WARNING when dev-mode SMS is triggered so admins don't confuse it with real delivery.
