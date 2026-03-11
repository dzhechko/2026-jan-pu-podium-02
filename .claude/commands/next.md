---
description: Show next features to work on from the project roadmap.
  Quick overview of sprint progress and top suggested tasks.
  $ARGUMENTS: optional — "update" to refresh statuses, or feature-id to mark as done
---

# /next $ARGUMENTS

## Default: Show Next Steps

1. Read `.claude/feature-roadmap.json`
2. Show current sprint progress (% complete)
3. List top 3 suggested next tasks based on priority and dependencies
4. Show any blocking issues
5. Ask which task to start

Format as a brief, actionable list.

## /next update

Review the current codebase state and conversation history:
1. Check which features appear to be implemented (scan for key files)
2. Suggest status updates for features that may be done
3. Apply updates after user confirmation

## /next [feature-id]

Mark a specific feature as done:
1. Update status to `"done"` in `.claude/feature-roadmap.json`
2. Check if this unblocks any dependent features → update to `"next"`
3. Show updated sprint progress
4. Suggest the next feature to work on
