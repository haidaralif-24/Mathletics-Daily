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
