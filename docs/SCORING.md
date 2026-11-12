# Scoring

| Part | Rule |
| --- | --- |
| Base | 10 if correct, else 0 |
| Speed | Only if correct: `5 * (1 - elapsed / 24h)`, 1 decimal, minimum 0. `elapsed = first_submitted_at - release_at` |
| Steps | Sum of ticked mark-scheme criteria, 0-5. Counts even if the final answer is wrong |
| Total | base + speed + steps, maximum 20 |

- The formula lives only in `lib/scoring.ts`; constants only in `lib/config.ts`.
- `first_submitted_at` never changes. The final answer is locked after the first submit, so speed points cannot be gamed by submitting a placeholder.
- Admins can edit a saved grade; the total is recomputed and `graded_at` updated.
- A steps edit after grading sets `needs_regrade`.
- Auto-check pre-fills the verdict (`correct`, `wrong`, `needs_review`); the admin confirms or overrides.
- Leaderboard tie-break: total points, then correct count, then earliest average submit time.
- Weeks are Mon-Sun in WIB, grouped by question `release_date`. Streaks count by `release_date`, not by the calendar day of the timestamp.
