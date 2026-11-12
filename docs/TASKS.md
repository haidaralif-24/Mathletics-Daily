# Tasks

## P0 (10-16 Nov): gate "go live 16-17 Nov" = RLS tests pass, seeded login works on phones
- [ ] Supabase staging + prod projects; disable public signups; buckets
- [ ] Migration 0001: tables, generated columns, RLS, grants
- [ ] `submit_answer`, `leaderboard`, `get_osn_date` functions + triggers (including `auth.users` insert -> `profiles` row, role = member)
- [ ] RLS test suite (see docs/SECURITY.md)
- [ ] `scripts/seed.ts`: 2 admins, 5 dummy members, 3 sample questions with keys and mark schemes, a few submissions and grades
- [ ] Login page (via the `signIn` server action), middleware, forced password change (`must_change_password` in `app_metadata`; `changePassword` clears it)
- [ ] Admin: import members from CSV, temporary passwords shown once, reset password
- [ ] Admin: question editor (LaTeX toolbar, live preview, KaTeX parse check), key, mark scheme, image
- [ ] Today's question page: countdown, answer form, photo upload with compression, status
- [ ] Guest answer check (after close) + archive
- [ ] Admin grading screen (build early; time-test 20 seeded submissions: under 10 minutes): auto-verdict, mark-scheme ticks, key and mark scheme on screen, feedback, shortcuts, progress
- [ ] Basic leaderboard (polling)
- [ ] Unit tests: scoring, time, answers (already scaffolded)
- [ ] Answer the open items that block go-live (`docs/OPEN_ITEMS.md`)

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
