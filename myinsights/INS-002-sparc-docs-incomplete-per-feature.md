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

### Prevention (pipeline changes needed)

1. **Add doc count gate to `/go` and `/run` pipelines:**
```
BEFORE implementation phase:
  CHECK docs/features/{name}/sparc/ has >= 5 files:
    PRD.md, Specification.md, Pseudocode.md, Architecture.md, Refinement.md
  IF missing → generate before proceeding
  BLOCK implementation until gate passes
```

2. **Update `/run` loop to include doc validation:**
```
After doc generation, before implementation:
  count = ls docs/features/{name}/sparc/*.md | wc -l
  IF count < 5:
    WARN "Only {count}/5 SPARC docs — generating missing"
    Generate remaining docs
```

3. **Add SPARC doc checklist to `feature-lifecycle.md`:**
```markdown
### Mandatory SPARC Documents (no exceptions)
- [ ] PRD.md
- [ ] Specification.md
- [ ] Pseudocode.md
- [ ] Architecture.md
- [ ] Refinement.md
```

4. **Consider template-based generation** — Pre-fill section headers for each doc type so the AI has structure to follow, reducing the chance of skipping docs.

## Error Signatures

`SPARC docs incomplete`, `missing Architecture.md`, `missing Refinement.md`, `only 2 docs`, `only 3 docs`, `feature docs incomplete`, `INS-007 violation`

## Related

- INS-001: Same pattern — autonomous execution pressure causes quality shortcuts
- `.claude/rules/feature-lifecycle.md`: Has skip rules but no enforcement
- `docs/features/*/sparc/`: All 8 feature directories affected
