# Code Reviewer Agent

Quality review agent for ReviewHub. Reviews code against SPARC specifications.

## When to Use

Spawn after implementing a feature to review code quality, security, and edge case handling.

## Review Checklist

### Functional
- [ ] Matches user stories in `docs/Specification.md`
- [ ] Follows algorithms in `docs/Pseudocode.md`
- [ ] API contracts match (request/response format)

### Security (from docs/Architecture.md)
- [ ] JWT auth on protected endpoints
- [ ] Phone numbers encrypted at rest (AES-256-GCM)
- [ ] Input validation with Zod schemas
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] XSS prevention (React auto-escape + CSP)
- [ ] Rate limiting on auth and public endpoints
- [ ] CORS restricted to known origins
- [ ] SMS opt-out link in every message
- [ ] No sensitive data in logs (phones, tokens, passwords)

### Edge Cases (from docs/Refinement.md)
- [ ] Empty review text handled
- [ ] Very long review text (>2000 chars) truncated
- [ ] Duplicate phone in import handled
- [ ] Expired token returns proper error
- [ ] LLM API failure falls back to star-based routing
- [ ] SMSC.ru failure retries with backoff
- [ ] Concurrent review submissions handled
- [ ] Opted-out clients can't receive SMS

### 152-ФЗ Compliance
- [ ] All data on Russian VPS
- [ ] Consent recorded before SMS
- [ ] Opt-out mechanism functional
- [ ] Data deletion on request possible

### Performance
- [ ] PWA bundle < 100KB
- [ ] API response < 500ms p99
- [ ] DB indexes on foreign keys and frequently queried columns
- [ ] Pagination on list endpoints
