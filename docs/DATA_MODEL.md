# Data model

RLS is enabled on every table. Members have no direct write access to `submissions`, `grades` or `profiles`.

| Table | Key columns | Read | Write |
| --- | --- | --- | --- |
| `profiles` | `id` (auth user), `display_name`, `class_name`, `role` (member/admin), `active`, `must_change_password` | Own row; admin all. Other members' names reach members only through `leaderboard()` | Admin only (name, class, role, active). Members have no direct write |
| `app_settings` | `osn_date` | Logged-in users, through `get_osn_date()` only | Admin |
| `questions` | `release_date` (unique), `release_at`, `closes_at` (generated), `title`, `body_latex`, `image_path`, `topic`, `difficulty` | Anyone if `release_at <= now()`; admin all | Admin |
| `question_keys` | `question_id`, `answer_type`, `accepted_answers[]` | Nobody (service role in server actions; admins see keys through `loadGradingItem`) | Admin |
| `question_markschemes` | `question_id`, `position`, `description_md`, `points` | Admin | Admin |
| `question_solutions` | `question_id`, `solution_md`, `publish_markscheme` | Anyone if `closes_at <= now()`; admin all | Admin |
| `submissions` | `question_id`, `user_id`, `final_answer`, `steps_text`, `step_photo_paths[]`, `first_submitted_at`, `updated_at`, `auto_verdict`; unique (question, user) | Own; admin all | `submit_answer` function only |
| `grades` | `submission_id`, `is_correct`, `base_points`, `speed_points`, `steps_points`, `total_points` (generated), `criteria_ticks` (jsonb), `private_feedback`, `graded_by`, `graded_at`, `needs_regrade` | Own, only after the question closes; admin all | Admin via `saveGrade` |

`must_change_password` is also kept in the auth user's `app_metadata` (written only by the server) so middleware can read it from the JWT without a query. The `changePassword` and `resetPassword` actions keep the column and the metadata in step.

## Functions and triggers
- `submit_answer(question_id, final_answer, steps_text, photo_paths[])`: `security definer`; checks `release_at <= now() < closes_at` and `profiles.active`; validates photo path prefix; requires steps content; first submit inserts and sets `first_submitted_at = now()` and `auto_verdict`; later submits update steps only
- `leaderboard(period)`: `security definer`; active non-admin members only; returns rank, display name, class, total points, correct count, attempted; `period` is overall or the current Mon-Sun week in WIB, grouped by question `release_date`. Tie-break: total points, correct count, earliest average submit time
- `get_osn_date()`: returns only the date
- Trigger on `submissions` update: sets `grades.needs_regrade` if a grade exists
- Trigger on `auth.users` insert: creates the `profiles` row with `role = member`, `active = true`. Admins are promoted afterwards by an admin, the seed script or SQL
- Indexes: `submissions(question_id)`, `submissions(user_id)`, `questions(release_at)`

## Storage
- `question-media`: private; admin write; readable once the question is released
- `submission-media`: private; owner and admin read; short-lived signed URLs; MIME (jpeg, png, webp) and size limits in policy
- No third bucket: guests upload nothing

## Answer types
v1: integer. Add fraction, decimal (tolerance) and text after real sample answers arrive. Normaliser: `lib/answers.ts`.
