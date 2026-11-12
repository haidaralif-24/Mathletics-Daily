# Security

## Rules
- RLS on all tables. **Client roles (`anon`, `authenticated`) are read-only everywhere**: `supabase/migrations/0001_init.sql` creates no INSERT/UPDATE/DELETE policy for either role, and `anon`/`authenticated` are revoked down to explicit SELECTs. Where a column must stay hidden but the table is still read by a client, the grant is per column — currently only `submissions`, whose grant omits `auto_verdict` (M-7: RLS filters rows, never columns)
- Writes have two paths only: `submit_answer` (members, `security definer`, callable **only** by `service_role` — the server action passes the verified `p_user_id` and the verdict it computed in `lib/answers.ts`) and server actions holding the service role key (admins authoring questions, grading, managing members). The browser never writes: no client token can reach a write path, not even `submit_answer` (DECISIONS 30)
- Public signups disabled; accounts created only by the admin API (server, service role). The signup endpoint is reachable with the public anon key, so turning it off in Supabase Auth is mandatory (local `supabase/config.toml`: `enable_signup = false`, `minimum_password_length = 8`)
- Login goes through a server action so Supabase Auth's built-in rate limit applies to every attempt
- Temporary passwords: random, shown once, never stored; forced change at first login (`app_metadata` flag)
- Time that matters (submit time, open window, close) always from the database: `now()` against the generated `release_at`/`closes_at`
- Service role key only in server code and Vercel env vars
- Markdown/LaTeX without raw HTML; Zod on every server action
- Signed URLs (minutes) for private media
- Rate limiting is deferred (about 40 members). Login relies on Supabase Auth's built-in limits (check Authentication > Rate Limits in the dashboard) plus strong random temporary passwords. If abuse appears, add a limiter behind `lib/ratelimit.ts`: per email plus a generous per-IP ceiling (classrooms share Wi-Fi). Never use in-memory counters on serverless
- Deactivating a member also bans the auth user (JWTs live ~1 h)
- Admins excluded from the leaderboard
- Student data (email, name, class, answers, handwriting photos): get school/teacher sign-off, agree a deletion date after the exam (minors' data; Indonesia's PDP rules)

## Policies in `0001_init.sql`

Every policy is written with an explicit `to anon` / `to authenticated`. Helper predicates (`public.is_admin()`, `public.is_active_member()`) are `security definer` + `stable` + `set search_path = ''`, so they never re-enter profile RLS and cannot be hijacked through `search_path`.

| Table | SELECT policies | INSERT/UPDATE/DELETE policies |
| --- | --- | --- |
| `profiles` | `profiles_select_own` (`auth.uid() = id`), `profiles_select_admin` | none |
| `app_settings` | `app_settings_select_admin` (admin only; members read via `get_osn_date()`) | none |
| `questions` | `questions_select_released` (`anon, authenticated`, `release_at <= now()`), `questions_select_admin` | none |
| `question_keys` | none, and no SELECT grant for client roles: calls fail with `permission denied for table question_keys` rather than returning rows | none |
| `question_markschemes` | none, no SELECT grant for client roles | none |
| `question_solutions` | `question_solutions_select_closed` (`anon, authenticated`, question `closes_at <= now()`), `question_solutions_select_admin` | none |
| `submissions` | `submissions_select_own`, `submissions_select_admin`. NOT a table-wide grant: `authenticated` holds SELECT on every column except `auto_verdict`, so `select auto_verdict` and `select *` fail with `42501 permission denied for table submissions` while the Today page's explicit column list still works. The grant is role-based, so it applies to admins as well: the grading screen must read the verdict with the service-role client (`createSupabaseAdminClient()` in `lib/actions/grading.ts`), never with the admin's own JWT | none (`submit_answer` only) |
| `grades` | `grades_select_own_closed` (own submission **and** question `closes_at <= now()`), `grades_select_admin` | none (service role only) |

`storage.objects` (RLS already enabled by Supabase):

