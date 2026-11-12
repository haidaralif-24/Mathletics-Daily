---
description: Implement a SPEC.md requirement with the agent team. Usage: /feature M-1 M-2 M-3
argument-hint: <requirement IDs>
---
Implement these requirements from SPEC.md: $ARGUMENTS

Plan first, then delegate. Do not do the specialist work yourself.

1. Read SPEC.md, AGENTS.md and the docs the IDs point to. Write a short plan: which parts are DB, UI, or both.
2. If the DB changes: run `db-architect` FIRST and wait for it. Then run `rls-tester` on the result. Only one agent may edit supabase/migrations at a time.
3. When the schema is stable (or if there is no DB change), run `ui-builder`. If the work splits into independent screens, run several `ui-builder` agents in parallel, each given a distinct set of files.
4. When code is done, run `security-reviewer` and `spec-reviewer` in parallel.
5. Fix blockers by sending them back to the owning agent. Finish with `pnpm typecheck && pnpm lint && pnpm test`.
6. Summarise: IDs covered, files changed, open issues. Cite IDs in the commit message.
