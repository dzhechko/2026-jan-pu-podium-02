# INS-002: SPARC Feature Docs Generated With Only 2-3 of 5 Required Documents

**Status:** Active
**Severity:** High
**Hits:** 1
**First seen:** 2026-03-11

## Problem

When `/run mvp` generates SPARC documentation for each feature before implementation, only 2-3 documents are created per feature instead of the required 5 minimum:

**Expected (SPARC standard):**
1. PRD.md — Product Requirements
2. Specification.md — API contracts, acceptance criteria
3. Pseudocode.md — Algorithms
4. Architecture.md — Component diagrams, data flow, DB schema
5. Refinement.md — Edge cases, testing strategy, security

**Actual:** Most features got only PRD.md + Pseudocode.md (2 docs). Some got 3 (+ Specification.md).

## Root Cause Analysis

1. **`/run mvp` prioritizes speed over completeness** — The autonomous loop commits docs quickly to get to implementation. There is no quality gate checking doc count before proceeding.

2. **`/go` command complexity scoring** routes to `/plan` for simple features, which generates minimal docs. It should enforce SPARC minimum regardless of complexity score.

3. **No hard gate on doc count** — Unlike `/feature` pipeline which has validation (Phase 2, score >= 70), `/run` and `/go` skip the validation phase entirely for speed.

4. **`feature-lifecycle.md` rule is not enforced** — The rule says "ALL features get SPARC documentation, no exceptions" and lists skip rules only for hotfixes/config/deps. But the `/run` pipeline doesn't check compliance before implementation.

5. **Pattern matches INS-001** — Same root pattern as toolkit generation: autonomous execution pressure causes quality shortcuts. SKILL.md orchestrator summaries don't enforce per-artifact quality gates.

## Impact

- Feature documentation is incomplete → harder to onboard/maintain
- Missing Architecture.md = no component diagrams, no DB schema per feature
- Missing Refinement.md = no edge cases documented, no testing strategy
- INS-007 compliance audit would flag all features as incomplete

## Solution

### Immediate (applied)
Manually created all missing Architecture.md + Refinement.md + Specification.md docs for 8 features.

### Prevention — SPARC Completeness Gate (IMPLEMENTED)

Hard gate added to 4 pipeline files. Runs BEFORE implementation, not after.

**Files modified:**
1. `.claude/rules/feature-lifecycle.md` — new "SPARC Completeness Gate" section between Phase 1 and Phase 2
2. `.claude/commands/feature.md` — hard gate after Phase 1, before Phase 2
3. `.claude/commands/go.md` — gate in `/plan` branch (previously had no doc checks at all)
4. `.claude/commands/run.md` — pre-implementation gate + enhanced audit with 7-artifact check

**Gate logic (identical in all 4 files):**
```
AFTER Phase 1 (doc generation) completes:
  missing = []
  FOR doc IN [PRD.md, Specification.md, Pseudocode.md, Architecture.md, Refinement.md]:
    IF NOT exists docs/features/<feature-name>/sparc/{doc}:
      missing.append(doc)

  IF missing is not empty:
    ⛔ BLOCK implementation
    GENERATE missing documents from project context + existing SPARC docs
    COMMIT "docs(feature): complete SPARC docs for <feature-name>"
    RE-CHECK (must pass before proceeding)

  ✅ SPARC Completeness Gate PASSED — 5/5 mandatory docs present
```

### Upstream fix needed: cc-toolkit-generator-enhanced

**The real fix belongs in `cc-toolkit-generator-enhanced`** — the skill that generates `/feature`, `/go`, `/run` commands for new projects. Currently it generates commands WITHOUT the SPARC Completeness Gate, so every new project created by `/replicate` will have the same gap.

**Recommended changes to cc-toolkit-generator-enhanced:**
1. Module `04-generate-p1.md` (commands generation) — include SPARC Completeness Gate in generated `/feature.md` template
2. Module `04-generate-p1.md` — include gate in generated `/go.md` template (especially the `/plan` branch)
3. Module `04-generate-p1.md` — include pre-implementation gate in generated `/run.md` template
4. Module `05-generate-p2.md` (rules generation) — include gate in generated `feature-lifecycle.md` template
5. Add to quality gate checklist: "Generated commands include SPARC Completeness Gate? [REQUIRED]"

**Why this matters:** Without upstream fix, every `/replicate` creates projects with the same doc completeness gap. Fixing it in cc-toolkit-generator-enhanced means ALL future projects get the gate by default.

## Error Signatures

`SPARC docs incomplete`, `missing Architecture.md`, `missing Refinement.md`, `only 2 docs`, `only 3 docs`, `feature docs incomplete`, `INS-007 violation`, `SPARC Completeness Gate FAILED`

## Related

- INS-001: Same pattern — autonomous execution pressure causes quality shortcuts
- `.claude/rules/feature-lifecycle.md`: Now has enforcement via SPARC Completeness Gate
- `.claude/skills/cc-toolkit-generator-enhanced/`: Upstream fix needed
- `docs/features/*/sparc/`: All 8 feature directories were affected, now fixed
