# Data model

RLS is enabled on every table. **Client roles (`anon`, `authenticated`) are read-only everywhere**: the migration creates no INSERT/UPDATE/DELETE policy for either role, and table privileges are revoked down to the SELECTs listed below — per column where a column has to stay hidden (only `submissions`, see M-7). Writes go through server actions holding the service role key: admins authoring questions, grading and managing members, and members' own submits through `submit_answer`, which no client token can call (DECISIONS 30). Admins never write from the browser.

Migration: `supabase/migrations/0001_init.sql`.

| Table | Key columns | Read | Write |
| --- | --- | --- | --- |
| `profiles` | `id` (auth user), `email`, `display_name`, `class_name`, `role` (member/admin), `active`, `must_change_password` | Own row; admin all. Other members' names reach members only through `leaderboard()` | Service role only (name, class, role, active). No client write |
| `app_settings` | `id` (boolean, always `true`), `osn_date` | Admin direct read; everyone else through `get_osn_date()` | Service role only (admin action) |
| `questions` | `release_date` (unique), `release_at`, `closes_at` (generated), `title`, `body_latex`, `image_path`, `topic`, `difficulty` | Anyone if `release_at <= now()`; admin all | Service role only (admin authoring) |
| `question_keys` | `question_id`, `answer_type`, `accepted_answers[]`, `tolerance` | Nobody. No SELECT grant for `anon`/`authenticated`, so even an admin gets `permission denied`; read inside server actions with the service role (`loadGradingItem`) | Service role only |
| `question_markschemes` | `question_id`, `position`, `description_md`, `points`; unique (question, position) | Nobody (same rule as keys) | Service role only |
| `question_solutions` | `question_id`, `solution_md`, `publish_markscheme` | Anyone if the question's `closes_at <= now()`; admin all | Service role only |
| `submissions` | `question_id`, `user_id`, `final_answer`, `steps_text`, `step_photo_paths[]`, `first_submitted_at`, `updated_at`, `auto_verdict`; unique (question, user) | Own column-scoped: `authenticated` is granted SELECT on every column **except `auto_verdict`** (M-7), so a member's own row is readable but `select auto_verdict` and `select *` both fail with `42501`. The grant is role-based, so admins are covered by the same rule and the grading screen reads the verdict with the service-role client | `submit_answer` only (service role; members have no direct write) |
| `grades` | `submission_id`, `is_correct`, `base_points`, `speed_points`, `steps_points`, `total_points` (generated), `criteria_ticks` (jsonb array), `private_feedback`, `graded_by`, `graded_at`, `needs_regrade` | Own, only after the question closes; admin all | Service role only (`saveGrade`) |

`must_change_password` is also kept in the auth user's `app_metadata` (written only by the server) so middleware can read it from the JWT without a query. The `changePassword` and `resetPassword` actions keep the column and the metadata in step. `app_settings` holds exactly one row, inserted by the migration (`insert ... default values`).

## Generated time columns

`questions.release_at` and `closes_at` are stored generated columns derived from `release_date`:

```sql
release_at = (release_date::timestamp + interval '4 hours') at time zone 'Asia/Jakarta'
closes_at  = (release_date::timestamp + interval '28 hours') at time zone 'Asia/Jakarta'
```

`date::timestamp AT TIME ZONE 'Asia/Jakarta'` tells Postgres the wall clock is WIB and returns the `timestamptz` instant. `timezone(text, timestamp)` is `IMMUTABLE` on PostgreSQL 17, so it is legal in a generated column. WIB is UTC+7 with no DST. Verified: `2026-11-10` → `2026-11-09 21:00:00+00`, close `2026-11-10 21:00:00+00`. `closes_at` is written from `release_date` directly (not from `release_at`) so it never depends on another generated column.

## Functions and triggers

All helpers are `security definer`, `stable`, `set search_path = ''`, fully schema-qualified, and `EXECUTE` is revoked from `public`/`anon` unless noted.

- `submit_answer(p_user_id, question_id, final_answer, steps_text, photo_paths[], auto_verdict default null) → uuid`: `security definer`, but `EXECUTE` is revoked from `public`, `anon` and `authenticated` and granted to `service_role` only, so the server action is the single caller and a member calling it directly gets `42501 permission denied for function submit_answer` — see `docs/SECURITY.md` and DECISIONS 30. Identity comes from the explicit `p_user_id` (never `auth.uid()`, which is `NULL` under the service role); a `NULL` id raises "Anda harus masuk untuk mengirim jawaban". Reads the target profile by id and rejects an unknown profile, an inactive one ("Akun Anda tidak aktif") and an admin ("Admin tidak mengirim jawaban", SPEC §3, checked before the window checks). Rejects a window outside `[release_at, closes_at)` ("Soal ini belum dibuka" / "Soal ini sudah ditutup"), a blank or >500-character final answer, empty steps (text and photos both empty), more than 5 photos, and any photo path not under `<p_user_id>/`. First submit inserts with `first_submitted_at = now()` and `auto_verdict`; later submits update only `steps_text`, `step_photo_paths`, `updated_at` and reject a changed final answer ("Jawaban akhir tidak bisa diubah setelah dikirim"). An unknown `auto_verdict` becomes `needs_review`. The verdict itself is computed once, in `lib/answers.ts`, by the action that compared the answer against `question_keys`; the table column is a hint for the grading screen and never adds points on its own — only a `grades` row scores.
- `leaderboard(period text default 'overall') → (rank, user_id, display_name, class_name, total_points, correct_count, attempted, avg_submit_seconds)`: executable by `authenticated` only. Active `role = 'member'` only. `week` = the Mon–Sun WIB week containing today, grouped by `questions.release_date`. Order: total points, correct count, average submit seconds ascending (`nulls last`), display name. Never returns answers, photos or feedback.
- `get_osn_date() → date`: executable by `authenticated` only.
- `is_admin()` / `is_active_member()`: used by policies; `authenticated` only.
- Trigger on `submissions` update: sets `grades.needs_regrade = true` when `steps_text` or `step_photo_paths` changed.
- Trigger on `auth.users` insert: creates the `profiles` row with `role = member`, `active = true`, `must_change_password = true`, `display_name` from `raw_user_meta_data->>'display_name'` or the email local part. Never admin.
- `updated_at` trigger on `profiles`, `app_settings`, `questions`, `submissions`.
- Indexes: `submissions(question_id)`, `submissions(user_id)`, `questions(release_at)`; plus the unique constraints on `submissions(question_id, user_id)`, `questions(release_date)` and `question_markschemes(question_id, position)`.

## Storage

Two private buckets (`public = false`), both limited to `image/jpeg`, `image/png`, `image/webp` and 8 MB per object.

- `question-media`: admin write. Readable by anyone once the matching question is released. `questions.image_path` stores the object path inside the bucket (for example `2026-11-10/diagram.png`), no bucket prefix.
- `submission-media`: the owner writes only under `<auth.uid()>/...`; owner and admin read. Signed URLs (minutes) in the app. Upsert needs insert + select + update, all three are granted.
- No third bucket: guests upload nothing.

## Answer types

v1: integer. Add fraction, decimal (tolerance) and text after real sample answers arrive. Normaliser: `lib/answers.ts`.