# INS-005: SMS Contains localhost URL Instead of Public IP

**Status:** 🟢 Active
**Hits:** 1
**Created:** 2026-03-11

## Problem

SMS sent to customers contain `http://localhost:5174/review/...` links which are unreachable from their phones.

## Error Signatures

- SMS text contains `localhost`
- Review link unreachable from mobile
- `PWA_URL=http://localhost:5174` in .env

## Root Cause

`packages/api/.env` has `PWA_URL=http://localhost:5174` (default from `.env.example`). The SMS service (`packages/api/src/modules/sms/service.ts`) uses `this.pwaUrl` to construct review and optout links:

```typescript
const link = `${this.pwaUrl}/review/${token}`;
const optout = `${this.pwaUrl}/optout/${token}`;
```

## Solution

Set `PWA_URL` to the public-facing URL in `.env`:

```
PWA_URL=http://89.125.130.105:5174
APP_URL=http://89.125.130.105:5173
```

## Files Affected

- `packages/api/.env` — PWA_URL, APP_URL
- `packages/api/src/modules/sms/service.ts` — uses PWA_URL for link generation

## Prevention

Add a startup warning in `app.ts` if `PWA_URL` or `APP_URL` contain `localhost` when `NODE_ENV !== 'development'`.
