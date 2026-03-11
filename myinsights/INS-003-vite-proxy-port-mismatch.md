# INS-003: Vite Proxy Port Mismatch

**Status:** 🟢 Active
**Hits:** 1
**Created:** 2026-03-11

## Problem

When API runs on a non-default port (e.g. 3001 instead of 3000), Vite dev servers for admin and PWA still proxy `/api/*` requests to `localhost:3000`. This causes:
- Admin: XHR errors on registration/login (`POST /api/auth/register` → connection refused)
- PWA: "Ссылка не найдена" on review form (`GET /api/reviews/form/:token` → connection refused, frontend treats as `not_found`)

## Error Signatures

- `XHR POST /api/auth/register` failed
- `Ссылка не найдена` / `not_found` on PWA review page
- `ECONNREFUSED 127.0.0.1:3000`
- Vite proxy returning HTML instead of JSON

## Root Cause

Both `packages/admin/vite.config.ts` and `packages/pwa/vite.config.ts` hardcode proxy target as `http://localhost:3000`. If port 3000 is occupied (e.g. by another Docker container), API starts on a different port but Vite proxies don't follow.

## Solution

Update proxy target in both Vite configs to match actual API port:

```typescript
// packages/admin/vite.config.ts AND packages/pwa/vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:3001', // must match API PORT in .env
    changeOrigin: true,
  },
},
```

## Files Affected

- `packages/admin/vite.config.ts` — proxy target
- `packages/pwa/vite.config.ts` — proxy target
- `packages/api/.env` — PORT value

## Prevention

Consider using an env variable for the API port in Vite configs, or document that all three must be in sync.
