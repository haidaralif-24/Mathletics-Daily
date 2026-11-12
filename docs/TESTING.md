# Testing

Most acceptance criteria are security criteria, so the **RLS isolation suite comes first**.

| Layer | Tool | Command | Covers |
| --- | --- | --- | --- |
| Unit | Vitest | `pnpm test` | `lib/scoring.ts`, `lib/time.ts`, `lib/answers.ts` |
| Database / RLS | pgTAP in `supabase/tests` | `pnpm db:verify` (reset + test) | Every policy and function (checklist in `docs/SECURITY.md`) |
| End to end | Playwright | `pnpm e2e` | Login -> submit -> admin grades -> leaderboard |
| Performance / a11y | Lighthouse (mobile) | manual on a preview | Today's question: Performance >= 85, Accessibility >= 90 |
| Manual | Real devices | see below | Photo upload, small screens |

## Run the RLS suite on a CLEAN database — always

```bash
pnpm db:verify      # supabase db reset && supabase test db
```

`pnpm db:test` alone is only correct on a database that has just been reset.
The suite builds its own fixtures and asserts exact row counts, so it assumes
empty tables. Run it against a **seeded** database and you get spurious failures
that look like real bugs:

- `duplicate key value violates unique constraint "questions_release_date_key"` —
  the suite inserts a question on today's WIB date, which is also what
  `scripts/seed.ts` creates, so the two collide.
- `have: 14 want: 7` profiles, `have: 3 want: 1` admins — the seed adds 7 users.

None of that means the policies are broken. It fails loudly rather than passing
vacuously, which is the safe direction, but do not go bug-hunting: reset first.
Seed afterwards if you want a database to click around in.

Verified figures on a clean database: **Files=7, Tests=254, PASS**.

The suite is worth trusting because it was mutation-tested: disabling RLS on
`submissions` (`alter table public.submissions disable row level security;`)
makes 7 assertions fail across `01_questions.sql` and `02_submissions.sql`. A
suite that still passes with RLS off would be proving nothing.

## RLS suite (write before the UI)
Four actors: anon (guest), member A, member B, admin. Cover every item in the checklist in `docs/SECURITY.md`. Add a test whenever a table, policy or function changes. A policy without a test is not done.

Layout (`supabase/tests`, run in order, each file a transaction that rolls back):

| File | Covers (docs/SECURITY.md checklist) |
| --- | --- |
| `01_questions.sql` | 1, 16 (read side) + structural guards: RLS on every table, no client write policy, no client grant on `question_keys`/`question_markschemes` |
| `02_submissions.sql` | 3, 5, 7, 8, 9, 10, 11, 12, 14 + `submit_answer` privileges and `user_id = auth.uid()` |
| `03_profiles.sql` | 2, 4, 19 |
| `04_grades.sql` | 3 (feedback), 5 (grades), 13, 16 (grading) |
| `05_functions.sql` | 6, 11 + the "Function privileges" table |
| `06_storage.sql` | 17 |
| `07_auth.sql` | 18 (DB side only), 19 |

Rules that keep the suite honest:
- The runner connects as `postgres`, a superuser with `BYPASSRLS`, so **every** assertion runs after an explicit `set local role anon|authenticated|service_role` plus `set_config('request.jwt.claims', ...)`. Fixtures are created before the first role switch (only superusers can insert into `auth.users`).
- Assert `auth.uid()` is the expected uuid before trusting a "cannot read" result, otherwise a NULL uid makes denial tests pass for the wrong reason.
- Fixture dates are derived from `now()` in `Asia/Jakarta` (open / closed / unreleased questions), so the suite passes at any hour. Questions whose window matters assert their own precondition.
- Expect `42501` (`permission denied`) for `question_keys`/`question_markschemes` (no grant at all) and for client writes to public tables (grant revoked); RLS filters give empty results instead.
- Checklist 18 (`auth.signUp` with the anon key) is an HTTP call to GoTrue, not SQL, so pgTAP cannot cover it. Verify it with the curl probe documented at the bottom of `07_auth.sql`; a stale auth container keeps serving the old config until it is recreated.

## Unit tests to keep green
- Speed points: full at release, half at 12 h, zero at 24 h, never negative, rounded to 1 decimal.
- Window: 04:00 WIB equals 21:00 UTC the day before; open at release, closed exactly at `closes_at`.
- Total capped at 20; steps points count when the answer is wrong.
- Answer matching: spaces and case, `3/4` equals `0.75`, comma decimals, unparseable input is `needs_review`.
- Weekly boundaries (Mon-Sun by `release_date`) and streak by `release_date`.

## E2E
One happy-path test is enough for v1. Seed accounts with `pnpm seed` against **staging**, never production. Install browsers once: `pnpm exec playwright install`.

## Manual checklist before go-live
- [ ] Upload photos from a real iPhone and a low-end Android phone (check HEIC handling and compression)
- [ ] Log in on a phone using the temporary password and change it
- [ ] Grade 20 seeded submissions with the stopwatch running: under 10 minutes
- [ ] A question opens at 04:00 WIB and closes 24 h later without intervention
- [ ] Leaderboard updates within a minute of saving a grade
- [ ] Dark mode and a 360 px screen look right on every page
