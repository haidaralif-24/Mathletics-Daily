# Security

## Rules
- RLS on all tables; no direct member writes
- Public signups disabled; accounts created only by the admin API (server, service role). The signup endpoint is reachable with the public anon key, so turning it off in Supabase Auth is mandatory
- Login goes through a server action so Supabase Auth's built-in rate limit applies to every attempt
- Temporary passwords: random, shown once, never stored; forced change at first login (`app_metadata` flag)
- Time that matters (submit time, open window, close) always from the database
- Service role key only in server code and Vercel env vars
- Markdown/LaTeX without raw HTML; Zod on every server action
- Signed URLs (minutes) for private media
- Rate limiting is deferred (about 40 members). Login relies on Supabase Auth's built-in limits (check Authentication > Rate Limits in the dashboard) plus strong random temporary passwords. If abuse appears, add a limiter behind `lib/ratelimit.ts`: per email plus a generous per-IP ceiling (classrooms share Wi-Fi). Never use in-memory counters on serverless
- Deactivating a member also bans the auth user (JWTs live ~1 h)
- Admins excluded from the leaderboard
- Student data (email, name, class, answers, handwriting photos): get school/teacher sign-off, agree a deletion date after the exam (minors' data; Indonesia's PDP rules)

## RLS test checklist (write these first)
Run with a guest/anon client, two member accounts (A, B) and an admin.
- [ ] Anon cannot read an unreleased question, any key, any mark scheme, any solution before close
- [ ] Anon cannot read `profiles`, `submissions`, `grades`
- [ ] Member A cannot read B's submission, photos, grade or feedback
- [ ] Member cannot update any `profiles` column (`role`, `active`, `display_name`, `class_name`) and cannot clear `must_change_password`
- [ ] Member cannot insert/update `submissions` directly
- [ ] Final answer cannot change after first submit; `first_submitted_at` cannot change
- [ ] Submit after `closes_at` or before `release_at` is rejected
- [ ] Deactivated member cannot submit
- [ ] Photo path with another user's id is rejected
- [ ] Grade is invisible to the member until the question has closed
- [ ] `leaderboard()` returns no answers or feedback and excludes admins and inactive members
- [ ] Admin can read and grade everything
- [ ] `auth.signUp` with the anon key is rejected (public signups disabled)
- [ ] A newly created auth user gets a `profiles` row with role = member, never admin