| Bucket | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| `question-media` | `question_media_select_released` (row's question is released), `question_media_select_admin` | `question_media_insert_admin`, `question_media_update_admin`, `question_media_delete_admin` |
| `submission-media` | `submission_media_select_own_or_admin` (folder prefix = `auth.uid()`) | `submission_media_insert_own`, `submission_media_update_own`; no delete policy |

Both buckets are private, MIME-limited to jpeg/png/webp and capped at 8 MB, enforced on the bucket and again in every write policy through `metadata->>'mimetype'` and `(metadata->>'size')::bigint`.

## Function privileges

| Function | `anon` | `authenticated` | `service_role` | Notes |
| --- | --- | --- | --- | --- |
| `submit_answer(...)` | no | **no** | yes | `security definer`; `EXECUTE` is revoked from `public`, `anon` and `authenticated`, so a member calling it gets `42501 permission denied for function submit_answer`. Identity comes from the explicit `p_user_id` a trusted server action passes, never from `auth.uid()` (DECISIONS 30) |
| `leaderboard(period)` | no | yes | yes | aggregates only |
| `get_osn_date()` | no | yes | yes | returns a date only |
| `is_admin()`, `is_active_member()` | no | yes | yes | policy helpers |
| `handle_new_user()`, `flag_needs_regrade()`, `set_updated_at()` | no | no | no | trigger functions, not API surface |

## RLS test checklist (write these first)
Run with a guest/anon client, two member accounts (A, B) and an admin. `question_keys` and `question_markschemes` have no SELECT grant at all, so expect SQLSTATE `42501` (`permission denied`), not an empty result.
- [ ] Anon cannot read an unreleased question, any key, any mark scheme, any solution before close
- [ ] Anon cannot read `profiles`, `submissions`, `grades`
- [ ] Member A cannot read B's submission, photos, grade or feedback
- [ ] Member A can read the granted columns of their own submission (the Today page's column list) but gets `42501` for `auto_verdict` and for `select *` — the verdict stays hidden while the question is open (M-7), and the service role can still read it for the grading screen
- [ ] An admin's own JWT also gets `42501` for `auto_verdict` (the grant is role-based): every verdict read in the app must go through the service-role client
- [ ] Member cannot update any `profiles` column (`role`, `active`, `display_name`, `class_name`) and cannot clear `must_change_password`
- [ ] Member cannot insert/update/delete `submissions` or `grades` directly
- [ ] A member calling `submit_answer` directly gets `42501 permission denied for function submit_answer`: no client-reachable path exists, so a member can neither submit as somebody else nor forge `p_auto_verdict`
- [ ] `submit_answer` rejects an admin ("Admin tidak mengirim jawaban") and a missing `p_user_id` ("Anda harus masuk untuk mengirim jawaban")
- [ ] Member cannot read `app_settings` directly; `get_osn_date()` works and returns only the date
- [ ] Final answer cannot change after first submit; `first_submitted_at` cannot change
- [ ] Submit after `closes_at` ("Soal ini sudah ditutup") or before `release_at` ("Soal ini belum dibuka") is rejected
- [ ] Deactivated member cannot submit (the function re-reads `profiles.active` for `p_user_id`, so the check cannot be skipped by the caller)
- [ ] Blank answer, blank steps (text and photos empty), more than 5 photos and an answer over 500 characters are rejected
- [ ] Photo path with another user's id is rejected
- [ ] `auto_verdict` outside the allowed values becomes `needs_review`; the verdict is always the one the server action computed with `lib/answers.ts`, it is not client-readable before close (M-7, column-level grant) and it never by itself creates points (a `grades` row is what scores)
- [ ] Grade is invisible to the member until the question has closed
- [ ] Editing steps after grading sets `grades.needs_regrade`; the final answer still cannot change
- [ ] `leaderboard()` returns no answers, photos or feedback; excludes admins and inactive members; unknown `period` raises; `total_points` matches the saved grade
- [ ] Admin can read and grade everything (through the service role), including unreleased questions and keys
- [ ] Storage: anon reads only released `question-media`; a member reads only their own `submission-media` and cannot upload into another member's folder, a non-image MIME, or an object over 8 MB
- [ ] Storage writes: an admin can insert, update and delete `question-media` objects; no member can delete in either bucket (tested with the storage API's `storage.allow_delete_query` guard — `storage.protect_delete` blocks every other direct DELETE with `42501`); only the service role writes objects on behalf of members
- [ ] `auth.signUp` with the anon key is rejected (public signups disabled)
- [ ] A newly created auth user gets a `profiles` row with role = member, never admin
