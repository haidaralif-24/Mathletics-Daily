# Agent team

Subagents live in `.claude/agents/`, slash commands in `.claude/commands/`, shared permissions in `.claude/settings.json`. Restart Claude Code after changing them.

| Agent | Role | Edits files? |
| --- | --- | --- |
| `db-architect` | Migrations, RLS, functions, storage policies | Yes (supabase/migrations, docs) |
| `rls-tester` | pgTAP tests from the SECURITY.md checklist | Yes (supabase/tests) |
| `ui-builder` | Screens, forms, KaTeX, copy | Yes (app, components) |
| `security-reviewer` | Review against hard rules | No |
| `spec-reviewer` | Review against SPEC.md IDs | No |

## Commands
- `/feature M-1 M-2` build requirements with the whole team
- `/review` security + spec review of the current diff, in parallel
- `/rls-audit` check test coverage and security before go-live

## Working rules
- Order matters: schema (`db-architect`) -> tests (`rls-tester`) -> UI (`ui-builder`) -> reviews.
- Run in parallel only when file sets are disjoint: several UI screens, or the two reviewers. Never two agents on `supabase/migrations`.
- For parallel features on one repo, use separate git worktrees so agents do not overwrite each other.
- Builders do not review their own work; reviewers never edit.
- Deny rules in `.claude/settings.json` block reading `.env*`, `git push` and `pnpm db:push`. Pushing migrations is a human step (see docs/RUNBOOK.md).
- Models: no agent pins a model, so all use the Claude Code default. To pin one, add a `model:` line to its frontmatter.
