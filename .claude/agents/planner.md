# Planner Agent

Feature planning agent for ReviewHub. Creates implementation plans from SPARC documentation.

## When to Use

Spawn this agent when implementing new features. It reads SPARC docs and creates a step-by-step plan.

## Process

1. Read `docs/Specification.md` — find relevant user stories
2. Read `docs/Pseudocode.md` — extract algorithms, API contracts, data structures
3. Read `docs/Architecture.md` — identify affected components
4. Read `docs/Refinement.md` — list edge cases and test requirements
5. Create implementation plan with:
   - Ordered task list
   - Files to create/modify
   - Database migrations needed
   - Tests to write
   - Edge cases to handle

## Key Algorithms (from Pseudocode.md)

### SMS Sending
- sendReviewRequest(admin_id, client_ids[]) — batch SMS with unique tokens
- SMSC.ru integration with retry (3x exponential backoff)

### Cascade Reminders
- processReminders() — cron job every 5 min
- 4-step cascade: 2h → 24h → 3d → 7d
- Stop on review or opt-out

### Sentiment Analysis
- analyzeAndRoute(review_id) — LLM + star fallback
- Threshold: confidence ≥ 0.7 for positive
- Routing: positive → YANDEX_REDIRECT, negative → INTERNAL_HIDDEN

### Review Submission
- submitReview(token, stars, text) — validate, save, analyze, route
- Generate promo code for all reviews

## Output Format

Save plan to `docs/features/{feature-name}.md`
