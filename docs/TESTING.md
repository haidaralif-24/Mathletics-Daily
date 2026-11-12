# Testing

Most acceptance criteria are security criteria, so the **RLS isolation suite comes first**.

| Layer | Tool | Command | Covers |
| --- | --- | --- | --- |
| Unit | Vitest | `pnpm test` | `lib/scoring.ts`, `lib/time.ts`, `lib/answers.ts` |
| Database / RLS | pgTAP in `supabase/tests` | `pnpm db:test` | Every policy and function (checklist in `docs/SECURITY.md`) |
| End to end | Playwright | `pnpm e2e` | Login -> submit -> admin grades -> leaderboard |
| Performance / a11y | Lighthouse (mobile) | manual on a preview | Today's question: Performance >= 85, Accessibility >= 90 |
| Manual | Real devices | see below | Photo upload, small screens |

## RLS suite (write before the UI)
Four actors: anon (guest), member A, member B, admin. Cover every item in the checklist in `docs/SECURITY.md`. Add a test whenever a table, policy or function changes. A policy without a test is not done.

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
