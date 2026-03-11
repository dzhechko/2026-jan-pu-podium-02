# [INS-006] Fastify DELETE 400 with empty JSON body

**Date:** 2026-03-11
**Status:** 🟢 Active
**Severity:** 🟡 Medium
**Tags:** `fastify`, `api`, `frontend`, `content-type`
**Hits:** 0

## Error Signatures
```
FST_ERR_CTP_EMPTY_JSON_BODY
Body cannot be empty when content-type is set to 'application/json'
HTTP/1.1 400 Bad Request
```

## Symptoms
DELETE requests from frontend return 400 Bad Request. The browser sends `Content-Type: application/json` header but no body. Fastify's JSON parser rejects the empty body.

## Diagnostic Steps
1. Checked API logs — found `FST_ERR_CTP_EMPTY_JSON_BODY` error
2. Traced to `apiClient` in `packages/admin/src/lib/api.ts` which always sets `Content-Type: application/json`
3. Confirmed DELETE requests have no body but still get the header

## Root Cause
The shared `apiClient` function unconditionally sets `Content-Type: application/json` on all requests. Fastify's built-in JSON content type parser requires a non-empty body when this header is present. DELETE requests have no body → 400 error.

## Solution
1. Only set `Content-Type: application/json` when `options.body` is present:
```typescript
const headers: Record<string, string> = {
  ...(options.body ? { 'Content-Type': 'application/json' } : {}),
  ...(options.headers as Record<string, string>),
};
```

## Prevention
- Never set `Content-Type: application/json` on requests without a body (GET, DELETE, HEAD)
- Consider adding an integration test for DELETE endpoints
- Review shared HTTP client wrappers for method-specific header handling

## Related
- Fastify docs: content type parser behavior
