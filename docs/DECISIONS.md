# Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | Seeded accounts with email + password, no signup, no SMTP | Internal first; avoids email deliverability work; admin controls who joins |
| 2 | Members cannot write tables directly; writes via server actions / `submit_answer` | RLS cannot restrict columns; keeps time and locks server-side |
| 3 | Final answer locked after first submit; steps editable until close | Stops gaming speed points and brute-forcing the auto-check |
| 4 | Speed measured from first submit | Safe because the final answer is locked |
| 5 | Grading after close, no deadline | Removes edit-after-grade races |
| 6 | Mark scheme as structured criteria; steps bonus = ticked criteria sum | Consistent grading across 2-3 admins, faster |
| 7 | Guests see results only after close | Stops members guessing logged out before submitting |
| 8 | Guests store nothing | Less student-data risk |
| 9 | Polling instead of Realtime | Realtime does not stream views; grade RLS would block events |
| 10 | No Redis / rate-limit store for now | About 40 members; Supabase Auth limits cover login; the guest check reveals the answer after close anyway. In-memory counters do not work on serverless, so add Upstash or a Postgres counter table only if abuse appears |
| 11 | Admins excluded from the leaderboard | They see answer keys |
| 12 | LaTeX authoring with placeholder toolbar + live preview | Admins type formulas; students use photos for steps |
| 13 | Two Supabase projects (staging, prod) | Previews must never touch production data |
| 14 | `release_at`/`closes_at` generated from `release_date` | Windows cannot overlap; warn about gaps instead |
| 15 | Any unique email works as the login identifier | Supabase needs an email-format identifier but never delivers mail to it; students without a school email can still join |
| 16 | Login goes through a server action | Supabase Auth's built-in rate limit then applies to every attempt |
| 17 | `must_change_password` mirrored in `app_metadata` | Middleware reads it from the JWT with no DB query; users cannot edit `app_metadata`; `changePassword` clears it |
| 18 | Name and class are admin-managed; members have no write on `profiles` | Keeps leaderboard names trustworthy and the RLS surface smaller |
| 19 | No attempt cap for guests | The key is revealed after close anyway. If instant feedback is wanted later: 3 attempts per question per IP, accepting that incognito bypasses it |
| 20 | Reminders go through the club WhatsApp group, not push | PWA push and in-app notifications are out of scope for v1 |
| 21 | Brand accent colour is deep navy `#0B1F4D` | The client's colour theme; palette and contrast checks in `docs/UI_GUIDE.md` |
