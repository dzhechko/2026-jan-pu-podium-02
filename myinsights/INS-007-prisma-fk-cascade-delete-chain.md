# [INS-007] Prisma FK cascade delete fails across relation chain

**Date:** 2026-03-11
**Status:** 🟢 Active
**Severity:** 🔴 Critical
**Tags:** `prisma`, `database`, `foreign-key`, `cascade`, `delete`
**Hits:** 0

## Error Signatures
```
P2003
Foreign key constraint violated
reviews_client_id_fkey (index)
sms_logs_review_request_id_fkey (index)
PrismaClientKnownRequestError
```

## Symptoms
Deleting a client returns 500 Internal Server Error. First fix resolves one FK but reveals another in the chain: Client → ReviewRequest → SmsLog.

## Diagnostic Steps
1. First 500: `Foreign key constraint violated: reviews_client_id_fkey` — Review table has no cascade on clientId
2. Added `onDelete: Cascade` to Review.client relation
3. Second 500: `Foreign key constraint violated: sms_logs_review_request_id_fkey` — SmsLog has no cascade on reviewRequestId
4. Needed to add cascade to ALL relations in the delete chain

## Root Cause
When adding new FK relations (Review.clientId, Review.reviewRequestId, SmsLog.reviewRequestId), `onDelete: Cascade` was not set. Prisma defaults to `onDelete: Restrict`, which blocks parent deletion if child records exist. The entire chain must have cascades: Client → ReviewRequest (had it) → SmsLog (missing) and Client → Review (missing), ReviewRequest → Review (missing).

## Solution
Add `onDelete: Cascade` to all child relations in the delete chain:
```prisma
// Review model
reviewRequest  ReviewRequest @relation(..., onDelete: Cascade)
client         Client        @relation(..., onDelete: Cascade)

// SmsLog model
reviewRequest  ReviewRequest @relation(..., onDelete: Cascade)
```
Then run `npx prisma db push` to sync.

## Prevention
- When adding new FK relations in schema.prisma, always consider the delete behavior
- Rule: if parent entity "owns" children (client owns their reviews/requests), use `onDelete: Cascade`
- After adding new models/relations, test DELETE operations for parent entities
- Consider adding a schema review checklist that includes cascade behavior

## Related
- [INS-006](INS-006-fastify-delete-empty-json-body.md) — discovered in same debugging session
