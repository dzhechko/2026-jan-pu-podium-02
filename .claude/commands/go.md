---
description: Intelligent feature implementation pipeline. Analyzes complexity and selects
  optimal approach (/plan, /feature, or /feature-ent if available), then executes autonomously
  with parallel agents and frequent commits. Falls back to /feature for complex tasks
  when /feature-ent is not available in this project.
  $ARGUMENTS: feature name, ID, or brief description (optional — defaults to next from roadmap)
---

# /go $ARGUMENTS

## Purpose

One-command feature implementation that automatically selects the right pipeline
based on feature complexity, then executes it without manual confirmations.

> **PROCESS COMPLIANCE — BLOCKING RULES:**
> - MUST use /plan, /feature, or /feature-ent commands — NEVER launch raw Agent tools directly
> - MUST follow the skill chain: /next -> /go -> /plan|/feature|/feature-ent
> - FORBIDDEN: Bypassing the skill chain by spawning parallel agents without commands
> - FORBIDDEN: Batching multiple features into a single commit wave
> - CRITICAL: Each feature MUST get its own plan, validation, and commit sequence

## Step 1: Determine Target Feature

IF $ARGUMENTS is provided:
  - Parse as feature name, roadmap ID, or description
  - Look up in `.claude/feature-roadmap.json` if it matches an ID
ELSE:
  - Run `/next` logic to find the highest-priority `next` feature
  - If no `next` feature found, pick first `planned` feature
  - Confirm selection before proceeding

## Step 2: Analyze Complexity

First, check which pipelines are available:

```
Available pipelines:
✅ /plan              — always available
✅ /feature           — always available
⚠️ /feature-ent       — ONLY if .claude/commands/feature-ent.md exists
                        (generated only when project has DDD docs from idea2prd-manual pipeline)

CHECK: ls .claude/commands/feature-ent.md 2>/dev/null
  → exists: feature_ent_available = true
  → missing: feature_ent_available = false
```

Then evaluate the feature to determine the right pipeline:

| Signal | Score |
|--------|-------|
| Touches ≤3 files | -2 (simple) |
| Touches 4-10 files | 0 (medium) |
| Touches >10 files | +3 (complex) |
| Has external API integration | +2 |
| Requires new database entities | +2 |
| Has cross-bounded-context dependencies | +3 |
| Is a hotfix or minor improvement | -3 |
| Has DDD docs in project (`docs/ddd/`) | +1 (toward /feature-ent) |
| Has Gherkin scenarios for this feature | +1 |
| Estimated implementation < 30 min | -2 |
| Estimated implementation > 2 hours | +3 |

**Decision matrix:**

| Total Score | Pipeline | Rationale |
|-------------|----------|-----------|
| ≤ -2 | `/plan` | Simple task, lightweight plan is enough |
| -1 to +4 | `/feature` | Standard feature, needs SPARC lifecycle |
| ≥ +5 AND feature_ent_available | `/feature-ent` | Complex enterprise feature, full DDD/ADR/C4 lifecycle |
| ≥ +5 AND NOT feature_ent_available | `/feature` | Complex feature but /feature-ent not in this project; use /feature with extra attention to architecture |

## Step 3: Execute Selected Pipeline

### If `/plan` selected:
1. Run `/plan <feature-name>`
2. **SPARC Completeness Gate** (mandatory even for /plan):
   ```
   CHECK docs/features/<feature-name>/sparc/ for 5 mandatory files:
     PRD.md, Specification.md, Pseudocode.md, Architecture.md, Refinement.md
   IF any missing:
     GENERATE missing docs from project context
     COMMIT "docs(feature): complete SPARC docs for <feature-name>"
   ```
3. After plan is saved and SPARC gate passes, implement
4. Use `Task` tool to parallelize independent changes
5. Run tests after implementation
6. Commit and push: `git push origin HEAD`

### If `/feature` selected:
1. Run `/feature <feature-name>` in AUTO mode (no confirmations between phases)
   - Phase 1: PLAN (sparc-prd-mini → docs)
   - Phase 2: VALIDATE (requirements-validator → score ≥70)
   - Phase 3: IMPLEMENT (parallel agents from docs)
   - Phase 4: REVIEW (brutal-honesty-review → fix criticals)
2. Where possible, spawn concurrent tasks:
   - Parallel test writing + implementation
   - Parallel frontend + backend if independent
   - Use swarm of agents for large implementations
3. Commit frequently (after each logical change)
4. Push after each phase: `git push origin HEAD`

### If `/feature-ent` selected (only when feature_ent_available = true):
1. Run `/feature-ent <feature-name>` in AUTO mode
   - Includes DDD analysis, ADR creation, C4 updates
   - Phase 1: PLAN (idea2prd-manual → DDD/ADR/C4/Gherkin)
   - Phase 2: VALIDATE (7 agents, including DDD coherence + ADR consistency)
   - Phase 3: IMPLEMENT (parallel agents per Bounded Context)
   - Phase 4: REVIEW (6 agents, ADR + fitness verification)
2. Same parallelization and commit strategy as `/feature`
3. Push after each phase: `git push origin HEAD`

### If complex feature but `/feature-ent` NOT available:
1. Run `/feature <feature-name>` in AUTO mode (same as standard /feature above)
2. Additionally after Phase 1 (PLAN):
   - Recommend creating manual ADRs in `docs/features/<feature-name>/adr/`
   - Flag architectural concerns for extra review
3. Log warning:
```
⚠️ Complex feature (score: <N>) but /feature-ent not available in this project.
   Using /feature with enhanced attention to architecture.
   Consider: re-generate toolkit with idea2prd-manual for enterprise features.
```

## Step 4: Post-Implementation

1. Update `.claude/feature-roadmap.json`:
   - Set feature status to `done`
   - Update `files` array with actual files touched
2. Commit roadmap update: `git add .claude/feature-roadmap.json && git commit -m "docs(roadmap): mark <feature> as done"`
3. Push: `git push origin HEAD`
4. Report summary:
```
✅ Feature completed: <feature-name>
   Pipeline used: /plan | /feature | /feature-ent | /feature (complex fallback)
   Complexity score: <N>
   Files changed: <count>
   Commits: <count>
   Tests: <passed>/<total>

   Next suggested: /next or /go for the next feature
```

## Parallelization Strategy

- Use `Task` tool for independent subtasks within implementation
- Spawn concurrent agents when feature touches multiple packages/services
- Run tests in parallel with implementation of unrelated components
- Never parallelize tasks that have data dependencies

## Git Strategy

- Commit after each logical unit of work (not giant commits)
- Format: `type(scope): description`
- Push to remote after each completed phase to prevent data loss
- If working on a branch: `git push origin HEAD`
