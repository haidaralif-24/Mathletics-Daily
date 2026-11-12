# Architecture

**Principle:** the browser only reads through RLS. Every write and every secret-touching check runs in a server action.

## Routes
| Route | Who | Notes |
| --- | --- | --- |
| `/` | Guest, member | Today's question. Members see the submit form; guests see the answer-check form |
| `/arsip` | Guest, member | Closed questions, key and solution after close |
| `/login` | Public | Email + password, submitted through the `signIn` server action |
| `/ganti-sandi` | Member | Forced at first login (and after an admin reset); also reachable from Profil |
| `/leaderboard` | Member | Overall + this week; poll every 30-60 s and on focus |
| `/riwayat` | Member | Own submissions, grades, feedback |
| `/profil` | Member | Change password, sign out |
| `/admin/soal` | Admin | Question editor, key, mark scheme |
| `/admin/koreksi` | Admin | Grading screen |
| `/admin/member` | Admin | Import CSV, activate/deactivate, reset password, OSN date |

Middleware protects everything except `/`, `/arsip` and `/login`, and redirects members with `must_change_password` to `/ganti-sandi`. It reads the flag from `app_metadata` in the JWT, so it needs no database query.

## Server actions (server only)
Actions that touch keys, auth users or other members' data use the service role; the rest run with the caller's session.
- `signIn`: login goes through a server action so Supabase Auth's built-in rate limit applies to every attempt
- `changePassword`: checks the session, sets the new password (minimum 8 characters), clears `must_change_password` in `app_metadata` through the admin API and refreshes the session so the JWT drops the flag
- `loadGradingItem`: admin only; returns a submission with the answer key, mark scheme and signed photo URLs (`question_keys` has no client read policy)
- `submitAnswer`: checks session, window and `active`; locks final answer on first submit; saves steps atomically (via the `submit_answer` function)
- `checkGuestAnswer`: reads `question_keys`; returns a verdict only after `closes_at`
- `saveGrade`: admin only; computes points with `lib/scoring.ts`; stores breakdown
- `importMembers`, `resetPassword`: admin only; admin API creates/updates auth users; temporary passwords shown once
- `deactivateMember`: sets `profiles.active = false` and bans the auth user

## Client reads (RLS)
Released questions, own submissions and grades (grades only after close), `leaderboard(period)` function, own profile.

## Photo upload
1. Client compresses (~1600 px, ~250 KB) and uploads to `submission-media/{user_id}/{question_id}/{uuid}.jpg`.
2. Client calls `submitAnswer` with the paths. Orphaned files from failed attempts are harmless.
3. `submit_answer` verifies each path starts with the caller's `user_id`.

## Rendering
`react-markdown` + `remark-math` + `rehype-katex`, no `rehype-raw`. Render on the server where possible. Import `katex/dist/katex.min.css` once in the root layout.

## Environments
Two Supabase projects (staging, production). Vercel previews use staging. No rate-limit store for now (see docs/SECURITY.md). Do not use in-memory counters on serverless.
