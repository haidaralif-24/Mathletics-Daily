---
description: Run security and spec review on the current changes in parallel.
argument-hint: [requirement IDs]
---
Review the uncommitted changes (`git diff`). Run `security-reviewer` and `spec-reviewer` in parallel (requirement IDs for the spec review: $ARGUMENTS, or infer them from the diff). Merge their findings into one list ordered by severity. Do not fix anything unless asked.
