# Mathletics Daily

One math problem per day for the school math club, with manual grading and a leaderboard. Built to help students build a daily practice habit before the OSN selection.

## Quick start
```bash
pnpm install
pnpm db:start                   # local Supabase stack (needs Docker)
pnpm seed                       # one admin + one question, no dummy students
pnpm dev
```
Open http://localhost:3000 and sign in with the admin printed by `pnpm seed`.

`.env.local` already points at the local stack. `.env` holds the hosted project's
values — the copy Vercel needs. See `docs/RUNBOOK.md` for the hosted setup.

## Scripts
| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` | Run / build the app |
| `pnpm lint` / `pnpm typecheck` | Static checks |
| `pnpm test` | Unit tests (scoring, time, answer matching) |
| `pnpm e2e` | Playwright end-to-end test |
| `pnpm seed` | Create the admin(s) and the starter data. `SEED_PROFILE` picks how much: `starter` (default here), `demo`, `admins` |
| `pnpm db:test` | Run the pgTAP tests in `supabase/tests` (RLS suite) |
| `pnpm db:verify` | Reset the local database, then run the pgTAP suite. The suite assumes a clean database |
| `pnpm db:types` | Regenerate DB types from the local database |

## Supabase setup (checklist)
1. Create two projects: **staging** and **production**.
2. Auth: **disable public signups**. Accounts are created by admins with the admin API. No SMTP is needed for now.
3. Create private storage buckets `question-media` and `submission-media` — `0001_init.sql` creates them, so apply the migration first.
4. Apply migrations from `supabase/migrations` (`supabase link` then `supabase db push`).
5. Set env vars in Vercel: production values for Production, staging values for Preview.
6. Create the first admins with `SEED_PROFILE=admins SEED_ALLOW_REMOTE=1 pnpm seed`. Keep at least two admins.

## Lost admin access
If every admin loses their password, reset it from the Supabase dashboard (Auth > Users) or via SQL with the service role. Do this only from a trusted machine.

## Changing point weights
Edit `lib/config.ts` (`SCORING`) and run `pnpm test`. The formula lives only in `lib/scoring.ts`.

## Claude Code skills
`scaffold.sh` copies these into `.claude/skills/` (committed, so they show up in review):

| Skill | Source | Use |
| --- | --- | --- |
| `ui-ux-pro-max` | `uipro-cli` (`uipro init --ai claude`) | Screen design, palettes, typography |
| `supabase`, `supabase-postgres-best-practices` | `supabase/agent-skills` | Auth, Storage, migrations, RLS |
| `vercel-react-best-practices`, `web-design-guidelines` | `vercel-labs/agent-skills` | React/Next.js performance, accessibility and UX review |

- Restart Claude Code after installing or updating skills; they load at startup.
- Update: `npx skills update`. Re-run the UI skill: `npx uipro-cli@latest init --ai claude --force`.
- Skills run with full agent permissions: read a `SKILL.md` before trusting it, and review diffs when updating.
- Skipped on a machine without network: `SKIP_SKILLS=1 ./scaffold.sh`. Install later with the commands in `scaffold.sh`.

## Docs
Start with `SPEC.md` (behaviour) and `AGENTS.md` (rules for agents), then `docs/`. Unanswered questions and their defaults: `docs/OPEN_ITEMS.md`.
