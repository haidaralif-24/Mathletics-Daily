# Runbook

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
5. **Set the Vercel env vars** — Preview gets staging values, Production gets
   production values:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`).
6. **Staging only — load the demo data**:
   ```bash
   pnpm seed          # 2 admins, 5 dummy members, 3 questions with keys and mark schemes
   ```
   It prints every temporary password once. Never run this against production
   with the dummy data.
7. **Production — create just the 2 admins**:
   ```bash
   SEED_ONLY_ADMINS=1 SEED_ALLOW_REMOTE=1 pnpm seed
   ```
   `SEED_ONLY_ADMINS=1` skips the dummy members, sample questions and
   submissions. `SEED_ALLOW_REMOTE=1` is the deliberate guard that lets the
   script touch a non-local project. Both admins land with
   `must_change_password`, so they are forced to set their own password at
   first login.
8. **Import the roster**: sign in as an admin, Kelola Member > Impor CSV
   (`email, full name, class`). Temporary passwords are shown once and are
   downloadable as a CSV — hand them out in person or through the teacher.
   Malformed and duplicate rows are reported without aborting the import.
9. **Schedule the first 7 questions**: as an admin, create one question per
   WIB calendar date for the next 7 days, each with an answer key and a mark
   scheme. The dashboard warns about gaps ("Belum ada soal untuk besok"). A
   draft saved without a key still occupies its date and WILL be released —
   finish each one before its 04:00 WIB release.
10. **Have both admins log in** and change their passwords, then confirm the
    leaderboard is empty (admins never appear on it).
11. **Smoke-test on a real phone** with one member account: log in with the
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
