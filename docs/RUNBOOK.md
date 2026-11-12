# Runbook

## Current state (12 Nov 2026)
- Code is deployable: typecheck, lint, unit tests and `pnpm build` all pass, and
  the app renders correctly against a seeded local database.
- **The hosted project `sqxqukrjpccphjixgyhr` is still empty** — no tables, no
  buckets. `db push` (step 4) has never run, so a deploy pointing at it shows
  "Gagal memuat soal hari ini" on every page. That is the one blocking step.
- Vercel is not linked yet (`vercel link`), and the env vars in step 5 are unset.
- `pnpm db:reset` / `db:test` need the Supabase CLI to write `~/.supabase`. In a
  sandbox that denies it, use `docker exec supabase_db_mathletics-daily psql`
  for direct SQL instead.

## Environments
| Environment | Supabase project | Vercel |
| --- | --- | --- |
| Staging | staging | Preview deployments (every PR) |
| Production | production | Production (main branch) |

Previews must never point at production data.

## Deploy
1. Open a PR; Vercel builds a preview against staging.
2. Merge to `main`; Vercel deploys to production.
3. Schema changes: add a new file in `supabase/migrations`, run `pnpm db:push` against staging, test, then production. Never edit an applied migration.

## Environment variables (Vercel)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only). Production values for Production, staging values for Preview.

## First go-live, in order

These steps need a human: they touch hosted projects, secrets and real student
data. Nothing here can be done from the repo alone.

Set up once per project (staging first, then production):

1. **Create the Supabase project** (Settings > General for the project ref).
2. **Enable the extensions the migration needs** — nothing to do: `0001_init.sql`
   installs `pgtap` itself, and the buckets are created by the same migration.
3. **Disable public signups**: Authentication > Sign In / Providers > Email >
   turn off *Allow new users to sign up*. This is mandatory — the signup
   endpoint is reachable with the public anon key, and it is the only thing
   stopping self-service accounts (SPEC A-1, `docs/SECURITY.md`). While there,
   set *Minimum password length* to 8 to match `supabase/config.toml`.
4. **Apply the migrations**:
   ```bash
   pnpm dlx supabase link --project-ref <project-ref>
   pnpm dlx supabase db push
   ```
   `db push` is deliberately NOT on the agent allow-list. Run it yourself.
   Confirm both buckets exist afterwards (Storage > `question-media`,
   `submission-media`, both private).

   Without `supabase link` — or when the CLI cannot store its credentials —
   use the wrapper, which takes the database password from the environment:
   ```bash
   DBPW='<database password>' pnpm db:push:remote   # applies supabase/migrations
   DBPW='<database password>' pnpm db:check:remote  # lists the tables that now exist
   ```
   `scripts/remote-db.sh` also takes `sql "<query>"` and `url`. If the direct
   host does not resolve (IPv6-only projects), override `DB_HOST` to the
   session-mode pooler and `DB_USER` to `postgres.<project-ref>`; the header of
   the script spells it out.
5. **Set the Vercel env vars** — Preview gets staging values, Production gets
   production values:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`).
6. **Load data with the seed script** — `SEED_PROFILE` decides how much:
   ```bash
   # staging: one admin + one real question, no dummy students
   SEED_PROFILE=starter SEED_ALLOW_REMOTE=1 pnpm seed
   # production: admins only; write the real questions in the UI
   SEED_PROFILE=admins SEED_ALLOW_REMOTE=1 pnpm seed
   # local development: 5 dummy members, 3 questions, submissions and grades
   SEED_PROFILE=demo pnpm seed
   ```
   Admins are not forced to change the password set in `SEED_ADMIN_PASSWORD`
   (the operator chose it); members always are. `SEED_QUESTION_DATE=YYYY-MM-DD`
   schedules the starter question instead of releasing it immediately.
7. **Import the roster**: sign in as an admin, Kelola Member > Impor CSV
   (`email, full name, class`). Temporary passwords are shown once and are
   downloadable as a CSV — hand them out in person or through the teacher.
   Malformed and duplicate rows are reported without aborting the import.
8. **Schedule the first 7 questions**: as an admin, create one question per
   WIB calendar date for the next 7 days, each with an answer key and a mark
   scheme. The dashboard warns about gaps ("Belum ada soal untuk besok"). A
   draft saved without a key still occupies its date and WILL be released —
   finish each one before its 04:00 WIB release.
   `SEED_PROFILE=starter` already creates the first one, open now, so start from
   tomorrow.
9. **Have both admins log in** and change their passwords, then confirm the
   leaderboard is empty (admins never appear on it).
10. **Smoke-test on a real phone** with one member account: log in with the
    temporary password, change it, submit a photo, confirm the final answer
    locks, and confirm the verdict is hidden until after close.

Then work through the Launch checklist below.

## Launch checklist
- [ ] Public signups disabled in Supabase Auth (both projects)
- [ ] RLS tests pass; two-account isolation checked by hand once
- [ ] At least 2 admins exist and have logged in
- [ ] Roster imported; temporary passwords delivered; members have logged in on a phone
- [ ] Questions scheduled for the next 7 days, each with a key and a mark scheme
- [ ] OSN date set
- [ ] Backup taken (see below)
- [ ] Open items that block go-live are answered or defaulted (`docs/OPEN_ITEMS.md`)
- [ ] School/teacher sign-off on student data recorded (`docs/PRIVACY.md`)

## Capacity and plan
Storage estimate: 40 members x 3 photos x 0.4 MB x 25 days = about 1.2 GB. Default plan: free for staging, one month of Pro for production (the exam raises the stakes; free projects can pause and may have no backups). Check the current free-tier limits before launch.

## Backups
Check your Supabase plan's backup and pausing behaviour. If there are no automatic backups, export before launch and weekly:
```bash
pnpm dlx supabase db dump --linked -f backup.sql
```
Store dumps outside the repo. Photos live in Storage; copy them separately if they matter.

## Daily routine (admin)
- Check the dashboard gap warning: is tomorrow scheduled?
- Grade yesterday's question (no deadline, but points are not visible until then).
- Look for `needs_regrade` flags.

## Incidents
| Problem | Do this |
| --- | --- |
| Nobody can log in | Check Supabase status and Auth settings; confirm public signups did not get re-enabled; check the project is not paused |
| One member cannot log in | Admin resets the password in Kelola Member; check the member is active |
| All admins lost access | Reset a password in the Supabase dashboard (Auth > Users) or via SQL with the service role, from a trusted machine |
| Photo uploads fail | Check Storage bucket policies and size limits; ask the member to retry on a stronger connection |
| Wrong answer key published | Fix the key, re-run the auto-check, have an admin re-confirm affected grades |
| Wrong points on the leaderboard | Re-save the affected grades (totals are recomputed); check `lib/config.ts` was not changed mid-period |
| Bad deploy | Roll back to the previous deployment in Vercel; database migrations need a new corrective migration |

## After the exam
Follow the deletion plan in `docs/PRIVACY.md`: export what the club wants to keep, then delete student data and photos.
