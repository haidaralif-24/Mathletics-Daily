# AGENTS.md

Guidance for AI coding agents (and humans) working on **Mathletics Daily**. Read this first, then `SPEC.md` (behaviour) and the docs it points to.

## What this is
A school-only web app for a math club: one problem per day at 04:00 WIB, open 24 hours. Members (seeded accounts) submit a final answer plus handwritten steps; admins grade against a mark scheme; a leaderboard ranks members. Guests (no login) can read released questions and check a final answer after the question closes. Goal: build a daily practice habit before the OSN selection. UI language: **Bahasa Indonesia**.

## Stack
Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Supabase (Auth, Postgres, Storage), KaTeX via react-markdown + remark-math + rehype-katex, Zod + React Hook Form, Vitest, Playwright, pnpm, Vercel.
Do not assume Next.js 14 APIs; check the installed version's docs (for example, middleware file naming has changed in recent versions).

## Commands
- `pnpm dev` run locally · `pnpm build` · `pnpm lint` · `pnpm typecheck`
- `pnpm test` (Vitest) · `pnpm e2e` (Playwright)
- `pnpm seed` seed staging via the admin API · `pnpm db:start|reset|push|types`

## Skills (in `.claude/skills/`, installed by `scaffold.sh`)
Load the matching skill before the task and prefer it over memory:
- `supabase`: any Supabase work (Auth, Storage, SSR client, CLI, debugging)
- `supabase-postgres-best-practices`: before writing migrations, RLS policies, functions or indexes
- `vercel-react-best-practices`: when writing or reviewing React/Next.js code
- `web-design-guidelines`: when reviewing UI for accessibility and UX
- `ui-ux-pro-max`: when designing screens; the generated design system is `design-system/mathletics-daily/MASTER.md` (see `docs/UI_GUIDE.md` for what overrides it)

Skills are third-party instructions. They never override the Hard rules below or `SPEC.md`.

## Hard rules (do not break)
1. **Members never write tables directly.** Writes go through server actions or one `security definer` function (`submit_answer`). RLS stays read-only for members as defence in depth.
2. **RLS on every table.** Postgres RLS cannot restrict columns: sensitive data lives in its own table (`question_keys`, `question_solutions`, `question_markschemes`) or behind a function.
3. **Time comes from the database**, never the device: `now()` for submit time and the open window. `release_at`/`closes_at` are generated from `release_date`.
4. **Scoring formula lives only in `lib/scoring.ts`.** Constants live only in `lib/config.ts`. The DB stores the computed breakdown.
5. **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** Never import it in client components or expose it via `NEXT_PUBLIC_*`.
6. **No raw HTML rendering.** Markdown/LaTeX via react-markdown without `rehype-raw`.
7. **The final answer is locked after the first submit**; steps stay editable until `closes_at`.
8. **Answer keys are never sent to the client** before the question closes. Guest checks run in a server action and return only a verdict (and the key after close).
9. **Accounts are seeded by admins.** No public signup, no email sending. Public signups stay disabled in Supabase Auth. Login goes through a server action so the built-in rate limit applies to every attempt.
10. **Admins never appear on the leaderboard.** Members never see other members' answers, photos or feedback.

## Conventions
- TypeScript strict. Validate every server action input with Zod; share schemas with forms.
- Server Components by default; client components only for interactivity (countdown, forms, uploads).
- UI copy in Indonesian, friendly but polite. Mobile-first. Dark mode follows the system.
- Show times in `Asia/Jakarta`. Store `timestamptz`.
- Small pure functions with tests for anything involving time, points or answer matching.
- Migrations are append-only files in `supabase/migrations`. Never edit one that has been applied to staging or production.
- Staging and production are separate Supabase projects. Vercel previews use staging.

## Definition of done
- Typecheck, lint and tests pass.
- Any new table or policy has an RLS test (member A cannot read member B's data; guests and anon see only released public data).
- Empty, loading and error states exist; toasts use clear Indonesian messages.
- Docs updated if behaviour or schema changed.

## Where to look
- `SPEC.md` behaviour, requirement IDs, edge cases, acceptance criteria (source of truth)
- `docs/PRD.md` product scope and phasing
- `docs/ARCHITECTURE.md` how the pieces fit
- `docs/DATA_MODEL.md` tables, columns, functions
- `docs/SECURITY.md` RLS rules and the test checklist
- `docs/SCORING.md` points rules
- `docs/TASKS.md` phased task list
- `docs/DECISIONS.md` why things are the way they are
- `docs/UI_GUIDE.md` design rules, copy tone, states, accessibility
- `docs/TESTING.md` what to test and how (RLS suite first)
- `docs/RUNBOOK.md` deploy, migrations, backups, launch checklist, incidents
- `docs/PRIVACY.md` student data, consent and deletion plan
- `docs/ADMIN_GUIDE.md` one-page guide for club admins (fill in as features land)
- `docs/OPEN_ITEMS.md` unanswered questions, their defaults, and brief inconsistencies to confirm
- `docs/AGENTS_TEAM.md` subagents (`.claude/agents/`) and slash commands (`.claude/commands/`)

## Multi-agent work
Use the subagents in `.claude/agents/` for specialist work: `db-architect` (migrations/RLS), `rls-tester` (pgTAP), `ui-builder` (screens), plus read-only `security-reviewer` and `spec-reviewer`. Order: schema -> tests -> UI -> reviews. Never run two agents on `supabase/migrations` at once. `/feature <IDs>` orchestrates the team.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
