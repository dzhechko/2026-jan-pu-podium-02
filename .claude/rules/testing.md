# Testing Rules: ReviewHub

## Test Framework
- Unit + Integration: Vitest
- E2E: Playwright
- Coverage target: 80%+ on business logic

## Test Structure
```
packages/api/tests/
├── unit/          # Pure function tests, mocked dependencies
├── integration/   # API endpoint tests with test DB
└── e2e/           # Full flow tests
```

## Mocking
- SMSC.ru: always mock (never send real SMS in tests)
- LLM API: mock with deterministic responses
- Database: use test PostgreSQL instance (Docker)
- Redis: use test Redis instance

## What to Test

### Must Test
- Sentiment routing logic (positive/negative/fallback)
- Cascade reminder timing and cancellation
- Auth (registration, login, token refresh, rate limiting)
- Review submission flow (validation, save, analyze, route)
- SMS sending (success, failure, retry)

### Should Test
- CSV import parsing and error handling
- Analytics aggregation
- Promo code generation uniqueness
- Opt-out flow

## BDD Scenarios
Reference `docs/test-scenarios.md` for Gherkin scenarios.
Each scenario should have a corresponding test.
