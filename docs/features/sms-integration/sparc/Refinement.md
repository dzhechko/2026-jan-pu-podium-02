# Refinement: SMS Integration

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Client opted out | Skip, increment failed |
| 2 | Client not found | Skip, increment failed |
| 3 | SMSC.ru API timeout | SmsLog status = FAILED |
| 4 | SMSC.ru returns error | SmsLog status = FAILED, error logged |
| 5 | SMSC credentials not configured | Dev mode: log to console |
| 6 | Empty client_ids array | 400 validation error |
| 7 | Duplicate review request for same client | Allowed (new token each time) |
| 8 | Client belongs to different admin | findFirst with adminId filter → null → skip |

## Security

- Phone decrypted in-memory only for SMS sending
- Phone masked in SmsLog ("+790****67")
- Message preview truncated to 100 chars in DB
- SMSC credentials from env vars, never logged

## Testing Strategy

### Unit Tests
- SmscService: dev mode returns success
- ReviewRequestService: sends to non-opted-out clients
- ReviewRequestService: skips opted-out clients
- ReviewRequestService: creates SmsLog for each attempt

### Integration Tests
- POST /api/review-requests with valid clients → sent count
- POST /api/review-requests with opted-out → failed count
- GET /api/review-requests → paginated list
- GET /api/review-requests?status=SMS_SENT → filtered

### Mock Requirements
- SMSC.ru API: always mock in tests (never send real SMS)

## Performance

- Sequential sends per client (could be parallelized with batch limit of 50)
- DB writes per client: 2 (ReviewRequest create + SmsLog create)
- SMSC.ru API: ~200ms per call
