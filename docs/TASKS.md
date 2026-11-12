# Tasks

## P0 (10-16 Nov): gate "go live 16-17 Nov" = RLS tests pass, seeded login works on phones
- [x] Supabase staging + prod projects; disable public signups; buckets — *local only so far; hosted projects + dashboard switch are a human step (docs/RUNBOOK.md)*
- [x] Migration 0001: tables, generated columns, RLS, grants
- [x] `submit_answer`, `leaderboard`, `get_osn_date` functions + triggers (including `auth.users` insert -> `profiles` row, role = member)
- [x] RLS test suite (see docs/SECURITY.md) — *7 files, 261 assertions, PASS on a clean database (`pnpm db:verify`). Mutation-tested: disabling RLS on `submissions` fails 7 of them*
- [x] `scripts/seed.ts`: 2 admins, 5 dummy members, 3 sample questions with keys and mark schemes, a few submissions and grades — *runs green; `SEED_ONLY_ADMINS=1` for production. Run it yourself to get the one-time passwords*
- [x] Login page (via the `signIn` server action), middleware, forced password change (`must_change_password` in `app_metadata`; `changePassword` clears it) — *proxy.ts (Next 16 renamed middleware) + `requireUser`/`requireAdmin`; `signIn` verified over the real auth HTTP endpoint*
- [x] Admin: import members from CSV, temporary passwords shown once, reset password
- [x] Admin: question editor (LaTeX toolbar, live preview, KaTeX parse check), key, mark scheme, image
- [x] Today's question page: countdown, answer form, photo upload with compression, status
- [ ] Guest answer check (after close) + archive — *answer check done; archive is [P1]. The guest page was verified over HTTP: open question and KaTeX render, unreleased question and keys absent*
- [x] Admin grading screen (build early; time-test 20 seeded submissions: under 10 minutes): auto-verdict, mark-scheme ticks, key and mark scheme on screen, feedback, shortcuts, progress — *built; the under-10-minute stopwatch test has NOT been run*
- [x] Basic leaderboard (polling)
- [x] Unit tests: scoring, time, answers (already scaffolded)
- [x] Answer the open items that block go-live (`docs/OPEN_ITEMS.md`) — *defaults applied, see docs/DECISIONS.md 23-35*

### Not verified before go-live (be honest about these)
- [ ] Nothing was rendered in a real browser: no Playwright browser could be
      downloaded in the build environment and no system Chrome exists. So the
      360 px layout, dark mode appearance, the member submit form, the grading
      screen and the leaderboard have **not** been seen rendered — only built,
      typechecked and exercised through HTTP and SQL.
- [ ] Lighthouse mobile (Performance >= 85, Accessibility >= 90): not run.
- [ ] "Grade 20 submissions in under 10 minutes": not timed.
- [ ] Two-account isolation is proven in pgTAP at the SQL layer, never through
      the real PostgREST/Storage HTTP path with two live sessions.
- [ ] `auth.signUp` rejection is not SQL-testable; it rests on `enable_signup =
      false` being set in both hosted projects (docs/RUNBOOK.md step 3).
- [ ] SPEC section 6 "wrong key published" has no re-run mechanism: fixing a key
      does not recompute `auto_verdict`, so an admin must re-confirm verdicts by
      hand. Deliberately cut, not forgotten.

Legend: `[x]` done and verified · `[~]` in progress · `[ ]` not started

## P1 (17-23 Nov, while live)
- [ ] History + feedback
- [ ] Weekly leaderboard tab, streak
- [ ] CSV export (leaderboard, per question)
- [ ] OSN countdown in header (admin setting)
- [ ] Published solutions
- [ ] Playwright e2e: login -> submit -> grade -> leaderboard
- [ ] Lighthouse mobile check on Today's question

## Stabilise (24 Nov - 3 Dec)
- [ ] Bug fixes only; watch login problems; keep grading current

## Later
- [ ] Heatmap + badges · Google sign-in · email OTP (needs SMTP) · push reminders
