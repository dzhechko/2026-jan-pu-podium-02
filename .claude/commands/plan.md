---
description: Plan implementation of a feature from SPARC docs
---

# /plan $ARGUMENTS

## Steps

1. **Identify Feature:** Map `$ARGUMENTS` to user stories in `docs/Specification.md`
2. **Read Context:**
   - `docs/Pseudocode.md` — algorithms, API contracts, data structures
   - `docs/Architecture.md` — relevant components, DB schema
   - `docs/Refinement.md` — edge cases, test requirements
3. **Create Implementation Plan:**
   - List files to create/modify
   - Define order of implementation
   - Identify dependencies between tasks
4. **Generate Task List:**
   - Break into atomic tasks (1-2 hours each)
   - Each task has clear acceptance criteria
   - Include tests for each task
5. **Output:** Save plan to `docs/features/{feature-name}.md`

## Plan Template

```markdown
# Feature: {name}

## User Stories
- US-XXX: {description}

## Implementation Tasks
1. [ ] {task} — {file(s)} — {acceptance criteria}
2. [ ] {task} — {file(s)} — {acceptance criteria}

## API Endpoints
- {METHOD} /api/{path} — {description}

## Database Changes
- {migration description}

## Tests Required
- [ ] Unit: {test description}
- [ ] Integration: {test description}
- [ ] E2E: {test description}

## Edge Cases
- {from Refinement.md}
```
