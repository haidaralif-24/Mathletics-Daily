@AGENTS.md

# Claude-specific notes
- Read `SPEC.md` before implementing a feature and cite requirement IDs (for example `M-2`, `R-3`) in commits and PRs.
- Skills live in `.claude/skills/` and load at startup: restart Claude Code after installing or updating them (`npx skills update`).
- Work in small steps: one migration or one feature at a time, with tests.
- Before changing schema or policies, read `docs/DATA_MODEL.md` and `docs/SECURITY.md`; update them in the same change.
- When unsure about a product rule, check `docs/PRD.md` and `docs/DECISIONS.md` before inventing behaviour. If still unclear, ask.
- Never paste secrets into files. Use `.env.local` (git-ignored) and `.env.example` for names only.
- For multi-step features use `/feature <requirement IDs>`, and `/review` before merging. Subagents and rules are in `docs/AGENTS_TEAM.md`. Delegate DB work to `db-architect` and UI work to `ui-builder` instead of doing everything in the main session.
