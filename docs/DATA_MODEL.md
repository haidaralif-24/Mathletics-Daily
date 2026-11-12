# Data model

RLS is enabled on every table. **Client roles (`anon`, `authenticated`) are read-only everywhere**: the migration creates no INSERT/UPDATE/DELETE policy for either role, and table privileges are revoked down to the SELECTs listed below. Writes go through `submit_answer` (members) or through server actions holding the service role key (admins). Admins never write from the browser.

Migration: `supabase/migrations/0001_init.sql`.

| Table | Key columns | Read | Write |
| --- | --- | --- | --- |
| `profiles` | `id` (auth user), `email`, `display_name`, `class_name`, `role` (member/admin), `active`, `must_change_password` | Own row; admin all. Other members' names reach members only through `leaderboard()` | Service role only (name, class, role, active). No client write |
| `app_settings` | `id` (boolean, always `true`), `osn_date` | Admin direct read; everyone else through `get_osn_date()` | Service role only (admin action) |
| `questions` | `release_date` (unique), `release_at`, `closes_at` (generated), `title`, `body_latex`, `image_path`, `topic`, `difficulty` | Anyone if `release_at <= now()`; admin all | Service role only (admin authoring) |
| `question_keys` | `question_id`, `answer_type`, `accepted_answers[]`, `tolerance` | Nobody. No SELECT grant for `anon`/`authenticated`, so even an admin gets `permission denied`; read inside server actions with the service role (`loadGradingItem`) | Service role only |
| `question_markschemes` | `question_id`, `position`, `description_md`, `points`; unique (question, position) | Nobody (same rule as keys) | Service role only |
| `question_solutions` | `question_id`, `solution_md`, `publish_markscheme` | Anyone if the question's `closes_at <= now()`; admin all | Service role only |
| `submissions` | `question_id`, `user_id`, `final_answer`, `steps_text`, `step_photo_paths[]`, `first_submitted_at`, `updated_at`, `auto_verdict`; unique (question, user) | Own; admin all | `submit_answer` function only |
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

- `submit_answer(question_id, final_answer, steps_text, photo_paths[], auto_verdict default null) → uuid`: executable by `authenticated` only. Identity from `auth.uid()`, never a parameter. Rejects missing profile, inactive profile, a window outside `[release_at, closes_at)` ("Soal ini belum dibuka" / "Soal ini sudah ditutup"), a blank or >500-character final answer, empty steps (text and photos both empty), more than 5 photos, and any photo path not under `<uid>/`. First submit inserts with `first_submitted_at = now()` and `auto_verdict`; later submits update only `steps_text`, `step_photo_paths`, `updated_at` and reject a changed final answer ("Jawaban akhir tidak bisa diubah setelah dikirim"). An unknown `auto_verdict` becomes `needs_review`; it never affects points.
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