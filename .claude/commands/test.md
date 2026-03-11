---
description: Run or generate tests for ReviewHub
---

# /test $ARGUMENTS

## Modes

### No arguments: Run all tests
```bash
cd packages/api && npm test
cd packages/admin && npm test
cd packages/pwa && npm test
```

### With feature name: Generate tests for feature
1. Read `docs/test-scenarios.md` for BDD scenarios
2. Read `docs/Refinement.md` for edge cases
3. Generate test files matching existing test structure
4. Run new tests

## Test Structure

```
packages/api/
├── tests/
│   ├── unit/
│   │   ├── auth.test.ts
│   │   ├── sentiment.test.ts
│   │   └── reminder.test.ts
│   ├── integration/
│   │   ├── api/
│   │   │   ├── auth.test.ts
│   │   │   ├── clients.test.ts
│   │   │   └── reviews.test.ts
│   │   └── setup.ts
│   └── e2e/
│       └── review-flow.test.ts
```

## Testing Standards
- Unit: Vitest, mock external services (SMSC, LLM)
- Integration: Supertest + test PostgreSQL
- E2E: Playwright for admin panel, mobile viewport for PWA
- Coverage target: 80%+ on business logic
