# Git Workflow

## Commit Format
```
type(scope): description
```

## Types
- feat: New feature
- fix: Bug fix
- refactor: Code restructuring (no behavior change)
- test: Adding/updating tests
- docs: Documentation changes
- chore: Build, CI, config changes

## Rules
- Commit after each logical change
- Never combine unrelated changes in one commit
- Use scope from monorepo package names where applicable (api, admin, pwa)
- Write imperative mood descriptions ("add", not "added")
- Feature branches from `main`
- Squash merge to `main`

## Feature Lifecycle Commits
- After Phase 1: `docs(feature): SPARC planning for <feature-name>`
- After Phase 2: `docs(feature): validation complete for <feature-name>`
- During Phase 3: `feat(<feature-name>): <what changed>`
- After Phase 4: `docs(feature): review complete for <feature-name>`

## Auto-Committed Files (Stop hook)
- `myinsights/` — knowledge base entries
- `.claude/feature-roadmap.json` — feature status updates
- `docs/plans/` — implementation plans
